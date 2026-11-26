import { expect, it } from 'vitest';
import { VertesiaClient } from './client.js';

it('discovers the region with only the supplied delegated Microsoft Entra access token', async () => {
    const client = new VertesiaClient({
        serverUrl: 'https://api.example.com',
        storeUrl: 'https://api.example.com',
        apikey: 'studio-credential',
        fetch: async (input, init) => {
            const request = new Request(input, init);
            expect(request.url).toBe('https://api.example.com/api/v1/sharepoint-entry/region');
            expect(request.method).toBe('GET');
            expect(request.headers.get('authorization')).toBe('Bearer delegated-entra-token');
            expect(request.body).toBeNull();
            return Response.json({ region: 'eu1' });
        },
    });
    await expect(client.sharepointEntry.discoverRegion('delegated-entra-token')).resolves.toEqual({ region: 'eu1' });
});
