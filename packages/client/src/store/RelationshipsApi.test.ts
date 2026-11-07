import { describe, expect, it, vi } from 'vitest';
import { ZenoClient } from './client.js';

describe('RelationshipsApi', () => {
    it('sends relationship mutations and bounded queries to the expected routes', async () => {
        const requests: Request[] = [];
        const client = new ZenoClient({
            serverUrl: 'https://api.example.com',
            fetch: vi.fn(
                async () =>
                    new Response('{}', {
                        status: 200,
                        headers: { 'content-type': 'application/json' },
                    }),
            ),
            onRequest: (request) => requests.push(request),
        });
        const document = { kind: 'document' as const, id: 'doc-1' };
        const version = { kind: 'document_version' as const, id: 'version-1' };
        const payload = { type: 'related_to', source: document, target: version };

        await client.relationships.create({ ...payload, idempotency_key: 'create-1' });
        await client.relationships.retrieve('rel/1');
        await client.relationships.update('rel/1', { expected_revision: 2, properties: { weight: 1 } });
        await client.relationships.remove('rel/1', { expected_revision: 3 });
        await client.relationships.upsert({ items: [{ idempotency_key: 'item-1', relationship: payload }] });
        await client.relationships.find({ endpoints: [document], direction: 'outgoing', limit: 10 });
        await client.relationships.traverse({ start: [document], steps: [{ direction: 'both' }], max_edges: 20 });
        await client.relationships.reconcile({ document_id: 'doc-1', dry_run: true });
        await client.relationships.valueHints({
            document_id: 'doc-1',
            type_id: 'Vendor',
            config: { fields: ['vendor'] },
        });

        expect(requests.map((request) => [request.method, new URL(request.url).pathname])).toEqual([
            ['POST', '/api/v1/relationships'],
            ['GET', '/api/v1/relationships/rel%2F1'],
            ['PUT', '/api/v1/relationships/rel%2F1'],
            ['DELETE', '/api/v1/relationships/rel%2F1'],
            ['POST', '/api/v1/relationships/upsert'],
            ['POST', '/api/v1/relationships/find'],
            ['POST', '/api/v1/relationships/traverse'],
            ['POST', '/api/v1/relationships/reconcile'],
            ['POST', '/api/v1/relationships/value-hints'],
        ]);
        expect(await requests[0].clone().json()).toEqual({ ...payload, idempotency_key: 'create-1' });
        expect(new URL(requests[3].url).searchParams.get('expected_revision')).toBe('3');
        expect(await requests[4].clone().json()).toEqual({
            items: [{ idempotency_key: 'item-1', relationship: payload }],
        });
        expect(await requests[7].clone().json()).toEqual({ document_id: 'doc-1', dry_run: true });
        expect(await requests[8].clone().json()).toEqual({
            document_id: 'doc-1',
            type_id: 'Vendor',
            config: { fields: ['vendor'] },
        });
    });

    it('generates one create key for retry attempts only when requested by the client policy', async () => {
        const payload = {
            type: 'related_to',
            source: { kind: 'document' as const, id: 'doc-1' },
            target: { kind: 'document_version' as const, id: 'version-1' },
        };
        const requestBodies: string[] = [];
        let attempt = 0;
        const client = new ZenoClient({
            serverUrl: 'https://api.example.com',
            retryPolicy: { attempts: 2, methods: ['POST'], baseDelayMs: 0, jitter: false, idempotencyKeys: true },
            fetch: vi.fn(async (input: RequestInfo) => {
                requestBodies.push(input instanceof Request ? await input.text() : '');
                attempt++;
                return attempt === 1
                    ? new Response('unavailable', { status: 503 })
                    : Response.json({ id: 'relationship-1' });
            }),
        });

        await client.relationships.create(payload);
        expect(requestBodies).toHaveLength(2);
        expect(requestBodies[1]).toBe(requestBodies[0]);
        expect(JSON.parse(requestBodies[0]).idempotency_key).toMatch(/^[0-9a-f-]{36}$/);

        const callerBodies: string[] = [];
        const plainClient = new ZenoClient({
            serverUrl: 'https://api.example.com',
            fetch: vi.fn(async (input: RequestInfo) => {
                callerBodies.push(input instanceof Request ? await input.text() : '');
                return Response.json({ id: 'relationship-2' });
            }),
        });
        await plainClient.relationships.create(payload);
        await plainClient.relationships.create({ ...payload, idempotency_key: 'caller-key' });
        expect(JSON.parse(callerBodies[0])).not.toHaveProperty('idempotency_key');
        expect(JSON.parse(callerBodies[1]).idempotency_key).toBe('caller-key');
    });
});
