import type { ImportDataPayload } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { ZenoClient } from './client.js';

describe('DataApi', () => {
    // `import` is the name applications built against the 1.4 SDK call, through the client the
    // platform serves them rather than one they bundle -- so renaming it (as 1.5 briefly did, to
    // `importData`) breaks them at deploy time rather than at their next upgrade. This pins both
    // the name and the request it issues.
    it('exposes `import` as POST {store}/import with the data store header', async () => {
        const requests: { url: string; method: string; storeHeader: string | null; body: string }[] = [];
        const fetchImport = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
            const request = new Request(input, init);
            requests.push({
                url: request.url,
                method: request.method,
                storeHeader: request.headers.get('x-data-store-id'),
                body: await request.text(),
            });
            return new Response(JSON.stringify({ id: 'import-1', status: 'completed' }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            });
        };

        const client = new ZenoClient({ serverUrl: 'https://store.test', apikey: 'token', fetch: fetchImport });
        const payload: ImportDataPayload = {
            mode: 'append',
            message: 'test import',
            tables: { customers: { source: 'inline', data: [{ id: 1 }] } },
        };

        const job = await client.data.import('store-1', payload);

        expect(job).toEqual({ id: 'import-1', status: 'completed' });
        expect(requests).toHaveLength(1);
        expect(requests[0].method).toBe('POST');
        expect(requests[0].url).toBe('https://store.test/api/v1/data/store-1/import');
        expect(requests[0].storeHeader).toBe('store-1');
        expect(JSON.parse(requests[0].body)).toEqual(payload);
    });
});
