import type { AuditAdoptionQuery, AuditAggregationQuery } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { VertesiaClient } from './client.js';

describe('AuditTrailApi.adoption', () => {
    it('posts usage trends through the typed client', async () => {
        const requests: Request[] = [];
        const client = new VertesiaClient({
            serverUrl: 'https://api.test',
            storeUrl: 'https://store.test',
            apikey: 'token',
            fetch: async (input, init) => {
                requests.push(new Request(input, init));
                return new Response('{}', { headers: { 'content-type': 'application/json' } });
            },
        });
        await client.auditTrail.usage();
        await client.auditTrail.usage({ projectId: 'p' });
        expect(requests[0].url).toBe('https://api.test/api/v1/audit-trail/usage');
        expect(requests[0].method).toBe('POST');
        expect(await requests[0].json()).toEqual({});
        expect(await requests[1].json()).toEqual({ projectId: 'p' });
    });
    it.each([undefined, { projectId: 'project-1' }] as (AuditAdoptionQuery | undefined)[])(
        'posts the default or supplied query to the adoption endpoint',
        async (query) => {
            const requests: Request[] = [];
            const client = new VertesiaClient({
                serverUrl: 'https://api.test',
                storeUrl: 'https://store.test',
                apikey: 'token',
                fetch: async (input, init) => {
                    requests.push(new Request(input, init));
                    return new Response('{}', { headers: { 'content-type': 'application/json' } });
                },
            });

            if (query) await client.auditTrail.adoption(query);
            else await client.auditTrail.adoption();

            expect(requests).toHaveLength(1);
            expect(requests[0].method).toBe('POST');
            expect(requests[0].url).toBe('https://api.test/api/v1/audit-trail/adoption');
            expect(await requests[0].json()).toEqual(query ?? {});
        },
    );
});

describe('AuditTrailApi.aggregateBatch', () => {
    it('posts the queries to the batch endpoint and returns the results in order', async () => {
        const requests: Request[] = [];
        const results = [
            { from: '2026-10-01T00:00:00.000Z', to: '2026-10-31T00:00:00.000Z', rows: [] },
            {
                from: '2026-10-01T00:00:00.000Z',
                to: '2026-10-31T00:00:00.000Z',
                rows: [{ dimensions: { action: 'create' }, metrics: { events: 3 } }],
            },
        ];
        const client = new VertesiaClient({
            serverUrl: 'https://api.test',
            storeUrl: 'https://store.test',
            apikey: 'token',
            fetch: async (input, init) => {
                requests.push(new Request(input, init));
                return new Response(JSON.stringify({ results }), {
                    headers: { 'content-type': 'application/json' },
                });
            },
        });
        const queries: AuditAggregationQuery[] = [
            { metrics: [{ id: 'events', operation: 'count' }] },
            { groupBy: [{ dimension: 'action' }], metrics: [{ id: 'events', operation: 'count' }], limit: 5 },
        ];

        const response = await client.auditTrail.aggregateBatch(queries);

        expect(requests).toHaveLength(1);
        expect(requests[0].method).toBe('POST');
        expect(requests[0].url).toBe('https://api.test/api/v1/audit-trail/aggregate/batch');
        expect(await requests[0].json()).toEqual({ queries });
        expect(response.results).toEqual(results);
    });
});
