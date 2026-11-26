import { describe, expect, it } from 'vitest';
import { VertesiaClient } from './client.js';

describe('SharePointLibrariesApi', () => {
    it('merges current project libraries and continues to support the dedicated-only response', async () => {
        const dedicated = { id: 'dedicated' };
        const first = { id: 'first' };
        const second = { id: 'second' };
        let response: { library: { id: string }; libraries?: { id: string }[] } = { library: dedicated };
        const client = new VertesiaClient({
            serverUrl: 'https://api.example.com',
            storeUrl: 'https://api.example.com',
            fetch: async (input, init) => {
                expect(new URL(new Request(input, init).url).pathname).toBe(
                    '/api/v1/sharepoint-onboarding/libraries/current-project',
                );
                return Response.json(response);
            },
        });
        expect(await client.sharepointLibraries.getProjectLibraries()).toEqual([dedicated]);
        response = { library: dedicated, libraries: [first, dedicated, second] };
        expect(await client.sharepointLibraries.getProjectLibraries()).toEqual([dedicated, first, second]);
        expect(await client.sharepointLibraries.getProjectLibrary()).toEqual(dedicated);
    });

    it('sends only the selected project and audience for an existing-project approval', async () => {
        const payload = { project_id: 'aaaaaaaaaaaaaaaaaaaaaaaa', audience: 'mirrored' } as const;
        const client = new VertesiaClient({
            serverUrl: 'https://api.example.com',
            storeUrl: 'https://api.example.com',
            fetch: async (input, init) => {
                const request = new Request(input, init);
                expect(request.method).toBe('POST');
                expect(new URL(request.url).pathname).toBe('/api/v1/sharepoint-onboarding/libraries/binding/approve');
                expect(await request.json()).toEqual(payload);
                return Response.json({ id: 'binding' });
            },
        });
        expect(await client.sharepointLibraries.approveLibrary('binding', payload)).toEqual({ id: 'binding' });
    });
});
