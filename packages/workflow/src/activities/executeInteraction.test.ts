import type { ApplicationFailure } from '@temporalio/activity';
import { MockActivityEnvironment } from '@temporalio/testing';
import { ServerError } from '@vertesia/api-fetch-client';
import type { VertesiaClient } from '@vertesia/client';
import { ContentEventName, type DSLActivityExecutionPayload, ExecutionRunStatus } from '@vertesia/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActivityContext } from '../dsl/setup/ActivityContext.js';
import { type ExecuteInteractionParams, executeInteraction } from './executeInteraction.js';

vi.mock('../dsl/setup/ActivityContext.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../dsl/setup/ActivityContext.js')>();
    return { ...actual, setupActivity: vi.fn() };
});

let testEnv: MockActivityEnvironment;
const activityLogger = { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn() };

beforeAll(() => {
    testEnv = new MockActivityEnvironment({}, { logger: activityLogger });
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
            requestSlot: vi.fn().mockResolvedValue({ delay_ms: 0 }),
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
    it('should durably retry before executing when the LLM limiter returns a delay', async () => {
        const { setupActivity } = await import('../dsl/setup/ActivityContext.js');
        const executeByName = vi.fn();
        const mockClient = {
            interactions: {
                requestSlot: vi.fn().mockResolvedValue({ delay_ms: 5_000 }),
                executeByName,
            },
        } as unknown as VertesiaClient;
        vi.mocked(setupActivity).mockResolvedValue({
            client: mockClient,
            inputType: 'objectIds',
            params: createPayload().params,
        } as unknown as ActivityContext<ExecuteInteractionParams>);

        await expect(testEnv.run(executeInteraction, createPayload())).rejects.toMatchObject({
            type: 'InteractionRateLimitRetry',
            nextRetryDelay: 5_000,
            nonRetryable: false,
        } satisfies Partial<ApplicationFailure>);
        expect(executeByName).not.toHaveBeenCalled();
    });

    it('preserves typed API 429 metadata for the activity retry interceptor', async () => {
        const error = new ServerError('quota reached', new Request('https://studio.test/api'), 429, {}, true, {
            reason: 'quota',
            retryAfterMs: 12_345,
            resource: 'genai',
            window: 'quota',
        });
        await mockInteractionError(error);

        await expect(testEnv.run(executeInteraction, createPayload())).rejects.toBe(error);
    });

    it('should convert a provider 429 with Retry-After into a durable retry timer', async () => {
        const error = new ServerError(
            'provider throttled',
            new Request('https://studio.test/api'),
            429,
            {},
            true,
            undefined,
            12_345,
        );
        await mockInteractionError(error);

        await expect(testEnv.run(executeInteraction, createPayload())).rejects.toMatchObject({
            type: 'ProviderRateLimitRetry',
            nonRetryable: false,
            nextRetryDelay: 12_345,
        } satisfies Partial<ApplicationFailure>);
    });

    it('should leave provider 429 timing to the activity retry policy when Retry-After is absent', async () => {
        const error = new ServerError('provider throttled', new Request('https://studio.test/api'), 429, {});
        await mockInteractionError(error);

        await expect(testEnv.run(executeInteraction, createPayload())).rejects.toMatchObject({
            type: 'ProviderRateLimitRetry',
            nonRetryable: false,
            nextRetryDelay: undefined,
        } satisfies Partial<ApplicationFailure>);
    });

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
        const requestSlot = vi.fn().mockResolvedValue({ delay_ms: 0 });
        const mockClient = {
            interactions: {
                requestSlot,
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
                workflow: expect.objectContaining({
                    rate_limit_id: expect.stringMatching(/:testInteraction$/),
                }),
            }),
            undefined,
            { include_prompt: false },
        );
        expect(requestSlot).toHaveBeenCalledWith(
            expect.objectContaining({
                interaction: 'testInteraction',
                environment_id: 'env-id',
                model_id: 'model-id',
                rate_limit_id: expect.stringMatching(/:testInteraction$/),
            }),
        );
        expect(requestSlot.mock.calls[0][0].rate_limit_id).toBe(executeByName.mock.calls[0][1].workflow.rate_limit_id);
    });

    async function runWithProjection(projection: Record<string, unknown>) {
        const { setupActivity } = await import('../dsl/setup/ActivityContext.js');
        const executeByName = vi.fn().mockResolvedValue({
            id: 'run-id',
            status: ExecutionRunStatus.completed,
            result: [],
            prompt: 'rendered prompt',
        });
        const mockClient = {
            interactions: {
                requestSlot: vi.fn().mockResolvedValue({ delay_ms: 0 }),
                executeByName,
            },
        } as unknown as VertesiaClient;
        const payload = createPayload();
        payload.activity = { ...payload.activity, projection };

        vi.mocked(setupActivity).mockResolvedValue({
            client: mockClient,
            inputType: 'objectIds',
            params: payload.params,
        } as unknown as ActivityContext<ExecuteInteractionParams>);

        const output = await testEnv.run(executeInteraction, payload);
        return { output, query: executeByName.mock.calls[0][3] };
    }

    it.each([
        ['`#.prompt`', { rendered_prompt: '${#.prompt}' }, { rendered_prompt: 'rendered prompt' }],
        [
            'the whole response',
            { response: '${#}' },
            { response: expect.objectContaining({ prompt: 'rendered prompt' }) },
        ],
    ])('should keep the prompt for a projection reading %s', async (_label, projection, expected) => {
        const { output, query } = await runWithProjection(projection);

        expect(query).toBeUndefined();
        expect(output).toEqual(expected);
    });

    it('should still omit the prompt for a projection that cannot read it', async () => {
        const { output, query } = await runWithProjection({ run: '${#.id}', status: '${#.status}' });

        expect(query).toEqual({ include_prompt: false });
        expect(output).toEqual({ run: 'run-id', status: ExecutionRunStatus.completed });
    });

    it('should take the previous error from the run search without fetching the whole run', async () => {
        const { setupActivity } = await import('../dsl/setup/ActivityContext.js');
        const previousError = { code: 'validation_error', message: 'missing field' };
        const executeByName = vi.fn().mockResolvedValue({
            id: 'run-id',
            status: ExecutionRunStatus.completed,
            result: [],
        });
        const retrieve = vi.fn();
        const mockClient = {
            interactions: {
                requestSlot: vi.fn().mockResolvedValue({ delay_ms: 0 }),
                executeByName,
            },
            runs: {
                search: vi.fn().mockResolvedValue([{ id: 'previous-run', error: previousError }]),
                retrieve,
            },
        } as unknown as VertesiaClient;
        const payload = createPayload();
        const params: ExecuteInteractionParams = { ...payload.params, include_previous_error: true };

        vi.mocked(setupActivity).mockResolvedValue({
            client: mockClient,
            inputType: 'objectIds',
            params,
        } as unknown as ActivityContext<ExecuteInteractionParams>);

        const retryEnv = new MockActivityEnvironment({ attempt: 2 }, { logger: activityLogger });
        await retryEnv.run(executeInteraction, { ...payload, params });

        expect(retrieve).not.toHaveBeenCalled();
        expect(executeByName.mock.calls[0][1].data).toEqual(expect.objectContaining({ previous_error: previousError }));
    });

    it('should leave 412 rendition-in-progress failures retryable', async () => {
        await mockInteractionError(Object.assign(new Error('rendition in progress'), { statusCode: 412 }));

        await expect(testEnv.run(executeInteraction, createPayload())).rejects.toMatchObject({
            message: 'Interaction Execution failed testInteraction: rendition in progress',
        });
        expect(activityLogger.warn).toHaveBeenCalledWith(
            'Interaction testInteraction is waiting for a rendition',
            expect.any(Object),
        );
        expect(activityLogger.error).not.toHaveBeenCalled();
    });

    describe('when the workflow waits for renditions', () => {
        const pendingRunBody = {
            id: 'rejected-run',
            status: ExecutionRunStatus.failed,
            error: {
                code: 'rendition_pending',
                message: 'Rendition for object video-1 is in progress',
                retry_after_ms: 30_000,
                data: { pending: [{ object_id: 'video-1', kind: 'video' }, { object_id: 'bad' }] },
            },
        };

        async function mockWaitingExecution(executeByName: ReturnType<typeof vi.fn>) {
            const { setupActivity } = await import('../dsl/setup/ActivityContext.js');
            const payload = createPayload();
            payload.params.wait_for_renditions = true;
            vi.mocked(setupActivity).mockResolvedValue({
                client: {
                    interactions: { requestSlot: vi.fn().mockResolvedValue({ delay_ms: 0 }), executeByName },
                } as unknown as VertesiaClient,
                inputType: 'objectIds',
                params: payload.params,
            } as unknown as ActivityContext<ExecuteInteractionParams>);
            return payload;
        }

        it('sends the rendition wait header', async () => {
            const executeByName = vi.fn().mockResolvedValue({
                id: 'run-id',
                status: ExecutionRunStatus.completed,
                result: [],
            });
            const payload = await mockWaitingExecution(executeByName);

            await testEnv.run(executeInteraction, payload);

            expect(executeByName.mock.calls[0][4]).toEqual({ 'x-vertesia-rendition-wait': '1' });
        });

        it('fails without retry, listing the pending renditions, when the server answers 412', async () => {
            const error = new ServerError(
                'Precondition Failed',
                new Request('http://mock-studio'),
                412,
                pendingRunBody,
            );
            const payload = await mockWaitingExecution(vi.fn().mockRejectedValue(error));

            await expect(testEnv.run(executeInteraction, payload)).rejects.toMatchObject({
                type: 'RenditionPendingError',
                nonRetryable: true,
                details: [
                    {
                        pending: [{ object_id: 'video-1', kind: 'video' }],
                        retry_after_ms: 30_000,
                        run_id: 'rejected-run',
                    },
                ],
            });
            expect(activityLogger.error).not.toHaveBeenCalled();
        });

        it('keeps a 412 that lists no pending renditions retryable', async () => {
            const error = new ServerError('Precondition Failed', new Request('http://mock-studio'), 412, {
                id: 'rejected-run',
                error: { message: 'Rendition for object image-1 is in progress' },
            });
            const payload = await mockWaitingExecution(vi.fn().mockRejectedValue(error));

            await expect(testEnv.run(executeInteraction, payload)).rejects.not.toMatchObject({
                type: 'RenditionPendingError',
            });
            await expect(testEnv.run(executeInteraction, payload)).rejects.not.toMatchObject({ nonRetryable: true });
        });
    });

    it('does not send the rendition wait header by default', async () => {
        const { setupActivity } = await import('../dsl/setup/ActivityContext.js');
        const executeByName = vi
            .fn()
            .mockResolvedValue({ id: 'run-id', status: ExecutionRunStatus.completed, result: [] });
        vi.mocked(setupActivity).mockResolvedValue({
            client: {
                interactions: { requestSlot: vi.fn().mockResolvedValue({ delay_ms: 0 }), executeByName },
            } as unknown as VertesiaClient,
            inputType: 'objectIds',
            params: createPayload().params,
        } as unknown as ActivityContext<ExecuteInteractionParams>);

        await testEnv.run(executeInteraction, createPayload());

        // Other callers keep their exact arguments: no headers argument at all.
        expect(executeByName.mock.calls[0]).toHaveLength(4);
    });

    it.each([
        ['status', { status: 412 }],
        ['code', { code: 412 }],
    ])('should leave 412 failures retryable when reported as %s', async (_field, statusProps) => {
        await mockInteractionError(Object.assign(new Error('precondition failed'), statusProps));

        await expect(testEnv.run(executeInteraction, createPayload())).rejects.toMatchObject({
            message: 'Interaction Execution failed testInteraction: precondition failed',
        });
        expect(activityLogger.warn).toHaveBeenCalledWith(
            'Interaction testInteraction is waiting for a rendition',
            expect.any(Object),
        );
        expect(activityLogger.error).not.toHaveBeenCalled();
    });

    it.each([
        ['statusCode', { statusCode: 502 }],
        ['status', { status: 503 }],
        ['code', { code: 504 }],
    ])('logs a transient server failure reported as %s at warn and retries it', async (_field, statusProps) => {
        await mockInteractionError(Object.assign(new Error('Service Unavailable'), statusProps));

        await expect(testEnv.run(executeInteraction, createPayload())).rejects.not.toMatchObject({
            nonRetryable: true,
        });
        expect(activityLogger.warn).toHaveBeenCalledWith(
            'Transient server failure while executing interaction testInteraction',
            expect.any(Object),
        );
        expect(activityLogger.error).not.toHaveBeenCalled();
    });

    it('keeps an explicitly permanent 503 at error level', async () => {
        await mockInteractionError(
            Object.assign(new Error('permanently unavailable'), { status: 503, retryable: false }),
        );

        await expect(testEnv.run(executeInteraction, createPayload())).rejects.toMatchObject({
            nonRetryable: true,
        } satisfies Partial<ApplicationFailure>);
        expect(activityLogger.error).toHaveBeenCalled();
    });

    it('should mark other 4xx failures as non-retryable', async () => {
        await mockInteractionError(Object.assign(new Error('bad request'), { statusCode: 400 }));

        await expect(testEnv.run(executeInteraction, createPayload())).rejects.toMatchObject({
            nonRetryable: true,
        } satisfies Partial<ApplicationFailure>);
        expect(activityLogger.error).toHaveBeenCalled();
    });

    it('keeps explicitly permanent 412 failures at error level', async () => {
        await mockInteractionError(
            Object.assign(new Error('permanent precondition failure'), {
                statusCode: 412,
                retryable: false,
            }),
        );

        await expect(testEnv.run(executeInteraction, createPayload())).rejects.toMatchObject({
            nonRetryable: true,
        } satisfies Partial<ApplicationFailure>);
        expect(activityLogger.error).toHaveBeenCalled();
    });

    it('does not retry unavailable rendition responses', async () => {
        await mockInteractionError(Object.assign(new Error('rendition unavailable'), { statusCode: 422 }));

        await expect(testEnv.run(executeInteraction, createPayload())).rejects.toMatchObject({
            nonRetryable: true,
        } satisfies Partial<ApplicationFailure>);
        expect(activityLogger.error).toHaveBeenCalled();
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
