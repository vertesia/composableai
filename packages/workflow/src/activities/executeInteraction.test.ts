import type { CompletionResult } from '@llumiverse/common';
import type { ApplicationFailure } from '@temporalio/activity';
import { MockActivityEnvironment } from '@temporalio/testing';
import { ServerError } from '@vertesia/api-fetch-client';
import type { VertesiaClient } from '@vertesia/client';
import type { NodeStreamSource } from '@vertesia/client/node';
import { ContentEventName, type DSLActivityExecutionPayload, ExecutionRunStatus } from '@vertesia/common';
import sharp from 'sharp';
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

describe('executeInteraction image results', () => {
    async function executeImages(images: CompletionResult[], uploadFile = vi.fn()) {
        const { setupActivity } = await import('../dsl/setup/ActivityContext.js');
        const client = {
            interactions: {
                requestSlot: vi.fn().mockResolvedValue({ delay_ms: 0 }),
                executeByName: vi
                    .fn()
                    .mockResolvedValue({ id: 'run', status: ExecutionRunStatus.completed, result: images }),
            },
            files: { uploadFile },
        } as unknown as VertesiaClient;
        vi.mocked(setupActivity).mockResolvedValue({
            client,
            params: createPayload().params,
        } as unknown as ActivityContext<ExecuteInteractionParams>);
        return testEnv.run(executeInteraction, createPayload());
    }

    it('retains storage and HTTP image references without uploading', async () => {
        const images: CompletionResult[] = [
            'gs://bucket/image.png',
            's3://bucket/image.jpg',
            'https://example.com/image.webp',
        ].map((value) => ({ type: 'image', value }));
        const uploadFile = vi.fn();
        await expect(executeImages(images, uploadFile)).resolves.toMatchObject({ result: images });
        expect(uploadFile).not.toHaveBeenCalled();
    });

    it.each(['png', 'jpeg', 'webp'] as const)('uploads inline %s with matching bytes and metadata', async (format) => {
        const bytes = await sharp({ create: { width: 1, height: 1, channels: 3, background: 'white' } })
            .toFormat(format)
            .toBuffer();
        const uploaded: { type?: string; name: string; bytes: Buffer }[] = [];
        const uploadFile = vi.fn(async (source: NodeStreamSource) => {
            const chunks: Uint8Array[] = [];
            const reader = source.stream.getReader();
            for (;;) {
                const { value, done } = await reader.read();
                if (done) break;
                chunks.push(value);
            }
            uploaded.push({ type: source.type, name: source.name, bytes: Buffer.concat(chunks) });
            return 'gs://bucket/uploaded';
        });
        const result = await executeImages(
            [
                { type: 'image', value: `data:image/${format};charset=binary;base64,${bytes.toString('base64')}` },
                { type: 'image', value: bytes.toString('base64') },
            ],
            uploadFile,
        );
        expect(result).toMatchObject({
            result: [{ value: 'gs://bucket/uploaded' }, { value: 'gs://bucket/uploaded' }],
        });
        expect(uploaded).toHaveLength(2);
        for (const source of uploaded) {
            expect(source.bytes).toEqual(bytes);
            expect(source.type).toBe(`image/${format}`);
            expect(source.name).toMatch(new RegExp(`\\.${format === 'jpeg' ? 'jpg' : format}$`));
        }
    });
});

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
