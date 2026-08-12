import { describe, expect, it } from 'vitest';
import type { AsyncConversationExecutionPayload } from '../interaction.js';
import {
    AsyncConversationExecutionPayloadSchema,
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

describe('run response contracts', () => {
    it('models the arbitrary stored-field projection returned by /runs/find', () => {
        expect(
            FindRunResultSchema.parse({
                id: 'run-1',
                environment: 'env-1',
                account: 'account-1',
                project: 'project-1',
                interaction: 'interaction-1',
                interaction_code: 'sys:Example',
                result: [],
                parameters: { query: 'test' },
            }),
        ).toMatchObject({ environment: 'env-1', account: 'account-1', project: 'project-1' });
    });

    it('models enriched and dynamically named run facet buckets', () => {
        expect(
            ComputeRunFacetsResponseSchema.parse({
                environments: [{ _id: 'env-1', count: 2, name: 'Default' }],
                interactions: [{ _id: 'interaction-1', count: 1, name: 'Example', status: 'published', version: 3 }],
                modelId: [{ _id: 'gpt', count: 2 }],
                total: 2,
            }),
        ).toMatchObject({ total: 2 });
    });
});
