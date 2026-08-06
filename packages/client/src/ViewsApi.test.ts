import { describe, expect, it, vi } from 'vitest';
import { VertesiaClient } from './client.js';

describe('ViewsApi', () => {
    it('keeps CRUD on Studio and proxies execution to Zeno', async () => {
        const requests: Request[] = [];
        const fetchMock = vi.fn(async () => {
            return new Response(JSON.stringify({}), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            });
        });
        const client = new VertesiaClient({
            serverUrl: 'https://studio.example.com',
            storeUrl: 'https://zeno.example.com',
            fetch: fetchMock,
            onRequest: (request) => requests.push(request),
        });

        await client.views.retrieve('document-library');
        await client.views.execute('document-library');
        await client.views.preview({
            configuration: {
                name: 'Document library',
                description: 'Browse documents.',
                scope: {},
            },
        });

        expect(requests.map((request) => request.url)).toEqual([
            'https://studio.example.com/api/v1/views/document-library',
            'https://zeno.example.com/api/v1/view-executions/document-library/execute',
            'https://zeno.example.com/api/v1/view-executions/preview',
        ]);
    });
});
