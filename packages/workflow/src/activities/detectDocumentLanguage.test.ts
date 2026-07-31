import { ApplicationFailure } from '@temporalio/activity';
import { MockActivityEnvironment } from '@temporalio/testing';
import type { VertesiaClient } from '@vertesia/client';
import { ContentEventName, type DSLActivityExecutionPayload } from '@vertesia/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActivityContext } from '../dsl/setup/ActivityContext.js';
import { type DetectDocumentLanguageParams, detectDocumentLanguage } from './detectDocumentLanguage.js';
import { executeInteractionFromActivity } from './executeInteraction.js';

vi.mock('../dsl/setup/ActivityContext.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../dsl/setup/ActivityContext.js')>();
    return { ...actual, setupActivity: vi.fn() };
});

vi.mock('./executeInteraction.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./executeInteraction.js')>();
    return { ...actual, executeInteractionFromActivity: vi.fn() };
});

let testEnv: MockActivityEnvironment;

beforeAll(() => {
    testEnv = new MockActivityEnvironment();
});

beforeEach(async () => {
    vi.clearAllMocks();
    const { setupActivity } = await import('../dsl/setup/ActivityContext.js');
    const params = {} satisfies DetectDocumentLanguageParams;
    const client = {
        objects: {
            retrieve: vi.fn().mockResolvedValue({ text: 'A short document', metadata: {} }),
            update: vi.fn(),
        },
    } as unknown as VertesiaClient;
    vi.mocked(setupActivity).mockResolvedValue({
        client,
        objectId: 'object-1',
        params,
    } as unknown as ActivityContext<DetectDocumentLanguageParams>);
});

function createPayload(): DSLActivityExecutionPayload<DetectDocumentLanguageParams> {
    return {
        auth_token: 'test-token',
        account_id: 'test-account',
        project_id: 'test-project',
        params: {},
        config: { studio_url: 'http://test-studio', store_url: 'http://test-store' },
        workflow_name: 'StandardIntake',
        event: ContentEventName.create,
        objectIds: ['object-1'],
        vars: {},
        activity: { name: 'detectDocumentLanguage', params: {} },
    };
}

describe('detectDocumentLanguage', () => {
    it('should preserve interaction admission deferrals for a durable retry', async () => {
        vi.mocked(executeInteractionFromActivity).mockRejectedValue(
            ApplicationFailure.create({
                message: 'Interaction admission delayed for 5000ms',
                type: 'InteractionRateLimitRetry',
                nonRetryable: false,
                nextRetryDelay: 5_000,
            }),
        );

        await expect(testEnv.run(detectDocumentLanguage, createPayload())).rejects.toMatchObject({
            type: 'InteractionRateLimitRetry',
            nonRetryable: false,
            nextRetryDelay: 5_000,
        });
    });

    it('should remain best-effort for non-capacity interaction failures', async () => {
        vi.mocked(executeInteractionFromActivity).mockRejectedValue(new Error('invalid response'));

        await expect(testEnv.run(detectDocumentLanguage, createPayload())).resolves.toEqual({
            status: 'skipped',
            message: 'detection-failed',
        });
    });
});
