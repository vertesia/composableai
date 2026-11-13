import { describe, expect, it, vi } from 'vitest';
import { VertesiaClient } from './client.js';

function clientRecording(requests: Request[]): VertesiaClient {
    return new VertesiaClient({
        serverUrl: 'https://api.example.com',
        storeUrl: 'https://store.example.com',
        fetch: vi.fn(async () => Response.json({ access_token: 'token' })),
        onRequest: (request) => requests.push(request),
    });
}

describe('OAuthProvidersApi.getToken', () => {
    it('asks for the default scopes with an empty body', async () => {
        const requests: Request[] = [];
        expect(await clientRecording(requests).oauthProviders.getToken('provider-1')).toEqual({
            access_token: 'token',
        });
        expect(requests[0].method).toBe('POST');
        expect(new URL(requests[0].url).pathname).toBe('/api/v1/oauth-providers/provider-1/token');
        expect(await requests[0].json()).toEqual({});
    });

    it('sends the requested scope', async () => {
        const requests: Request[] = [];
        await clientRecording(requests).oauthProviders.getToken('provider-1', {
            scope: 'https://contoso.sharepoint.com/.default',
        });
        expect(await requests[0].json()).toEqual({ scope: 'https://contoso.sharepoint.com/.default' });
    });
});
