import { StringValue } from "ms";
import { BaseObject } from "./common.js";
import { WorkflowExecutionPayload } from "./index.js";
import { ParentClosePolicyType } from "./temporalio.js";


/**
 * The payload sent when starting a workflow from the temporal client to the workflow instance.
 */
export interface DSLWorkflowExecutionPayload extends WorkflowExecutionPayload {
    /**
     * The workflow definition to be used by the DSL workflow.
     * If a dsl workflow is executed and no definition is provided the workflow will fail.
     */
    workflow: DSLWorkflowSpec;
}

/**
 * The payload for a DSL activity options.
 *
 * @see ActivityOptions in @temporalio/common
 */
export interface DSLActivityOptions {
    startToCloseTimeout?: StringValue | number;
    scheduleToStartTimeout?: StringValue | number;
    scheduleToCloseTimeout?: StringValue | number;
    retry?: DSLRetryPolicy;
}

/**
 * The payload for a DSL retry policy.
 *
 * @see RetryPolicy in @temporalio/common
 */
export interface DSLRetryPolicy {
    backoffCoefficient?: number;
    initialInterval?: StringValue | number;
    maximumAttempts?: number;
    maximumInterval?: StringValue | number;
    nonRetryableErrorTypes?: string[];
}

/**
 * The payload for a DSL activity execution.
 */
export interface DSLActivityExecutionPayload<ParamsT extends Record<string, any>> extends WorkflowExecutionPayload {
    activity: DSLActivitySpec;
    params: ParamsT;
    workflow_name: string;
    debug_mode?: boolean;
}


export type ImportSpec = (string | Record<string, string>)[];
export interface ActivityFetchSpec {
    /**
     * The data provider name
     */
    type: "document" | "document_type" | "interaction_run";
    /**
     * An optional URI to the data source.
     */
    source?: string;
    /**
     * The query to be executed by the data provider
     */
    query: Record<string, any>;
    /**
     * a string of space separated field names.
     * Prefix a field name with "-" to exclude it from the result.
     */
    select?: string;

    /**
     * The number of results to return. If the result is limited to 1 the result will be a single object
     */
    limit?: number;

    /**
     * How to handle not found objects.
     * 1. ignore - Ignore and return an empty array for multi objects query (or undefined for single object query) or empty array for multiple objects throw an error.
     * 2. throw - Throw an error if the object or no objects are found.
     */
    on_not_found?: "ignore" | "throw";
}

export interface DSLWorkflowStepBase {
    /**
     * The type fo the step.
     * If not set defaults to "activity"
     */
    type: "activity" | "workflow";
}

export interface DSLActivitySpec<PARAMS extends Record<string, any> = Record<string, any>> {
    /**
     * The name of the activity function
     */
    name: string;
    /**
     * Title of the activity to be displayed in the UI workflow builder
     */
    title?: string;
    /**
     * The description of the activity to e displayed in the UI workflow builder
     */
    description?: string;
    /**
     * Activities parameters. These parameters can be either literals
     * (hardcoded strings, numbers, booleans, objects, arrays etc.), either
     * references to the workflow variables.
     * The workflow variables are built from the workflow params (e.g. the workflow configuration)
     * and from the result of the previous activities.
     */
    params?: PARAMS;
    /**
     * The name of the workflow variable that will store the result of the activity
     * If not specified the result will not be stored
     * The parameters describe how the actual parameters will be obtained from the workflow execution vars.
     * since it may contain references to workflow execution vars.
     */
    output?: string;

    /**
     * A JSON expression which evaluate to true or false similar to mongo matches.
     * We support for now basic expression like: $true, $false, $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $regexp
     * {$eq: {name: value}},
     * Ex: {$eq: {wfVarName: value}}
     */
    condition?: Record<string, any>;

    /**
     * The import spec is used to import data from workflow variables.
     * The import spec is a list of variable names to import from the workflow context.
     * You can also use objects to rename the imported variables, or to reference an expression.
     * Example:
     * ["runId", {"typeId": "docType.id"}]
     */
    import?: ImportSpec;

    /**
     * The fetch phase is used to fetch data from external sources.
     */
    fetch?: Record<string, ActivityFetchSpec>;

    /**
     * Projection to apply to the result. Not all activities support this.
     */
    projection?: never | Record<string, any>;

    // ---------- Optional features not implemented in a first step ------------
    /**
     * If true the activity will be executed in parallel with the other activities.
     * (i.e. the workflow will not wait for the activity to finish before starting the next one)
     */
    parallel?: boolean;

    /**
     * Await for a parallel activity execution to return.
     */
    await?: string; //the activity name to await

    /**
     * Activity options for configuring the activity execution, which overrides the activity options
     * defined at workflow level.
     */
    options?: DSLActivityOptions;
}

export interface DSLActivityStep<PARAMS extends Record<string, any> = Record<string, any>> extends DSLActivitySpec<PARAMS>, DSLWorkflowStepBase {
    type: "activity";
}

export interface DSLChildWorkflowStep extends DSLWorkflowStepBase {
    type: "workflow";
    // the workflow endpoint to run
    name: string;
    /**
     * The parameters to pass to the child workflow.
     * These parameters will be merged over the parent workflow vars and passed altogether to the child workflow.
     */
    vars?: Record<string, any>;
    // whether or not to wait for the workflow to finish.
    // default is false. (the parent workflow will await for the workflow to finish)
    async?: boolean;
    /**
     * The name of the workflow variable that will store the result of the child workflow (if async the workflow id is stored)
     * If not specified the result will not be stored
     * The parameters describe how the actual parameters will be obtained from the workflow execution vars.
     * since it may contain references to workflow execution vars.
     */
    output?: string;
    /**
     * In case the dslWorkflow is used as a child workflow the spec is used to define the child workflow.
     * If spec is defined then the name must be "dslWorkflow"
     */
    spec?: DSLWorkflowSpec;
    options?: {
        memo?: Record<string, any>;
        retry?: DSLRetryPolicy;
        searchAttributes?: Record<string, string[] | number[] | boolean[] | Date[]>;
        taskQueue?: string;
        workflowExecutionTimeout?: StringValue | number;
        workflowRunTimeout?: StringValue | number;
        workflowTaskTimeout?: StringValue | number;
        workflowId?: string;
        cronSchedule?: string;
        parentClosePolicy?: ParentClosePolicyType;
        //TODO
        //cancellationType
        //versioningIntent
        //workflowIdReusePolicy
    }
}

export type DSLWorkflowStep = DSLActivityStep | DSLChildWorkflowStep;

export interface DSLWorkflowSpecBase {
    name: string;
    description?: string;
    tags?: string[];

    steps?: DSLWorkflowStep[] | never;
    /**
     * @deprecated use steps instead
     */
    activities?: DSLActivitySpec[] | never;

    // a dictionary of vars to initialize the workflow execution vars
    // Initial vars cannot contains references to other vars
    vars: Record<string, any>;
    // activity options that apply to all activities within the workflow
    options?: DSLActivityOptions;
    // the name of the variable that will hold the workflow result
    // if not specified "result" will be assumed
    result?: string;
    debug_mode?: boolean;
}

export interface DSLWorkflowSpecWithSteps extends DSLWorkflowSpecBase {
    steps: DSLWorkflowStep[];
    /**
     * @deprecated use steps instead
     */
    activities?: never;
}

/**
 * @deprecated use steps instead
 */
export interface DSLWorkflowSpecWithActivities extends DSLWorkflowSpecBase {
    steps?: never;
    /**
     * @deprecated use steps instead
     */
    activities: DSLActivitySpec[];
}

/**
 * activities and steps fields are mutually exclusive
 * steps was added after activities and may contain a mix of activities and other tasks like exec child workflows.
 * For backward compatibility we keep the activities field as a fallback but one should use one or the other not both.
 */
export type DSLWorkflowSpec = DSLWorkflowSpecWithSteps | DSLWorkflowSpecWithActivities;

export interface DSLWorkflowDefinition extends BaseObject, DSLWorkflowSpecBase {
    // an optional JSON schema to describe the input vars of the workflow.
    input_schema?: Record<string, any>;
    activities?: DSLActivitySpec[];
    steps?: DSLWorkflowStep[];
}

export interface WorkflowDefinitionRef {
    id: string;
    name: string;
    description?: string;
    tags?: string[];
    created_at: Date;
    updated_at: Date;
}

export const WorkflowDefinitionRefPopulate = "id name description tags created_at updated_at"
