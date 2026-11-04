import { expect, it, vi } from 'vitest';
import { VertesiaClient } from './client.js';

it('changes only status through the dedicated endpoint with an encoded client ID', async () => {
    const requests: Request[] = [];
    const client = new VertesiaClient({
        serverUrl: 'https://api.example.com',
        storeUrl: 'https://store.example.com',
        fetch: vi.fn(async () => Response.json({ client_id: 'vts_app', status: 'disabled' })),
        onRequest: (request) => requests.push(request),
    });
    expect((await client.oauthClients.setStatus('app/id', { status: 'disabled' })).status).toBe('disabled');
    expect(requests[0].method).toBe('PUT');
    expect(new URL(requests[0].url).pathname).toBe('/api/v1/oauth-clients/app%2Fid/status');
    expect(await requests[0].json()).toEqual({ status: 'disabled' });
});
