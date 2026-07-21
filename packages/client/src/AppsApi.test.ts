import { describe, expect, it, vi } from 'vitest';
import { VertesiaClient } from './client.js';

describe('AppsApi repository files', () => {
    it('returns the original response bytes and content type', async () => {
        const requests: Request[] = [];
        const bytes = new Uint8Array([0, 255, 10, 42]);
        const fetchMock = vi.fn(
            async () =>
                new Response(bytes, {
                    status: 200,
                    headers: { 'content-type': 'application/octet-stream' },
                }),
        );
        const client = new VertesiaClient({
            serverUrl: 'https://studio.example.com',
            storeUrl: 'https://zeno.example.com',
            fetch: fetchMock,
            onRequest: (request) => requests.push(request),
        });

        const response = await client.apps.getRepoFile('sample-app', 'docs/file.bin', { ref: 'feature/demo' });

        expect(response.headers.get('content-type')).toBe('application/octet-stream');
        expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
        expect(requests[0]?.url).toBe(
            'https://studio.example.com/api/v1/apps/sample-app/repo/file?path=docs%2Ffile.bin&ref=feature%2Fdemo',
        );
    });

    it('uploads multiple documents as one multipart commit request', async () => {
        const requests: Request[] = [];
        const fetchMock = vi.fn(async () =>
            Response.json({
                ref: 'main',
                previous_commit: '1'.repeat(40),
                commit: '2'.repeat(40),
                paths: ['docs/guide.md', 'docs/diagram.png'],
            }),
        );
        const client = new VertesiaClient({
            serverUrl: 'https://studio.example.com',
            storeUrl: 'https://zeno.example.com',
            fetch: fetchMock,
            onRequest: (request) => requests.push(request),
        });

        const result = await client.apps.commitRepoDocuments(
            'sample-app',
            [
                { path: 'docs/guide.md', content: new Blob(['# Guide']), fileName: 'guide.md' },
                { path: 'docs/diagram.png', content: new Blob([new Uint8Array([1, 2, 3])]), fileName: 'diagram.png' },
            ],
            { ref: 'main', expectedHead: '1'.repeat(40), message: 'Add docs' },
        );

        expect(result.commit).toBe('2'.repeat(40));
        const request = requests[0];
        expect(request?.url).toBe('https://studio.example.com/api/v1/apps/sample-app/repo/documents');
        expect(request?.headers.get('content-type')).toContain('multipart/form-data; boundary=');
        const form = await request?.formData();
        expect(JSON.parse(String(form?.get('metadata')))).toEqual({
            ref: 'main',
            expected_head: '1'.repeat(40),
            message: 'Add docs',
            files: [
                { field: 'file_0', path: 'docs/guide.md' },
                { field: 'file_1', path: 'docs/diagram.png' },
            ],
        });
        expect((form?.get('file_0') as File).name).toBe('guide.md');
        expect((form?.get('file_1') as File).size).toBe(3);
    });
});
