import { describe, expect, it, vi } from 'vitest';
import { VertesiaClient } from './client.js';

describe('ProjectsApi', () => {
    it('encodes app View ids as one path segment', async () => {
        const requests: Request[] = [];
        const fetchMock = vi.fn(async () => {
            return new Response(
                JSON.stringify({
                    id: 'app:content:document-lib',
                    name: 'document-lib',
                    definition: { name: 'Document library' },
                }),
                {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                },
            );
        });
        const client = new VertesiaClient({
            serverUrl: 'https://api.example.com',
            storeUrl: 'https://api.example.com',
            fetch: fetchMock,
            onRequest: (request) => requests.push(request),
        });

        await client.projects.getAppView('project/with/slash', 'app:content:../../environments');

        expect(requests[0]?.url).toBe(
            'https://api.example.com/api/v1/projects/project%2Fwith%2Fslash/app-views/app%3Acontent%3A..%2F..%2Fenvironments',
        );
    });
});
