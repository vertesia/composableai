import { ModelOptions } from "@llumiverse/core";
import { activityInfo, log } from "@temporalio/activity";
import { VertesiaClient } from "@vertesia/client";
import {
    DSLActivityExecutionPayload,
    DSLActivitySpec,
    ExecutionRun,
    ExecutionRunStatus,
    InteractionExecutionConfiguration,
    RunSearchPayload,
} from "@vertesia/common";
import { projectResult } from "../dsl/projections.js";
import { setupActivity } from "../dsl/setup/ActivityContext.js";
import { ActivityParamInvalid, ActivityParamNotFound } from "../errors.js";
import { TruncateSpec, truncByMaxTokens } from "../utils/tokens.js";

//Example:
//@ts-ignore
const JSON: DSLActivitySpec = {
    name: "executeInteraction",
    import: ["defaultModel", "guidlineId", "docTypeId"],
    params: {
        defaultModel: "${model}",
        interactionName: "GenerateSummary",
        model: "${defaultModel ?? 'gpt4'}",
        environment: "13456",
        max_tokens: 100,
        temperature: 0.5,
        tags: ["test"],
        result_schema: "${docType.object_schema}",
        prompt_data: {
            documents: "${documents}",
            guidline: "${guidline.text}",
        },
    },
    fetch: {
        documents: {
            type: "document",
            query: {
                id: { $in: "${objectIds}" },
            },
            select: "+text",
        },
        guidline: {
            type: "document",
            limit: 1,
            query: {
                id: "${guidlineId}",
            },
            select: "+text",
            on_not_found: "throw",
        },
        docType: {
            type: "document_type",
            limit: 1,
            query: {
                id: "${docTypeId}",
            },
            select: "+object_schema",
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
     * Force a JSON schema for the result
     */
    result_schema?: any;

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
}

/**
 * TODO: must be kept in sync with InteractionAsyncExecutionPayload form @vertesia/common
 * Also see the executeInteractionAsync endpoint on the server for how the client payload is sent to the workflow.
 * (interaction is translated to interactionName)
 */
export interface ExecuteInteractionParams extends InteractionExecutionParams {
    //TODO rename to interaction as in InteractionAsyncExecutionPayload
    interactionName: string;
    prompt_data: Record<string, any>;
    /**
     * Additional prompt data passed by the workflow configuration. This will be merged with prompt_data if any.
     * You should use `import: ["static_prompt_data"]` to import the workflow prompt data as static_prompt_data param.
     * Otherwise the workflow prompt data will be ignored.
     */
    static_prompt_data?: Record<string, any>;
    truncate?: Record<string, TruncateSpec>;
}

export interface ExecuteInteraction extends DSLActivitySpec<ExecuteInteractionParams> {
    name: "executeInteraction";
}

export async function executeInteraction(payload: DSLActivityExecutionPayload<ExecuteInteractionParams>) {
    const { client, params } = await setupActivity<ExecuteInteractionParams>(payload);

    const { interactionName, prompt_data, static_prompt_data: wf_prompt_data } = params;
    if (wf_prompt_data) {
        Object.assign(prompt_data, wf_prompt_data);
    }

    if (!interactionName) {
        log.error("Missing interactionName", { params });
        throw new ActivityParamNotFound("interactionName", payload.activity);
    }

    if (params.truncate) {
        const truncate = params.truncate;
        for (const [key, value] of Object.entries(truncate)) {
            prompt_data[key] = truncByMaxTokens(prompt_data[key], value);
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
        return projectResult(payload, params, res, {
            runId: res.id,
            status: res.status,
            result: res.result,
        });
    } catch (error: any) {
        log.error("Failed to execute interaction", { error });
        if (error.message.includes("Failed to validate merged prompt schema")) {
            //issue with the input data, don't retry
            throw new ActivityParamInvalid("prompt_data", payload.activity, error.message);
        } else if (error.message.includes("modelId: Path `modelId` is required")) {
            //issue with the input data, don't retry
            throw new ActivityParamInvalid("model", payload.activity, error.message);
        } else {
            throw error;
        }
    }
}

export async function executeInteractionFromActivity(
    client: VertesiaClient,
    interactionName: string,
    params: InteractionExecutionParams,
    prompt_data: any,
    debug?: boolean,
) {
    const userTags = params.tags;
    const info = activityInfo();
    const runId = info.workflowExecution.runId;
    let tags = ["workflow", `tmpRunId:${runId}`]; //TODO use wf:wfName
    if (userTags) {
        tags = tags.concat(userTags);
    }

    let previousStudioExecutionRun: ExecutionRun | undefined = undefined;
    if (params.include_previous_error) {
        //retrieve last failed run if any
        if (info.attempt > 1) {
            log.info("Retrying, searching for previous run", { tags: ["tmpRunId:" + runId] });
            const payload: RunSearchPayload = {
                query: { tags: ["tmpRunId:" + info.workflowExecution.runId] },
                limit: 1,
            };
            const previousRun = await client.runs.search(payload).then((res) => {
                log.info("Search results", { results: res });
                return res ? (res[0] ?? undefined) : undefined;
            });

            if (previousRun) {
                log.info("Found previous run", { previousRun });
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
    };
    const data = {
        ...prompt_data,
        previous_error: previousStudioExecutionRun?.error,
    };

    const result_schema = params.result_schema;

    log.debug(`About to execute interaction ${interactionName}`, { config, data, result_schema, tags });

    const res = await client.interactions
        .executeByName(interactionName, {
            config,
            data,
            result_schema,
            tags,
            stream: false,
        })
        .catch((err) => {
            log.error(`Error executing interaction ${interactionName}`, { err });
            throw new Error(`Interaction Execution failed ${interactionName}: ${err.message}`);
        });

    if (debug) {
        log.info(`Interaction executed ${interactionName}`, res);
    }

    if (res.error || res.status === ExecutionRunStatus.failed) {
        log.error(`Error executing interaction ${interactionName}`, { error: res.error });
        throw new Error(`Interaction Execution failed ${interactionName}: ${res.error}`);
    }

    return res;
}
