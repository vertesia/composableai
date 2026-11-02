import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import Koa from 'koa';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { Router } from './router.js';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
    const router = new Router('/');
    router.get('/items/:id', async (ctx) => {
        ctx.body = { id: ctx.$router.params.id };
    });
    router.put('/items/:id', async (ctx) => {
        ctx.status = 204;
    });
    router.head('/items/:id', async (ctx) => {
        ctx.status = 200;
    });
    router.post('/items/export', async (ctx) => {
        ctx.status = 204;
    });
    const projects = router.mount('/projects/:projectId');
    projects.get('/objects/:objectId', async (ctx) => {
        ctx.body = { ...ctx.$router.params };
    });
    const app = new Koa();
    app.use(router.middleware());
    server = createServer(app.callback());
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

describe('Router', () => {
    test('answers 405 with the methods the endpoint supports in Allow', async () => {
        const res = await fetch(`${baseUrl}/items/1`, { method: 'DELETE' });

        expect(res.status).toBe(405);
        expect(res.headers.get('allow')?.split(', ').sort()).toEqual(['GET', 'HEAD', 'PUT']);
    });

    test('lists in Allow the methods of every endpoint the path matches', async () => {
        // `/items/export` also matches `/items/:id`, and dispatch serves a request from either.
        const res = await fetch(`${baseUrl}/items/export`, { method: 'PATCH' });

        expect(res.status).toBe(405);
        expect(res.headers.get('allow')?.split(', ').sort()).toEqual(['GET', 'HEAD', 'POST', 'PUT']);
    });

    test('serves a method Allow lists from the less specific endpoint', async () => {
        const res = await fetch(`${baseUrl}/items/export`);

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ id: 'export' });
    });

    test('routes HEAD to a head() endpoint', async () => {
        const res = await fetch(`${baseUrl}/items/1`, { method: 'HEAD' });

        expect(res.status).toBe(200);
    });

    test('decodes a path param once below a parameterized prefix', async () => {
        const res = await fetch(`${baseUrl}/projects/p%201/objects/a%2525b`);

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ projectId: 'p 1', objectId: 'a%25b' });
    });

    test('keeps an encoded slash inside one path param below a parameterized prefix', async () => {
        const res = await fetch(`${baseUrl}/projects/p1/objects/a%2Fb`);

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ projectId: 'p1', objectId: 'a/b' });
    });
});
