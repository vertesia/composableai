import { type CompletionResult, type JSONSchema, type ModelOptions, LlumiverseError } from '@llumiverse/common';
import { activityInfo, ApplicationFailure, log } from '@temporalio/activity';
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
import { type TruncateSpec, truncByMaxTokens } from '../utils/tokens.js';
import { Readable } from 'node:stream';

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
export interface InteractionExecutionParams {
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
                        const info = activityInfo();
                        const workflowExecution = info.workflowExecution;
                        if (!workflowExecution) {
                            throw ApplicationFailure.nonRetryable('Missing workflow execution info');
                        }
                        const { runId } = workflowExecution;
                        const { activityId } = info;
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
        const executionError = toExecutionError(error);
        log.error(`Failed to execute interaction ${interactionName}`, { error: executionError });
        if (executionError.statusCode === 429 && params.exit_on_resource_exhaustion) {
            throw new ResourceExhaustedError(executionError.statusCode, 'Resource exhausted - rate limit exceeded');
        } else if (
            is4xxNonRetryable(executionError.status) ||
            is4xxNonRetryable(executionError.statusCode) ||
            is4xxNonRetryable(executionError.code) ||
            executionError.retryable === false
        ) {
            // 4xx HTTP errors (except retryable statuses) are permanent client errors
            // (e.g. model not found, invalid request).
            // Errors explicitly marked as non-retryable (e.g. LlumiverseError) also fall here.
            // They will not be resolved by retrying.
            throw ApplicationFailure.create({
                message: `Interaction Execution failed ${interactionName}: ${executionError.message}`,
                nonRetryable: true,
            });
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
                ? true
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
    const workflowExecution = info.workflowExecution;
    if (!workflowExecution) {
        throw ApplicationFailure.nonRetryable('No workflow execution info found in activityInfo');
    }
    const runId = workflowExecution.runId;
    let tags = ['workflow'];
    if (userTags) {
        tags = tags.concat(userTags);
    }
    const workflow: ExecutionRunWorkflow = {
        run_id: workflowExecution.runId,
        workflow_id: workflowExecution.workflowId,
        activity_type: info.activityType,
    };

    let previousStudioExecutionRun: ExecutionRun | undefined;
    if (params.include_previous_error) {
        //retrieve last failed run if any
        if (info.attempt > 1) {
            log.info('Retrying, searching for previous run', { prev_run_id: runId });
            const payload: RunSearchPayload = {
                query: { workflow_run_ids: [runId] },
                limit: 1,
            };
            const previousRun = await client.runs.search(payload).then((res) => {
                log.info('Search results', { results: res });
                return res ? (res[0] ?? undefined) : undefined;
            });

            if (previousRun) {
                log.info('Found previous run', { previousRun });
                previousStudioExecutionRun = await client.runs.retrieve(previousRun.id);
            }
        }
    }
    if (debug && previousStudioExecutionRun?.error) {
        log.info(`Found  previous run error`, { error: previousStudioExecutionRun?.error });
    }

    const config: InteractionExecutionConfiguration = {
        environment: params.environment,
        model: params.model,
        model_options: params.model_options,
        do_validate: params.validate_result,
    };
    const data = {
        ...prompt_data,
        previous_error: previousStudioExecutionRun?.error,
    };

    const result_schema = params.result_schema;

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
        .catch((err) => {
            log.error(`Error executing interaction ${interactionName}`, { err });
            throw err;
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
