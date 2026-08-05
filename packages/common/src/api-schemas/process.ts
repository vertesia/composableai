// Runtime schemas for the process API domain.

import { JSONObjectSchema, JSONSchemaSchema } from '@llumiverse/common/schemas';
import type { StringValue } from 'ms';
import { z } from 'zod';
import { StringValueMapSchema } from './files.js';
import { ConversationVisibilitySchema, RunSourceSchema } from './interaction.js';
import { TaskFieldSchema } from './task.js';

export const DurationValueSchema = z
    .union([z.string(), z.number()])
    .meta({ id: 'DurationValue', anyOf: undefined, type: ['string', 'number'] }) as z.ZodType<StringValue | number>;

export const JsonLogicRuleSchema = z.looseObject({}).meta({ id: 'JsonLogicRule' });

export const ProcessDefinitionMetadataSchema = z.looseObject({}).meta({ id: 'ProcessDefinitionMetadata' });

export const BranchJoinPolicySchema = z.literal('all').meta({ id: 'BranchJoinPolicy' });

export const ParallelFailurePolicySchema = z
    .enum(['fail_fast', 'collect_errors'])
    .meta({ id: 'ParallelFailurePolicy' });

export const ParallelCollectFieldSchema = z
    .enum([
        'status',
        'index',
        'item',
        'item_id',
        'branch_id',
        'branch_title',
        'output',
        'context_update',
        'error',
        'child_run_id',
        'child_workflow_id',
        'child_workflow_run_id',
    ])
    .meta({ id: 'ParallelCollectField' });

export const ParallelCollectModeSchema = z.literal('array').meta({ id: 'ParallelCollectMode' });

export const HumanTaskDefinitionSchema = z
    .strictObject({
        title: z.string(),
        description: z.string().optional(),
        assignee: z
            .string()
            .meta({
                description:
                    'Who owns the task. Either a group reference (`group:<name>`) or a concrete user id. Leave unset to make the task available to anyone who can see the inbox. `role:<name>` is not supported — use `group:<name>` instead.',
            })
            .optional(),
        fields: z.array(TaskFieldSchema),
    })
    .meta({ id: 'HumanTaskDefinition' });

export const TransitionTriggerSchema = z.enum(['auto', 'agent', 'user']).meta({ id: 'TransitionTrigger' });

export const ProcessNodeReturnsDefinitionSchema = z
    .strictObject({
        from: z
            .string()
            .meta({
                description:
                    'Path to read from the completed child process state. Use `context.foo` for child context values or `state.sequence` for process-state fields. If omitted, the child context is used as the node output.',
            })
            .optional(),
        context: z
            .array(z.string())
            .meta({
                description:
                    'Select specific fields from the completed child process context. Ignored when `from` is set.',
            })
            .optional(),
    })
    .meta({ id: 'ProcessNodeReturnsDefinition' });

export const ProcessNodeRunTypeSchema = z.enum(['supervised', 'programmatic']).meta({ id: 'ProcessNodeRunType' });

export const ProcessNodeTypeSchema = z
    .enum([
        'tool',
        'interaction',
        'agent',
        'script',
        'process',
        'human_task',
        'foreach',
        'branch',
        'condition',
        'final',
    ])
    .meta({ id: 'ProcessNodeType' });

export const ProcessContextDefinitionSchema = z
    .strictObject({
        schema: JSONSchemaSchema,
        initial: z.looseObject({}),
    })
    .meta({ id: 'ProcessContextDefinition' });

export const ProcessScriptInlineSourceSchema = z
    .strictObject({
        type: z.literal('inline'),
        files: StringValueMapSchema,
    })
    .meta({
        id: 'ProcessScriptInlineSource',
        description:
            'Script files stored directly in the process definition.\n\nThe source is a discriminated object so artifact- and Git-backed sources can be added without changing the surrounding script resource contract.',
    });

export const ProcessScriptLanguageSchema = z
    .enum(['python', 'javascript', 'typescript'])
    .meta({ id: 'ProcessScriptLanguage' });

export const ProcessDefinitionFormatVersionSchema = z.literal(1).meta({ id: 'ProcessDefinitionFormatVersion' });

export const ProcessDefinitionStatusSchema = z
    .enum(['draft', 'published', 'archived'])
    .meta({ id: 'ProcessDefinitionStatus' });

export const ProcessRunTypeSchema = z.enum(['supervised', 'programmatic']).meta({ id: 'ProcessRunType' });

export const RevertProcessDefinitionPayloadSchema = z
    .strictObject({
        confirmed: z.boolean().meta({ description: 'Required explicit confirmation from the caller.' }),
        comment: z
            .string()
            .meta({ description: 'Optional note explaining why this version is being restored as the draft.' })
            .optional(),
    })
    .meta({ id: 'RevertProcessDefinitionPayload' });

export const RetryProcessNodePayloadSchema = z
    .strictObject({
        node: z.string().optional(),
        reason: z.string().optional(),
    })
    .meta({ id: 'RetryProcessNodePayload' });

export const PublishProcessDefinitionPayloadSchema = z
    .strictObject({
        confirmed: z.boolean().meta({ description: 'Required explicit confirmation from the caller.' }),
        tags: z
            .array(z.string())
            .meta({ description: 'Optional tags to merge into the published revision.' })
            .optional(),
        label: z.string().meta({ description: 'Optional human-readable revision label.' }).optional(),
        comment: z.string().meta({ description: 'Optional publish note.' }).optional(),
    })
    .meta({ id: 'PublishProcessDefinitionPayload' });

export const ProcessDefinitionRevisionInfoSchema = z
    .strictObject({
        parent: z
            .string()
            .meta({ description: 'Direct parent revision id. Omitted for the first revision in a bucket.' })
            .optional(),
        root: z
            .string()
            .meta({ description: 'Root revision id shared by all revisions of the same process definition.' }),
        head: z
            .boolean()
            .meta({ description: 'True when this is the latest revision returned by default list/resolve calls.' }),
        label: z.string().meta({ description: 'Optional human-readable label for the revision.' }).optional(),
        comment: z
            .string()
            .meta({ description: 'Optional publish note captured when a draft is promoted.' })
            .optional(),
    })
    .meta({ id: 'ProcessDefinitionRevisionInfo' });

export const ProcessRunConfigSchema = z
    .strictObject({
        model: z.string().optional(),
        user_message: z
            .string()
            .meta({
                description:
                    'Free-form message from the user when starting a run. Passed to the orchestrator LLM in supervised mode; stored on the run regardless so programmatic runs retain the intent that triggered them.',
            })
            .optional(),
        process_workstream_monitor: z
            .strictObject({
                monitor_workflow_id: z.string(),
                launch_id: z.string().optional(),
                workstream_id: z.string().optional(),
            })
            .meta({
                description:
                    'Optional monitor workflow used when a process is launched as a conversation workstream. The process workflow sends checkpoint status signals to this monitor so long-running human-task processes do not need tight polling.',
            })
            .optional(),
    })
    .meta({ id: 'ProcessRunConfig' });

export const ProcessHistoryRefSchema = z
    .strictObject({
        path: z.string(),
        latest_sequence: z.number(),
        count: z.number(),
    })
    .meta({ id: 'ProcessHistoryRef' });

export const NodeHistoryEntrySchema = z
    .strictObject({
        id: z.string().optional(),
        node: z.string(),
        attempt: z.number().optional(),
        entered_at: z.string().meta({ format: 'date-time' }),
        exited_at: z.string().meta({ format: 'date-time' }).optional(),
        status: z.enum(['running', 'completed', 'skipped', 'failed', 'cancelled']),
        context_diff: z.looseObject({}).optional(),
        data_ref: z.string().optional(),
        sequence: z.number().optional(),
        child_run_id: z.string().optional(),
        child_workflow_id: z.string().optional(),
        child_workflow_run_id: z.string().optional(),
        artifacts: z.array(z.string()).optional(),
        log_ref: z.string().optional(),
    })
    .meta({ id: 'NodeHistoryEntry' });

export const ProcessHistoryResponseSchema = z
    .strictObject({
        run_id: z.string(),
        current_node: z.string(),
        node_history: z.array(NodeHistoryEntrySchema),
        node_history_ref: z
            .strictObject({
                path: z.string(),
                latest_sequence: z.number(),
                count: z.number(),
            })
            .optional(),
    })
    .meta({ id: 'ProcessHistoryResponse' });

export const ProcessContextResponseSchema = z
    .strictObject({
        run_id: z.string(),
        current_node: z.string(),
        context: JSONObjectSchema,
    })
    .meta({ id: 'ProcessContextResponse' });

export const WorkflowExecutionStartResultSchema = z
    .strictObject({
        run_id: z.string(),
        workflow_id: z.string(),
    })
    .meta({ id: 'WorkflowExecutionStartResult' });

export const ActivityFetchSpecSchema = z
    .strictObject({
        type: z.enum(['document', 'document_type', 'interaction_run']).meta({ description: 'The data provider name' }),
        source: z.string().meta({ description: 'An optional URI to the data source.' }).optional(),
        query: z.looseObject({}).meta({ description: 'The query to be executed by the data provider' }),
        select: z
            .string()
            .meta({
                description:
                    'a string of space separated field names. Prefix a field name with "-" to exclude it from the result.',
            })
            .optional(),
        limit: z
            .number()
            .meta({
                description:
                    'The number of results to return. If the result is limited to 1 the result will be a single object',
            })
            .optional(),
        on_not_found: z
            .enum(['ignore', 'throw'])
            .meta({
                description:
                    'How to handle not found objects. 1. ignore - Ignore and return an empty array for multi objects query (or undefined for single object query) or empty array for multiple objects throw an error. 2. throw - Throw an error if the object or no objects are found.',
            })
            .optional(),
    })
    .meta({ id: 'ActivityFetchSpec' });

export const ImportSpecSchema = z.array(z.unknown()).meta({ id: 'ImportSpec' });

export const WorkflowSearchAttributeValueSchema = z
    .array(
        z.union([z.string(), z.number(), z.boolean()]).meta({
            anyOf: undefined,
            oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
        }),
    )
    .meta({ id: 'WorkflowSearchAttributeValue' });

export const AnswerProcessTaskPayloadSchema = z
    .strictObject({
        task_id: z.string(),
        // Required, despite being absent from the component the scanner derived. The handler throws
        // `Missing required field: result` without it and then checks it field-by-field against the
        // task's declared `fields`, so a body carrying only `task_id` has never been answerable.
        // The shape is open because the keys ARE those declared fields — they are defined by the
        // process node, not by this contract.
        result: z.looseObject({}).meta({ description: "Answers to the task's declared fields, keyed by field name." }),
    })
    .meta({ id: 'AnswerProcessTaskPayload' });

export const AdvanceProcessPayloadSchema = z
    .strictObject({
        target: z.string().optional(),
        reason: z.string().optional(),
    })
    .meta({ id: 'AdvanceProcessPayload' });

export const BranchDefinitionSchema = z
    .strictObject({
        to: z.string(),
        when: JsonLogicRuleSchema.optional(),
        default: z.boolean().optional(),
        metadata: ProcessDefinitionMetadataSchema.optional(),
    })
    .meta({ id: 'BranchDefinition' });

export const ParallelCollectDefinitionSchema = z
    .strictObject({
        into: z.string().meta({ description: 'Context key that receives the collected results.' }),
        mode: ParallelCollectModeSchema.optional(),
        include: z
            .array(ParallelCollectFieldSchema)
            .meta({
                description:
                    'Fields to include in each collected item. Defaults to the operational envelope: status, index, item_id, output, error, and child_run_id.',
            })
            .optional(),
    })
    .meta({ id: 'ParallelCollectDefinition' });

export const TransitionDefinitionSchema = z
    .strictObject({
        to: z.string(),
        guard: JsonLogicRuleSchema.optional(),
        trigger: TransitionTriggerSchema.optional(),
        label: z.string().optional(),
        metadata: ProcessDefinitionMetadataSchema.optional(),
    })
    .meta({ id: 'TransitionDefinition' });

export const ProcessScriptSourceSchema = ProcessScriptInlineSourceSchema.meta({ id: 'ProcessScriptSource' });

export const ProcessStateSchema = z
    .strictObject({
        context: z.looseObject({}),
        current_node: z.string(),
        node_history: z.array(NodeHistoryEntrySchema),
        node_history_ref: ProcessHistoryRefSchema.optional(),
        sequence: z.number(),
    })
    .meta({ id: 'ProcessState' });

export const WorkflowExecutionStartResultArraySchema = z
    .array(WorkflowExecutionStartResultSchema)
    .meta({ id: 'WorkflowExecutionStartResultArray' });

export const DSLRetryPolicySchema = z
    .strictObject({
        backoffCoefficient: z.number().optional(),
        initialInterval: DurationValueSchema.optional(),
        maximumAttempts: z.number().optional(),
        maximumInterval: DurationValueSchema.optional(),
        nonRetryableErrorTypes: z.array(z.string()).optional(),
    })
    .meta({ id: 'DSLRetryPolicy', description: 'The payload for a DSL retry policy.' });

export const ActivityFetchSpecMapSchema = z
    .object({})
    .catchall(ActivityFetchSpecSchema)
    .meta({ id: 'ActivityFetchSpecMap' });

export const WorkflowSearchAttributeValueMapSchema = z
    .object({})
    .catchall(WorkflowSearchAttributeValueSchema)
    .meta({ id: 'WorkflowSearchAttributeValueMap' });

export const ProcessScriptResourceSchema = z
    .strictObject({
        language: ProcessScriptLanguageSchema,
        entrypoint: z.string(),
        source: ProcessScriptSourceSchema,
        packages: z.array(z.string()).optional(),
    })
    .meta({ id: 'ProcessScriptResource' });

export const DSLActivityOptionsSchema = z
    .strictObject({
        startToCloseTimeout: DurationValueSchema.optional(),
        heartbeatTimeout: DurationValueSchema.optional(),
        scheduleToStartTimeout: DurationValueSchema.optional(),
        scheduleToCloseTimeout: DurationValueSchema.optional(),
        retry: DSLRetryPolicySchema.optional(),
    })
    .meta({ id: 'DSLActivityOptions', description: 'The payload for a DSL activity options.' });

export const DSLActivitySpecSchema = z
    .strictObject({
        name: z.string().meta({ description: 'The name of the activity function' }),
        title: z
            .string()
            .meta({ description: 'Title of the activity to be displayed in the UI workflow builder' })
            .optional(),
        description: z
            .string()
            .meta({ description: 'The description of the activity to e displayed in the UI workflow builder' })
            .optional(),
        params: z
            .looseObject({})
            .meta({
                description:
                    'Activities parameters. These parameters can be either literals (hardcoded strings, numbers, booleans, objects, arrays etc.), either references to the workflow variables. The workflow variables are built from the workflow params (e.g. the workflow configuration) and from the result of the previous activities.',
            })
            .optional(),
        output: z
            .string()
            .meta({
                description:
                    'The name of the workflow variable that will store the result of the activity If not specified the result will not be stored The parameters describe how the actual parameters will be obtained from the workflow execution vars. since it may contain references to workflow execution vars.',
            })
            .optional(),
        condition: z
            .looseObject({})
            .meta({
                description:
                    'A JSON expression which evaluate to true or false similar to mongo matches. We support for now basic expression like: $true, $false, $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $regexp {$eq: {name: value}}, Ex: {$eq: {wfVarName: value}}',
            })
            .optional(),
        import: ImportSpecSchema.meta({
            description:
                'The import spec is used to import data from workflow variables. The import spec is a list of variable names to import from the workflow context. You can also use objects to rename the imported variables, or to reference an expression. Example: ["runId", {"typeId": "docType.id"}]',
        }).optional(),
        fetch: ActivityFetchSpecMapSchema.meta({
            description: 'The fetch phase is used to fetch data from external sources.',
        }).optional(),
        projection: z
            .looseObject({})
            .meta({ description: 'Projection to apply to the result. Not all activities support this.' })
            .optional(),
        parallel: z
            .boolean()
            .meta({
                description:
                    'If true the activity will be executed in parallel with the other activities. (i.e. the workflow will not wait for the activity to finish before starting the next one)',
            })
            .optional(),
        await: z.string().meta({ description: 'Await for a parallel activity execution to return.' }).optional(),
        options: DSLActivityOptionsSchema.meta({
            description:
                'Activity options for configuring the activity execution, which overrides the activity options defined at workflow level.',
        }).optional(),
    })
    .meta({ id: 'DSLActivitySpec' });

export const WorkflowSearchAttributesSchema = WorkflowSearchAttributeValueMapSchema.meta({
    id: 'WorkflowSearchAttributes',
});

export const DSLActivityStepSchema = z
    .strictObject({
        type: z.literal('activity').meta({ description: 'The type fo the step. If not set defaults to "activity"' }),
        name: z.string().meta({ description: 'The name of the activity function' }),
        title: z
            .string()
            .meta({ description: 'Title of the activity to be displayed in the UI workflow builder' })
            .optional(),
        description: z
            .string()
            .meta({ description: 'The description of the activity to e displayed in the UI workflow builder' })
            .optional(),
        params: z
            .looseObject({})
            .meta({
                description:
                    'Activities parameters. These parameters can be either literals (hardcoded strings, numbers, booleans, objects, arrays etc.), either references to the workflow variables. The workflow variables are built from the workflow params (e.g. the workflow configuration) and from the result of the previous activities.',
            })
            .optional(),
        output: z
            .string()
            .meta({
                description:
                    'The name of the workflow variable that will store the result of the activity If not specified the result will not be stored The parameters describe how the actual parameters will be obtained from the workflow execution vars. since it may contain references to workflow execution vars.',
            })
            .optional(),
        condition: z
            .looseObject({})
            .meta({
                description:
                    'A JSON expression which evaluate to true or false similar to mongo matches. We support for now basic expression like: $true, $false, $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $regexp {$eq: {name: value}}, Ex: {$eq: {wfVarName: value}}',
            })
            .optional(),
        import: ImportSpecSchema.meta({
            description:
                'The import spec is used to import data from workflow variables. The import spec is a list of variable names to import from the workflow context. You can also use objects to rename the imported variables, or to reference an expression. Example: ["runId", {"typeId": "docType.id"}]',
        }).optional(),
        fetch: ActivityFetchSpecMapSchema.meta({
            description: 'The fetch phase is used to fetch data from external sources.',
        }).optional(),
        projection: z
            .looseObject({})
            .meta({ description: 'Projection to apply to the result. Not all activities support this.' })
            .optional(),
        parallel: z
            .boolean()
            .meta({
                description:
                    'If true the activity will be executed in parallel with the other activities. (i.e. the workflow will not wait for the activity to finish before starting the next one)',
            })
            .optional(),
        await: z.string().meta({ description: 'Await for a parallel activity execution to return.' }).optional(),
        options: DSLActivityOptionsSchema.meta({
            description:
                'Activity options for configuring the activity execution, which overrides the activity options defined at workflow level.',
        }).optional(),
    })
    .meta({ id: 'DSLActivityStep' });

export const ProcessScriptResourceMapSchema = z
    .object({})
    .catchall(ProcessScriptResourceSchema)
    .meta({ id: 'ProcessScriptResourceMap' });

export const ProcessResourcesDefinitionSchema = z
    .strictObject({
        scripts: ProcessScriptResourceMapSchema.optional(),
    })
    .meta({ id: 'ProcessResourcesDefinition' });

export const BranchNodeBranchDefinitionSchema: z.ZodType = z
    .strictObject({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        node: z.lazy(() => NodeDefinitionSchema),
        metadata: ProcessDefinitionMetadataSchema.optional(),
    })
    .meta({ id: 'BranchNodeBranchDefinition' });

export const CreateProcessDefinitionPayloadSchema: z.ZodType = z
    .strictObject({
        name: z.string(),
        description: z.string().optional(),
        status: ProcessDefinitionStatusSchema.meta({
            description:
                'Deprecated: Process definitions are created as drafts. Use the publish endpoint\nto create immutable published versions.',
            deprecated: true,
            'x-deprecated-message':
                'Process definitions are created as drafts. Use the publish endpoint\nto create immutable published versions.',
        }).optional(),
        version: z
            .number()
            .meta({
                description:
                    'Deprecated: Version is server-owned. Use the publish endpoint to create the next version.',
                deprecated: true,
                'x-deprecated-message': 'Version is server-owned. Use the publish endpoint to create the next version.',
            })
            .optional(),
        tags: z.array(z.string()).optional(),
        definition: z.lazy(() => ProcessDefinitionBodySchema),
    })
    .meta({ id: 'CreateProcessDefinitionPayload' });

export const DSLChildWorkflowStepSchema: z.ZodType = z
    .strictObject({
        type: z.literal('workflow').meta({ description: 'The type fo the step. If not set defaults to "activity"' }),
        name: z.string(),
        vars: z
            .looseObject({})
            .meta({
                description:
                    'The parameters to pass to the child workflow. These parameters will be merged over the parent workflow vars and passed altogether to the child workflow.',
            })
            .optional(),
        async: z.boolean().optional(),
        output: z
            .string()
            .meta({
                description:
                    'The name of the workflow variable that will store the result of the child workflow (if async the workflow id is stored) If not specified the result will not be stored The parameters describe how the actual parameters will be obtained from the workflow execution vars. since it may contain references to workflow execution vars.',
            })
            .optional(),
        condition: z
            .looseObject({})
            .meta({
                description:
                    'A JSON expression which evaluates to true or false similar to mongo matches. The child workflow will only execute if the condition is satisfied. Example: {$eq: {wfVarName: value}}',
            })
            .optional(),
        spec: z
            .lazy(() => DSLWorkflowSpecSchema)
            .meta({
                description:
                    'In case the dslWorkflow is used as a child workflow the spec is used to define the child workflow. If spec is defined then the name must be "dslWorkflow"',
            })
            .optional(),
        options: z
            .strictObject({
                memo: z.looseObject({}).optional(),
                retry: DSLRetryPolicySchema.optional(),
                searchAttributes: WorkflowSearchAttributesSchema.optional(),
                taskQueue: z.string().optional(),
                workflowExecutionTimeout: DurationValueSchema.optional(),
                workflowRunTimeout: DurationValueSchema.optional(),
                workflowTaskTimeout: DurationValueSchema.optional(),
                workflowId: z.string().optional(),
                cronSchedule: z.string().optional(),
                parentClosePolicy: z.enum(['TERMINATE', 'ABANDON', 'REQUEST_CANCEL']).optional(),
            })
            .optional(),
    })
    .meta({ id: 'DSLChildWorkflowStep' });

export const DSLWorkflowDefinitionSchema: z.ZodType = z
    .strictObject({
        name: z.string().meta({ description: 'Human-readable name or title' }),
        description: z.string().meta({ description: 'Optional detailed description of the object' }).optional(),
        tags: z.array(z.string()).meta({ description: 'Optional array of categorization tags' }).optional(),
        steps: z.array(z.lazy(() => DSLWorkflowStepSchema)).optional(),
        activities: z.array(DSLActivitySpecSchema).optional(),
        vars: z.looseObject({}),
        options: DSLActivityOptionsSchema.optional(),
        result: z.string().optional(),
        debug_mode: z.boolean().optional(),
        id: z.string().meta({ description: 'Unique identifier for the object' }),
        updated_by: z.string().meta({ description: 'Identifier of the user who last modified the object' }),
        created_by: z.string().meta({ description: 'Identifier of the user who created the object' }),
        created_at: z.string().meta({ description: 'ISO timestamp of when the object was created' }),
        updated_at: z.string().meta({ description: 'ISO timestamp of when the object was last updated' }),
        input_schema: z.looseObject({}).optional(),
    })
    .meta({ id: 'DSLWorkflowDefinition' });

export const DSLWorkflowDefinitionResponseSchema: z.ZodType = z
    .strictObject({
        name: z.string().meta({ description: 'Human-readable name or title' }),
        description: z.string().meta({ description: 'Optional detailed description of the object' }).optional(),
        tags: z.array(z.string()).meta({ description: 'Optional array of categorization tags' }).optional(),
        steps: z.array(z.lazy(() => DSLWorkflowStepSchema)).optional(),
        activities: z.array(DSLActivitySpecSchema).optional(),
        vars: z.looseObject({}),
        options: DSLActivityOptionsSchema.optional(),
        result: z.string().optional(),
        debug_mode: z.boolean().optional(),
        id: z.string().meta({ description: 'Unique identifier for the object' }),
        updated_by: z.string().meta({ description: 'Identifier of the user who last modified the object' }),
        created_by: z.string().meta({ description: 'Identifier of the user who created the object' }),
        created_at: z.string().meta({ description: 'ISO timestamp of when the object was created' }),
        updated_at: z.string().meta({ description: 'ISO timestamp of when the object was last updated' }),
        input_schema: z.looseObject({}).optional(),
        spec_format: z.enum(['steps', 'activities']),
    })
    .meta({ id: 'DSLWorkflowDefinitionResponse' });

export const DSLWorkflowSpecSchema: z.ZodType = z
    .discriminatedUnion('spec_format', [
        z.lazy(() => DSLWorkflowSpecWithStepsSchema) as unknown as z.ZodObject,
        z.lazy(() => DSLWorkflowSpecWithActivitiesSchema) as unknown as z.ZodObject,
    ])
    .meta({ id: 'DSLWorkflowSpec' });

/**
 * The fields every workflow-spec shape carries, spread rather than `.extend()`ed.
 *
 * `.extend()` clones the base's registry metadata, so the derived schema kept emitting under the
 * base's `id` and collided with it in the component map.
 */
const dslWorkflowSpecBaseFields = {
    name: z.string(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    vars: z.looseObject({}),
    options: DSLActivityOptionsSchema.optional(),
    result: z.string().optional(),
    debug_mode: z.boolean().optional(),
};

const deprecatedActivitiesMeta = {
    description: 'Deprecated: use steps instead',
    deprecated: true,
    'x-deprecated-message': 'use steps instead',
};

export const DSLWorkflowSpecWithActivitiesSchema: z.ZodType = z
    .strictObject({
        ...dslWorkflowSpecBaseFields,
        steps: z.array(z.lazy(() => DSLWorkflowStepSchema)).optional(),
        activities: z.array(DSLActivitySpecSchema).meta(deprecatedActivitiesMeta),
        spec_format: z.literal('activities'),
    })
    .meta({ id: 'DSLWorkflowSpecWithActivities' });

export const DSLWorkflowSpecWithStepsSchema: z.ZodType = z
    .strictObject({
        ...dslWorkflowSpecBaseFields,
        steps: z.array(z.lazy(() => DSLWorkflowStepSchema)),
        activities: z.array(DSLActivitySpecSchema).meta(deprecatedActivitiesMeta).optional(),
        spec_format: z.literal('steps'),
    })
    .meta({ id: 'DSLWorkflowSpecWithSteps' });

/**
 * What `POST /workflows/definitions` and `PUT /workflows/definitions/:id` accept: a workflow spec,
 * not a stored definition.
 *
 * Naming the stored `DSLWorkflowDefinition` as the request body would demand `id`, `created_at`,
 * `updated_at`, `created_by` and `updated_by` — all server-assigned — while rejecting the
 * `spec_format` discriminator every real caller sends.
 *
 * The three fields below are optional and only exist for the legacy upsert branch of the POST
 * handler: a body carrying `id` updates that definition instead of creating one, and `updated_at`
 * is the value it was read with, checked for optimistic concurrency. The published client only ever
 * sends a bare spec.
 */
const legacyWorkflowDefinitionUpsertFields = {
    id: z
        .string()
        .meta({ description: 'Legacy upsert: update this definition instead of creating a new one.' })
        .optional(),
    created_at: z.string().meta({ description: 'Legacy upsert: ignored, the stored value wins.' }).optional(),
    updated_at: z
        .string()
        .meta({ description: 'Legacy upsert: the value the definition was read with, for conflict detection.' })
        .optional(),
};

export const WorkflowDefinitionPayloadWithActivitiesSchema: z.ZodType = z
    .strictObject({
        ...dslWorkflowSpecBaseFields,
        ...legacyWorkflowDefinitionUpsertFields,
        steps: z.array(z.lazy(() => DSLWorkflowStepSchema)).optional(),
        activities: z.array(DSLActivitySpecSchema).meta(deprecatedActivitiesMeta),
        spec_format: z.literal('activities'),
    })
    .meta({ id: 'WorkflowDefinitionPayloadWithActivities' });

export const WorkflowDefinitionPayloadWithStepsSchema: z.ZodType = z
    .strictObject({
        ...dslWorkflowSpecBaseFields,
        ...legacyWorkflowDefinitionUpsertFields,
        steps: z.array(z.lazy(() => DSLWorkflowStepSchema)),
        activities: z.array(DSLActivitySpecSchema).meta(deprecatedActivitiesMeta).optional(),
        spec_format: z.literal('steps'),
    })
    .meta({ id: 'WorkflowDefinitionPayloadWithSteps' });

export const WorkflowDefinitionPayloadSchema: z.ZodType = z
    .discriminatedUnion('spec_format', [
        WorkflowDefinitionPayloadWithStepsSchema as unknown as z.ZodObject,
        WorkflowDefinitionPayloadWithActivitiesSchema as unknown as z.ZodObject,
    ])
    .meta({ id: 'WorkflowDefinitionPayload' });

export const DSLWorkflowStepSchema: z.ZodType = z
    .discriminatedUnion('type', [
        DSLActivityStepSchema,
        z.lazy(() => DSLChildWorkflowStepSchema) as unknown as z.ZodObject,
    ])
    .meta({ id: 'DSLWorkflowStep' });

export const NodeDefinitionSchema: z.ZodType = z
    .strictObject({
        type: ProcessNodeTypeSchema,
        tool: z.string().optional(),
        script: z
            .string()
            .meta({ description: 'Named entry in process resources.scripts for script nodes.' })
            .optional(),
        timeout: z
            .number()
            .meta({ description: 'Script execution timeout in seconds. Defaults to 300 and is capped at 600.' })
            .optional(),
        interaction: z.string().optional(),
        process: z.string().optional(),
        process_definition: z.lazy(() => ProcessDefinitionBodySchema).optional(),
        process_version: z.number().optional(),
        run_type: ProcessNodeRunTypeSchema.optional(),
        returns: ProcessNodeReturnsDefinitionSchema.optional(),
        result_schema: JSONSchemaSchema.meta({
            description:
                'Optional JSON Schema for structured output produced by interaction and agent nodes. When omitted, the process engine derives a schema from `writes` and the process context schema.',
        }).optional(),
        prompt: z.string().optional(),
        input: z.looseObject({}).optional(),
        config: z.looseObject({}).optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        human_description: z
            .string()
            .meta({
                description:
                    'End-user-facing explanation of what this node does. Authored by the process designer (often an LLM) in plain language — one or two sentences — and rendered in run observability so a human reading the run can understand why this node exists without reading the config. Distinct from `description`, which is developer-facing.',
            })
            .optional(),
        writes: z.array(z.string()).optional(),
        skippable: z.boolean().optional(),
        max_retries: z.number().optional(),
        transitions: z.array(TransitionDefinitionSchema).optional(),
        tools: z.array(z.string()).optional(),
        model: z
            .string()
            .meta({
                description:
                    "Model id override for this node. If unset, falls back to the process run's `config.model`, then to the project's default. Useful when a specific node needs heavier reasoning (e.g. Opus for legal flagging) while the rest of the process uses a cheaper default.",
            })
            .optional(),
        task: HumanTaskDefinitionSchema.optional(),
        foreach: z.string().optional(),
        as: z.string().optional(),
        item_id: z.string().optional(),
        node: z.lazy(() => NodeDefinitionSchema).optional(),
        max_concurrency: z.number().optional(),
        collect: z.union([z.string(), ParallelCollectDefinitionSchema]).optional(),
        failure_policy: ParallelFailurePolicySchema.optional(),
        join: BranchJoinPolicySchema.optional(),
        branches: z
            .array(
                z.union([BranchDefinitionSchema, z.lazy(() => BranchNodeBranchDefinitionSchema)]).meta({
                    anyOf: undefined,
                    oneOf: [
                        { $ref: '#/components/schemas/BranchDefinition' },
                        { $ref: '#/components/schemas/BranchNodeBranchDefinition' },
                    ],
                }),
            )
            .optional(),
        metadata: ProcessDefinitionMetadataSchema.optional(),
    })
    .meta({ id: 'NodeDefinition' });

export const NodeDefinitionMapSchema: z.ZodType = z
    .object({})
    .catchall(z.lazy(() => NodeDefinitionSchema))
    .meta({ id: 'NodeDefinitionMap' });

export const ProcessDefinitionSchema: z.ZodType = z
    .strictObject({
        id: z.string(),
        account: z.string(),
        project: z.string(),
        name: z.string(),
        description: z.string().optional(),
        status: ProcessDefinitionStatusSchema,
        version: z.number(),
        revision: ProcessDefinitionRevisionInfoSchema.optional(),
        tags: z.array(z.string()).optional(),
        definition: z.lazy(() => ProcessDefinitionBodySchema),
        created_at: z.string().meta({ format: 'date-time' }),
        updated_at: z.string().meta({ format: 'date-time' }),
        created_by: z.string(),
        updated_by: z.string(),
    })
    .meta({ id: 'ProcessDefinition' });

export const HistoricalProcessDefinitionBodySchema = z
    .strictObject({
        format_version: ProcessDefinitionFormatVersionSchema.optional(),
        process: z.string().optional(),
        description: z.string().optional(),
        initial: z.string().optional(),
        model: z.string().optional(),
        resources: JSONObjectSchema.optional(),
        context: JSONObjectSchema.optional(),
        nodes: JSONObjectSchema,
        metadata: JSONObjectSchema.optional(),
    })
    .meta({ id: 'HistoricalProcessDefinitionBody' });

/** Read-side compatibility for definitions stored before the current format was introduced. */
export const HistoricalProcessDefinitionSchema = z
    .strictObject({
        id: z.string(),
        account: z.string(),
        project: z.string(),
        name: z.string(),
        description: z.string().optional(),
        status: ProcessDefinitionStatusSchema,
        version: z.number(),
        revision: ProcessDefinitionRevisionInfoSchema.optional(),
        tags: z.array(z.string()).optional(),
        definition: HistoricalProcessDefinitionBodySchema,
        created_at: z.string().meta({ format: 'date-time' }),
        updated_at: z.string().meta({ format: 'date-time' }),
        created_by: z.string(),
        updated_by: z.string(),
    })
    .meta({ id: 'HistoricalProcessDefinition' });

export const ProcessDefinitionArraySchema = z
    .array(HistoricalProcessDefinitionSchema)
    .meta({ id: 'ProcessDefinitionArray' });

export const ProcessDefinitionBodySchema: z.ZodType = z
    .strictObject({
        format_version: ProcessDefinitionFormatVersionSchema,
        process: z.string(),
        description: z.string().optional(),
        initial: z.string(),
        model: z.string().optional(),
        resources: ProcessResourcesDefinitionSchema.optional(),
        context: ProcessContextDefinitionSchema,
        nodes: z.lazy(() => NodeDefinitionMapSchema),
        metadata: ProcessDefinitionMetadataSchema.optional(),
    })
    .meta({ id: 'ProcessDefinitionBody' });

export const UpdateProcessDefinitionPayloadSchema: z.ZodType = z
    .strictObject({
        name: z.string().optional(),
        description: z.string().optional(),
        status: ProcessDefinitionStatusSchema.meta({
            description:
                'Deprecated: Status is server-owned. Use publish/archive endpoints instead of updating it directly.',
            deprecated: true,
            'x-deprecated-message':
                'Status is server-owned. Use publish/archive endpoints instead of updating it directly.',
        }).optional(),
        version: z
            .number()
            .meta({
                description:
                    'Deprecated: Version is server-owned. Use the publish endpoint to create the next version.',
                deprecated: true,
                'x-deprecated-message': 'Version is server-owned. Use the publish endpoint to create the next version.',
            })
            .optional(),
        tags: z.array(z.string()).optional(),
        definition: z.lazy(() => ProcessDefinitionBodySchema).optional(),
    })
    .meta({ id: 'UpdateProcessDefinitionPayload' });

export const ListProcessDefinitionsQuerySchema = z
    .object({
        status: ProcessDefinitionStatusSchema.optional(),
        process: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
        all_versions: z.boolean().optional(),
    })
    .meta({ id: 'ListProcessDefinitionsQuery' });

export const RecordProcessRunPayloadSchema = z
    .strictObject({
        workflow_id: z.string(),
        first_workflow_run_id: z.string().optional(),
        run_kind: z.literal('process'),
        run_type: ProcessRunTypeSchema.optional(),
        process_id: z.string().optional(),
        process_version: z.number().optional(),
        process_definition: ProcessDefinitionBodySchema.optional(),
        data: z.looseObject({}).optional(),
        config: ProcessRunConfigSchema.optional(),
        visibility: ConversationVisibilitySchema.optional(),
        tags: z.array(z.string()).optional(),
        categories: z.array(z.string()).optional(),
        source: RunSourceSchema.optional(),
        started_by: z.string().optional(),
    })
    .meta({ id: 'RecordProcessRunPayload' });
