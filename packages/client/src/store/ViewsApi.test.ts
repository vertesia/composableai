import { describe, expect, it, vi } from 'vitest';
import { ZenoClient } from './client.js';

describe('StoreViewsApi', () => {
    it('uses the View execution resource for persisted and draft execution', async () => {
        const requests: Request[] = [];
        const fetchMock = vi.fn(async () => {
            return new Response(JSON.stringify({}), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            });
        });
        const client = new ZenoClient({
            serverUrl: 'https://api.example.com',
            fetch: fetchMock,
            onRequest: (request) => requests.push(request),
        });

        await client.views.execute('app:content:document-library');
        await client.views.preview({
            configuration: {
                name: 'Document library',
                description: 'Browse documents.',
                scope: {},
            },
        });

        expect(requests.map((request) => request.url)).toEqual([
            'https://api.example.com/api/v1/view-executions/app%3Acontent%3Adocument-library/execute',
            'https://api.example.com/api/v1/view-executions/preview',
        ]);
    });
});
