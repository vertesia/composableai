import { ApplicationFailure } from '@temporalio/activity';
import { MockActivityEnvironment } from '@temporalio/testing';
import type { VertesiaClient } from '@vertesia/client';
import { ContentEventName, type DSLActivityExecutionPayload } from '@vertesia/common';
import type { ActivityContext } from '../dsl/setup/ActivityContext.js';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeInteraction, type ExecuteInteractionParams } from './executeInteraction.js';

vi.mock('../dsl/setup/ActivityContext.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../dsl/setup/ActivityContext.js')>();
    return { ...actual, setupActivity: vi.fn() };
});

let testEnv: MockActivityEnvironment;

beforeAll(() => {
    testEnv = new MockActivityEnvironment();
});

beforeEach(() => {
    vi.clearAllMocks();
});

const createPayload = (): DSLActivityExecutionPayload<ExecuteInteractionParams> => ({
    auth_token: 'mock-token',
    account_id: 'test-account',
    project_id: 'test-project',
    params: {
        interactionName: 'testInteraction',
        prompt_data: {},
    },
    config: { studio_url: 'http://mock-studio', store_url: 'http://mock-store' },
    workflow_name: 'test-workflow',
    event: ContentEventName.create,
    objectIds: ['test-object-id'],
    input: { inputType: 'objectIds', objectIds: ['test-object-id'] },
    vars: {},
    activity: { name: 'executeInteraction', params: {} },
});

async function mockInteractionError(error: Error & { statusCode?: number; status?: number; code?: number }): Promise<void> {
    const { setupActivity } = await import('../dsl/setup/ActivityContext.js');
    const mockClient = {
        interactions: {
            executeByName: vi.fn().mockRejectedValue(error),
        },
    } as unknown as VertesiaClient;

    vi.mocked(setupActivity).mockResolvedValue({
        client: mockClient,
        inputType: 'objectIds',
        params: createPayload().params,
    } as unknown as ActivityContext<ExecuteInteractionParams>);
}

describe('executeInteraction retryability', () => {
    it('leaves 412 rendition-in-progress failures retryable', async () => {
        await mockInteractionError(Object.assign(new Error('rendition in progress'), { statusCode: 412 }));

        await expect(testEnv.run(executeInteraction, createPayload())).rejects.toMatchObject({
            message: 'Interaction Execution failed testInteraction: rendition in progress',
        });
    });

    it.each([
        ['status', { status: 412 }],
        ['code', { code: 412 }],
    ])('leaves 412 failures retryable when reported as %s', async (_field, statusProps) => {
        await mockInteractionError(Object.assign(new Error('precondition failed'), statusProps));

        await expect(testEnv.run(executeInteraction, createPayload())).rejects.toMatchObject({
            message: 'Interaction Execution failed testInteraction: precondition failed',
        });
    });

    it('marks other 4xx failures as non-retryable', async () => {
        await mockInteractionError(Object.assign(new Error('bad request'), { statusCode: 400 }));

        await expect(testEnv.run(executeInteraction, createPayload())).rejects.toMatchObject({
            nonRetryable: true,
        } satisfies Partial<ApplicationFailure>);
    });
});
