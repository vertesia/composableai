import type { AuthTokenPayload } from '@vertesia/common';
import { Hono } from 'hono';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authorize, createToolServer, ToolCollection } from './sandbox.js';
import { createToolServer as createNodeToolServer } from './server.js';

describe('sandbox SDK', () => {
    afterEach(() => vi.unstubAllGlobals());
    const app = createToolServer({
        disableHtml: true,
        tools: [
            new ToolCollection({
                name: 'example',
                tools: [
                    {
                        name: 'echo',
                        description: 'echo',
                        input_schema: { type: 'object', properties: {} },
                        run: async (_input, context) => ({ is_error: false, content: context.token }),
                    },
                ],
            }),
        ],
    });
    const claims = { account: { id: 'a' }, project: { id: 'p' }, endpoints: {} } as AuthTokenPayload;
    const body = JSON.stringify({ tool_use: { id: '1', tool_name: 'echo', tool_input: {} } });
    it('binds non-secret host claims without giving tools a bearer token', async () => {
        const response = await app.request(
            'https://example.test/api/tools',
            {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body,
            },
            { sandboxSession: claims },
        );
        expect(await response.json()).toMatchObject({ content: 'sandbox', is_error: false });
    });
    it('rejects a valid bearer without host claims while retaining Node bearer auth', async () => {
        const { privateKey, publicKey } = await generateKeyPair('RS256');
        const issuer = 'https://sandbox-review.vertesia.io';
        const token = await new SignJWT({ ...claims })
            .setProtectedHeader({ alg: 'RS256' })
            .setIssuer(issuer)
            .setExpirationTime('1h')
            .sign(privateKey);
        const jwksFetch = vi.fn(async () => Response.json({ keys: [await exportJWK(publicKey)] }));
        vi.stubGlobal('fetch', jwksFetch);
        const request = {
            method: 'POST',
            headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
            body,
        };
        expect((await app.request('https://example.test/api/tools', request)).status).toBe(401);
        expect(jwksFetch).not.toHaveBeenCalled();
        const bound = await app.request('https://example.test/api/tools', request, { sandboxSession: claims });
        expect(await bound.json()).toMatchObject({ content: 'sandbox' });
        expect(jwksFetch).not.toHaveBeenCalled();

        const nodeApp = createNodeToolServer({
            disableHtml: true,
            tools: [
                new ToolCollection({
                    name: 'example',
                    tools: [
                        {
                            name: 'echo',
                            description: 'echo',
                            input_schema: { type: 'object', properties: {} },
                            run: async (_input, context) => ({ is_error: false, content: context.token }),
                        },
                    ],
                }),
            ],
        });
        const nodeResponse = await nodeApp.request('https://example.test/api/tools', request);
        expect(await nodeResponse.json()).toMatchObject({ content: token });
        expect(jwksFetch).toHaveBeenCalledOnce();
    });
    it('exports a sandbox-only authorizer and keeps public discovery available', async () => {
        const direct = new Hono();
        direct.get('/', async (ctx) => ctx.json({ token: (await authorize(ctx)).token }));
        expect(
            (
                await direct.request('https://example.test/', {
                    headers: { Authorization: 'Bearer guest-credential' },
                })
            ).status,
        ).toBe(401);
        expect((await app.request('https://example.test/api')).status).toBe(200);
    });
    it('does not accept a session supplied through HTTP headers', async () => {
        const response = await app.request('https://example.test/api/tools', {
            method: 'POST',
            headers: { 'content-type': 'application/json', toolAuthSession: 'forged' },
            body,
        });
        expect(response.status).toBe(401);
    });
});
