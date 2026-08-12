import { describe, expect, it } from 'vitest';
import type { AsyncConversationExecutionPayload } from '../interaction.js';
import {
    AsyncConversationExecutionPayloadSchema,
    ComputeRunFacetPayloadSchema,
    ComputeRunFacetsResponseSchema,
    FindRunResultSchema,
} from './interaction.js';

describe('AsyncConversationExecutionPayload contract', () => {
    it('retains an immutable app-version execution target', () => {
        const payload: AsyncConversationExecutionPayload = {
            type: 'conversation',
            interaction: 'sys:AppTester',
            app_version: '20260804T022611971Z',
        };

        expect(AsyncConversationExecutionPayloadSchema.parse(payload)).toMatchObject({
            app_version: '20260804T022611971Z',
        });
    });

    it('rejects a non-string app-version target', () => {
        expect(() =>
            AsyncConversationExecutionPayloadSchema.parse({
                type: 'conversation',
                interaction: 'sys:AppTester',
                app_version: 42,
            }),
        ).toThrow();
    });
});

describe('run facet contracts', () => {
    const facets = [
        { name: 'environments', field: 'environment' },
        { name: 'interactions', field: 'interaction' },
        { name: 'models', field: 'modelId' },
        { name: 'statuses', field: 'status' },
        { name: 'finish_reason', field: 'finish_reason' },
    ];

    it('accepts exactly the supported run facet pairs', () => {
        expect(ComputeRunFacetPayloadSchema.parse({ facets })).toEqual({ facets });
    });

    it.each(['tags', 'created_by', 'start', 'end'])('rejects the removed %s facet', (field) => {
        expect(ComputeRunFacetPayloadSchema.safeParse({ facets: [{ name: field, field }] }).success).toBe(false);
    });

    it('rejects mismatched and additional facet names', () => {
        expect(ComputeRunFacetPayloadSchema.safeParse({ facets: [{ name: 'models', field: 'status' }] }).success).toBe(
            false,
        );
        expect(ComputeRunFacetPayloadSchema.safeParse({ facets: [{ name: 'custom', field: 'modelId' }] }).success).toBe(
            false,
        );
    });

    it('keeps removed facet fields available as query filters', () => {
        const query = {
            tags: ['visible'],
            created_by: 'user:123',
            start: '2026-08-01T00:00:00.000Z',
            end: '2026-08-02T00:00:00.000Z',
        };

        expect(ComputeRunFacetPayloadSchema.parse({ facets: [], query })).toEqual({ facets: [], query });
    });

    it('rejects removed and custom response facets', () => {
        expect(ComputeRunFacetsResponseSchema.safeParse({ tags: [] }).success).toBe(false);
        expect(ComputeRunFacetsResponseSchema.safeParse({ custom: [] }).success).toBe(false);
    });
});

describe('run response contracts', () => {
    it('models the arbitrary stored-field projection returned by /runs/find', () => {
        expect(
            FindRunResultSchema.parse({
                id: 'run-1',
                environment: 'env-1',
                account: 'account-1',
                project: 'project-1',
                interaction: 'interaction-1',
                result: [],
                parameters: { query: 'test' },
            }),
        ).toMatchObject({ environment: 'env-1', account: 'account-1', project: 'project-1' });
    });

    it('does not publish run persistence-only fields', () => {
        expect(() => FindRunResultSchema.parse({ interaction_code: 'sys:Example' })).toThrow();
        expect(() => FindRunResultSchema.parse({ tmp_prompt: [] })).toThrow();
    });

    it('models enriched supported run facet buckets', () => {
        expect(
            ComputeRunFacetsResponseSchema.parse({
                environments: [{ _id: 'env-1', count: 2, name: 'Default' }],
                interactions: [{ _id: 'interaction-1', count: 1, name: 'Example', status: 'published', version: 3 }],
                models: [{ _id: 'gpt', count: 2 }],
                total: 2,
            }),
        ).toMatchObject({ total: 2 });
    });
});
