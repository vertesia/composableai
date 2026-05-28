import type { ApplicationFailure } from '@temporalio/activity';
import { MockActivityEnvironment } from '@temporalio/testing';
import type { VertesiaClient } from '@vertesia/client';
import { ContentEventName, type DSLActivityExecutionPayload, ExecutionRunStatus } from '@vertesia/common';
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

async function mockInteractionError(
    error: Error & { statusCode?: number; status?: number; code?: number; retryable?: boolean },
): Promise<void> {
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
    it('should forward the execution config object to interaction execution', async () => {
        const { setupActivity } = await import('../dsl/setup/ActivityContext.js');
        const httpTimeout = {
            headersTimeout: 1_000,
            bodyTimeout: 2_000,
            connectTimeout: 300,
        };
        const executeByName = vi.fn().mockResolvedValue({
            id: 'run-id',
            status: ExecutionRunStatus.completed,
            result: [],
        });
        const mockClient = {
            interactions: {
                executeByName,
            },
        } as unknown as VertesiaClient;
        const payload = createPayload();
        const params: ExecuteInteractionParams = {
            ...payload.params,
            config: {
                environment: 'env-id',
                model: 'model-id',
                http_timeout: httpTimeout,
            },
        };

        vi.mocked(setupActivity).mockResolvedValue({
            client: mockClient,
            inputType: 'objectIds',
            params,
        } as unknown as ActivityContext<ExecuteInteractionParams>);

        await expect(testEnv.run(executeInteraction, { ...payload, params })).resolves.toMatchObject({
            runId: 'run-id',
            status: ExecutionRunStatus.completed,
        });

        expect(executeByName).toHaveBeenCalledWith(
            'testInteraction',
            expect.objectContaining({
                config: expect.objectContaining({
                    environment: 'env-id',
                    model: 'model-id',
                    http_timeout: httpTimeout,
                }),
            }),
        );
    });

    it('should leave 412 rendition-in-progress failures retryable', async () => {
        await mockInteractionError(Object.assign(new Error('rendition in progress'), { statusCode: 412 }));

        await expect(testEnv.run(executeInteraction, createPayload())).rejects.toMatchObject({
            message: 'Interaction Execution failed testInteraction: rendition in progress',
        });
    });

    it.each([
        ['status', { status: 412 }],
        ['code', { code: 412 }],
    ])('should leave 412 failures retryable when reported as %s', async (_field, statusProps) => {
        await mockInteractionError(Object.assign(new Error('precondition failed'), statusProps));

        await expect(testEnv.run(executeInteraction, createPayload())).rejects.toMatchObject({
            message: 'Interaction Execution failed testInteraction: precondition failed',
        });
    });

    it('should mark other 4xx failures as non-retryable', async () => {
        await mockInteractionError(Object.assign(new Error('bad request'), { statusCode: 400 }));

        await expect(testEnv.run(executeInteraction, createPayload())).rejects.toMatchObject({
            nonRetryable: true,
        } satisfies Partial<ApplicationFailure>);
    });

    it('should honor explicitly retryable 4xx execution errors', async () => {
        await mockInteractionError(
            Object.assign(new Error('Status: URL_REJECTED-REJECTED_CLIENT_THROTTLED'), {
                statusCode: 400,
                retryable: true,
            }),
        );

        await expect(testEnv.run(executeInteraction, createPayload())).rejects.toMatchObject({
            nonRetryable: false,
        } satisfies Partial<ApplicationFailure>);
    });

    it('should honor explicitly non-retryable execution errors', async () => {
        await mockInteractionError(Object.assign(new Error('provider rejected request'), { retryable: false }));

        await expect(testEnv.run(executeInteraction, createPayload())).rejects.toMatchObject({
            nonRetryable: true,
        } satisfies Partial<ApplicationFailure>);
    });
});
