// Runtime schemas for the workflow runs API domain.

import { JSONObjectSchema, JSONSchemaSchema, JSONValueSchema } from '@llumiverse/common/schemas';
import { z } from 'zod';
import type { ActivityTypeDefinition } from '../store/activity-catalog.js';
import { CompactMessageSchema } from './agent-runs.js';
import { AgentRunStatusSchema, ConversationActivityStateSchema } from './app-lifecycle.js';
import { WorkflowExecutionStatusSchema } from './document-processing.js';
import {
    AgentToolApprovalModeSchema,
    ConversationVisibilitySchema,
    InteractionRefSchema,
    UserChannelSchema,
} from './interaction.js';
import { nullableStringSchema } from './schema-primitives.js';
import { InteractionExecutionConfigurationSchema } from './store.js';

export const RestartAgentRunPayloadSchema = z
    .strictObject({
        nd_restart_count: z.number().optional(),
    })
    .meta({
        id: 'RestartAgentRunPayload',
        description: 'Optional restart options. `POST /agents/:id/restart` accepts no body at all.',
    });

export const TaskType_TIMERSchema = z.literal('timer').meta({ id: 'TaskType_TIMER' });

export const TaskType_SIGNALSchema = z.literal('signal').meta({ id: 'TaskType_SIGNAL' });

export const TaskType_CHILD_WORKFLOWSchema = z.literal('childWorkflow').meta({ id: 'TaskType_CHILD_WORKFLOW' });

export const TaskType_ACTIVITYSchema = z.literal('activity').meta({ id: 'TaskType_ACTIVITY' });

export const WorkflowQueryResultSchema = JSONValueSchema.meta({ id: 'WorkflowQueryResult' });

export const WorkflowUpdatePublishResponseSchema = z
    .strictObject({
        success: z.boolean(),
    })
    .meta({ id: 'WorkflowUpdatePublishResponse' });

const ActivityTypeNameSchema = z.enum([
    'string',
    'number',
    'boolean',
    'record',
    'object',
    'array',
    'enum',
    'literal',
    'union',
    'promise',
    'any',
    'void',
]);

export const ActivityTypeDefinitionSchema: z.ZodType<ActivityTypeDefinition> = z
    .lazy(() =>
        z.strictObject({
            name: ActivityTypeNameSchema,
            value: z.union([z.string(), z.boolean(), z.number(), z.null()]),
            members: z.array(ActivityPropertyDefinitionSchema).optional(),
            innerType: ActivityTypeDefinitionSchema.optional(),
            enum: z.union([z.array(z.string()), z.array(z.number())]).optional(),
            union: z.array(ActivityTypeDefinitionSchema).optional(),
            keyType: ActivityTypeDefinitionSchema.optional(),
            valueType: ActivityTypeDefinitionSchema.optional(),
        }),
    )
    .meta({ id: 'ActivityTypeDefinition' });

export const ActivityPropertyDefinitionSchema = z
    .strictObject({
        name: z.string(),
        type: ActivityTypeDefinitionSchema,
        optional: z.boolean(),
        doc: z.string().optional(),
    })
    .meta({ id: 'ActivityPropertyDefinition' });

export const ActivityDefinitionSchema = z
    .strictObject({
        name: z.string(),
        title: z.string(),
        doc: z.string().optional(),
        paramsType: z.string(),
        params: z.array(ActivityPropertyDefinitionSchema),
        returnType: ActivityTypeDefinitionSchema.optional(),
    })
    .meta({ id: 'ActivityDefinition' });

export const ActivityCatalogSchema = z
    .strictObject({
        activities: z.array(ActivityDefinitionSchema),
    })
    .meta({ id: 'ActivityCatalog' });

export const WorkflowInteractionVarsSchema = z
    .strictObject({
        type: z.string(),
        interaction: z.string(),
        interactive: z.boolean(),
        tool_approval_mode: AgentToolApprovalModeSchema.optional(),
        debug_mode: z.boolean().optional(),
        non_blocking_subagents: z.boolean().optional(),
        user_channels: z.array(UserChannelSchema).optional(),
        data: JSONObjectSchema.optional(),
        tool_names: z.array(z.string()),
        config: InteractionExecutionConfigurationSchema,
        interactionParamsSchema: JSONSchemaSchema.optional(),
        collection_id: z.string().optional(),
        disabled_mcp_collections: z.array(z.string()).optional(),
        checkpoint_tokens: z.number().optional(),
        version: z.number().optional(),
        agent_run_id: z.string().optional(),
    })
    .meta({ id: 'WorkflowInteractionVars' });

export const ListWorkflowInteractionsResponseSchema = z
    .strictObject({
        workflow_id: z.string(),
        run_id: z.string(),
        interaction: WorkflowInteractionVarsSchema,
    })
    .meta({ id: 'ListWorkflowInteractionsResponse' });

export const ListWorkflowRunsPayloadSchema = z
    .strictObject({
        document_id: z.string().meta({ description: 'The document ID passed to a workflow run.' }).optional(),
        event_name: z.string().meta({ description: 'The event name that triggered the workflow.' }).optional(),
        rule_id: z.string().meta({ description: 'Legacy workflow rule ID filter, when applicable.' }).optional(),
        start: z.string().meta({ description: 'The start time for filtering workflow runs.' }).optional(),
        end: z.string().meta({ description: 'The end time for filtering workflow runs.' }).optional(),
        status: z.string().meta({ description: 'The status of the workflow run.' }).optional(),
        search_term: z.string().meta({ description: 'search term to filter on workflow id and run id' }).optional(),
        initiated_by: z
            .string()
            .meta({ description: 'The user or service account that initiated the workflow run.' })
            .optional(),
        interaction: z.string().meta({ description: 'The interaction name used to filter conversations.' }).optional(),
        query: z
            .string()
            .meta({
                description:
                    'Lucene query string to search for the workflow runs. This is a full text search on the workflow run history.',
            })
            .optional(),
        type: z.string().optional(),
        page_size: z.number().meta({ description: 'The maximum number of results to return per page.' }).optional(),
        next_page_token: z.string().meta({ description: 'The page token for Temporal pagination.' }).optional(),
        has_reported_errors: z
            .boolean()
            .meta({ description: 'Filter by whether the workflow has reported errors (TemporalReportedProblems).' })
            .optional(),
        activity_state: ConversationActivityStateSchema.meta({
            description: 'Filter by the activity state of the conversation (running or idle).',
        }).optional(),
        interactive: z.boolean().meta({ description: 'Filter by whether the conversation is interactive.' }).optional(),
    })
    .meta({ id: 'ListWorkflowRunsPayload' });

export const WorkflowDefinitionRefSchema = z
    .strictObject({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
        created_at: z.string().meta({ format: 'date-time' }),
        updated_at: z.string().meta({ format: 'date-time' }),
    })
    .meta({ id: 'WorkflowDefinitionRef' });

export const WorkflowRunSchema = z
    .strictObject({
        status: z.union([WorkflowExecutionStatusSchema, z.string()]).optional(),
        type: z.string().meta({ description: 'The Temporal Workflow Type of this Workflow Run.' }).optional(),
        started_at: nullableStringSchema,
        closed_at: nullableStringSchema,
        execution_duration: z.number().optional(),
        run_id: z.string().optional(),
        workflow_id: z.string().optional(),
        initiated_by: z.string().optional(),
        interaction_name: z.string().optional(),
        input: z.unknown().optional(),
        result: z.unknown().optional(),
        error: z.unknown().optional(),
        has_reported_errors: z.boolean().optional(),
        raw: z.unknown().optional(),
        vertesia_workflow_type: z
            .string()
            .meta({
                description:
                    'The Vertesia Workflow Type of this Workflow Run.  - For DSL workflows (`type:dslWorkflow`), the vertesia_type refers to the "Workflow Rule Name" specified in the    DSL. For example, "Standard Document Intake" or "Standard Image Intake".  - For non-DSL workflows, the vertesia_type is the name of the Temporal Workflow Type.',
            })
            .optional(),
        interactions: z
            .array(InteractionRefSchema)
            .meta({ description: 'An interaction is used to start the agent, the data is stored on temporal "vars"' })
            .optional(),
        visibility: ConversationVisibilitySchema.meta({
            description:
                "The visibility of the workflow run.\n- 'private': Only visible to the user who initiated the workflow\n- 'project': Visible to all users in the project",
        }).optional(),
        topic: z.string().meta({ description: 'A brief summary of the conversation workflow.' }).optional(),
        activity_state: ConversationActivityStateSchema.meta({
            description:
                "The current activity state of the conversation.\n- 'working': The agent is actively processing\n- 'idle': The agent is waiting for user input",
        }).optional(),
        interactive: z
            .boolean()
            .meta({ description: 'Whether this conversation is interactive (accepts user input).' })
            .optional(),
        memo: z.looseObject({}).nullable().optional(),
    })
    .meta({ id: 'WorkflowRun' });

export const PendingActivitySchema = z
    .strictObject({
        activityId: z.string().optional(),
        activityType: z.string().optional(),
        attempt: z.number(),
        maximumAttempts: z.number(),
        lastFailure: z.string().optional(),
        lastStartedTime: nullableStringSchema,
        lastHeartbeatTime: nullableStringSchema.optional(),
    })
    .meta({ id: 'PendingActivity' });

export const AgentTaskSchema = z
    .strictObject({
        taskType: z
            .enum(['tool_call', 'llm_call', 'input', 'timer', 'subagent', 'processing', 'signal'])
            .meta({ description: 'Type discriminator for future task types' }),
        toolName: z.string().meta({ description: 'Tool-specific fields' }),
        toolUseId: z.string().optional(),
        toolRunId: z.string().optional(),
        toolType: z.enum(['builtin', 'interaction', 'remote', 'skill']).optional(),
        iteration: z.number().optional(),
        scheduled_at: nullableStringSchema.meta({ description: 'Execution details' }),
        started_at: nullableStringSchema,
        completed_at: nullableStringSchema,
        status: z.enum(['running', 'completed', 'error', 'warning', 'received', 'sent']),
        parameters: z.looseObject({}).meta({ description: 'Tool data' }).optional(),
        result: z.string().optional(),
        error: z
            .strictObject({
                type: z.string(),
                message: z.string(),
            })
            .optional(),
        retries: z.number().meta({ description: 'Number of activity retries' }).optional(),
        activeTools: z.array(z.string()).meta({ description: 'Active tools for this LLM call' }).optional(),
        availableSkills: z.array(z.string()).meta({ description: 'Available skills for this LLM call' }).optional(),
        runId: z.string().meta({ description: 'Temporal run ID that produced this task.' }).optional(),
        workstreamId: z.string().meta({ description: 'Workstream tracking' }).optional(),
        direction: z
            .enum(['sending', 'receiving'])
            .meta({ description: 'Signal direction for signal tasks' })
            .optional(),
        finish_reason: z
            .string()
            .meta({ description: 'LLM stop reason for llm_call tasks (e.g., "stop", "length", "tool_use")' })
            .optional(),
        warnings: z
            .array(z.string())
            .meta({ description: 'Warnings about the task outcome (e.g. unexpected model behavior).' })
            .optional(),
    })
    .meta({
        id: 'AgentTask',
        description:
            'Agent task information for workflow history UI representation. This is separate from the analytics AgentEvent types. Consistent with WorkflowTask naming convention.\n\nCurrently represents tool calls, but designed to be extensible for other task types (LLM calls, checkpoints, etc.)',
    });

export const TaskStatusSchema = z
    .enum(['scheduled', 'running', 'completed', 'failed', 'canceled', 'timed_out', 'terminated', 'sent', 'received'])
    .meta({ id: 'TaskStatus' });

export const EventErrorSchema = z
    .strictObject({
        message: z.string().optional(),
        source: z.string().optional(),
        stacktrace: z.string().optional(),
        type: z.string().optional(),
    })
    .meta({ id: 'EventError', description: 'Error information from failed workflow events' });

export const SignalEventPropertiesSchema = z
    .strictObject({
        direction: z.enum(['receiving', 'sending']),
        signalName: z.string().optional(),
        input: z.unknown().optional(),
        sender: z
            .strictObject({
                workflowId: z.string().optional(),
                runId: z.string().optional(),
            })
            .optional(),
        recipient: z
            .strictObject({
                workflowId: z.string().optional(),
                runId: z.string().optional(),
            })
            .optional(),
        initiatedEventId: z.string().optional(),
    })
    .meta({ id: 'SignalEventProperties', description: 'Signal event properties for workflow events' });

export const WorkflowInputFileSchema = z
    .strictObject({
        url: z.string(),
        mimetype: z.string(),
    })
    .meta({ id: 'WorkflowInputFile', description: 'File reference with URL and mimetype' });

export const WorkflowActionResponseSchema = z
    .strictObject({
        message: z.string(),
    })
    .meta({ id: 'WorkflowActionResponse' });

export const WorkflowDefinitionRefArraySchema = z
    .array(WorkflowDefinitionRefSchema)
    .meta({ id: 'WorkflowDefinitionRefArray' });

export const ListWorkflowRunsResponseSchema = z
    .strictObject({
        runs: z.array(WorkflowRunSchema),
        next_page_token: z.string().optional(),
        has_more: z.boolean().optional(),
    })
    .meta({ id: 'ListWorkflowRunsResponse' });

export const TimerTaskSchema = z
    .strictObject({
        type: TaskType_TIMERSchema,
        activityId: z.string(),
        activityName: z.string().optional(),
        input: z.unknown().optional(),
        scheduled: nullableStringSchema,
        status: TaskStatusSchema,
        attempts: z.number(),
        started: nullableStringSchema,
        completed: nullableStringSchema,
        error: nullableStringSchema,
        result: z.unknown(),
        runId: z
            .string()
            .meta({
                description:
                    'Temporal run ID that produced this task (set when aggregating across continueAsNew runs).',
            })
            .optional(),
        timerId: z.string().optional(),
        duration: z.string().optional(),
    })
    .meta({ id: 'TimerTask' });

export const SignalTaskSchema = z
    .strictObject({
        type: TaskType_SIGNALSchema,
        activityId: z.string(),
        activityName: z.string().optional(),
        input: z.unknown().optional(),
        scheduled: nullableStringSchema,
        status: TaskStatusSchema,
        attempts: z.number(),
        started: nullableStringSchema,
        completed: nullableStringSchema,
        error: nullableStringSchema,
        result: z.unknown(),
        runId: z
            .string()
            .meta({
                description:
                    'Temporal run ID that produced this task (set when aggregating across continueAsNew runs).',
            })
            .optional(),
        signalName: z.string().optional(),
        direction: z.enum(['sending', 'receiving']).optional(),
        sender: z
            .strictObject({
                workflowId: z.string().optional(),
                runId: z.string().optional(),
            })
            .optional(),
        recipient: z
            .strictObject({
                workflowId: z.string().optional(),
                runId: z.string().optional(),
            })
            .optional(),
    })
    .meta({ id: 'SignalTask' });

export const ChildWorkflowTaskSchema = z
    .strictObject({
        type: TaskType_CHILD_WORKFLOWSchema,
        activityId: z.string(),
        activityName: z.string().optional(),
        input: z.unknown().optional(),
        scheduled: nullableStringSchema,
        status: TaskStatusSchema,
        attempts: z.number(),
        started: nullableStringSchema,
        completed: nullableStringSchema,
        error: nullableStringSchema,
        result: z.unknown(),
        runId: z
            .string()
            .meta({
                description:
                    'Temporal run ID that produced this task (set when aggregating across continueAsNew runs).',
            })
            .optional(),
        workflowType: z.string().optional(),
    })
    .meta({ id: 'ChildWorkflowTask' });

export const ActivityTaskSchema = z
    .strictObject({
        type: TaskType_ACTIVITYSchema,
        activityId: z.string(),
        activityName: z.string().optional(),
        input: z.unknown().optional(),
        scheduled: nullableStringSchema,
        status: TaskStatusSchema,
        attempts: z.number(),
        started: nullableStringSchema,
        completed: nullableStringSchema,
        error: nullableStringSchema,
        result: z.unknown(),
        runId: z
            .string()
            .meta({
                description:
                    'Temporal run ID that produced this task (set when aggregating across continueAsNew runs).',
            })
            .optional(),
    })
    .meta({ id: 'ActivityTask' });

export const WorkflowRunEventSchema = z
    .strictObject({
        event_id: z.number(),
        event_time: nullableStringSchema,
        event_type: z.string(),
        task_id: z.string().optional(),
        attempt: z.number(),
        activity: z
            .strictObject({
                name: z.string().optional(),
                id: z.string().optional(),
                input: z.unknown().optional(),
                scheduledEventId: z.string().optional(),
                startedEventId: z.string().optional(),
            })
            .optional(),
        childWorkflow: z
            .strictObject({
                workflowId: z.string().optional(),
                workflowType: z.string().optional(),
                runId: z.string().optional(),
                scheduledEventId: z.string().optional(),
                startedEventId: z.string().optional(),
                input: z.unknown().optional(),
                result: z.unknown().optional(),
            })
            .optional(),
        signal: SignalEventPropertiesSchema.optional(),
        timer: z
            .strictObject({
                timerId: z.string().optional(),
                duration: z.string().optional(),
                summary: z.string().optional(),
            })
            .optional(),
        error: EventErrorSchema.optional(),
        result: z.unknown().optional(),
    })
    .meta({ id: 'WorkflowRunEvent' });

export const WorkflowInputSchema = z
    .discriminatedUnion('inputType', [
        z.strictObject({
            inputType: z.literal('objectIds'),
            objectIds: z.array(z.string()),
        }),
        z.strictObject({
            inputType: z.literal('files'),
            files: z.array(WorkflowInputFileSchema),
        }),
    ])
    .meta({
        id: 'WorkflowInput',
        type: 'object',
        required: ['inputType'],
        discriminator: { propertyName: 'inputType' },
    });

export const WorkflowRunUpdatesResponseSchema = z
    .strictObject({
        messages: z.array(CompactMessageSchema),
    })
    .meta({ id: 'WorkflowRunUpdatesResponse' });

export const WorkflowTaskSchema = z
    .discriminatedUnion('type', [ActivityTaskSchema, ChildWorkflowTaskSchema, SignalTaskSchema, TimerTaskSchema])
    .meta({
        id: 'WorkflowTask',
        type: 'object',
        required: ['type'],
        discriminator: {
            propertyName: 'type',
            mapping: {
                activity: '#/components/schemas/ActivityTask',
                childWorkflow: '#/components/schemas/ChildWorkflowTask',
                signal: '#/components/schemas/SignalTask',
                timer: '#/components/schemas/TimerTask',
            },
        },
    });

export const ExecuteWorkflowPayloadSchema = z
    .strictObject({
        task_queue: z
            .string()
            .meta({
                description: 'The task queue to assign the workflow to. Deprecated, queues are choosend server side',
            })
            .optional(),
        objectIds: z
            .array(z.string())
            .meta({
                description:
                    'Docuument IDs pon which the workflow will be executed, deprecated, replaced params in vars',
            })
            .optional(),
        input: WorkflowInputSchema.meta({
            description:
                'New format: Workflow input (either objectIds or files). Takes precedence over the deprecated `objectIds` field.',
        }).optional(),
        vars: z.looseObject({}).meta({ description: 'Parameters to pass to the workflow' }).optional(),
        unique: z
            .boolean()
            .meta({ description: 'Make the workflow ID unique by always adding a random token to the ID.' })
            .optional(),
        custom_id: z
            .string()
            .meta({ description: 'A custom ID to use for the workflow execution id instead of the generated one.' })
            .optional(),
        timeout: z
            .number()
            .meta({ description: 'Timeout for the workflow execution to complete, in seconds.' })
            .optional(),
        run_at: z
            .string()
            .meta({
                description:
                    'Schedule the workflow to run at a specific time (ISO 8601 datetime). Example: "2024-02-15T16:00:00Z" If in the past or not provided, workflow runs immediately.',
            })
            .optional(),
    })
    .meta({ id: 'ExecuteWorkflowPayload' });

export const WorkflowHistorySchema = z
    .discriminatedUnion('type', [
        z.strictObject({
            type: z.literal('events'),
            events: z.array(WorkflowRunEventSchema),
        }),
        z.strictObject({
            type: z.literal('tasks'),
            tasks: z.array(WorkflowTaskSchema),
        }),
        z.strictObject({
            type: z.literal('agent'),
            agentTasks: z.array(AgentTaskSchema),
        }),
    ])
    .meta({ id: 'WorkflowHistory', type: 'object', required: ['type'], discriminator: { propertyName: 'type' } });

export const WorkflowRunWithDetailsSchema = z
    .strictObject({
        status: z.union([WorkflowExecutionStatusSchema, z.string()]).optional(),
        type: z.string().meta({ description: 'The Temporal Workflow Type of this Workflow Run.' }).optional(),
        started_at: nullableStringSchema,
        closed_at: nullableStringSchema,
        execution_duration: z.number().optional(),
        run_id: z.string().optional(),
        workflow_id: z.string().optional(),
        initiated_by: z.string().optional(),
        interaction_name: z.string().optional(),
        input: z.unknown().optional(),
        result: z.unknown().optional(),
        error: z.unknown().optional(),
        has_reported_errors: z.boolean().optional(),
        raw: z.unknown().optional(),
        vertesia_workflow_type: z
            .string()
            .meta({
                description:
                    'The Vertesia Workflow Type of this Workflow Run.  - For DSL workflows (`type:dslWorkflow`), the vertesia_type refers to the "Workflow Rule Name" specified in the    DSL. For example, "Standard Document Intake" or "Standard Image Intake".  - For non-DSL workflows, the vertesia_type is the name of the Temporal Workflow Type.',
            })
            .optional(),
        interactions: z
            .array(InteractionRefSchema)
            .meta({ description: 'An interaction is used to start the agent, the data is stored on temporal "vars"' })
            .optional(),
        visibility: ConversationVisibilitySchema.meta({
            description:
                "The visibility of the workflow run.\n- 'private': Only visible to the user who initiated the workflow\n- 'project': Visible to all users in the project",
        }).optional(),
        topic: z.string().meta({ description: 'A brief summary of the conversation workflow.' }).optional(),
        activity_state: ConversationActivityStateSchema.meta({
            description:
                "The current activity state of the conversation.\n- 'working': The agent is actively processing\n- 'idle': The agent is waiting for user input",
        }).optional(),
        interactive: z
            .boolean()
            .meta({ description: 'Whether this conversation is interactive (accepts user input).' })
            .optional(),
        history: WorkflowHistorySchema.optional(),
        memo: z.looseObject({}).nullable().optional(),
        pendingActivities: z.array(PendingActivitySchema).optional(),
        children: z.array(WorkflowRunSchema).optional(),
    })
    .meta({ id: 'WorkflowRunWithDetails' });

export const WorkflowRunDetailsQuerySchema = z
    .object({
        include_history: z.boolean().optional(),
        history_format: z.enum(['events', 'tasks', 'agent']).optional(),
        hydrate_payloads: z.boolean().optional(),
        hydrate_tools: z
            .array(z.string())
            .meta({
                description:
                    'Restricts payload hydration to the tool calls named here. Only meaningful together with `hydrate_payloads=true`: externalized payloads are then downloaded for tool tasks whose tool name is listed, and every other task keeps its stored artifact reference and placeholder content. Omit to hydrate the whole history, which can reach several megabytes on a long agent run.',
            })
            .optional(),
    })
    .meta({ id: 'WorkflowRunDetailsQuery' });

export const WorkflowRunUpdatesQuerySchema = z
    .object({
        since: z.number().optional(),
    })
    .meta({ id: 'WorkflowRunUpdatesQuery' });

export const WorkflowRunStreamQuerySchema = WorkflowRunUpdatesQuerySchema.extend({
    skipHistory: z.boolean().optional(),
}).meta({ id: 'WorkflowRunStreamQuery' });

export const BindRunWorkflowPayloadSchema = z
    .strictObject({
        workflow_id: z.string(),
        first_workflow_run_id: z.string(),
        status: AgentRunStatusSchema.optional(),
        activity_state: ConversationActivityStateSchema.optional(),
    })
    .meta({ id: 'BindRunWorkflowPayload' });
