import type { z } from 'zod';
import type {
    ActivityFetchSpecSchema,
    DSLActivityOptionsSchema,
    DSLActivitySpecSchema,
    DSLActivityStepSchema,
    DSLRetryPolicySchema,
    DurationValueSchema,
} from '../api-schemas/process.js';
import type {
    WorkflowDefinitionRefSchema,
    WorkflowInputFileSchema,
    WorkflowInputSchema,
} from '../api-schemas/workflow-runs.js';
import type { ToolExecutionMetadata } from '../tool-execution.js';
import type { BaseObject } from './common.js';
import type { WorkflowExecutionPayload } from './index.js';

/**
 * Copied from temporalio: the child-workflow parent-close policy, as authored in a DSL workflow
 * step. Declared here rather than in `./temporalio.js` because that module is Vertesia-internal
 * while this union is part of the public DSL that clients write.
 */
export type ParentClosePolicyType = 'TERMINATE' | 'ABANDON' | 'REQUEST_CANCEL' | undefined;

export type DurationValue = z.infer<typeof DurationValueSchema>;

/**
 * Discriminator for workflow input type - either object IDs or GCS file URIs
 */
export type WorkflowInputType = 'objectIds' | 'files';

export type WorkflowInputFile = z.infer<typeof WorkflowInputFileSchema>;

export type WorkflowInput = z.infer<typeof WorkflowInputSchema>;

/**
 * The payload sent when starting a workflow from the temporal client to the workflow instance.
 */
export interface DSLWorkflowExecutionPayload extends WorkflowExecutionPayload<Record<string, unknown>> {
    /**
     * The workflow definition to be used by the DSL workflow.
     * If a dsl workflow is executed and no definition is provided the workflow will fail.
     */
    workflow: DSLWorkflowSpec;
}

export type DSLActivityOptions = z.infer<typeof DSLActivityOptionsSchema>;

export type DSLRetryPolicy = z.infer<typeof DSLRetryPolicySchema>;

// Temporal accepts Date values internally, while the HTTP schema documents their JSON string form.
// Keep the execution type truthful at the Temporal boundary instead of pretending HTTP validation revives dates.
export type WorkflowSearchAttributeValue = string[] | number[] | boolean[] | Date[];
export type WorkflowSearchAttributes = Record<string, WorkflowSearchAttributeValue>;

/**
 * The payload for a DSL activity execution.
 */
export interface DSLActivityExecutionPayload<ParamsT extends object> extends WorkflowExecutionPayload {
    activity: DSLActivitySpec;
    params: ParamsT;
    workflow_name: string;
    debug_mode?: boolean;
    toolRunId?: string;
    activityGroupId?: string;
}

// The published schema intentionally leaves array items open. This narrower authoring type is an
// internal DSL convenience, not a claim made by the HTTP validator.
export type ImportSpec = (string | Record<string, string>)[];
export type ActivityFetchSpec = z.infer<typeof ActivityFetchSpecSchema>;

interface DSLWorkflowStepBase {
    /**
     * The type fo the step.
     * If not set defaults to "activity"
     */
    type: 'activity' | 'workflow';
}

type DSLActivitySpecWire = z.infer<typeof DSLActivitySpecSchema>;

/** The published activity shape with a caller-specializable parameter bag. */
export type DSLActivitySpec<PARAMS extends object = Record<string, unknown>> = Omit<
    DSLActivitySpecWire,
    'params' | 'import'
> & {
    params?: PARAMS;
    import?: ImportSpec;
};

type DSLActivityStepWire = z.infer<typeof DSLActivityStepSchema>;

/** The published activity-step shape with a caller-specializable parameter bag. */
export type DSLActivityStep<PARAMS extends object = Record<string, unknown>> = Omit<
    DSLActivityStepWire,
    'params' | 'import'
> & {
    params?: PARAMS;
    import?: ImportSpec;
};

export interface DSLChildWorkflowStep extends DSLWorkflowStepBase {
    type: 'workflow';
    // the workflow endpoint to run
    name: string;
    /** Title displayed for the child workflow in the workflow builder. */
    title?: string;
    /** Description displayed for the child workflow in the workflow builder. */
    description?: string;
    /**
     * The parameters to pass to the child workflow.
     * These parameters will be merged over the parent workflow vars and passed altogether to the child workflow.
     */
    vars?: Record<string, unknown>;
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
     * A JSON expression which evaluates to true or false similar to mongo matches.
     * The child workflow will only execute if the condition is satisfied.
     * Example: {$eq: {wfVarName: value}}
     */
    condition?: Record<string, unknown>;
    /**
     * In case the dslWorkflow is used as a child workflow the spec is used to define the child workflow.
     * If spec is defined then the name must be "dslWorkflow"
     */
    spec?: DSLWorkflowSpec;
    options?: {
        memo?: Record<string, unknown>;
        retry?: DSLRetryPolicy;
        searchAttributes?: WorkflowSearchAttributes;
        taskQueue?: string;
        workflowExecutionTimeout?: DurationValue;
        workflowRunTimeout?: DurationValue;
        workflowTaskTimeout?: DurationValue;
        workflowId?: string;
        cronSchedule?: string;
        parentClosePolicy?: ParentClosePolicyType;
        //TODO
        //cancellationType
        //versioningIntent
        //workflowIdReusePolicy
    };
}

/**
 * @discriminator type
 */
export type DSLWorkflowStep = DSLActivityStep | DSLChildWorkflowStep;

interface DSLWorkflowSpecBase {
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
    vars: Record<string, unknown>;
    // activity options that apply to all activities within the workflow
    options?: DSLActivityOptions;
    // the name of the variable that will hold the workflow result
    // if not specified "result" will be assumed
    result?: string;
    debug_mode?: boolean;
}

export interface DSLWorkflowSpecWithSteps extends DSLWorkflowSpecBase {
    spec_format: 'steps';
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
    spec_format: 'activities';
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
/**
 * @discriminator spec_format
 */
export type DSLWorkflowSpec = DSLWorkflowSpecWithSteps | DSLWorkflowSpecWithActivities;

/**
 * Legacy upsert fields the workflow-definition write endpoints still accept alongside a spec.
 *
 * A body carrying `id` updates that definition instead of creating one, with `updated_at` checked
 * against the stored value for optimistic concurrency. All server-assigned on the read side, hence
 * optional here and absent from {@link DSLWorkflowSpec}.
 */
interface LegacyWorkflowDefinitionUpsertFields {
    id?: string;
    created_at?: string;
    updated_at?: string;
}

export type WorkflowDefinitionPayloadWithSteps = DSLWorkflowSpecWithSteps & LegacyWorkflowDefinitionUpsertFields;
export type WorkflowDefinitionPayloadWithActivities = DSLWorkflowSpecWithActivities &
    LegacyWorkflowDefinitionUpsertFields;

/** The request body of `POST /workflows/definitions`. */
export type WorkflowDefinitionPayload = WorkflowDefinitionPayloadWithSteps | WorkflowDefinitionPayloadWithActivities;

interface ExpectedEditRevision {
    expected_edit_revision?: number;
}

export type UpdateWorkflowDefinitionPayloadWithSteps = DSLWorkflowSpecWithSteps & ExpectedEditRevision;
export type UpdateWorkflowDefinitionPayloadWithActivities = DSLWorkflowSpecWithActivities & ExpectedEditRevision;

/** The guarded request body of `PUT /workflows/definitions/:id`. */
export type UpdateWorkflowDefinitionPayload =
    | UpdateWorkflowDefinitionPayloadWithSteps
    | UpdateWorkflowDefinitionPayloadWithActivities;

export function withDSLWorkflowSpecDiscriminator(spec: DSLWorkflowSpecBase): DSLWorkflowSpec {
    if ('steps' in spec && spec.steps) {
        return { ...spec, spec_format: 'steps' } as DSLWorkflowSpecWithSteps;
    }
    return { ...spec, spec_format: 'activities' } as DSLWorkflowSpecWithActivities;
}

export interface DSLWorkflowDefinition extends BaseObject, DSLWorkflowSpecBase {
    edit_revision: number;
    // an optional JSON schema to describe the input vars of the workflow.
    input_schema?: Record<string, unknown>;
    activities?: DSLActivitySpec[];
    steps?: DSLWorkflowStep[];
}

export interface DSLWorkflowDefinitionResponse extends DSLWorkflowDefinition {
    spec_format: 'steps' | 'activities';
}

export type WorkflowDefinitionRef = z.infer<typeof WorkflowDefinitionRefSchema>;

export const WorkflowDefinitionRefPopulate = 'id name description tags created_at updated_at';

/**
 * Payload sent to a remote activity endpoint on a tool server.
 * This is POSTed by the `executeRemoteActivity` bridge activity.
 */
export interface RemoteActivityExecutionPayload<ParamsT extends object = Record<string, unknown>> {
    /** The activity name (unprefixed, as known by the tool server) */
    activity_name: string;
    /** The resolved activity parameters */
    params: ParamsT;
    /** Execution metadata (same shape as tool execution metadata) */
    metadata?: ToolExecutionMetadata;
}

/**
 * Response from a remote activity endpoint on a tool server.
 */
export interface RemoteActivityExecutionResponse {
    /** The result data (stored into workflow vars via the step's `output` field) */
    result: unknown;
    /** Whether the execution failed */
    is_error?: boolean;
    /** Error message if is_error is true */
    error?: string;
}
