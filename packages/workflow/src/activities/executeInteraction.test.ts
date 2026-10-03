import { createHash } from 'node:crypto';
import { ApplicationFailure } from '@temporalio/activity';
import { MockActivityEnvironment } from '@temporalio/testing';
import { ServerError } from '@vertesia/api-fetch-client';
import type {
    CanonicalInteractionStreamSessionOptions,
    EnhancedExperimentalCanonicalInteractionExecutionResult,
    VertesiaClient,
} from '@vertesia/client';
import {
    CANONICAL_STREAM_RECOVERY_PENDING_ERROR_CODE,
    ContentEventName,
    type ConversationDocumentV0,
    type DSLActivityExecutionPayload,
    EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE,
    ExecutionRunStatus,
    RunDataStorageLevel,
} from '@vertesia/common';
import {
    ExperimentalCanonicalInitialIngestionAcceptedSchema,
    ExperimentalCanonicalNamedInteractionExecutionRequestSchema,
} from '@vertesia/common/api-schemas';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActivityContext } from '../dsl/setup/ActivityContext.js';
import {
    type CanonicalInteractionActivityPlan,
    type CanonicalInteractionActivityRequest,
    CanonicalInteractionExecutionError,
    type ExecuteInteractionParams,
    executeCanonicalInteractionFromActivity,
    executeInteraction,
    executeInteractionFromActivity,
    type InteractionExecutionParams,
    isCanonicalInteractionExecutionError,
} from './executeInteraction.js';

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

function canonicalResult(
    options: {
        id?: string;
        status?: ExecutionRunStatus;
        generationStatus?: 'completed' | 'failed' | 'cancelled';
        turnStatus?: 'completed' | 'interrupted' | 'failed';
        acceptedOutput?: boolean;
        error?: { message: string; code?: string; retryable?: boolean };
        blocks?: readonly Record<string, unknown>[];
        assets?: Record<string, Record<string, unknown>>;
    } = {},
): EnhancedExperimentalCanonicalInteractionExecutionResult {
    const id = options.id ?? 'run-id';
    const status = options.status ?? ExecutionRunStatus.completed;
    const generationStatus =
        options.generationStatus ?? (status === ExecutionRunStatus.completed ? 'completed' : 'failed');
    const turnStatus =
        options.turnStatus ??
        (generationStatus === 'failed' ? 'failed' : generationStatus === 'cancelled' ? 'interrupted' : 'completed');
    const acceptedOutput = options.acceptedOutput ?? status === ExecutionRunStatus.completed;
    const blocks = options.blocks ?? [];
    const assets = options.assets ?? {};
    const output = {
        blocks,
        fragment: {
            turn: { status: turnStatus },
            generation: {
                requested_model: 'requested-model-id',
                resolved_model: 'resolved-model-id',
                status: generationStatus,
                finish_reason: generationStatus === 'completed' ? 'stop' : 'error',
                timestamps: {
                    recorded_at: '2026-01-01T00:00:00.000Z',
                    provider_duration_ms: 321,
                },
                usage: {
                    input_tokens: 10,
                    input_new_tokens: 6,
                    cache_read_tokens: 4,
                    cache_write_tokens: 2,
                    output_tokens: 3,
                    total_tokens: 13,
                },
            },
            assets,
        },
        asset(assetId: string) {
            const asset = assets[assetId];
            if (!asset) throw new Error(`Missing test asset ${assetId}`);
            return asset;
        },
        object<T>() {
            const block = blocks.find((candidate) => candidate.type === 'json');
            if (!block) throw new Error('No JSON block');
            return block.value as T;
        },
        text() {
            return blocks.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('\n');
        },
    };
    return {
        run: {
            id,
            status,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
            retention: 'STANDARD',
            ...(options.error ? { error: options.error } : {}),
        },
        output: acceptedOutput
            ? { status: 'accepted', fragment: output.fragment }
            : { status: 'unavailable', reason: 'no_accepted_response' },
        history: { status: 'unavailable', reason: 'not_requested', retention: 'STANDARD' },
        ...(acceptedOutput ? { canonicalOutput: output } : {}),
    } as unknown as EnhancedExperimentalCanonicalInteractionExecutionResult;
}

function acceptedStream(runId = 'run-id') {
    return {
        run_id: runId,
        operation_id: 'operation-id',
        stream_id: 'stream-id',
        terminal_event: { type: 'response_accepted' },
        cursor: { stream_id: 'stream-id', event_id: 'event-id', sequence: 1 },
        retained_events: [],
    } as unknown as Awaited<ReturnType<VertesiaClient['runs']['streamCanonical']>>;
}

function terminatedStream(runId: string) {
    return {
        ...acceptedStream(runId),
        terminal_event: { type: 'stream_terminated', outcome: 'failed' },
    } as unknown as Awaited<ReturnType<VertesiaClient['runs']['streamCanonical']>>;
}

function mockCanonicalClient(result = canonicalResult()) {
    const requestSlot = vi.fn().mockResolvedValue({ delay_ms: 0 });
    const streamCanonical = vi.fn().mockResolvedValue(acceptedStream(result.run.id));
    const retrieveCanonical = vi.fn().mockResolvedValue(result);
    const search = vi.fn().mockResolvedValue([]);
    const retrieve = vi.fn();
    const uploadFile = vi.fn();
    const downloadFile = vi.fn();
    return {
        client: {
            interactions: { requestSlot },
            runs: { streamCanonical, retrieveCanonical, search, retrieve },
            files: { uploadFile, downloadFile },
        } as unknown as VertesiaClient,
        requestSlot,
        streamCanonical,
        retrieveCanonical,
        search,
        retrieve,
        uploadFile,
        downloadFile,
    };
}

function canonicalActivityRequest(
    overrides: Partial<CanonicalInteractionActivityRequest> = {},
): CanonicalInteractionActivityRequest {
    return {
        interaction: 'testInteraction',
        initial_state: { type: 'new' },
        retention: RunDataStorageLevel.STANDARD,
        return_policy: { history: 'none' },
        data: {},
        config: {},
        ...overrides,
    };
}

function canonicalToolDocument(): ConversationDocumentV0 {
    return {
        format: 'llumiverse.conversation',
        schema_version: 0,
        experimental_revision: '2026-09-30.adoption.1',
        id: 'conversation-id',
        revision: 0,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        turns: [],
        generations: {},
        operation_receipts: {},
        execution_receipts: {},
        assets: {},
        tool_definitions: {
            'tool-definition:lookup': {
                id: 'tool-definition:lookup',
                name: 'lookup',
                version: '1',
                description: 'Look up a record',
                input_schema: {
                    type: 'object',
                    properties: { query: { type: 'string' } },
                    required: ['query'],
                },
                result_capabilities: ['json'],
            },
        },
        context: {
            revision: 0,
            entries: [],
            active_tool_definition_ids: ['tool-definition:lookup'],
            protected_entry_ids: [],
            retrieval_requirements: [],
        },
        compactions: {},
        processing: { enabled: false, policy_revision: 0, processors: [] },
    } satisfies ConversationDocumentV0;
}

function canonicalActivityPlan(
    requestOverrides: Partial<CanonicalInteractionActivityRequest> = {},
    planOverrides: Omit<Partial<CanonicalInteractionActivityPlan>, 'request'> = {},
): CanonicalInteractionActivityPlan {
    return {
        request: canonicalActivityRequest(requestOverrides),
        ...planOverrides,
    };
}

async function mockInteractionError(
    error: Error & { statusCode?: number; status?: number; code?: number; retryable?: boolean; errorCode?: string },
): Promise<void> {
    const { setupActivity } = await import('../dsl/setup/ActivityContext.js');
    const { client: mockClient, streamCanonical } = mockCanonicalClient();
    streamCanonical.mockRejectedValue(error);

    vi.mocked(setupActivity).mockResolvedValue({
        client: mockClient,
        inputType: 'objectIds',
        params: createPayload().params,
    } as unknown as ActivityContext<ExecuteInteractionParams>);
}

describe('executeInteraction retryability', () => {
    it('should durably retry before executing when the LLM limiter returns a delay', async () => {
        const { setupActivity } = await import('../dsl/setup/ActivityContext.js');
        const { client: mockClient, requestSlot, streamCanonical } = mockCanonicalClient();
        requestSlot.mockResolvedValue({ delay_ms: 5_000 });
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
        expect(streamCanonical).not.toHaveBeenCalled();
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

    it('should forward config, result binding, and workflow attribution to canonical execution', async () => {
        const { setupActivity } = await import('../dsl/setup/ActivityContext.js');
        const httpTimeout = { headersTimeout: 1_000, bodyTimeout: 2_000, connectTimeout: 300 };
        const { client: mockClient, requestSlot, streamCanonical } = mockCanonicalClient();
        const payload = createPayload();
        const params: ExecuteInteractionParams = {
            ...payload.params,
            agent_run_id: 'agent-run-id',
            result_schema: { type: 'object' },
            config: {
                environment: 'env-id',
                model: 'model-id',
                inference_profile: '507f1f77bcf86cd799439011',
                inherit_model_config: true,
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

        const streamRequest = streamCanonical.mock.calls[0][0];
        expect(streamRequest.request).toMatchObject({
            interaction: 'testInteraction',
            initial_state: { type: 'new' },
            retention: 'STANDARD',
            return_policy: { history: 'none' },
            config: {
                environment: 'env-id',
                model: 'model-id',
                http_timeout: httpTimeout,
            },
            result_schema: { type: 'object' },
            workflow: {
                agent_run_id: 'agent-run-id',
                rate_limit_id: expect.stringMatching(/:testInteraction$/),
            },
        });
        expect(requestSlot).toHaveBeenCalledWith(
            expect.objectContaining({
                interaction: 'testInteraction',
                environment_id: 'env-id',
                model_id: 'model-id',
                inference_profile: '507f1f77bcf86cd799439011',
                inherit_model_config: true,
                rate_limit_id: expect.stringMatching(/:testInteraction$/),
            }),
        );
        expect(requestSlot.mock.calls[0][0].rate_limit_id).toBe(streamRequest.request.workflow?.rate_limit_id);
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

    it.each([
        ['retryable', true, false],
        ['non-retryable', false, true],
        ['unspecified', undefined, false],
    ] as const)(
        'preserves a canonical %s failure without serializing its retained result as details',
        async (_label, retryable, nonRetryable) => {
            const failed = canonicalResult({
                id: 'private-retained-run-id',
                status: ExecutionRunStatus.failed,
                generationStatus: 'failed',
                acceptedOutput: false,
                error: {
                    message: 'canonical execution failed',
                    code: 'PROVIDER_STREAM_FAILED',
                    ...(retryable === undefined ? {} : { retryable }),
                },
            });
            const canonicalError = new CanonicalInteractionExecutionError('testInteraction', failed);
            await mockInteractionError(canonicalError);

            let caught: unknown;
            try {
                await testEnv.run(executeInteraction, createPayload());
                expect.unreachable('expected canonical interaction failure');
            } catch (error) {
                caught = error;
            }

            expect(caught).toBe(canonicalError);
            expect(caught).toMatchObject({
                name: 'CanonicalInteractionExecutionError',
                type: 'CanonicalInteractionExecutionError',
                nonRetryable,
            } satisfies Partial<ApplicationFailure>);
            expect((caught as ApplicationFailure).details).toBeUndefined();
            expect(canonicalError.result).toBe(failed);
            expect(Object.keys(canonicalError)).not.toContain('result');
            expect(JSON.stringify(canonicalError)).not.toContain('private-retained-run-id');
        },
    );

    it('applies input-validation policy before preserving a canonical failure', async () => {
        const failed = canonicalResult({
            status: ExecutionRunStatus.failed,
            generationStatus: 'failed',
            acceptedOutput: false,
            error: {
                message: 'Failed to validate merged prompt schema',
                code: 'PROVIDER_STREAM_FAILED',
                retryable: true,
            },
        });
        const canonicalError = new CanonicalInteractionExecutionError('testInteraction', failed);
        await mockInteractionError(canonicalError);

        const failure = testEnv.run(executeInteraction, createPayload());
        await expect(failure).rejects.not.toBe(canonicalError);
        await expect(failure).rejects.toMatchObject({
            type: 'ActivityParamInvalidError',
            nonRetryable: true,
        } satisfies Partial<ApplicationFailure>);
    });

    it('preserves required-tool recovery type for generic compatibility activity failures', async () => {
        await mockInteractionError(
            Object.assign(new Error('required tool call missing'), {
                retryable: false,
                errorCode: 'RequiredToolCallMissingError',
            }),
        );

        await expect(testEnv.run(executeInteraction, createPayload())).rejects.toMatchObject({
            type: 'RequiredToolCallMissingError',
            nonRetryable: true,
        } satisfies Partial<ApplicationFailure>);
    });

    it('applies required-tool policy before preserving a canonical failure', async () => {
        const failed = canonicalResult({
            status: ExecutionRunStatus.failed,
            generationStatus: 'failed',
            acceptedOutput: false,
            error: {
                message: 'required tool call missing',
                code: 'RequiredToolCallMissingError',
                retryable: true,
            },
        });
        const canonicalError = new CanonicalInteractionExecutionError('testInteraction', failed);
        await mockInteractionError(canonicalError);

        const failure = testEnv.run(executeInteraction, createPayload());
        await expect(failure).rejects.not.toBe(canonicalError);
        await expect(failure).rejects.toMatchObject({
            type: 'RequiredToolCallMissingError',
            nonRetryable: true,
        } satisfies Partial<ApplicationFailure>);
    });

    it('does not classify a forbidden tool call as recoverable', async () => {
        await mockInteractionError(
            Object.assign(new Error('forbidden tool call'), {
                retryable: false,
                errorCode: 'CANONICAL_FORBIDDEN_TOOL_CALL',
            }),
        );

        const failure = testEnv.run(executeInteraction, createPayload());
        await expect(failure).rejects.toMatchObject({ nonRetryable: true } satisfies Partial<ApplicationFailure>);
        await failure.catch((error: unknown) => {
            expect(error).not.toMatchObject({ type: 'RequiredToolCallMissingError' });
        });
    });
});

const retryEnvironment = (attempt: number) =>
    new MockActivityEnvironment({
        attempt,
        activityId: 'activity-id',
        workflowExecution: { workflowId: 'workflow-id', runId: 'workflow-run-id' },
    });

const ROOT_AGENT_ACCEPTANCE = {
    version: 1,
    subject_agent_run_id: 'agent-run-id',
    scope: 'root',
} as const;

describe('executeCanonicalInteractionFromActivity', () => {
    it.each([
        ['RequiredToolCallMissingError', 'RequiredToolCallMissingError'],
        ['CANONICAL_FORBIDDEN_TOOL_CALL', 'CanonicalInteractionExecutionError'],
    ] as const)('exposes direct canonical failure code %s under safe error name %s', async (code, expectedName) => {
        const failed = canonicalResult({
            generationStatus: 'failed',
            error: { message: 'Canonical tool-selection failure', code, retryable: false },
        });
        const mocks = mockCanonicalClient(failed);

        const execution = retryEnvironment(1).run(
            executeCanonicalInteractionFromActivity,
            mocks.client,
            canonicalActivityPlan(),
        );
        await expect(execution).rejects.toMatchObject({
            type: expectedName,
            errorCode: code,
            retryable: false,
        });
    });

    it.each([
        ['RequiredToolCallMissingError', 'RequiredToolCallMissingError'],
        ['CANONICAL_FORBIDDEN_TOOL_CALL', 'CanonicalInteractionExecutionError'],
    ] as const)('preserves direct canonical failure %s through Temporal conversion as %s', (code, expectedType) => {
        const failure = new CanonicalInteractionExecutionError(
            'sys:CanonicalActivity',
            canonicalResult({
                generationStatus: 'failed',
                error: { message: 'Canonical tool-selection failure', code, retryable: false },
            }),
        );

        const temporalFailure = ApplicationFailure.fromError(failure);
        expect(temporalFailure).toBe(failure);
        expect(temporalFailure).toMatchObject({
            name: 'CanonicalInteractionExecutionError',
            type: expectedType,
            nonRetryable: true,
        });
    });

    it('rejects caller-supplied workflow identity before recovery, admission, or transport', async () => {
        const mocks = mockCanonicalClient();
        const request = {
            ...canonicalActivityRequest(),
            workflow: { run_id: 'forged-run', workflow_id: 'forged-workflow' },
        } as unknown as CanonicalInteractionActivityRequest;

        await expect(
            retryEnvironment(2).run(executeCanonicalInteractionFromActivity, mocks.client, { request }),
        ).rejects.toThrow('derives workflow identity from the active Temporal activity');
        expect(mocks.search).not.toHaveBeenCalled();
        expect(mocks.requestSlot).not.toHaveBeenCalled();
        expect(mocks.streamCanonical).not.toHaveBeenCalled();
    });

    it('rejects an unsupported service tier policy before recovery, admission, or transport', async () => {
        const mocks = mockCanonicalClient();
        const malformed = {
            ...canonicalActivityPlan(),
            service_tier_policy: 'future-policy',
        } as unknown as CanonicalInteractionActivityPlan;

        await expect(
            retryEnvironment(2).run(executeCanonicalInteractionFromActivity, mocks.client, malformed),
        ).rejects.toThrow('Unsupported canonical interaction service_tier_policy: future-policy');
        expect(mocks.search).not.toHaveBeenCalled();
        expect(mocks.requestSlot).not.toHaveBeenCalled();
        expect(mocks.streamCanonical).not.toHaveBeenCalled();
    });

    it('rejects caller tags that spoof service tier policy identity', async () => {
        const mocks = mockCanonicalClient();

        await expect(
            retryEnvironment(1).run(
                executeCanonicalInteractionFromActivity,
                mocks.client,
                canonicalActivityPlan({ tags: ['workflow-service-tier-policy:flex_then_default'] }),
            ),
        ).rejects.toThrow('Interaction tags may not use reserved prefix workflow-service-tier-policy:');
        expect(mocks.search).not.toHaveBeenCalled();
        expect(mocks.requestSlot).not.toHaveBeenCalled();
        expect(mocks.streamCanonical).not.toHaveBeenCalled();
    });

    it('forwards every canonical request field while deriving protected execution identities', async () => {
        const mocks = mockCanonicalClient();
        const document = canonicalToolDocument();
        const request = canonicalActivityRequest({
            initial_state: { type: 'document', document },
            retention: RunDataStorageLevel.DEBUG,
            return_policy: { history: 'document' },
            data: { question: 'Where is the record?' },
            config: {
                environment: 'environment-id',
                model: 'model-id',
                inference_profile: '000000000000000000000001',
                inherit_model_config: true,
            },
            result_schema: { type: 'object', properties: { answer: { type: 'string' } } },
            tags: ['caller-tag'],
        });
        expect(ExperimentalCanonicalNamedInteractionExecutionRequestSchema.parse(request)).toEqual(request);

        await retryEnvironment(1).run(executeCanonicalInteractionFromActivity, mocks.client, {
            request,
            invocation_key: 'initial-agent-turn',
            agent_run_id: 'agent-run-id',
            agent_acceptance: ROOT_AGENT_ACCEPTANCE,
        });

        expect(mocks.requestSlot).toHaveBeenCalledWith({
            interaction: 'testInteraction',
            inference_profile: '000000000000000000000001',
            inherit_model_config: true,
            environment_id: 'environment-id',
            model_id: 'model-id',
            rate_limit_id: expect.stringContaining(':invocation-key:18:initial-agent-turn'),
        });
        const sent = mocks.streamCanonical.mock.calls[0][0];
        expect(sent.agent_acceptance).toEqual({ ...ROOT_AGENT_ACCEPTANCE, activity_id: 'activity-id' });
        expect(sent.request).toMatchObject({
            interaction: request.interaction,
            initial_state: request.initial_state,
            retention: request.retention,
            return_policy: request.return_policy,
            data: request.data,
            config: request.config,
            result_schema: request.result_schema,
            tags: [
                'workflow',
                expect.stringMatching(/^workflow-interaction:/),
                'caller-tag',
                'workflow-predecessor:initial',
            ],
            workflow: {
                run_id: 'workflow-run-id',
                workflow_id: 'workflow-id',
                rate_limit_id: expect.stringContaining(':invocation-key:18:initial-agent-turn'),
                agent_run_id: 'agent-run-id',
            },
        });
        expect(sent.request.initial_state).toEqual({
            type: 'document',
            document: expect.objectContaining({
                tool_definitions: document.tool_definitions,
                context: expect.objectContaining({ active_tool_definition_ids: ['tool-definition:lookup'] }),
            }),
        });
        expect(Object.hasOwn(request, 'workflow')).toBe(false);
    });

    it.each([
        ['string', 'memory:input'],
        ['zero', 0],
        ['false', false],
        ['null', null],
        ['array', ['first', 2, false, null, { nested: true }]],
    ])('preserves exact canonical JSON request data without object coercion: %s', async (_label, data) => {
        const mocks = mockCanonicalClient();

        await retryEnvironment(1).run(
            executeCanonicalInteractionFromActivity,
            mocks.client,
            canonicalActivityPlan({ data }),
        );

        expect(mocks.streamCanonical).toHaveBeenCalledOnce();
        expect(mocks.streamCanonical.mock.calls[0][0].request).toHaveProperty('data', data);
    });

    it('reopens a scalar accepted operation with the exact request identity', async () => {
        const data = 'memory:input';
        const initial = mockCanonicalClient();
        await retryEnvironment(1).run(
            executeCanonicalInteractionFromActivity,
            initial.client,
            canonicalActivityPlan({ data }, { invocation_key: 'scalar-input' }),
        );
        const original = initial.streamCanonical.mock.calls[0][0];

        const accepted = canonicalResult({ id: 'accepted-run' });
        const retry = mockCanonicalClient(accepted);
        retry.search.mockResolvedValue([{ id: accepted.run.id, tags: ['workflow-predecessor:initial'] }]);
        retry.retrieveCanonical.mockResolvedValue(accepted);
        await retryEnvironment(2).run(
            executeCanonicalInteractionFromActivity,
            retry.client,
            canonicalActivityPlan({ data }, { invocation_key: 'scalar-input' }),
        );

        expect(retry.requestSlot).not.toHaveBeenCalled();
        expect(retry.streamCanonical.mock.calls[0][0]).toEqual(original);
    });

    it('rejects previous-error injection into non-object data before recovery, admission, or transport', async () => {
        const mocks = mockCanonicalClient();

        await expect(
            retryEnvironment(2).run(
                executeCanonicalInteractionFromActivity,
                mocks.client,
                canonicalActivityPlan({ data: ['not', 'an', 'object'] }, { include_previous_error: true }),
            ),
        ).rejects.toThrow('Canonical include_previous_error requires object or undefined request data');
        expect(mocks.search).not.toHaveBeenCalled();
        expect(mocks.requestSlot).not.toHaveBeenCalled();
        expect(mocks.streamCanonical).not.toHaveBeenCalled();
    });

    it('derives the activity id for a scoped workstream acceptance target without mutating the caller', async () => {
        const mocks = mockCanonicalClient();
        const target = {
            version: 1,
            subject_agent_run_id: 'child-agent-run-id',
            scope: 'workstream:launch-1',
            workstream_id: 'implementation',
        } as const;

        await retryEnvironment(1).run(
            executeCanonicalInteractionFromActivity,
            mocks.client,
            canonicalActivityPlan({}, { agent_acceptance: target }),
        );

        expect(mocks.streamCanonical.mock.calls[0][0].agent_acceptance).toEqual({
            ...target,
            activity_id: 'activity-id',
        });
        expect(target).not.toHaveProperty('activity_id');
    });

    it.each([
        { policy: undefined, expectedTier: 'flex_auto' },
        { policy: 'flex_then_default' as const, expectedTier: 'flex' },
    ])(
        'forwards the logical tier as $expectedTier with service tier policy $policy',
        async ({ policy, expectedTier }) => {
            const mocks = mockCanonicalClient();
            const request = canonicalActivityRequest({
                config: {
                    model_options: {
                        _option_id: 'openai-text',
                        service_tier: 'flex_auto',
                        temperature: 0.25,
                    },
                },
            });

            await retryEnvironment(1).run(
                executeCanonicalInteractionFromActivity,
                mocks.client,
                canonicalActivityPlan(request, { service_tier_policy: policy }),
            );

            expect(mocks.streamCanonical.mock.calls[0][0].request.config?.model_options).toMatchObject({
                _option_id: 'openai-text',
                service_tier: expectedTier,
                temperature: 0.25,
            });
            expect(
                mocks.streamCanonical.mock.calls[0][0].request.tags?.includes(
                    'workflow-service-tier-policy:flex_then_default',
                ),
            ).toBe(policy !== undefined);
            expect(request.config?.model_options).toMatchObject({ service_tier: 'flex_auto' });
        },
    );

    it('binds service tier policy drift into the same operation request fingerprint', async () => {
        const request = canonicalActivityRequest({
            config: { model_options: { _option_id: 'openai-text', service_tier: 'flex' } },
        });
        const initial = mockCanonicalClient();
        await retryEnvironment(1).run(executeCanonicalInteractionFromActivity, initial.client, { request });
        const initialPayload = initial.streamCanonical.mock.calls[0][0];

        const accepted = canonicalResult({ id: 'accepted-flex-run' });
        const retry = mockCanonicalClient(accepted);
        retry.search.mockResolvedValue([{ id: accepted.run.id, tags: ['workflow-predecessor:initial'] }]);
        retry.retrieveCanonical.mockResolvedValue(accepted);
        const conflict = new ServerError(
            'Canonical request does not match the accepted operation',
            new Request('https://studio.test/api/v1/runs/canonical-stream'),
            409,
            { errorCode: 'canonical_request_mismatch' },
        );
        retry.streamCanonical.mockRejectedValue(conflict);
        const changedPlan: CanonicalInteractionActivityPlan = {
            request,
            service_tier_policy: 'flex_then_default',
        };

        await expect(
            retryEnvironment(2).run(executeCanonicalInteractionFromActivity, retry.client, changedPlan),
        ).rejects.toBe(conflict);

        const changedPayload = retry.streamCanonical.mock.calls[0][0];
        expect(changedPayload.operation_id).toBe(initialPayload.operation_id);
        expect(changedPayload.request.config).toEqual(initialPayload.request.config);
        expect(initialPayload.request.tags).not.toContain('workflow-service-tier-policy:flex_then_default');
        expect(changedPayload.request.tags).toContain('workflow-service-tier-policy:flex_then_default');
        expect(retry.requestSlot).not.toHaveBeenCalled();
    });

    it('reopens an ambiguous flex attempt with the same operation and request', async () => {
        const mocks = mockCanonicalClient();
        const connectionLost = new Error('connection lost after dispatch');
        mocks.streamCanonical.mockRejectedValueOnce(connectionLost).mockResolvedValueOnce(acceptedStream());
        const plan = canonicalActivityPlan(
            {},
            { service_tier_policy: 'flex_then_default', agent_acceptance: ROOT_AGENT_ACCEPTANCE },
        );

        await expect(retryEnvironment(1).run(executeCanonicalInteractionFromActivity, mocks.client, plan)).rejects.toBe(
            connectionLost,
        );
        await expect(
            retryEnvironment(2).run(executeCanonicalInteractionFromActivity, mocks.client, plan),
        ).resolves.toBeDefined();

        const initial = mocks.streamCanonical.mock.calls[0][0];
        const reopened = mocks.streamCanonical.mock.calls[1][0];
        expect(reopened.operation_id).toBe(initial.operation_id);
        expect(reopened.request).toEqual(initial.request);
        expect(reopened.agent_acceptance).toEqual(initial.agent_acceptance);
        expect(reopened.agent_acceptance).toEqual({ ...ROOT_AGENT_ACCEPTANCE, activity_id: 'activity-id' });
        expect(reopened.request.config?.model_options).toMatchObject({ service_tier: 'flex' });
        expect(mocks.requestSlot).toHaveBeenCalledTimes(2);
        expect(mocks.requestSlot.mock.calls[0][0].rate_limit_id).toBe(mocks.requestSlot.mock.calls[1][0].rate_limit_id);
    });

    it('resumes an active default-tier successor without another admission', async () => {
        const failed = canonicalResult({
            id: 'failed-flex-run',
            status: ExecutionRunStatus.failed,
            acceptedOutput: false,
            error: { message: 'flex capacity unavailable', code: 'FLEX_UNAVAILABLE', retryable: true },
        });
        const active = canonicalResult({ id: 'active-default-run', status: ExecutionRunStatus.processing });
        const accepted = canonicalResult({ id: active.run.id });
        const mocks = mockCanonicalClient(accepted);
        mocks.search.mockResolvedValue([{ id: active.run.id, tags: [`workflow-predecessor:${failed.run.id}`] }]);
        mocks.retrieveCanonical
            .mockResolvedValueOnce(active)
            .mockResolvedValueOnce(failed)
            .mockResolvedValueOnce(accepted);

        await expect(
            retryEnvironment(3).run(
                executeCanonicalInteractionFromActivity,
                mocks.client,
                canonicalActivityPlan(
                    {},
                    { service_tier_policy: 'flex_then_default', agent_acceptance: ROOT_AGENT_ACCEPTANCE },
                ),
            ),
        ).resolves.toBe(accepted);

        expect(mocks.requestSlot).not.toHaveBeenCalled();
        expect(mocks.streamCanonical).toHaveBeenCalledOnce();
        expect(mocks.streamCanonical.mock.calls[0][0].request.config?.model_options).toMatchObject({
            service_tier: 'default',
        });
        expect(mocks.streamCanonical.mock.calls[0][0].request.tags).toContain(
            'workflow-service-tier-policy:flex_then_default',
        );
        expect(mocks.streamCanonical.mock.calls[0][0].agent_acceptance).toEqual({
            ...ROOT_AGENT_ACCEPTANCE,
            activity_id: 'activity-id',
        });
    });

    it('creates one deterministic default-tier successor only after confirming the failed flex terminal', async () => {
        const failed = canonicalResult({
            id: 'failed-flex-run',
            status: ExecutionRunStatus.failed,
            acceptedOutput: false,
            error: { message: 'flex capacity unavailable', code: 'FLEX_UNAVAILABLE', retryable: true },
        });
        const accepted = canonicalResult({ id: 'accepted-default-run' });
        const mocks = mockCanonicalClient(accepted);
        mocks.search
            .mockResolvedValueOnce([{ id: failed.run.id, tags: ['workflow-predecessor:initial'] }])
            .mockResolvedValueOnce([{ id: accepted.run.id, tags: [`workflow-predecessor:${failed.run.id}`] }]);
        mocks.streamCanonical
            .mockResolvedValueOnce(terminatedStream(failed.run.id))
            .mockResolvedValueOnce(terminatedStream(failed.run.id))
            .mockResolvedValueOnce(acceptedStream(accepted.run.id));
        mocks.retrieveCanonical
            .mockResolvedValueOnce(failed)
            .mockResolvedValueOnce(failed)
            .mockResolvedValueOnce(failed)
            .mockResolvedValueOnce(accepted)
            .mockResolvedValueOnce(accepted)
            .mockResolvedValueOnce(failed)
            .mockResolvedValueOnce(accepted);
        const plan = canonicalActivityPlan(
            {},
            { service_tier_policy: 'flex_then_default', agent_acceptance: ROOT_AGENT_ACCEPTANCE },
        );

        await expect(
            retryEnvironment(1).run(executeCanonicalInteractionFromActivity, mocks.client, plan),
        ).rejects.toBeInstanceOf(CanonicalInteractionExecutionError);
        await expect(
            retryEnvironment(2).run(executeCanonicalInteractionFromActivity, mocks.client, plan),
        ).resolves.toBe(accepted);
        await expect(
            retryEnvironment(3).run(executeCanonicalInteractionFromActivity, mocks.client, plan),
        ).resolves.toBe(accepted);

        const first = mocks.streamCanonical.mock.calls[0][0];
        const confirmed = mocks.streamCanonical.mock.calls[1][0];
        const successor = mocks.streamCanonical.mock.calls[2][0];
        const recovered = mocks.streamCanonical.mock.calls[3][0];
        expect(confirmed.operation_id).toBe(first.operation_id);
        expect(confirmed.request.config?.model_options).toMatchObject({ service_tier: 'flex' });
        expect(successor.operation_id).not.toBe(first.operation_id);
        expect(successor.request.config?.model_options).toMatchObject({ service_tier: 'default' });
        expect(successor.request.tags).toContain(`workflow-predecessor:${failed.run.id}`);
        expect(recovered).toEqual(successor);
        for (const [payload] of mocks.streamCanonical.mock.calls) {
            expect(payload.agent_acceptance).toEqual({ ...ROOT_AGENT_ACCEPTANCE, activity_id: 'activity-id' });
        }
        expect(mocks.requestSlot).toHaveBeenCalledTimes(2);
    });

    it('keeps the compatibility wrapper request and identity byte-for-byte equivalent', async () => {
        const wrapperMocks = mockCanonicalClient();
        const directMocks = mockCanonicalClient();
        const params = {
            tags: ['caller-tag'],
            invocation_key: 'slot-a',
            agent_run_id: 'agent-run-id',
            config: {
                run_data: RunDataStorageLevel.RESTRICTED,
                environment: 'configured-environment',
                model: 'configured-model',
                inference_profile: 'profile-id',
            },
            environment: 'override-environment',
            model: 'override-model',
            result_schema: { type: 'object' },
        } satisfies InteractionExecutionParams;
        const data = { value: 'same' };

        await retryEnvironment(1).run(
            executeInteractionFromActivity,
            wrapperMocks.client,
            'testInteraction',
            params,
            data,
        );
        await retryEnvironment(1).run(
            executeCanonicalInteractionFromActivity,
            directMocks.client,
            canonicalActivityPlan(
                {
                    retention: RunDataStorageLevel.RESTRICTED,
                    data,
                    config: {
                        environment: 'override-environment',
                        model: 'override-model',
                        inference_profile: 'profile-id',
                    },
                    result_schema: { type: 'object' },
                    tags: ['caller-tag'],
                },
                { invocation_key: 'slot-a', agent_run_id: 'agent-run-id' },
            ),
        );

        expect(wrapperMocks.requestSlot.mock.calls[0][0]).toEqual(directMocks.requestSlot.mock.calls[0][0]);
        expect(wrapperMocks.streamCanonical.mock.calls[0][0]).toEqual(directMocks.streamCanonical.mock.calls[0][0]);
        expect(Object.hasOwn(wrapperMocks.streamCanonical.mock.calls[0][0], 'agent_acceptance')).toBe(false);
    });

    it('reuses the exact operation and forwards a changed canonical tool catalog for conflict rejection', async () => {
        const original = mockCanonicalClient();
        const originalDocument = canonicalToolDocument();
        await retryEnvironment(1).run(
            executeCanonicalInteractionFromActivity,
            original.client,
            canonicalActivityPlan(
                { initial_state: { type: 'document', document: originalDocument } },
                { invocation_key: 'slot-a' },
            ),
        );
        const originalOperationId = original.streamCanonical.mock.calls[0][0].operation_id;

        const accepted = canonicalResult({ id: 'accepted-run' });
        const retry = mockCanonicalClient(accepted);
        retry.search.mockResolvedValue([{ id: 'accepted-run', tags: ['workflow-predecessor:initial'] }]);
        retry.retrieveCanonical.mockResolvedValue(accepted);
        const conflict = new ServerError(
            'Canonical request does not match the accepted operation',
            new Request('https://studio.test/api/v1/runs/canonical-stream'),
            409,
            { errorCode: 'canonical_request_mismatch' },
        );
        retry.streamCanonical.mockRejectedValue(conflict);
        const changedDocument = structuredClone(originalDocument);
        changedDocument.tool_definitions['tool-definition:lookup'].version = '2';

        await expect(
            retryEnvironment(2).run(
                executeCanonicalInteractionFromActivity,
                retry.client,
                canonicalActivityPlan(
                    { initial_state: { type: 'document', document: changedDocument } },
                    { invocation_key: 'slot-a' },
                ),
            ),
        ).rejects.toBe(conflict);
        expect(retry.requestSlot).not.toHaveBeenCalled();
        expect(retry.streamCanonical.mock.calls[0][0]).toMatchObject({
            operation_id: originalOperationId,
            request: {
                initial_state: {
                    type: 'document',
                    document: {
                        tool_definitions: {
                            'tool-definition:lookup': expect.objectContaining({ version: '2' }),
                        },
                        context: expect.objectContaining({ active_tool_definition_ids: ['tool-definition:lookup'] }),
                    },
                },
            },
        });
    });

    it('forwards Temporal cancellation to a pending canonical stream', async () => {
        const environment = retryEnvironment(1);
        const mocks = mockCanonicalClient();
        let markStarted: (() => void) | undefined;
        const started = new Promise<void>((resolve) => {
            markStarted = resolve;
        });
        let observedSignal: AbortSignal | undefined;
        mocks.streamCanonical.mockImplementation((_payload, options) => {
            observedSignal = options?.signal;
            markStarted?.();
            return new Promise((_resolve, reject) => {
                observedSignal?.addEventListener('abort', () => reject(observedSignal?.reason), { once: true });
            });
        });

        const execution = environment.run(
            executeCanonicalInteractionFromActivity,
            mocks.client,
            canonicalActivityPlan(),
        );
        const rejection = expect(execution).rejects.toBeDefined();
        await started;
        environment.cancel();

        await rejection;
        expect(observedSignal?.aborted).toBe(true);
    });
});

describe('executeInteraction canonical lifecycle', () => {
    it('rejects user tags that collide with durable predecessor identity before admission', async () => {
        const mocks = mockCanonicalClient();

        await expect(
            retryEnvironment(1).run(
                executeInteractionFromActivity,
                mocks.client,
                'testInteraction',
                { tags: ['workflow-predecessor:forged'] },
                {},
            ),
        ).rejects.toThrow('reserved prefix workflow-predecessor:');
        expect(mocks.requestSlot).not.toHaveBeenCalled();
        expect(mocks.streamCanonical).not.toHaveBeenCalled();
    });

    it('rejects user tags that collide with generated invocation identity before recovery or transport', async () => {
        const mocks = mockCanonicalClient();

        await expect(
            retryEnvironment(2).run(
                executeInteractionFromActivity,
                mocks.client,
                'testInteraction',
                { tags: ['workflow-interaction:forged'] },
                {},
            ),
        ).rejects.toThrow('reserved prefix workflow-interaction:');
        expect(mocks.search).not.toHaveBeenCalled();
        expect(mocks.requestSlot).not.toHaveBeenCalled();
        expect(mocks.streamCanonical).not.toHaveBeenCalled();
    });

    it('reopens an accepted retry against the exact request binding without another admission', async () => {
        const accepted = canonicalResult({ id: 'accepted-run' });
        const mocks = mockCanonicalClient(accepted);
        mocks.search.mockResolvedValue([{ id: 'accepted-run', tags: ['workflow-predecessor:initial'] }]);
        mocks.retrieveCanonical.mockResolvedValue(accepted);

        await expect(
            retryEnvironment(2).run(executeInteractionFromActivity, mocks.client, 'testInteraction', {}, {}),
        ).resolves.toBe(accepted);
        expect(mocks.requestSlot).not.toHaveBeenCalled();
        expect(mocks.streamCanonical).toHaveBeenCalledOnce();
        expect(mocks.streamCanonical.mock.calls[0][0].request).toMatchObject({
            data: {},
            tags: expect.arrayContaining(['workflow-predecessor:initial']),
        });
        expect(mocks.search).toHaveBeenCalledWith(
            expect.objectContaining({
                query: expect.objectContaining({
                    workflow_run_ids: ['workflow-run-id'],
                    tags: [expect.stringMatching(/^workflow-interaction:/)],
                }),
            }),
        );
    });

    it('rejects a changed payload instead of returning a stale accepted result for the same invocation key', async () => {
        const first = mockCanonicalClient();
        await retryEnvironment(1).run(
            executeInteractionFromActivity,
            first.client,
            'testInteraction',
            { invocation_key: 'slot-a' },
            { value: 'original' },
        );
        const originalOperationId = first.streamCanonical.mock.calls[0][0].operation_id;

        const accepted = canonicalResult({ id: 'accepted-run' });
        const retry = mockCanonicalClient(accepted);
        retry.search.mockResolvedValue([{ id: 'accepted-run', tags: ['workflow-predecessor:initial'] }]);
        retry.retrieveCanonical.mockResolvedValue(accepted);
        const conflict = new ServerError(
            'Canonical request does not match the accepted operation',
            new Request('https://studio.test/api/v1/runs/canonical-stream'),
            409,
            { errorCode: 'canonical_request_mismatch' },
        );
        retry.streamCanonical.mockRejectedValue(conflict);

        await expect(
            retryEnvironment(2).run(
                executeInteractionFromActivity,
                retry.client,
                'testInteraction',
                { invocation_key: 'slot-a' },
                { value: 'changed' },
            ),
        ).rejects.toBe(conflict);
        expect(retry.requestSlot).not.toHaveBeenCalled();
        expect(retry.streamCanonical).toHaveBeenCalledOnce();
        expect(retry.streamCanonical.mock.calls[0][0]).toMatchObject({
            operation_id: originalOperationId,
            request: { data: { value: 'changed' } },
        });
    });

    it('reconstructs an accepted retry from its stored predecessor identity and error', async () => {
        const failed = canonicalResult({
            id: 'failed-predecessor',
            status: ExecutionRunStatus.failed,
            error: { message: 'provider failed', code: 'PROVIDER_FAILED', retryable: true },
        });
        const accepted = canonicalResult({ id: 'accepted-run' });
        const mocks = mockCanonicalClient(accepted);
        mocks.search.mockResolvedValue([
            { id: 'accepted-run', tags: ['workflow-predecessor:failed-predecessor'] },
            { id: 'failed-predecessor', tags: ['workflow-predecessor:initial'] },
        ]);
        mocks.retrieveCanonical
            .mockResolvedValueOnce(accepted)
            .mockResolvedValueOnce(failed)
            .mockResolvedValueOnce(accepted);

        await expect(
            retryEnvironment(3).run(
                executeInteractionFromActivity,
                mocks.client,
                'testInteraction',
                { include_previous_error: true, invocation_key: 'slot-a' },
                { value: 'same' },
            ),
        ).resolves.toBe(accepted);
        expect(mocks.streamCanonical).toHaveBeenCalledOnce();
        expect(mocks.streamCanonical.mock.calls[0][0].request).toMatchObject({
            data: {
                value: 'same',
                previous_error: { message: 'provider failed', code: 'PROVIDER_FAILED', retryable: true },
            },
            tags: expect.arrayContaining(['workflow-predecessor:failed-predecessor']),
        });
        expect(mocks.requestSlot).not.toHaveBeenCalled();
    });

    it('keeps an accepted retry pending until the exact operation yields response_accepted', async () => {
        const accepted = canonicalResult({ id: 'accepted-run' });
        const mocks = mockCanonicalClient(accepted);
        mocks.search.mockResolvedValue([{ id: 'accepted-run', tags: ['workflow-predecessor:initial'] }]);
        mocks.streamCanonical.mockResolvedValue(terminatedStream('accepted-run'));

        await expect(
            retryEnvironment(2).run(executeInteractionFromActivity, mocks.client, 'testInteraction', {}, {}),
        ).rejects.toMatchObject({ type: 'CanonicalStreamRecoveryPending', nonRetryable: false });
        expect(mocks.requestSlot).not.toHaveBeenCalled();
    });

    it('isolates same-interaction calls by stable invocation key and recovers each exact operation', async () => {
        const firstA = mockCanonicalClient();
        const firstB = mockCanonicalClient();
        await retryEnvironment(1).run(
            executeInteractionFromActivity,
            firstA.client,
            'testInteraction',
            { invocation_key: 'slot-a' },
            { value: 'a' },
        );
        await retryEnvironment(1).run(
            executeInteractionFromActivity,
            firstB.client,
            'testInteraction',
            { invocation_key: 'slot-b' },
            { value: 'b' },
        );

        const firstRequestA = firstA.streamCanonical.mock.calls[0][0];
        const firstRequestB = firstB.streamCanonical.mock.calls[0][0];
        const operationTagA = firstRequestA.request.tags?.find((tag: string) =>
            tag.startsWith('workflow-interaction:'),
        );
        const operationTagB = firstRequestB.request.tags?.find((tag: string) =>
            tag.startsWith('workflow-interaction:'),
        );
        expect(firstRequestA.operation_id).not.toBe(firstRequestB.operation_id);
        expect(firstRequestA.request.workflow?.rate_limit_id).not.toBe(firstRequestB.request.workflow?.rate_limit_id);
        expect(operationTagA).toBeDefined();
        expect(operationTagA).not.toBe(operationTagB);

        const acceptedA = canonicalResult({ id: 'accepted-a' });
        const acceptedB = canonicalResult({ id: 'accepted-b' });
        const retryA = mockCanonicalClient(acceptedA);
        const retryB = mockCanonicalClient(acceptedB);
        retryA.search.mockResolvedValue([{ id: 'accepted-a', tags: ['workflow-predecessor:initial'] }]);
        retryB.search.mockResolvedValue([{ id: 'accepted-b', tags: ['workflow-predecessor:initial'] }]);

        await retryEnvironment(2).run(
            executeInteractionFromActivity,
            retryA.client,
            'testInteraction',
            { invocation_key: 'slot-a' },
            { value: 'a' },
        );
        await retryEnvironment(2).run(
            executeInteractionFromActivity,
            retryB.client,
            'testInteraction',
            { invocation_key: 'slot-b' },
            { value: 'b' },
        );

        expect(retryA.search.mock.calls[0][0].query.tags).toEqual([operationTagA]);
        expect(retryB.search.mock.calls[0][0].query.tags).toEqual([operationTagB]);
        expect(retryA.streamCanonical.mock.calls[0][0].operation_id).toBe(firstRequestA.operation_id);
        expect(retryB.streamCanonical.mock.calls[0][0].operation_id).toBe(firstRequestB.operation_id);
        expect(retryA.requestSlot).not.toHaveBeenCalled();
        expect(retryB.requestSlot).not.toHaveBeenCalled();
    });

    it.each(['', 'contains spaces', 'contains/slash', `x${'a'.repeat(128)}`])(
        'rejects invalid invocation key %j before search, admission, or transport',
        async (invocationKey) => {
            const mocks = mockCanonicalClient();
            await expect(
                retryEnvironment(2).run(
                    executeInteractionFromActivity,
                    mocks.client,
                    'testInteraction',
                    { invocation_key: invocationKey },
                    {},
                ),
            ).rejects.toThrow('Interaction invocation_key must match');
            expect(mocks.search).not.toHaveBeenCalled();
            expect(mocks.requestSlot).not.toHaveBeenCalled();
            expect(mocks.streamCanonical).not.toHaveBeenCalled();
        },
    );

    it('rejects a non-string invocation key from malformed runtime input before identity construction', async () => {
        const mocks = mockCanonicalClient();
        await expect(
            retryEnvironment(2).run(
                executeInteractionFromActivity,
                mocks.client,
                'testInteraction',
                { invocation_key: 7 as unknown as string },
                {},
            ),
        ).rejects.toThrow('Interaction invocation_key must match');
        expect(mocks.search).not.toHaveBeenCalled();
        expect(mocks.requestSlot).not.toHaveBeenCalled();
        expect(mocks.streamCanonical).not.toHaveBeenCalled();
    });

    it('recovers a completed accepted generation despite stale failed run projection', async () => {
        const accepted = canonicalResult({
            id: 'accepted-run',
            status: ExecutionRunStatus.failed,
            generationStatus: 'completed',
            acceptedOutput: true,
            error: { message: 'stale host delivery failure', code: 'HOST_DELIVERY_FAILED', retryable: true },
        });
        const mocks = mockCanonicalClient(accepted);
        mocks.search.mockResolvedValue([{ id: 'accepted-run', tags: ['workflow-predecessor:initial'] }]);
        mocks.retrieveCanonical.mockResolvedValue(accepted);

        await expect(
            retryEnvironment(2).run(executeInteractionFromActivity, mocks.client, 'testInteraction', {}, {}),
        ).resolves.toBe(accepted);
        expect(mocks.requestSlot).not.toHaveBeenCalled();
        expect(mocks.streamCanonical).toHaveBeenCalledOnce();
    });

    it('returns an accepted cancelled generation with an interrupted turn as cutoff output', async () => {
        const cutoff = canonicalResult({
            generationStatus: 'cancelled',
            turnStatus: 'interrupted',
        });
        const mocks = mockCanonicalClient(cutoff);

        await expect(
            retryEnvironment(1).run(executeInteractionFromActivity, mocks.client, 'testInteraction', {}, {}),
        ).resolves.toBe(cutoff);
    });

    it('does not return an accepted fragment whose generation failed on a fresh execution', async () => {
        const failed = canonicalResult({
            status: ExecutionRunStatus.completed,
            generationStatus: 'failed',
            error: { message: 'provider rejected output', code: 'OUTPUT_FAILED', retryable: false },
        });
        const mocks = mockCanonicalClient(failed);

        const execution = retryEnvironment(1).run(
            executeInteractionFromActivity,
            mocks.client,
            'testInteraction',
            {},
            {},
        );
        await expect(execution).rejects.toMatchObject({ retryable: false, errorCode: 'OUTPUT_FAILED' });
        await execution.catch((error: unknown) => {
            expect(error).toBeInstanceOf(CanonicalInteractionExecutionError);
            expect(isCanonicalInteractionExecutionError(error)).toBe(true);
            if (isCanonicalInteractionExecutionError(error)) expect(error.result).toBe(failed);
        });
        expect(mocks.streamCanonical).toHaveBeenCalledOnce();
    });

    it('preserves persisted typed-stream retryability for workflow retry classification', async () => {
        const failed = canonicalResult({
            id: 'failed-stream-run',
            status: ExecutionRunStatus.failed,
            acceptedOutput: false,
            error: { message: 'Canonical provider stream failed', code: 'PROVIDER_STREAM_FAILED', retryable: true },
        });
        const mocks = mockCanonicalClient(failed);
        mocks.streamCanonical.mockResolvedValue(terminatedStream(failed.run.id));

        await expect(
            retryEnvironment(1).run(executeInteractionFromActivity, mocks.client, 'testInteraction', {}, {}),
        ).rejects.toMatchObject({ retryable: true, errorCode: 'PROVIDER_STREAM_FAILED' });
        expect(mocks.streamCanonical).toHaveBeenCalledOnce();
        expect(mocks.retrieveCanonical).toHaveBeenCalledWith(failed.run.id);
    });

    it.each([ExecutionRunStatus.failed, ExecutionRunStatus.completed, ExecutionRunStatus.processing])(
        'advances after response_accepted confirms canonical failure with host status %s',
        async (runStatus) => {
            const failed = canonicalResult({
                id: 'failed-run',
                status: runStatus,
                generationStatus: 'completed',
                turnStatus: 'failed',
                acceptedOutput: true,
                error: { message: 'provider failed', code: 'PROVIDER_FAILED', retryable: false },
            });
            const accepted = canonicalResult({ id: 'retry-run' });
            const mocks = mockCanonicalClient(accepted);
            mocks.search.mockResolvedValue([{ id: 'failed-run', tags: ['workflow-predecessor:initial'] }]);
            mocks.streamCanonical
                .mockResolvedValueOnce(acceptedStream('failed-run'))
                .mockResolvedValueOnce(acceptedStream('retry-run'));
            mocks.retrieveCanonical
                .mockResolvedValueOnce(failed)
                .mockResolvedValueOnce(failed)
                .mockResolvedValueOnce(accepted);

            await expect(
                retryEnvironment(2).run(
                    executeInteractionFromActivity,
                    mocks.client,
                    'testInteraction',
                    { include_previous_error: true },
                    {},
                ),
            ).resolves.toBe(accepted);
            expect(mocks.streamCanonical).toHaveBeenCalledTimes(2);
            expect(mocks.streamCanonical.mock.calls[1][0].operation_id).not.toBe(
                mocks.streamCanonical.mock.calls[0][0].operation_id,
            );
            expect(mocks.streamCanonical.mock.calls[1][0].request.data).toMatchObject({
                previous_error: { message: 'provider failed', code: 'PROVIDER_FAILED', retryable: false },
            });
        },
    );

    it.each([1, 2])(
        'rejects a targetless ingestion ACK instead of accepting a response on attempt %s',
        async (attempt) => {
            const environment = retryEnvironment(attempt);
            const heartbeatDetails: unknown[] = [];
            environment.on('heartbeat', (details) => heartbeatDetails.push(details));
            const accepted = canonicalResult({ id: 'accepted-run' });
            const mocks = mockCanonicalClient(accepted);
            if (attempt > 1) {
                mocks.search.mockResolvedValue([{ id: accepted.run.id, tags: ['workflow-predecessor:initial'] }]);
            }
            const ack = ExperimentalCanonicalInitialIngestionAcceptedSchema.parse({
                api_version: EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE,
                type: 'ingestion_accepted',
                run_id: accepted.run.id,
                operation_id: 'input-operation',
                accepted_source: { conversation_id: 'input-source', revision: 1 },
            });
            mocks.streamCanonical.mockImplementation(
                (_request: unknown, options?: CanonicalInteractionStreamSessionOptions) => {
                    options?.on_envelope?.(ack);
                    return Promise.resolve(acceptedStream(accepted.run.id));
                },
            );

            await expect(
                environment.run(executeCanonicalInteractionFromActivity, mocks.client, canonicalActivityPlan()),
            ).rejects.toThrow('cannot accept an initial ingestion ACK');
            expect(heartbeatDetails).toEqual([]);
            expect(mocks.streamCanonical).toHaveBeenCalledOnce();
            // A retry may inspect its historical row first, but the ACK never causes an accepted output read.
            expect(mocks.retrieveCanonical).toHaveBeenCalledTimes(attempt > 1 ? 1 : 0);
            expect(mocks.requestSlot).toHaveBeenCalledTimes(attempt > 1 ? 0 : 1);
        },
    );

    it('heartbeats while a provider stream is idle and clears the timer after settlement', async () => {
        vi.useFakeTimers();
        try {
            const environment = new MockActivityEnvironment({
                attempt: 1,
                activityId: 'activity-id',
                heartbeatTimeoutMs: 1_000,
                workflowExecution: { workflowId: 'workflow-id', runId: 'workflow-run-id' },
            });
            const heartbeatDetails: unknown[] = [];
            environment.on('heartbeat', (details) => heartbeatDetails.push(details));
            const mocks = mockCanonicalClient();
            let resolveStream: ((value: ReturnType<typeof acceptedStream>) => void) | undefined;
            mocks.streamCanonical.mockImplementation(
                () =>
                    new Promise((resolve) => {
                        resolveStream = resolve;
                    }),
            );

            const execution = environment.run(
                executeCanonicalInteractionFromActivity,
                mocks.client,
                canonicalActivityPlan(),
            );
            await vi.advanceTimersByTimeAsync(501);
            expect(heartbeatDetails).toContainEqual({ operation_id: expect.stringMatching(/^workflow-interaction:/) });

            resolveStream?.(acceptedStream());
            await execution;
            const settledCount = heartbeatDetails.length;
            await vi.advanceTimersByTimeAsync(20_000);
            expect(heartbeatDetails).toHaveLength(settledCount);
        } finally {
            vi.useRealTimers();
        }
    });

    it('reuses the exact operation when the prior run is not yet searchable', async () => {
        const mocks = mockCanonicalClient();
        await retryEnvironment(1).run(executeInteractionFromActivity, mocks.client, 'testInteraction', {}, {});
        await retryEnvironment(2).run(executeInteractionFromActivity, mocks.client, 'testInteraction', {}, {});

        expect(mocks.streamCanonical).toHaveBeenCalledTimes(2);
        expect(mocks.streamCanonical.mock.calls[0][0].operation_id).toBe(
            mocks.streamCanonical.mock.calls[1][0].operation_id,
        );
        expect(mocks.streamCanonical.mock.calls[0][0].request).toEqual(mocks.streamCanonical.mock.calls[1][0].request);
        expect(mocks.requestSlot).toHaveBeenCalledTimes(2);
        expect(mocks.requestSlot.mock.calls[0][0].rate_limit_id).toBe(mocks.requestSlot.mock.calls[1][0].rate_limit_id);
    });

    it('rechecks one stable admission reservation after a delayed first attempt', async () => {
        const mocks = mockCanonicalClient();
        mocks.requestSlot.mockResolvedValueOnce({ delay_ms: 5_000 }).mockResolvedValueOnce({ delay_ms: 0 });

        await expect(
            retryEnvironment(1).run(executeInteractionFromActivity, mocks.client, 'testInteraction', {}, {}),
        ).rejects.toMatchObject({ type: 'InteractionRateLimitRetry', nonRetryable: false, nextRetryDelay: 5_000 });
        await retryEnvironment(2).run(executeInteractionFromActivity, mocks.client, 'testInteraction', {}, {});

        expect(mocks.requestSlot).toHaveBeenCalledTimes(2);
        expect(mocks.requestSlot.mock.calls[0][0].rate_limit_id).toBe(mocks.requestSlot.mock.calls[1][0].rate_limit_id);
        expect(mocks.streamCanonical).toHaveBeenCalledOnce();
        expect(mocks.streamCanonical.mock.calls[0][0].request.workflow?.rate_limit_id).toBe(
            mocks.requestSlot.mock.calls[1][0].rate_limit_id,
        );
    });

    it('resumes an active operation without obtaining a second admission slot', async () => {
        const active = canonicalResult({ id: 'active-run', status: ExecutionRunStatus.processing });
        const accepted = canonicalResult({ id: 'active-run' });
        const mocks = mockCanonicalClient(accepted);
        mocks.search.mockResolvedValue([{ id: 'active-run', tags: ['workflow-predecessor:initial'] }]);
        mocks.retrieveCanonical.mockResolvedValueOnce(active).mockResolvedValueOnce(accepted);

        await retryEnvironment(2).run(executeInteractionFromActivity, mocks.client, 'testInteraction', {}, {});
        expect(mocks.requestSlot).not.toHaveBeenCalled();
        expect(mocks.streamCanonical).toHaveBeenCalledOnce();
    });

    it('starts a new bound operation only after a previous failure is confirmed', async () => {
        const first = mockCanonicalClient();
        await retryEnvironment(1).run(executeInteractionFromActivity, first.client, 'testInteraction', {}, {});
        const firstOperation = first.streamCanonical.mock.calls[0][0].operation_id;

        const failure = canonicalResult({
            id: 'failed-run',
            status: ExecutionRunStatus.failed,
            error: { message: 'provider failed', code: 'PROVIDER_FAILED', retryable: true },
        });
        const accepted = canonicalResult({ id: 'retry-run' });
        const retry = mockCanonicalClient(accepted);
        retry.search.mockResolvedValue([{ id: 'failed-run', tags: ['workflow-predecessor:initial'] }]);
        retry.streamCanonical
            .mockResolvedValueOnce(terminatedStream('failed-run'))
            .mockResolvedValueOnce(acceptedStream('retry-run'));
        retry.retrieveCanonical
            .mockResolvedValueOnce(failure)
            .mockResolvedValueOnce(failure)
            .mockResolvedValueOnce(accepted);

        await retryEnvironment(2).run(
            executeInteractionFromActivity,
            retry.client,
            'testInteraction',
            {
                include_previous_error: true,
            },
            {},
        );
        expect(retry.streamCanonical.mock.calls[0][0].operation_id).toBe(firstOperation);
        const retryRequest = retry.streamCanonical.mock.calls[1][0];
        expect(retryRequest.operation_id).not.toBe(firstOperation);
        expect(retryRequest.request.data).toMatchObject({
            previous_error: { message: 'provider failed', code: 'PROVIDER_FAILED', retryable: true },
        });
        expect(retry.requestSlot).toHaveBeenCalledOnce();
    });

    it('reconstructs an active retry from its confirmed predecessor even when search omits that predecessor', async () => {
        const failure = canonicalResult({
            id: 'failed-predecessor',
            status: ExecutionRunStatus.failed,
            error: { message: 'provider failed', code: 'PROVIDER_FAILED', retryable: true },
        });
        const active = canonicalResult({ id: 'active-run', status: ExecutionRunStatus.processing });
        const accepted = canonicalResult({ id: 'active-run' });
        const mocks = mockCanonicalClient(accepted);
        mocks.search.mockResolvedValue([{ id: 'active-run', tags: ['workflow-predecessor:failed-predecessor'] }]);
        mocks.retrieveCanonical
            .mockResolvedValueOnce(active)
            .mockResolvedValueOnce(failure)
            .mockResolvedValueOnce(accepted);

        await retryEnvironment(3).run(
            executeInteractionFromActivity,
            mocks.client,
            'testInteraction',
            { include_previous_error: true },
            {},
        );

        expect(mocks.requestSlot).not.toHaveBeenCalled();
        expect(mocks.streamCanonical.mock.calls[0][0].request.data).toMatchObject({
            previous_error: { message: 'provider failed', code: 'PROVIDER_FAILED', retryable: true },
        });
        expect(mocks.retrieveCanonical).toHaveBeenCalledWith('failed-predecessor');
    });

    it('retries a failed Mongo run at the same operation until its stream terminal is authoritative', async () => {
        const failure = canonicalResult({
            id: 'failed-run',
            status: ExecutionRunStatus.failed,
            error: { message: 'provider failed', code: 'PROVIDER_FAILED', retryable: true },
        });
        const mocks = mockCanonicalClient();
        mocks.search.mockResolvedValue([{ id: 'failed-run', tags: ['workflow-predecessor:initial'] }]);
        mocks.retrieveCanonical.mockResolvedValue(failure);
        const pending = new ServerError(
            'Canonical stream dispatch outcome is indeterminate',
            new Request('https://studio.test/api/v1/runs/canonical-stream'),
            409,
            { errorCode: CANONICAL_STREAM_RECOVERY_PENDING_ERROR_CODE },
        );
        mocks.streamCanonical.mockRejectedValue(pending);

        await expect(
            retryEnvironment(2).run(executeInteractionFromActivity, mocks.client, 'testInteraction', {}, {}),
        ).rejects.toMatchObject({ type: 'CanonicalStreamRecoveryPending', nonRetryable: false });
        expect(mocks.requestSlot).not.toHaveBeenCalled();
        expect(mocks.streamCanonical).toHaveBeenCalledOnce();
        expect(mocks.streamCanonical.mock.calls[0][0].request.tags).toContain('workflow-predecessor:initial');
    });

    it('preserves a canonical stream HTTP error whose payload is null', async () => {
        const mocks = mockCanonicalClient();
        const error = new ServerError(
            'Canonical stream failed',
            new Request('https://studio.test/api/v1/runs/canonical-stream'),
            500,
            null,
        );
        mocks.streamCanonical.mockRejectedValue(error);

        await expect(
            retryEnvironment(1).run(executeInteractionFromActivity, mocks.client, 'testInteraction', {}, {}),
        ).rejects.toBe(error);
    });

    it('projects canonical JSON and verified image bytes at the legacy DSL boundary', async () => {
        const { setupActivity } = await import('../dsl/setup/ActivityContext.js');
        const bytes = new Uint8Array([1, 2, 3, 4]);
        const hash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
        const result = canonicalResult({
            blocks: [
                { id: 'json-block', type: 'json', value: { answer: 42 } },
                {
                    id: 'tool-call-block',
                    type: 'tool_call',
                    call_id: 'call-1',
                    tool_name: 'lookup',
                    arguments: { type: 'json', value: { query: 'record' } },
                    executor: 'application',
                },
                { id: 'image-block', type: 'image', asset_id: 'image-asset' },
            ],
            assets: {
                'image-asset': {
                    id: 'image-asset',
                    kind: 'image',
                    mime_type: 'image/png',
                    storage: { type: 'inline_base64', data: Buffer.from(bytes).toString('base64') },
                    provenance: { type: 'generated', generation_id: 'generation-id' },
                    byte_length: bytes.byteLength,
                    content_hash: hash,
                    created_at: '2026-01-01T00:00:00.000Z',
                },
            },
        });
        const mocks = mockCanonicalClient(result);
        mocks.uploadFile.mockImplementation(async (source) => {
            expect(source.type).toBe('image/png');
            const uploaded: Uint8Array[] = [];
            for await (const chunk of source.stream) uploaded.push(chunk);
            expect(Buffer.concat(uploaded)).toEqual(Buffer.from(bytes));
            return 'uploaded-image-id';
        });
        const payload = createPayload();
        vi.mocked(setupActivity).mockResolvedValue({
            client: mocks.client,
            inputType: 'objectIds',
            params: payload.params,
        } as unknown as ActivityContext<ExecuteInteractionParams>);

        await expect(testEnv.run(executeInteraction, payload)).resolves.toMatchObject({
            runId: 'run-id',
            result: [
                { type: 'json', value: { answer: 42 } },
                { type: 'image', value: 'uploaded-image-id' },
            ],
        });
        expect(mocks.uploadFile).toHaveBeenCalledOnce();
    });

    it('projects the supported legacy run view from retained canonical output when legacy result retention is unavailable', async () => {
        const { setupActivity } = await import('../dsl/setup/ActivityContext.js');
        const result = canonicalResult({ blocks: [{ id: 'text-block', type: 'text', text: 'answer' }] });
        result.run.retention = RunDataStorageLevel.RESTRICTED;
        const mocks = mockCanonicalClient(result);
        mocks.retrieve.mockResolvedValue({
            id: 'run-id',
            environment: 'environment-id',
            config: { temperature: 0.2 },
            result: undefined,
            token_use: undefined,
        });
        const payload = createPayload();
        payload.params.config = { run_data: RunDataStorageLevel.RESTRICTED };
        payload.activity.projection = {
            finish: '${#.finish_reason}',
            id: '${#.id}',
            duration: '${#.execution_time}',
            environment: '${#.environment}',
            model: '${#.modelId}',
            prompt: '${#.token_use.prompt}',
            promptCached: '${#.token_use.prompt_cached}',
            promptNew: '${#.token_use.prompt_new}',
            resultTokens: '${#.token_use.result}',
            text: '${#.result[0].value}',
            total: '${#.token_use.total}',
        };
        vi.mocked(setupActivity).mockResolvedValue({
            client: mocks.client,
            inputType: 'objectIds',
            params: payload.params,
        } as unknown as ActivityContext<ExecuteInteractionParams>);

        await expect(testEnv.run(executeInteraction, payload)).resolves.toEqual({
            duration: 321,
            environment: 'environment-id',
            finish: 'stop',
            id: 'run-id',
            model: 'resolved-model-id',
            prompt: 10,
            promptCached: 4,
            promptNew: 6,
            resultTokens: 3,
            text: 'answer',
            total: 13,
        });
        expect(mocks.retrieve).toHaveBeenCalledWith('run-id');
    });
});
