import type { AuditAdoptionQuery } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { VertesiaClient } from './client.js';

describe('AuditTrailApi.adoption', () => {
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
