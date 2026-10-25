import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZenoClient } from './client.js';
import { zenoBulkBaseUrl } from './zeno-bulk.js';

describe('zenoBulkBaseUrl', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('derives zeno-bulk from the store URL when ZENO_BULK_URL is not set', () => {
        vi.stubEnv('ZENO_BULK_URL', '');
        expect(zenoBulkBaseUrl('http://localhost:8092')).toBe('https://zeno-bulk-dev-main.api.dev1.vertesia.io');
        expect(zenoBulkBaseUrl('https://zeno-server-dev-feat.api.dev1.vertesia.io')).toBe(
            'https://zeno-bulk-dev-feat.api.dev1.vertesia.io',
        );
        expect(zenoBulkBaseUrl('https://api.vertesia.io')).toBe('https://api.vertesia.io');
    });

    it('uses ZENO_BULK_URL whatever the store URL, without a trailing slash', () => {
        vi.stubEnv('ZENO_BULK_URL', 'http://127.0.0.1:8207/');
        expect(zenoBulkBaseUrl('http://localhost:8201')).toBe('http://127.0.0.1:8207');
        expect(zenoBulkBaseUrl('https://api.vertesia.io')).toBe('http://127.0.0.1:8207');
    });

    it('sends the bulk export and reindex calls to ZENO_BULK_URL', async () => {
        vi.stubEnv('ZENO_BULK_URL', 'http://127.0.0.1:8207');
        const requests: Request[] = [];
        const client = new ZenoClient({
            serverUrl: 'http://localhost:8201',
            fetch: vi.fn(async () => Response.json({})),
            onRequest: (request) => requests.push(request),
        });

        await client.objects.planContentObjectExportViaBulk(
            {} as Parameters<typeof client.objects.planContentObjectExportViaBulk>[0],
        );
        await client.indexing.swapAlias('tenant', 'target-index');

        expect(requests.map((request) => new URL(request.url).origin)).toEqual([
            'http://127.0.0.1:8207',
            'http://127.0.0.1:8207',
        ]);
    });
});
