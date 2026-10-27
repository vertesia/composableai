import type { ImportDataPayload } from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
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

describe('DataApi.import ids', () => {
    const payload: ImportDataPayload = {
        mode: 'append',
        message: 'keyed import',
        tables: { customers: { source: 'inline', data: [{ id: 1 }] } },
    };

    /** Fails the first attempt with a retryable 503 and records the body of every attempt. */
    function createRetryingClient(bodies: string[], idempotencyKeys: boolean) {
        let attempt = 0;
        return new ZenoClient({
            serverUrl: 'https://store.test',
            retryPolicy: { attempts: 3, methods: ['POST'], baseDelayMs: 0, jitter: false, idempotencyKeys },
            fetch: vi.fn(async (input: unknown) => {
                bodies.push(input instanceof Request ? await input.text() : '');
                attempt++;
                return attempt === 1
                    ? new Response('unavailable', { status: 503 })
                    : Response.json({ id: 'import-1', status: 'completed' }, { status: 200 });
            }),
        });
    }

    it('sends one fresh ObjectId on every attempt when the policy asks for idempotency keys', async () => {
        const bodies: string[] = [];
        await createRetryingClient(bodies, true).data.import('store-1', payload);

        expect(bodies).toHaveLength(2);
        expect(bodies[1]).toBe(bodies[0]);
        const importId: string = JSON.parse(bodies[0] ?? '{}').import_id;
        expect(importId).toMatch(/^[0-9a-f]{24}$/);
        expect(Math.abs(Number.parseInt(importId.slice(0, 8), 16) - Date.now() / 1000)).toBeLessThan(60);
    });

    it('keeps a caller ID, and sends none without the opt-in', async () => {
        const keyed: string[] = [];
        const importId = '6aa80a165d561be507124132';
        await createRetryingClient(keyed, true).data.import('store-1', { ...payload, import_id: importId });
        const plain: string[] = [];
        await createRetryingClient(plain, false).data.import('store-1', payload);

        expect(JSON.parse(keyed[0] ?? '{}')).toMatchObject({ import_id: importId });
        expect(JSON.parse(plain[0] ?? '{}')).not.toHaveProperty('import_id');
    });
});
