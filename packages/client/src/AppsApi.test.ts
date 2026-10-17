import type { AppInstallationPayload } from '@vertesia/common';
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
        if (!request) {
            throw new Error('Expected a multipart document request');
        }
        expect(request.url).toBe('https://studio.example.com/api/v1/apps/sample-app/repo/documents');
        expect(request.headers.get('content-type')).toContain('multipart/form-data; boundary=');
        const form = await request.formData();
        expect(JSON.parse(String(form.get('metadata')))).toEqual({
            ref: 'main',
            expected_head: '1'.repeat(40),
            message: 'Add docs',
            files: [
                { field: 'file_0', path: 'docs/guide.md' },
                { field: 'file_1', path: 'docs/diagram.png' },
            ],
        });
        const guideFile = form.get('file_0');
        const diagramFile = form.get('file_1');
        if (!(guideFile instanceof File) || !(diagramFile instanceof File)) {
            throw new Error('Expected multipart file entries');
        }
        expect(guideFile.name).toBe('guide.md');
        expect(diagramFile.size).toBe(3);
    });
});

describe('app installation instance transport', () => {
    it('preserves old install requests and carries optional instance identity separately from settings', async () => {
        const requests: Request[] = [];
        const client = new VertesiaClient({
            serverUrl: 'https://studio.example.com',
            storeUrl: 'https://zeno.example.com',
            fetch: vi.fn(async () => Response.json({ id: 'installation' })),
            onRequest: (request) => requests.push(request),
        });
        await client.apps.install('app', { workspace: 'default' });
        expect(await requests[0].clone().json()).toEqual({ app_id: 'app', settings: { workspace: 'default' } });
        await client.apps.install('app', { workspace: 'eu' }, undefined, undefined, undefined, undefined, undefined, {
            instance_key: 'eu',
            display_name: 'Europe',
            namespace_overrides: { crm: 'crm_eu' },
        });
        expect(await requests[1].clone().json()).toEqual({
            app_id: 'app',
            settings: { workspace: 'eu' },
            instance_key: 'eu',
            display_name: 'Europe',
            namespace_overrides: { crm: 'crm_eu' },
        });
        await client.apps.install(
            'app',
            undefined,
            undefined,
            undefined,
            undefined,
            { crm: { region: 'eu' } },
            { tenant: 'one' },
            { instance_key: 'eu', namespace_overrides: { crm: 'crm_eu' } },
        );
        expect(await requests[2].clone().json()).toEqual({
            app_id: 'app',
            mcp_parameters: { crm: { region: 'eu' } },
            mcp_shared_parameters: { tenant: 'one' },
            instance_key: 'eu',
            namespace_overrides: { crm: 'crm_eu' },
        });
        await client.apps.updateInstallationSettings({
            app_id: 'installation',
            display_name: 'Europe renamed',
            namespace_overrides: { added: 'crm_added' },
        });
        expect(await requests[3].clone().json()).toEqual({
            app_id: 'installation',
            display_name: 'Europe renamed',
            namespace_overrides: { added: 'crm_added' },
        });
        await client.apps.getAppInstallation('installation');
        expect(requests[4].url).toContain('/apps/installations/id/installation');
        await client.apps.setInstallationMcpApiKey('installation', 'crm', 'secret');
        expect(requests[5].url).toContain('/apps/installations/installation/collections/crm/api-key');
    });
});

const mcpParameterUpdates: AppInstallationPayload['mcp_parameters'][] = [
    undefined,
    { graph: { key: 'replacement', region: 'east' } },
    { graph: { key: null } },
];
it.each(mcpParameterUpdates)(
    'forwards MCP settings replacements, clearing and omission: %j',
    async (mcp_parameters) => {
        const requests: Request[] = [];
        const client = new VertesiaClient({
            serverUrl: 'https://api.example.com',
            storeUrl: 'https://store.example.com',
            fetch: vi.fn(async () => Response.json({ id: 'installation-one' })),
            onRequest: (request) => {
                requests.push(request.clone());
            },
        });
        await client.apps.updateInstallationSettings({
            app_id: 'installation-one',
            ...(mcp_parameters === undefined ? {} : { mcp_parameters }),
        });
        const body: unknown = await requests[0].json();
        if (mcp_parameters === undefined) expect(body).not.toHaveProperty('mcp_parameters');
        else expect(body).toMatchObject({ mcp_parameters });
    },
);

it('forwards shared parameter replacements and clears through installation and settings updates', async () => {
    const requests: Request[] = [];
    const client = new VertesiaClient({
        serverUrl: 'https://api.example.com',
        storeUrl: 'https://store.example.com',
        fetch: vi.fn(async () => Response.json({ id: 'installed' })),
        onRequest: (request) => {
            requests.push(request.clone());
        },
    });
    await client.apps.install('app', undefined, undefined, undefined, undefined, undefined, {
        tenant: 'one',
        key: 'private',
    });
    await client.apps.updateInstallationSettings({
        app_id: 'installed',
        mcp_shared_parameters: { tenant: null, key: 'replacement' },
    });
    expect(await Promise.all(requests.map((request) => request.json()))).toEqual([
        { app_id: 'app', mcp_shared_parameters: { tenant: 'one', key: 'private' } },
        { app_id: 'installed', mcp_shared_parameters: { tenant: null, key: 'replacement' } },
    ]);
});
