import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
    ComputeRunFacetsResponse,
    ContentQueryPayload,
    ContentQueryResult,
    ListUserGroupsQuery,
    RegisterPendingAskRequest,
    SendEmailRequest,
    UpdateEmailRouteRequest,
} from '../index.js';
import type {
    RegisterPendingAskRequestSchema,
    SendEmailRequestSchema,
    UpdateEmailRouteRequestSchema,
} from './agent-communication.js';
import type { ContentQueryPayloadSchema, ContentQueryResultSchema } from './content-query.js';
import type { ListUserGroupsQuerySchema } from './group.js';
import type { ComputeRunFacetsResponseSchema } from './interaction.js';
import { validateApiRequest, validateApiResponse } from './registry.js';

describe('agent communication API contracts', () => {
    it('derives public types from the runtime schemas', () => {
        expectTypeOf<SendEmailRequest>().toEqualTypeOf<import('zod').z.infer<typeof SendEmailRequestSchema>>();
        expectTypeOf<UpdateEmailRouteRequest>().toEqualTypeOf<
            import('zod').z.infer<typeof UpdateEmailRouteRequestSchema>
        >();
        expectTypeOf<RegisterPendingAskRequest>().toEqualTypeOf<
            import('zod').z.infer<typeof RegisterPendingAskRequestSchema>
        >();
        expectTypeOf<ContentQueryPayload>().toEqualTypeOf<import('zod').z.infer<typeof ContentQueryPayloadSchema>>();
        expectTypeOf<ContentQueryResult>().toEqualTypeOf<import('zod').z.infer<typeof ContentQueryResultSchema>>();
        expectTypeOf<ComputeRunFacetsResponse>().toEqualTypeOf<
            import('zod').z.infer<typeof ComputeRunFacetsResponseSchema>
        >();
        expectTypeOf<ListUserGroupsQuery>().toEqualTypeOf<import('zod').z.infer<typeof ListUserGroupsQuerySchema>>();
    });

    it('allows only the email route fields the server updates', () => {
        expect(validateApiRequest('UpdateEmailRouteRequest', { threadSubject: 'Subject' }).valid).toBe(true);
        expect(validateApiRequest('UpdateEmailRouteRequest', { projectId: 'project-1' }).valid).toBe(false);
    });

    it('preserves the established user-group filter contract', () => {
        expect(
            validateApiRequest('ListUserGroupsQuery', {
                search: 'admins',
                tags: ['internal'],
                limit: 20,
                offset: 0,
                project: 'project-1',
            }).valid,
        ).toBe(true);
        expect(validateApiRequest('ListUserGroupsQuery', { unsupported: true }).valid).toBe(false);
    });

    it('validates content query requests and results', () => {
        expect(validateApiRequest('ContentQueryPayload', { sql: 'SELECT * FROM content' }).valid).toBe(true);
        expect(validateApiRequest('ContentQueryPayload', { explain: true }).valid).toBe(false);
        expect(
            validateApiResponse('ContentQueryResult', {
                type: 'dsl',
                hits: [{ id: 'object-1', score: 1, source: { name: 'Example' } }],
                total: 1,
            }).valid,
        ).toBe(true);
    });

    it('validates the flat run-facet response returned by the endpoint', () => {
        expect(
            validateApiResponse('ComputeRunFacetsResponse', {
                total: 3,
                statuses: [
                    { _id: 'completed', count: 2 },
                    { _id: null, count: 1 },
                ],
            }).valid,
        ).toBe(true);
        expect(
            validateApiResponse('ComputeRunFacetsResponse', {
                status: [{ _id: 'completed', count: 2 }],
            }).valid,
        ).toBe(false);
        expect(
            validateApiResponse('ComputeRunFacetsResponse', {
                count: { total: 3 },
                facet: { statuses: { buckets: [] } },
            }).valid,
        ).toBe(false);
    });
});
