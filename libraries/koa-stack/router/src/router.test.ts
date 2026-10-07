import type { AddressInfo } from 'node:net';
import Koa from 'koa';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Router } from './router.js';

describe('versioned endpoint routing', () => {
    let endpoint: string;
    let server: ReturnType<Koa['listen']>;

    beforeAll(async () => {
        const router = new Router().withVersionHeader('x-api-version');
        router.route('GET', '/version-only', async () => ({ selected: 'version-only' }), undefined, {
            version: 20260930,
        });
        router.route('GET', '/coexisting', async () => ({ selected: 'legacy' }));
        router.route('GET', '/coexisting', async () => ({ selected: 'versioned' }), undefined, {
            version: 20260930,
        });
        router.route('POST', '/method-isolated', async () => ({ selected: 'post' }), undefined, {
            version: 20260930,
        });

        const app = new Koa();
        app.use(router.middleware());
        server = app.listen(0, '127.0.0.1');
        await new Promise<void>((resolve, reject) => {
            server.once('listening', resolve);
            server.once('error', reject);
        });
        endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    afterAll(async () => {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    });

    async function request(path: string, version?: string, method = 'GET') {
        return await fetch(`${endpoint}${path}`, {
            method,
            headers: version === undefined ? undefined : { 'x-api-version': version },
        });
    }

    it('dispatches a route that has only an exact requested version', async () => {
        const response = await request('/version-only', '=20260930');

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ selected: 'version-only' });
    });

    it('does not expose a version-only route without a selectable version', async () => {
        expect((await request('/version-only')).status).toBe(404);
        expect((await request('/version-only', '20260929')).status).toBe(404);
        expect((await request('/version-only', '=20260929')).status).toBe(406);
    });

    it('retains range selection for a version-only route', async () => {
        expect(await (await request('/version-only', '20260930')).json()).toEqual({ selected: 'version-only' });
        expect(await (await request('/version-only', '20261001')).json()).toEqual({ selected: 'version-only' });
    });

    it('preserves default and versioned dispatch when both are registered', async () => {
        expect(await (await request('/coexisting')).json()).toEqual({ selected: 'legacy' });
        expect(await (await request('/coexisting', '20260929')).json()).toEqual({ selected: 'legacy' });
        expect(await (await request('/coexisting', '=20260930')).json()).toEqual({ selected: 'versioned' });
        expect((await request('/coexisting', '=20260929')).status).toBe(406);
    });

    it('keeps version selection isolated by method and path', async () => {
        expect((await request('/method-isolated', '=20260930')).status).toBe(405);
        expect(await (await request('/method-isolated', '=20260930', 'POST')).json()).toEqual({ selected: 'post' });
        expect((await request('/version-only/child', '=20260930')).status).toBe(404);
    });
});
