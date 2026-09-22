import { describe, expect, it, vi } from 'vitest';
import { VertesiaClient } from './client.js';

describe('external MCP callback requests', () => {
    it('encodes the callback as one query parameter and exchanges code/state in the body', async () => {
        const requests: Request[] = [];
        const client = new VertesiaClient({
            serverUrl: 'https://api.example.com',
            storeUrl: 'https://store.example.com',
            fetch: vi.fn(async () => Response.json({ success: true })),
            onRequest: (request) => requests.push(request.clone()),
        });
        const redirect_uri = 'https://customer.example/callback?flow=mcp&view=connections';
        await client.remoteMcpConnections.authorize('installation', 'collection', { redirect_uri });
        const url = new URL(requests[0].url);
        expect(url.searchParams.get('redirect_uri')).toBe(redirect_uri);
        expect([...url.searchParams.keys()]).toEqual(['redirect_uri']);
        await client.remoteMcpConnections.exchange('authorization-code', 'transaction-state');
        expect(await requests[1].json()).toEqual({ code: 'authorization-code', state: 'transaction-state' });
    });

    it('forwards callback registration and explicit revocation through installation settings', async () => {
        const requests: Request[] = [];
        const client = new VertesiaClient({
            serverUrl: 'https://api.example.com',
            storeUrl: 'https://store.example.com',
            fetch: vi.fn(async () => Response.json({})),
            onRequest: (request) => requests.push(request.clone()),
        });
        await client.apps.updateInstallationSettings({
            app_id: 'installation',
            oauth_redirect_uris: ['https://customer.example/callback'],
        });
        await client.apps.updateInstallationSettings({ app_id: 'installation', oauth_redirect_uris: [] });
        expect(await requests[0].json()).toEqual({
            app_id: 'installation',
            oauth_redirect_uris: ['https://customer.example/callback'],
        });
        expect(await requests[1].json()).toEqual({ app_id: 'installation', oauth_redirect_uris: [] });
    });
});
