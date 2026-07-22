import { describe, expect, it, vi } from 'vitest';
import { VertesiaClient } from './client.js';

describe('AppsApi', () => {
    it('starts an in-place version rebuild without a caller-controlled payload', async () => {
        const requests: Request[] = [];
        const fetchMock = vi.fn(async () =>
            Response.json({
                workflow_id: 'workflow-1',
                run_id: 'run-1',
                app_id: 'sample-app',
                version_id: 'version-1',
                rebuild_version_record_id: 'record-1',
            }),
        );
        const client = new VertesiaClient({
            serverUrl: 'https://studio.example.com',
            storeUrl: 'https://zeno.example.com',
            fetch: fetchMock,
            onRequest: (request) => requests.push(request),
        });

        const result = await client.apps.rebuildVersion('record-1');

        expect(result.version_id).toBe('version-1');
        expect(requests[0]?.method).toBe('POST');
        expect(requests[0]?.url).toBe('https://studio.example.com/api/v1/apps/versions/record-1/rebuild');
    });

    it('deletes a version through its dedicated endpoint', async () => {
        const requests: Request[] = [];
        const fetchMock = vi.fn(async () =>
            Response.json({
                id: 'record-1',
                app_id: 'sample-app',
                version_id: 'version-1',
                deleted: true,
                warnings: [],
            }),
        );
        const client = new VertesiaClient({
            serverUrl: 'https://studio.example.com',
            storeUrl: 'https://zeno.example.com',
            fetch: fetchMock,
            onRequest: (request) => requests.push(request),
        });

        const result = await client.apps.deleteVersion('record-1');

        expect(result.deleted).toBe(true);
        expect(requests[0]?.method).toBe('DELETE');
        expect(requests[0]?.url).toBe('https://studio.example.com/api/v1/apps/versions/record-1');
    });

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
