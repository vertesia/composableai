import { Readable } from 'node:stream';
import {
    type CompletionResult,
    type HttpTimeoutOptions,
    type JSONSchema,
    LlumiverseError,
    type ModelOptions,
} from '@llumiverse/common';
import { ApplicationFailure, activityInfo, log } from '@temporalio/activity';
import type { RateLimitMetadata } from '@vertesia/api-fetch-client';
import type { VertesiaClient } from '@vertesia/client';
import { NodeStreamSource } from '@vertesia/client/node';
import {
    type DSLActivityExecutionPayload,
    type DSLActivitySpec,
    type ExecutionRun,
    ExecutionRunStatus,
    type ExecutionRunWorkflow,
    type InteractionExecutionConfiguration,
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
    type: 'InteractionRateLimitRetry' | 'ProviderRateLimitRetry';
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
        (candidate.type === 'InteractionRateLimitRetry' || candidate.type === 'ProviderRateLimitRetry') &&
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

        let completionResult: CompletionResult[] = res.result;

        // Handle image uploads if the result contains base64 images
        const imageResults = completionResult.filter((r) => r.type === 'image');
        if (imageResults.length > 0) {
            const uploadedImages = await Promise.all(
                completionResult.map(async (item, index) => {
                    if (item.type === 'image') {
                        const image = item.value;
                        // Extract base64 data and create buffer
                        const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');
                        const buffer = Buffer.from(base64Data, 'base64');

                        // Generate filename
                        const { runId } = activityWorkflowExecution();
                        const { activityId } = activityInfo();
                        const filename = `generated-image-${runId}-${activityId}-${index}.png`;

                        // Create a readable stream from the buffer
                        const stream = Readable.from(buffer);

                        const source = new NodeStreamSource(stream, filename, 'image/png');

                        const file = await client.files.uploadFile(source);
                        return { type: 'image', value: file } as CompletionResult;
                    }
                    return item;
                }),
            );
            completionResult = uploadedImages;
        }

        return projectResult(payload, params, res, {
            runId: res.id,
            status: res.status,
            result: completionResult,
        });
    } catch (error: unknown) {
        // Preserve admission failures raised before executeByName and the provider failures
        // normalized by executeInteractionFromActivity.
        const rateLimitFailure = getInteractionRateLimitFailure(error, interactionName);
        if (rateLimitFailure) {
            throw rateLimitFailure;
        }
        const executionError = toExecutionError(error);
        log.error(`Failed to execute interaction ${interactionName}`, { error: executionError });
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

export async function executeInteractionFromActivity(
    client: VertesiaClient,
    interactionName: string,
    params: InteractionExecutionParams,
    prompt_data: Record<string, unknown>,
    debug?: boolean,
) {
    const userTags = params.tags;
    const info = activityInfo();
    const execution = activityWorkflowExecution(info);
    const runId = execution.runId;
    let tags = ['workflow'];
    if (userTags) {
        tags = tags.concat(userTags);
    }
    const workflow: ExecutionRunWorkflow = {
        run_id: execution.runId,
        workflow_id: execution.workflowId,
        activity_type: info.activityType,
    };

    let previousStudioExecutionRun: ExecutionRun | undefined;
    if (params.include_previous_error) {
        //retrieve last failed run if any
        if (info.attempt > 1) {
            log.debug('Retrying, searching for previous run', { prev_run_id: runId });
            const payload: RunSearchPayload = {
                query: { workflow_run_ids: [runId] },
                limit: 1,
            };
            const previousRuns = await client.runs.search(payload);
            log.debug('Previous run search completed', { result_count: previousRuns?.length ?? 0 });
            // `?.[0]` covers both an absent body and an empty array, matching what the previous
            // `res ? (res[0] ?? undefined) : undefined` did. The optional chaining is kept
            // deliberately: `search` is *typed* to return an array, but the value comes straight off
            // an HTTP response, so the type is a claim about the contract rather than a runtime
            // guarantee — and dropping the guard here would be a behaviour change, not a cleanup.
            const previousRun = previousRuns?.[0];

            if (previousRun) {
                log.debug('Found previous run', { prev_run_id: previousRun.id });
                previousStudioExecutionRun = await client.runs.retrieve(previousRun.id);
            }
        }
    }
    if (debug && previousStudioExecutionRun?.error) {
        log.info(`Found  previous run error`, { error: previousStudioExecutionRun?.error });
    }

    const configDefaults = params.config ?? {};
    const config: InteractionExecutionConfiguration = {
        ...configDefaults,
        environment: params.environment ?? configDefaults.environment,
        model: params.model ?? configDefaults.model,
        model_options: params.model_options ?? configDefaults.model_options,
        http_timeout: params.http_timeout ?? configDefaults.http_timeout,
        do_validate: params.validate_result ?? configDefaults.do_validate,
    };
    const data = {
        ...prompt_data,
        previous_error: previousStudioExecutionRun?.error,
    };

    const result_schema = params.result_schema;

    const rateLimitId = `${execution.runId}:${info.activityId}:${interactionName}`;
    const slot = await client.interactions.requestSlot({
        interaction: interactionName,
        environment_id: config.environment,
        model_id: config.model,
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
    workflow.rate_limit_id = rateLimitId;

    log.debug(`About to execute interaction ${interactionName}`, { config, data, result_schema, tags, workflow });

    const res = await client.interactions
        .executeByName(interactionName, {
            config,
            data,
            result_schema,
            tags,
            stream: false,
            workflow,
        })
        .catch((error: unknown) => {
            log.error(`Error executing interaction ${interactionName}`, { error });
            const rateLimitFailure = getInteractionRateLimitFailure(error, interactionName);
            throw rateLimitFailure ?? error;
        });

    if (debug) {
        log.info(`Interaction executed ${interactionName}`, res);
    }

    if (res.error || res.status === ExecutionRunStatus.failed) {
        log.error(`Error executing interaction ${interactionName}`, { error: res.error });

        // Create error with retryability information
        const errorMessage = `Interaction Execution failed ${interactionName}: ${res.error?.message || 'Unknown error'}`;
        const error = new Error(errorMessage);

        // Attach retryable property so the catch block can access it
        const executionError = error as Error & { retryable?: boolean; errorCode?: string };
        executionError.retryable = res.error?.retryable;
        executionError.errorCode = res.error?.code;

        throw error;
    }

    return res;
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

function toExecutionError(error: unknown): ExecutionError {
    if (error instanceof Error) {
        return error as ExecutionError;
    }
    return new Error(String(error)) as ExecutionError;
}
