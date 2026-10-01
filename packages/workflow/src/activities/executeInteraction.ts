import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import {
    type CompletionResult,
    type HttpTimeoutOptions,
    type JSONSchema,
    LlumiverseError,
    type ModelOptions,
} from '@llumiverse/common';
import { ApplicationFailure, activityInfo, Context, log } from '@temporalio/activity';
import type { RateLimitMetadata } from '@vertesia/api-fetch-client';
import type {
    CanonicalInteractionOutput,
    EnhancedExperimentalCanonicalInteractionExecutionResult,
    VertesiaClient,
} from '@vertesia/client';
import { NodeStreamSource } from '@vertesia/client/node';
import {
    CANONICAL_STREAM_RECOVERY_PENDING_ERROR_CODE,
    type ConversationOutputAsset,
    type ConversationOutputGenerationUsage,
    type DSLActivityExecutionPayload,
    type DSLActivitySpec,
    ExecutionRunStatus,
    type ExecutionRunWorkflow,
    type ExperimentalCanonicalNamedInteractionExecutionRequest,
    type InteractionExecutionConfiguration,
    RunDataStorageLevel,
    type RunSearchPayload,
} from '@vertesia/common';
import { projectResult } from '../dsl/projections.js';
import { setupActivity } from '../dsl/setup/ActivityContext.js';
import { ActivityParamInvalidError, ActivityParamNotFoundError, ResourceExhaustedError } from '../errors.js';
import { activityWorkflowExecution } from '../utils/activity-info.js';
import { type TruncateSpec, truncByMaxTokens } from '../utils/tokens.js';

//Example:
//@ts-expect-error
const _JSON: DSLActivitySpec = {
    name: 'executeInteraction',
    import: ['defaultModel', 'guidlineId', 'docTypeId'],
    params: {
        defaultModel: '${model}',
        interactionName: 'GenerateSummary',
        model: "${defaultModel ?? 'gpt4'}",
        environment: '13456',
        max_tokens: 100,
        temperature: 0.5,
        tags: ['test'],
        result_schema: '${docType.object_schema}',
        prompt_data: {
            documents: '${documents}',
            guidline: '${guidline.text}',
        },
    },
    fetch: {
        documents: {
            type: 'document',
            query: {
                id: { $in: '${objectIds}' },
            },
            select: '+text',
        },
        guidline: {
            type: 'document',
            limit: 1,
            query: {
                id: '${guidlineId}',
            },
            select: '+text',
            on_not_found: 'throw',
        },
        docType: {
            type: 'document_type',
            limit: 1,
            query: {
                id: '${docTypeId}',
            },
            select: '+object_schema',
        },
    },
};

interface ApiRateLimitedRequestError extends Error {
    status: number;
    rateLimit: RateLimitMetadata;
}

interface ProviderRateLimitedRequestError extends Error {
    status: number;
    retryAfterMs?: number;
}

interface InteractionRateLimitApplicationFailure extends Error {
    type: 'CanonicalStreamRecoveryPending' | 'InteractionRateLimitRetry' | 'ProviderRateLimitRetry';
    nonRetryable: false;
    nextRetryDelay?: number;
}

function isApiRateLimitedRequestError(error: unknown): error is ApiRateLimitedRequestError {
    if (!(error instanceof Error)) return false;
    const candidate = error as Partial<ApiRateLimitedRequestError>;
    return (
        candidate.status === 429 &&
        candidate.rateLimit !== undefined &&
        (candidate.rateLimit.reason === 'pacing' || candidate.rateLimit.reason === 'quota') &&
        Number.isFinite(candidate.rateLimit.retryAfterMs) &&
        candidate.rateLimit.retryAfterMs >= 0
    );
}

function isProviderRateLimitedRequestError(error: unknown): error is ProviderRateLimitedRequestError {
    if (!(error instanceof Error)) return false;
    const candidate = error as Partial<ProviderRateLimitedRequestError & ApiRateLimitedRequestError>;
    return candidate.status === 429 && candidate.rateLimit === undefined;
}

function isInteractionRateLimitApplicationFailure(error: unknown): error is InteractionRateLimitApplicationFailure {
    if (!(error instanceof Error)) return false;
    const candidate = error as Partial<InteractionRateLimitApplicationFailure>;
    return (
        (candidate.type === 'CanonicalStreamRecoveryPending' ||
            candidate.type === 'InteractionRateLimitRetry' ||
            candidate.type === 'ProviderRateLimitRetry') &&
        candidate.nonRetryable === false
    );
}

/**
 * Preserve rate-limit timing across activities that call executeInteractionFromActivity directly.
 * API limiter errors stay typed for the worker interceptor; provider delays become durable Temporal timers.
 */
export function getInteractionRateLimitFailure(error: unknown, interactionName: string): Error | undefined {
    if (isInteractionRateLimitApplicationFailure(error)) {
        return error;
    }
    if (isApiRateLimitedRequestError(error)) {
        return error;
    }
    if (isProviderRateLimitedRequestError(error)) {
        return ApplicationFailure.create({
            message: `Provider rate limit while executing ${interactionName}: ${error.message}`,
            type: 'ProviderRateLimitRetry',
            nonRetryable: false,
            ...(error.retryAfterMs !== undefined ? { nextRetryDelay: error.retryAfterMs } : {}),
        });
    }
    return undefined;
}

export interface InteractionExecutionParams {
    /**
     * Execution configuration shared across workflow-driven interaction calls.
     * Activity-level fields below override this object for backward compatibility.
     */
    config?: InteractionExecutionConfiguration;

    /**
     * The environment to use. If not specified the project default environment will be used.
     * If the latter is not specified an exception will be thrown.
     */
    environment?: string;
    /**
     * The model to use. If not specified the project default model will be used.
     * If the latter is not specified the default model of the environment will be used.
     * If the latter is not specified an exception will be thrown.
     */
    model?: string;

    /**
     * Request a JSON schema for the result
     */
    result_schema?: JSONSchema | null;

    /** Wether to validate the result against the schema */
    validate_result?: boolean;

    /**
     * Tags to add to the execution run
     */
    tags?: string[];

    /**
     * Wether or not to include the previous error in the interaction prompt data
     */
    include_previous_error?: boolean;

    /**
     * Options to control generation
     */
    model_options?: ModelOptions;

    /**
     * Per-run HTTP timeouts for upstream LLM-provider calls.
     */
    http_timeout?: HttpTimeoutOptions;

    /**
     * activity won't be retried if it fails due to resource exhaustion (429)
     */
    exit_on_resource_exhaustion?: boolean;

    /**
     * Stable caller-owned identity for one logical interaction invocation within an activity.
     * Reuse the same key when Temporal retries that invocation and use a distinct key for each
     * independent call to the same interaction from the same activity.
     */
    invocation_key?: string;

    /** Agent run that owns this nested interaction for hierarchy and telemetry attribution. */
    agent_run_id?: string;
}

/**
 * TODO: must be kept in sync with InteractionAsyncExecutionPayload form @vertesia/common
 * Also see the executeInteractionAsync endpoint on the server for how the client payload is sent to the workflow.
 * (interaction is translated to interactionName)
 */
export interface ExecuteInteractionParams extends InteractionExecutionParams {
    //TODO rename to interaction as in InteractionAsyncExecutionPayload
    interactionName: string;
    prompt_data: Record<string, unknown>;
    /**
     * Additional prompt data passed by the workflow configuration. This will be merged with prompt_data if any.
     * You should use `import: ["static_prompt_data"]` to import the workflow prompt data as static_prompt_data param.
     * Otherwise the workflow prompt data will be ignored.
     */
    static_prompt_data?: Record<string, unknown>;
    truncate?: Record<string, TruncateSpec>;
}

export interface ExecuteInteraction extends DSLActivitySpec<ExecuteInteractionParams> {
    name: 'executeInteraction';
}

const MAX_PROJECTED_MEDIA_BYTES = 50 * 1024 * 1024;
const MAX_PROJECTED_MEDIA_CHUNKS = 16_384;
const MAX_WORKFLOW_INVOCATION_KEY_LENGTH = 128;
const WORKFLOW_INTERACTION_TAG_PREFIX = 'workflow-interaction:';
const WORKFLOW_PREDECESSOR_TAG_PREFIX = 'workflow-predecessor:';
const WORKFLOW_SERVICE_TIER_POLICY_TAG_PREFIX = 'workflow-service-tier-policy:';
const FLEX_THEN_DEFAULT_SERVICE_TIER_POLICY = 'flex_then_default' as const;
const REQUIRED_TOOL_CALL_MISSING_ERROR_CODE = 'RequiredToolCallMissingError';
const WORKFLOW_INVOCATION_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const WORKFLOW_RESERVED_TAG_PREFIXES = [
    WORKFLOW_PREDECESSOR_TAG_PREFIX,
    WORKFLOW_INTERACTION_TAG_PREFIX,
    WORKFLOW_SERVICE_TIER_POLICY_TAG_PREFIX,
] as const;

type CanonicalWorkflowRequest = ExperimentalCanonicalNamedInteractionExecutionRequest & {
    workflow: ExecutionRunWorkflow;
};

/**
 * Complete canonical request fields supplied by a workflow activity before host-owned execution identity is attached.
 *
 * The executor derives `workflow`, operation, invocation, and rate-limit identities from the active Temporal activity.
 * Keeping `workflow` out of this input prevents a caller from selecting another durable execution lineage.
 */
export type CanonicalInteractionActivityRequest = Omit<
    ExperimentalCanonicalNamedInteractionExecutionRequest,
    'workflow'
>;

export interface CanonicalInteractionActivityPlan {
    request: CanonicalInteractionActivityRequest;
    /** Stable caller-owned key used as one input to the host-derived operation and rate-limit identities. */
    invocation_key?: string;
    /** Start this logical invocation on Flex and use Default only for successors of confirmed terminal failures. */
    service_tier_policy?: typeof FLEX_THEN_DEFAULT_SERVICE_TIER_POLICY;
    /** Include a confirmed predecessor failure in the next request's `data.previous_error`. */
    include_previous_error?: boolean;
    /** Agent run attribution carried by the trusted workflow activity. */
    agent_run_id?: string;
}

interface CanonicalRetryState {
    accepted?: EnhancedExperimentalCanonicalInteractionExecutionResult;
    active: boolean;
    operation_predecessor_run_id?: string;
    previous_error?: EnhancedExperimentalCanonicalInteractionExecutionResult['run']['error'];
    failed_candidate?: EnhancedExperimentalCanonicalInteractionExecutionResult;
}

function workflowInteractionTag(rateLimitId: string): string {
    return `${WORKFLOW_INTERACTION_TAG_PREFIX}${createHash('sha256').update(rateLimitId).digest('hex')}`;
}

function workflowInteractionOperationId(rateLimitId: string, predecessorRunId?: string): string {
    return `workflow-interaction:${createHash('sha256')
        .update(`${rateLimitId}:${predecessorRunId ?? 'initial'}`)
        .digest('hex')}`;
}

function workflowPredecessorTag(predecessorRunId?: string): string {
    return `${WORKFLOW_PREDECESSOR_TAG_PREFIX}${predecessorRunId ?? 'initial'}`;
}

function predecessorFromTags(tags: readonly string[] | undefined): string | undefined | null {
    const values =
        tags
            ?.filter((tag) => tag.startsWith(WORKFLOW_PREDECESSOR_TAG_PREFIX))
            .map((tag) => tag.slice(WORKFLOW_PREDECESSOR_TAG_PREFIX.length)) ?? [];
    if (values.length !== 1 || values[0].length === 0) return null;
    return values[0] === 'initial' ? undefined : values[0];
}

export class CanonicalInteractionExecutionError extends ApplicationFailure {
    readonly errorCode?: string;
    readonly retryable?: boolean;

    override get name(): string {
        return 'CanonicalInteractionExecutionError';
    }

    constructor(
        interactionName: string,
        readonly result: EnhancedExperimentalCanonicalInteractionExecutionResult,
    ) {
        const source = result.run.error;
        const type =
            source?.code === REQUIRED_TOOL_CALL_MISSING_ERROR_CODE
                ? REQUIRED_TOOL_CALL_MISSING_ERROR_CODE
                : 'CanonicalInteractionExecutionError';
        super(
            `Interaction Execution failed ${interactionName}: ${source?.message || 'Unknown error'}`,
            type,
            source?.retryable === false,
        );
        this.retryable = source?.retryable;
        this.errorCode = source?.code;
    }
}

export function isCanonicalInteractionExecutionError(error: unknown): error is CanonicalInteractionExecutionError {
    return error instanceof CanonicalInteractionExecutionError;
}

function canonicalExecutionError(
    interactionName: string,
    result: EnhancedExperimentalCanonicalInteractionExecutionResult,
): CanonicalInteractionExecutionError {
    return new CanonicalInteractionExecutionError(interactionName, result);
}

export function requireCanonicalInteractionOutput<T = unknown>(
    result: EnhancedExperimentalCanonicalInteractionExecutionResult<T>,
): CanonicalInteractionOutput<T> {
    if (!result.canonicalOutput) {
        throw new Error(`Canonical interaction run ${result.run.id} has no accepted output`);
    }
    return result.canonicalOutput;
}

function isCanonicalInteractionSuccess(result: EnhancedExperimentalCanonicalInteractionExecutionResult): boolean {
    return result.output.status === 'accepted' && !isCanonicalInteractionFailure(result);
}

function isCanonicalInteractionFailure(result: EnhancedExperimentalCanonicalInteractionExecutionResult): boolean {
    return result.output.status === 'accepted'
        ? result.output.fragment.generation.status === 'failed' || result.output.fragment.turn.status === 'failed'
        : result.run.status === ExecutionRunStatus.failed;
}

async function inspectCanonicalRetryState(
    client: VertesiaClient,
    workflowRunId: string,
    operationTag: string,
): Promise<CanonicalRetryState> {
    const payload: RunSearchPayload = {
        query: { workflow_run_ids: [workflowRunId], tags: [operationTag] },
        limit: 100,
        sort: [{ field: 'created_at', order: 'desc' }],
    };
    const refs = (await client.runs.search(payload)) ?? [];
    const entries: Array<{
        ref: (typeof refs)[number];
        result: EnhancedExperimentalCanonicalInteractionExecutionResult;
    }> = [];

    let accepted:
        | {
              ref: (typeof refs)[number];
              result: EnhancedExperimentalCanonicalInteractionExecutionResult;
          }
        | undefined;
    for (const ref of refs) {
        const result = await client.runs.retrieveCanonical(ref.id);
        if (!accepted && isCanonicalInteractionSuccess(result)) accepted = { ref, result };
        entries.push({ ref, result });
    }
    if (refs.length >= 100) {
        throw new Error('Canonical interaction retry history exceeds the bounded activity recovery window');
    }

    const resolvePredecessor = async (ref: (typeof refs)[number]) => {
        const predecessorRunId = predecessorFromTags(ref.tags);
        if (predecessorRunId === null) {
            throw ApplicationFailure.create({
                message: 'Canonical interaction operation lacks predecessor identity',
                type: 'CanonicalStreamRecoveryPending',
                nonRetryable: false,
            });
        }
        if (predecessorRunId === undefined) return {};
        const predecessor =
            entries.find(({ result }) => result.run.id === predecessorRunId)?.result ??
            (await client.runs.retrieveCanonical(predecessorRunId));
        if (!isCanonicalInteractionFailure(predecessor)) {
            throw ApplicationFailure.create({
                message: 'Canonical interaction predecessor is not yet durably failed',
                type: 'CanonicalStreamRecoveryPending',
                nonRetryable: false,
            });
        }
        return { operation_predecessor_run_id: predecessor.run.id, previous_error: predecessor.run.error };
    };

    if (accepted) {
        return { accepted: accepted.result, active: false, ...(await resolvePredecessor(accepted.ref)) };
    }

    const active = entries.find(
        ({ result }) =>
            !isCanonicalInteractionFailure(result) &&
            (result.run.status === ExecutionRunStatus.created || result.run.status === ExecutionRunStatus.processing),
    );
    if (active) return { active: true, ...(await resolvePredecessor(active.ref)) };

    const failed = entries.find(({ result }) => isCanonicalInteractionFailure(result));
    if (!failed) return { active: false };
    return {
        active: false,
        ...(await resolvePredecessor(failed.ref)),
        failed_candidate: failed.result,
    };
}
function contentHash(bytes: Uint8Array): string {
    return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function assertAssetIntegrity(asset: ConversationOutputAsset, bytes: Uint8Array): void {
    if (asset.byte_length === undefined || asset.content_hash === undefined) {
        throw new Error(`Canonical generated asset ${asset.id} lacks byte integrity evidence`);
    }
    if (bytes.byteLength !== asset.byte_length || contentHash(bytes) !== asset.content_hash) {
        throw new Error(`Canonical generated asset ${asset.id} failed byte integrity verification`);
    }
}

async function readBoundedMedia(
    stream: ReadableStream<Uint8Array>,
    asset: ConversationOutputAsset,
): Promise<Uint8Array> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let byteLength = 0;
    let chunkCount = 0;
    try {
        while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            chunkCount += 1;
            byteLength += chunk.value.byteLength;
            if (chunkCount > MAX_PROJECTED_MEDIA_CHUNKS || byteLength > MAX_PROJECTED_MEDIA_BYTES) {
                throw new Error(`Canonical generated asset ${asset.id} exceeds the workflow projection limit`);
            }
            chunks.push(chunk.value);
        }
    } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
    }
    const bytes = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return bytes;
}

async function materializeCanonicalAsset(client: VertesiaClient, asset: ConversationOutputAsset): Promise<Uint8Array> {
    let bytes: Uint8Array;
    if (asset.storage.type === 'inline_base64') {
        const estimatedByteLength = Math.floor((asset.storage.data.length * 3) / 4);
        if (estimatedByteLength > MAX_PROJECTED_MEDIA_BYTES) {
            throw new Error(`Canonical generated asset ${asset.id} exceeds the workflow projection limit`);
        }
        bytes = Buffer.from(asset.storage.data, 'base64');
    } else if (
        asset.storage.type === 'external' &&
        asset.storage.resolver === 'url' &&
        typeof asset.storage.locator.url === 'string'
    ) {
        bytes = await readBoundedMedia(await client.files.downloadFile(asset.storage.locator.url), asset);
    } else {
        throw new Error(`Canonical generated asset ${asset.id} has no supported workflow media resolver`);
    }
    if (bytes.byteLength > MAX_PROJECTED_MEDIA_BYTES) {
        throw new Error(`Canonical generated asset ${asset.id} exceeds the workflow projection limit`);
    }
    assertAssetIntegrity(asset, bytes);
    return bytes;
}

function canonicalLegacyTokenUse(usage: ConversationOutputGenerationUsage | undefined) {
    if (!usage) return undefined;
    return {
        ...(usage.input_tokens === undefined ? {} : { prompt: usage.input_tokens }),
        ...(usage.output_tokens === undefined ? {} : { result: usage.output_tokens }),
        ...(usage.total_tokens === undefined ? {} : { total: usage.total_tokens }),
        ...(usage.cache_read_tokens === undefined ? {} : { prompt_cached: usage.cache_read_tokens }),
        ...(usage.cache_write_tokens === undefined ? {} : { prompt_cache_write: usage.cache_write_tokens }),
        ...(usage.input_new_tokens === undefined ? {} : { prompt_new: usage.input_new_tokens }),
    };
}

/**
 * Temporary compatibility projection for workflow/tool boundaries that still expose CompletionResult[].
 * Canonical output remains authoritative; callers must not persist this projection as conversation history.
 */
export async function projectCanonicalCompletionResults(
    client: VertesiaClient,
    result: EnhancedExperimentalCanonicalInteractionExecutionResult,
): Promise<CompletionResult[]> {
    const output = requireCanonicalInteractionOutput(result);
    const completion: CompletionResult[] = [];
    for (const [index, block] of output.blocks.entries()) {
        if (block.type === 'text') {
            completion.push({ type: 'text', value: block.text });
        } else if (block.type === 'reasoning') {
            completion.push({ type: 'thoughts', value: block.text });
        } else if (block.type === 'json') {
            completion.push({ type: 'json', value: block.value });
        } else if (block.type === 'image') {
            const asset = output.asset(block.asset_id);
            const bytes = await materializeCanonicalAsset(client, asset);
            const execution = activityWorkflowExecution();
            const info = activityInfo();
            const filename = `generated-image-${execution.runId}-${info.activityId}-${index}.png`;
            const file = await client.files.uploadFile(
                new NodeStreamSource(Readable.from(bytes), filename, asset.mime_type),
            );
            completion.push({ type: 'image', value: file });
        } else if (block.type === 'audio' || block.type === 'video') {
            const asset = output.asset(block.asset_id);
            if (
                asset.storage.type === 'external' &&
                asset.storage.resolver === 'url' &&
                typeof asset.storage.locator.url === 'string'
            ) {
                completion.push(
                    block.type === 'audio'
                        ? { type: 'audio', value: asset.storage.locator.url, mime_type: asset.mime_type }
                        : { type: 'video', value: asset.storage.locator.url },
                );
            } else {
                const bytes = await materializeCanonicalAsset(client, asset);
                const value = `data:${asset.mime_type};base64,${Buffer.from(bytes).toString('base64')}`;
                completion.push(
                    block.type === 'audio'
                        ? { type: 'audio', value, mime_type: asset.mime_type }
                        : { type: 'video', value },
                );
            }
        } else {
            throw new Error(`Canonical ${block.type} output cannot be projected to the legacy workflow DSL`);
        }
    }
    return completion;
}

export async function executeInteraction(payload: DSLActivityExecutionPayload<ExecuteInteractionParams>) {
    const { client, params } = await setupActivity<ExecuteInteractionParams>(payload);

    const { interactionName, prompt_data, static_prompt_data: wf_prompt_data } = params;
    if (wf_prompt_data) {
        Object.assign(prompt_data, wf_prompt_data);
    }

    if (!interactionName) {
        log.error('Missing interactionName', { params });
        throw new ActivityParamNotFoundError('interactionName', payload.activity);
    }

    if (params.truncate) {
        const truncate = params.truncate;
        for (const [key, value] of Object.entries(truncate)) {
            const promptValue = prompt_data[key];
            if (typeof promptValue === 'string') {
                prompt_data[key] = truncByMaxTokens(promptValue, value);
            }
        }
    }

    try {
        const res = await executeInteractionFromActivity(
            client,
            interactionName,
            params,
            prompt_data,
            payload.debug_mode,
        );

        const completionResult = await projectCanonicalCompletionResults(client, res);
        const fallback = { runId: res.run.id, status: res.run.status, result: completionResult };
        if (!payload.activity.projection) return fallback;

        // Custom DSL projections are an explicit ephemeral compatibility boundary. Retain legacy run metadata while
        // overlaying authoritative accepted output so NONE retention cannot erase projected content or accounting.
        const legacyRun = await client.runs.retrieve(res.run.id);
        const generation = requireCanonicalInteractionOutput(res).fragment.generation;
        const projectionSource = {
            ...legacyRun,
            ...res.run,
            id: res.run.id,
            modelId: generation.resolved_model ?? generation.requested_model,
            finish_reason: generation.finish_reason,
            token_use: canonicalLegacyTokenUse(generation.usage),
            execution_time: generation.timestamps.provider_duration_ms ?? legacyRun.execution_time,
            result: completionResult,
        };
        return projectResult(payload, params, projectionSource, fallback);
    } catch (error: unknown) {
        // Preserve admission failures raised before executeByName and the provider failures
        // normalized by executeInteractionFromActivity.
        const rateLimitFailure = getInteractionRateLimitFailure(error, interactionName);
        if (rateLimitFailure) {
            // Rate-limit/backoff: Temporal retries the activity, so this is not a service failure.
            log.warn(`Rate limited while executing interaction ${interactionName}; retrying`, {
                error: rateLimitFailure,
            });
            throw rateLimitFailure;
        }
        const executionError = toExecutionError(error);
        if (isRenditionPending(executionError)) {
            log.warn(`Interaction ${interactionName} is waiting for a rendition`, { error: executionError });
        } else if (executionError.statusCode === 429) {
            log.warn(`Resource exhausted while executing interaction ${interactionName}`, { error: executionError });
        } else {
            log.error(`Failed to execute interaction ${interactionName}`, { error: executionError });
        }
        if (executionError.statusCode === 429 && params.exit_on_resource_exhaustion) {
            throw new ResourceExhaustedError(executionError.statusCode, 'Resource exhausted - rate limit exceeded');
        } else if (executionError.message.includes('Failed to validate merged prompt schema')) {
            //issue with the input data, don't retry
            throw new ActivityParamInvalidError('prompt_data', payload.activity, executionError.message);
        } else if (executionError.message.includes('modelId: Path `modelId` is required')) {
            //issue with the input data, don't retry
            throw new ActivityParamInvalidError('model', payload.activity, executionError.message);
        }

        // Check retryability from error object (set by executeInteractionFromActivity)
        // or from LlumiverseError instance (direct driver errors in some paths)
        const isRetryable =
            executionError.retryable !== undefined
                ? executionError.retryable
                : error instanceof LlumiverseError
                  ? error.retryable !== false
                  : undefined;

        if (executionError.errorCode === REQUIRED_TOOL_CALL_MISSING_ERROR_CODE) {
            throw ApplicationFailure.create({
                message: `Non-retryable Interaction Execution failed ${interactionName}: ${executionError.message}`,
                type: REQUIRED_TOOL_CALL_MISSING_ERROR_CODE,
                nonRetryable: true,
            });
        }

        if (isRetryable !== undefined) {
            if (isRetryable) {
                log.debug('Marking error as retryable', { interactionName, errorCode: executionError.errorCode });
                throw ApplicationFailure.create({
                    message: `Interaction Execution failed ${interactionName}: ${executionError.message}`,
                    nonRetryable: false,
                });
            } else {
                log.debug('Marking error as non-retryable', { interactionName, errorCode: executionError.errorCode });
                throw ApplicationFailure.create({
                    message: `Non-retryable Interaction Execution failed ${interactionName}: ${executionError.message}`,
                    nonRetryable: true,
                });
            }
        }

        if (
            is4xxNonRetryable(executionError.status) ||
            is4xxNonRetryable(executionError.statusCode) ||
            is4xxNonRetryable(executionError.code)
        ) {
            // 4xx HTTP errors (except retryable statuses) are permanent client errors
            // (e.g. model not found, invalid request). The explicit retryability
            // flag above wins when a provider marks a 4xx as transient.
            throw ApplicationFailure.create({
                message: `Interaction Execution failed ${interactionName}: ${executionError.message}`,
                nonRetryable: true,
            });
        }

        // Unknown retryability - rethrow as generic error (Temporal will use default retry policy)
        throw new Error(`Interaction Execution failed ${interactionName}: ${executionError.message}`);
    }
}

export async function executeCanonicalInteractionFromActivity(
    client: VertesiaClient,
    plan: CanonicalInteractionActivityPlan,
    debug?: boolean,
): Promise<EnhancedExperimentalCanonicalInteractionExecutionResult> {
    const suppliedRequest = plan.request as ExperimentalCanonicalNamedInteractionExecutionRequest;
    if (Object.hasOwn(suppliedRequest, 'workflow')) {
        throw new Error('Canonical activity execution derives workflow identity from the active Temporal activity');
    }
    const { data: requestData, tags: userTags, workflow: _callerWorkflow, ...requestFields } = suppliedRequest;
    const interactionName = requestFields.interaction;
    const reservedTagPrefix = WORKFLOW_RESERVED_TAG_PREFIXES.find((prefix) =>
        userTags?.some((tag) => tag.startsWith(prefix)),
    );
    if (reservedTagPrefix) {
        throw new Error(`Interaction tags may not use reserved prefix ${reservedTagPrefix}`);
    }
    const invocationKey = plan.invocation_key;
    if (
        invocationKey !== undefined &&
        (typeof invocationKey !== 'string' ||
            invocationKey.length > MAX_WORKFLOW_INVOCATION_KEY_LENGTH ||
            !WORKFLOW_INVOCATION_KEY_PATTERN.test(invocationKey))
    ) {
        throw new Error(
            `Interaction invocation_key must match ${WORKFLOW_INVOCATION_KEY_PATTERN} and contain at most ${MAX_WORKFLOW_INVOCATION_KEY_LENGTH} characters`,
        );
    }
    const serviceTierPolicy = (plan as { service_tier_policy?: unknown }).service_tier_policy;
    if (serviceTierPolicy !== undefined && serviceTierPolicy !== FLEX_THEN_DEFAULT_SERVICE_TIER_POLICY) {
        throw new Error(`Unsupported canonical interaction service_tier_policy: ${String(serviceTierPolicy)}`);
    }
    const info = activityInfo();
    const execution = activityWorkflowExecution(info);
    const baseRateLimitId = `${execution.runId}:${info.activityId}:${interactionName}`;
    const rateLimitId = invocationKey
        ? `${baseRateLimitId}:invocation-key:${invocationKey.length}:${invocationKey}`
        : baseRateLimitId;
    const operationTag = workflowInteractionTag(rateLimitId);
    const baseTags = [
        'workflow',
        operationTag,
        ...(serviceTierPolicy === FLEX_THEN_DEFAULT_SERVICE_TIER_POLICY
            ? [`${WORKFLOW_SERVICE_TIER_POLICY_TAG_PREFIX}${serviceTierPolicy}`]
            : []),
        ...(userTags ?? []),
    ];
    const workflow: ExecutionRunWorkflow = {
        run_id: execution.runId,
        workflow_id: execution.workflowId,
        activity_type: info.activityType,
        rate_limit_id: rateLimitId,
        ...(plan.agent_run_id ? { agent_run_id: plan.agent_run_id } : {}),
    };

    const retryState =
        info.attempt > 1
            ? await inspectCanonicalRetryState(client, execution.runId, operationTag)
            : ({ active: false } satisfies CanonicalRetryState);
    const canonicalConfig = requestFields.config ?? {};

    const makeRequest = (
        predecessorRunId: string | undefined,
        previousError: CanonicalRetryState['previous_error'],
    ): { operationId: string; request: CanonicalWorkflowRequest } => {
        const includePreviousError = plan.include_previous_error && previousError !== undefined;
        const data =
            requestData === undefined && !includePreviousError
                ? undefined
                : {
                      ...(requestData ?? {}),
                      ...(includePreviousError ? { previous_error: previousError } : {}),
                  };
        const effectiveRequestFields =
            serviceTierPolicy === FLEX_THEN_DEFAULT_SERVICE_TIER_POLICY
                ? {
                      ...requestFields,
                      config: {
                          ...(requestFields.config ?? {}),
                          model_options: {
                              ...(requestFields.config?.model_options ?? {}),
                              service_tier: predecessorRunId === undefined ? 'flex' : 'default',
                          } as ModelOptions,
                      },
                  }
                : requestFields;
        return {
            operationId: workflowInteractionOperationId(rateLimitId, predecessorRunId),
            request: {
                ...effectiveRequestFields,
                ...(data === undefined ? {} : { data: data as CanonicalWorkflowRequest['data'] }),
                tags: [...baseTags, workflowPredecessorTag(predecessorRunId)],
                workflow,
            },
        };
    };

    const dispatch = async (operationId: string, request: CanonicalWorkflowRequest) => {
        log.debug(`About to execute canonical interaction ${interactionName}`, {
            operation_id: operationId,
            config: canonicalConfig,
            data: request.data,
            result_schema: request.result_schema,
            tags: request.tags,
            workflow,
        });
        const activityContext = Context.current();
        const cancellationSignal = activityContext.cancellationSignal;
        const heartbeatIntervalMs = Math.max(1, Math.min(10_000, Math.floor((info.heartbeatTimeoutMs ?? 20_000) / 2)));
        const heartbeatTimer = setInterval(() => {
            if (!cancellationSignal.aborted) activityContext.heartbeat({ operation_id: operationId });
        }, heartbeatIntervalMs);
        heartbeatTimer.unref?.();
        try {
            return await client.runs.streamCanonical(
                { operation_id: operationId, request },
                {
                    signal: cancellationSignal,
                    on_envelope: (envelope) => {
                        activityContext.heartbeat({
                            operation_id: operationId,
                            run_id: envelope.run_id,
                            stream_id:
                                envelope.type === 'conversation_event' ? envelope.event.stream_id : envelope.stream_id,
                        });
                    },
                },
            );
        } catch (error: unknown) {
            const rateLimitFailure = getInteractionRateLimitFailure(error, interactionName);
            if (rateLimitFailure) throw rateLimitFailure;
            const payload =
                error && typeof error === 'object' && 'payload' in error ? (error as { payload: unknown }).payload : {};
            const errorCode =
                payload !== null && typeof payload === 'object' && 'errorCode' in payload
                    ? payload.errorCode
                    : undefined;
            if (errorCode === CANONICAL_STREAM_RECOVERY_PENDING_ERROR_CODE) {
                throw ApplicationFailure.create({
                    message: `Canonical stream recovery is pending for ${interactionName}`,
                    type: 'CanonicalStreamRecoveryPending',
                    nonRetryable: false,
                });
            }
            throw error;
        } finally {
            clearInterval(heartbeatTimer);
        }
    };

    let predecessorRunId = retryState.operation_predecessor_run_id;
    let previousError = retryState.previous_error;
    if (retryState.accepted) {
        const acceptedRequest = makeRequest(predecessorRunId, previousError);
        const acceptedStream = await dispatch(acceptedRequest.operationId, acceptedRequest.request);
        if (acceptedStream.terminal_event.type !== 'response_accepted') {
            throw ApplicationFailure.create({
                message: 'Canonical accepted interaction did not recover an accepted terminal',
                type: 'CanonicalStreamRecoveryPending',
                nonRetryable: false,
            });
        }
        const recovered = await client.runs.retrieveCanonical(acceptedStream.run_id);
        if (!isCanonicalInteractionSuccess(recovered)) throw canonicalExecutionError(interactionName, recovered);
        return recovered;
    }
    if (retryState.failed_candidate) {
        const prior = makeRequest(predecessorRunId, previousError);
        const priorStream = await dispatch(prior.operationId, prior.request);
        const confirmed = await client.runs.retrieveCanonical(priorStream.run_id);
        if (priorStream.terminal_event.type === 'response_accepted' && isCanonicalInteractionSuccess(confirmed)) {
            return confirmed;
        }
        const terminalFailure =
            isCanonicalInteractionFailure(confirmed) &&
            (priorStream.terminal_event.type === 'response_accepted' ||
                priorStream.terminal_event.type === 'stream_terminated');
        if (!terminalFailure) {
            throw ApplicationFailure.create({
                message: 'Canonical interaction failure is not yet terminal',
                type: 'CanonicalStreamRecoveryPending',
                nonRetryable: false,
            });
        }
        predecessorRunId = confirmed.run.id;
        previousError = confirmed.run.error;
    }

    if (debug && previousError) log.info('Found previous run error', { error: previousError });

    // Recheck admission until a run is visible. requestSlot removes/re-adds the same rate_limit_id atomically, so an
    // ambiguous retry refreshes one reservation without increasing occupancy. Accepted and active runs skip admission.
    if (!retryState.active) {
        const slot = await client.interactions.requestSlot({
            interaction: interactionName,
            inference_profile: canonicalConfig.inference_profile,
            inherit_model_config: canonicalConfig.inherit_model_config,
            environment_id: canonicalConfig.environment,
            model_id: canonicalConfig.model,
            rate_limit_id: rateLimitId,
        });
        if (slot.delay_ms > 0) {
            throw ApplicationFailure.create({
                message: `Interaction admission delayed for ${slot.delay_ms}ms`,
                type: 'InteractionRateLimitRetry',
                nonRetryable: false,
                nextRetryDelay: slot.delay_ms,
                details: [{ interactionName, rateLimitId, delayMs: slot.delay_ms }],
            });
        }
    }

    const prepared = makeRequest(predecessorRunId, previousError);
    const stream = await dispatch(prepared.operationId, prepared.request);
    const result = await client.runs.retrieveCanonical(stream.run_id);

    if (debug) log.info(`Canonical interaction executed ${interactionName}`, result);
    if (stream.terminal_event.type !== 'response_accepted' || !isCanonicalInteractionSuccess(result)) {
        log.error(`Error executing canonical interaction ${interactionName}`, {
            error: result.run.error,
            outcome: stream.terminal_event.type === 'stream_terminated' ? stream.terminal_event.outcome : undefined,
        });
        throw canonicalExecutionError(interactionName, result);
    }
    return result;
}

export async function executeInteractionFromActivity(
    client: VertesiaClient,
    interactionName: string,
    params: InteractionExecutionParams,
    prompt_data: Record<string, unknown>,
    debug?: boolean,
): Promise<EnhancedExperimentalCanonicalInteractionExecutionResult> {
    const configDefaults = params.config ?? {};
    const config: InteractionExecutionConfiguration = {
        ...configDefaults,
        environment: params.environment ?? configDefaults.environment,
        model: params.model ?? configDefaults.model,
        model_options: params.model_options ?? configDefaults.model_options,
        http_timeout: params.http_timeout ?? configDefaults.http_timeout,
        do_validate: params.validate_result ?? configDefaults.do_validate,
    };
    const { run_data: retention = RunDataStorageLevel.STANDARD, ...canonicalConfig } = config;

    return executeCanonicalInteractionFromActivity(
        client,
        {
            request: {
                interaction: interactionName,
                initial_state: { type: 'new' },
                retention,
                return_policy: { history: 'none' },
                data: prompt_data as CanonicalInteractionActivityRequest['data'],
                config: canonicalConfig,
                result_schema: params.result_schema as CanonicalInteractionActivityRequest['result_schema'],
                tags: params.tags,
            },
            invocation_key: params.invocation_key,
            include_previous_error: params.include_previous_error,
            agent_run_id: params.agent_run_id,
        },
        debug,
    );
}
/**
 * Returns true for 4xx status codes that indicate permanent client errors.
 * 412 (Precondition Failed) and 429 (Too Many Requests) are excluded because
 * they are retryable.
 */
function is4xxNonRetryable(code: number | undefined): boolean {
    if (code === undefined || typeof code !== 'number') return false;
    return code >= 400 && code < 500 && code !== 412 && code !== 429;
}

interface ExecutionError extends Error {
    status?: number;
    statusCode?: number;
    code?: number;
    retryable?: boolean;
    errorCode?: unknown;
}

function isRenditionPending(error: ExecutionError): boolean {
    return (error.statusCode ?? error.status ?? error.code) === 412 && error.retryable !== false;
}

function toExecutionError(error: unknown): ExecutionError {
    if (error instanceof Error) {
        return error as ExecutionError;
    }
    return new Error(String(error)) as ExecutionError;
}
