// Runtime schemas for the agent runs API domain.

import { ExecutionTokenUsageSchema, ReasoningEffortSchema } from '@llumiverse/common/schemas';
import { z } from 'zod';
import type { AgentMessageType, FileProcessingStatus } from '../store/workflow.js';
import { type AgentEvent, AgentEventType, LlmCallType, TelemetryToolType } from '../workflow-analytics.js';
import * as AppLifecycleSchemas from './app-lifecycle.js';
import {
    AgentRunStatusSchema,
    ContentObjectTypeRefSchema,
    ConversationActivityStateSchema,
    EventRefSchema,
    RunKindSchema,
    RunTypeSchema,
} from './app-lifecycle.js';
import {
    AgentResourceReferenceSchema,
    AgentSearchScopeSchema,
    AgentToolApprovalModeSchema,
    ConversationEnrichmentFields,
    ConversationVisibilitySchema,
    InitialToolCallSchema,
    InteractionRefSchema,
    PlanTaskSchema,
    RunSourceSchema,
    UserChannelSchema,
} from './interaction.js';
import * as ProcessSchemas from './process.js';
import {
    ProcessDefinitionBodySchema,
    ProcessRunConfigSchema,
    ProcessStateSchema,
    RecordProcessRunPayloadSchema,
} from './process.js';
import { AgentCheckpointConfigurationSchema } from './project-configuration.js';
import { nullableStringSchema } from './schema-primitives.js';
import { InteractionExecutionConfigurationSchema } from './store.js';

const agentEventBase = {
    timestamp: z.string(),
    runId: z.string(),
    agentRunId: z.string().optional(),
    model: z.string(),
    environmentId: z.string(),
    environmentType: z.string(),
    interactionId: z.string(),
    parentRunId: z.string().optional(),
    ancestorRunIds: z.array(z.string()).optional(),
};

const AgentRunStartedEventSchema = z.strictObject({
    ...agentEventBase,
    eventType: z.literal(AgentEventType.AgentRunStarted),
    interactive: z.boolean(),
    taskId: z.string().optional(),
    userChannels: z.array(z.string()).optional(),
});

const AgentRunCompletedEventSchema = z.strictObject({
    ...agentEventBase,
    eventType: z.literal(AgentEventType.AgentRunCompleted),
    success: z.boolean(),
    durationMs: z.number(),
    errorType: z.string().optional(),
    errorMessage: z.string().optional(),
    totalIterations: z.number(),
    totalToolCalls: z.number(),
    totalLlmCalls: z.number(),
    // No `totalTokens` (and no `total` here): an input+output sum mixes differently-priced
    // quantities and nothing consumes it — token analytics aggregate the per-call LlmCallEvent
    // fields. This also keeps `$.totalTokens` scalar-only in the telemetry `event_data` column
    // (LlmCallEvent is the only current producer of that path).
    tokenUsage: z
        .strictObject({
            input: z.number(),
            output: z.number(),
        })
        .optional(),
    endConversation: z
        .strictObject({
            status: z.enum(['success', 'failure']),
            reason: z.string().optional(),
        })
        .optional(),
});

const LlmCallEventSchema = z.strictObject({
    ...agentEventBase,
    eventType: z.literal(AgentEventType.LlmCall),
    promptTokens: z.number(),
    promptCachedTokens: z.number().optional(),
    promptCacheWriteTokens: z.number().optional(),
    completionTokens: z.number(),
    totalTokens: z.number(),
    durationMs: z.number(),
    success: z.boolean(),
    streamingEnabled: z.boolean(),
    toolUseCount: z.number(),
    callType: z.enum(LlmCallType),
    attemptNumber: z.number().optional(),
    errorType: z.string().optional(),
    // `NestedInteractionEvent` — an interaction executed from inside a tool — is an `LlmCallEvent`
    // with three more fields and the same `eventType`, so it cannot be a branch of its own and has to
    // widen this one. They are optional because a plain LLM call carries none of them; the three
    // travel together, pinned by `callType: 'nested_interaction'`.
    nestedInteractionId: z.string().optional(),
    toolName: z.string().optional(),
    toolType: z.enum(TelemetryToolType).optional(),
});

const ToolCallEventSchema = z.strictObject({
    ...agentEventBase,
    eventType: z.literal(AgentEventType.ToolCall),
    toolName: z.string(),
    toolUseId: z.string(),
    toolType: z.enum(TelemetryToolType),
    iteration: z.number(),
    parameters: z.record(z.string(), z.unknown()).optional(),
    parametersSizeBytes: z.number().optional(),
    success: z.boolean(),
    durationMs: z.number(),
    resultSizeBytes: z.number().optional(),
    errorType: z.string().optional(),
    errorMessage: z.string().optional(),
    spawnedChildWorkflow: z.boolean().optional(),
});

const ShadowSkillRankingEventSchema = z.strictObject({
    ...agentEventBase,
    eventType: z.literal(AgentEventType.ShadowSkillRanking),
    callType: z.union([z.literal(LlmCallType.Start), z.literal(LlmCallType.ResumeUser)]),
    iteration: z.number(),
    attemptNumber: z.number(),
    scorerVersion: z.number(),
    userMessageTokenCount: z.number(),
    scope: z.enum(['universe', 'active_only']),
    rankings: z
        .array(
            z.strictObject({
                skill: z.string(),
                score: z.number(),
                active: z.boolean(),
            }),
        )
        .max(20),
});

export const AgentEventSchema: z.ZodType<AgentEvent> = z
    .discriminatedUnion('eventType', [
        AgentRunStartedEventSchema,
        AgentRunCompletedEventSchema,
        LlmCallEventSchema,
        ToolCallEventSchema,
        ShadowSkillRankingEventSchema,
    ])
    .meta({ id: 'AgentEvent' });

export const IngestAgentEventsPayloadSchema = z
    .strictObject({
        events: z.array(AgentEventSchema),
    })
    .meta({ id: 'IngestAgentEventsPayload' });

export const IngestAgentEventsResponseSchema = z
    .strictObject({
        ingested: z.number(),
        status: z.string().optional(),
        error: z.string().optional(),
    })
    .meta({ id: 'IngestAgentEventsResponse' });

export const AgentMessageTypeSchema = z
    .union([
        z.literal(0),
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.literal(4),
        z.literal(5),
        z.literal(6),
        z.literal(7),
        z.literal(8),
        z.literal(9),
        z.literal(10),
        z.literal(11),
        z.literal(12),
        z.literal(13),
        z.literal(14),
    ])
    .meta({
        id: 'AgentMessageType',
        anyOf: undefined,
        type: 'number',
        enum: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
    }) as z.ZodType<AgentMessageType>;

export const AgentRunArtifactPathArraySchema = z.array(z.string()).meta({ id: 'AgentRunArtifactPathArray' });

export const UpdateAgentArtifactContentResponseSchema = z
    .strictObject({
        path: z.string(),
        generation: z.string(),
    })
    .meta({ id: 'UpdateAgentArtifactContentResponse', description: 'Result of a conditional agent artifact update.' });

export const UpdateAgentArtifactContentPayloadSchema = z
    .strictObject({
        content: z.string(),
        generation: z.string(),
    })
    .meta({ id: 'UpdateAgentArtifactContentPayload', description: 'Conditional text update for an agent artifact.' });

export const TerminateAgentRunResponseSchema = z
    .strictObject({
        message: z.string(),
        reason: z.string().optional(),
    })
    .meta({ id: 'TerminateAgentRunResponse', description: 'Response from terminating an agent run.' });

export const SignalAgentPayloadSchema = z.looseObject({}).meta({
    id: 'SignalAgentPayload',
    additionalProperties: true,
    description: 'Generic signal payload sent to a running agent workflow.',
});

const AgentRunTypeSchema = AppLifecycleSchemas.AgentRunTypeSchema;

export const PostAgentRunUpdateResponseSchema = z
    .strictObject({
        success: z.boolean(),
    })
    .meta({ id: 'PostAgentRunUpdateResponse', description: 'Response from posting an agent update.' });

export const FileProcessingStatusSchema = z.enum(['uploading', 'processing', 'ready', 'error']).meta({
    id: 'FileProcessingStatus',
    description: 'Status of a file being processed for conversation use.',
}) as z.ZodType<FileProcessingStatus>;

export const AgentRunArchiveStateSchema = z.enum(['none', 'pending', 'archiving', 'complete', 'failed']).meta({
    id: 'AgentRunArchiveState',
    description:
        'Archive lifecycle state for an agent run.\n\n- `none`:      No archive exists (default)\n- `pending`:   Terminal status recorded; archive workflow triggered\n- `archiving`: Archive workflow is running\n- `complete`:  Archive stored in GCS successfully\n- `failed`:    Archive attempt failed (see `last_archive_error`)',
});

export const ResourceRefSchema = z
    .strictObject({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        email: z.string().optional(),
        description: z.string().optional(),
        version: z.number().optional(),
        status: z.string().optional(),
        tags: z.array(z.string()).optional(),
        endpoint: z.string().optional(),
    })
    .meta({ id: 'ResourceRef' });

export const AgentArtifactContentResponseSchema = z
    .strictObject({
        path: z.string(),
        content: z.string(),
        generation: z.string(),
    })
    .meta({
        id: 'AgentArtifactContentResponse',
        description: 'Text content and concurrency token for an agent artifact.',
    });

export const AgentArtifactUrlResponseSchema = z
    .strictObject({
        url: z.string(),
        path: z.string(),
    })
    .meta({ id: 'AgentArtifactUrlResponse', description: 'Signed artifact URL response for agent artifacts.' });

export const SignalAgentResponseSchema = z
    .strictObject({
        status: z.string(),
        message: z.string(),
    })
    .meta({ id: 'SignalAgentResponse', description: 'Response from signaling an agent workflow.' });

const AgentRunSearchHitSchema = AppLifecycleSchemas.AgentRunSearchHitSchema;

export const ConversationFileSchema = z
    .strictObject({
        id: z.string().meta({ description: 'Unique ID for tracking this file (generated client-side)' }),
        name: z.string().meta({ description: 'Original filename' }),
        content_type: z.string().meta({ description: 'MIME type' }),
        size: z.number().meta({ description: 'Size in bytes' }),
        status: FileProcessingStatusSchema.meta({ description: 'Current processing status' }),
        artifact_path: z
            .string()
            .meta({ description: 'Artifact path (e.g., "files/document.pdf") - set after upload' })
            .optional(),
        reference: z
            .string()
            .meta({ description: 'Full artifact reference URI (e.g., "artifact:files/document.pdf")' })
            .optional(),
        md_path: z
            .string()
            .meta({ description: 'Path to extracted text markdown (e.g., "files/document.pdf.md")' })
            .optional(),
        text_extracted: z.boolean().meta({ description: 'Whether text extraction completed successfully' }).optional(),
        error: z.string().meta({ description: 'Error message if status is ERROR' }).optional(),
        started_at: z.number().meta({ description: 'Timestamp when upload started' }),
        completed_at: z.number().meta({ description: 'Timestamp when processing completed' }).optional(),
        consumed_at: z
            .number()
            .meta({
                description:
                    'Timestamp when this file was delivered to the agent as part of a user message. Once set, the file is no longer re-attached to later messages — it remains accessible to tools via its artifact_path/md_path.',
            })
            .optional(),
    })
    .meta({ id: 'ConversationFile', description: 'Represents a file being processed in a conversation workflow.' });

export const AutonomousRunResponseSchema = z
    .strictObject({
        interaction: z.string().meta({ description: 'Interaction ID or code (e.g. "sys:generic_question").' }),
        data: z.looseObject({}).meta({ description: 'Input parameters, typed per interaction' }).optional(),
        config: InteractionExecutionConfigurationSchema.meta({
            description: 'Execution configuration (environment, model, model_options, etc.)',
        }).optional(),
        interactive: z.boolean().meta({ description: 'Whether the agent accepts user input' }).optional(),
        tool_approval_mode: AgentToolApprovalModeSchema.meta({
            description: 'How side-effecting tool actions are approved for interactive runs.',
        }).optional(),
        tool_names: z
            .array(z.string())
            .meta({ description: 'Tools configured for this run (+/- syntax supported)' })
            .optional(),
        initial_skills: z
            .array(z.string())
            .meta({ description: 'Builtin system skills activated before the first model turn.' })
            .optional(),
        initial_tool_calls: z
            .array(InitialToolCallSchema)
            .meta({ description: 'Ordered, bounded hydration/read calls executed before the first model turn.' })
            .optional(),
        excluded_tools: z
            .array(z.string())
            .meta({
                description: 'Hard denylist of tool names: never exposed to the model, refused at execution time.',
            })
            .optional(),
        collection_id: z.string().meta({ description: 'Scoped collection (if any)' }).optional(),
        disabled_mcp_collections: z
            .array(z.string())
            .meta({
                description:
                    'Denylist of MCP tool-collection ids deactivated for this run. `undefined`/empty means all installed/connected MCP collections are active (back-compat, and new servers stay active by default). Listed collections are excluded even if connected.',
            })
            .optional(),
        content_type: ContentObjectTypeRefSchema.meta({
            description: 'Content type linked to this run — defines the schema for `properties`',
        }).optional(),
        visibility: ConversationVisibilitySchema.meta({ description: 'Conversation/process visibility' }).optional(),
        tags: z.array(z.string()).meta({ description: 'User-defined or system tags for categorization' }).optional(),
        categories: z.array(z.string()).meta({ description: 'Categories for organizing runs' }).optional(),
        properties: z
            .looseObject({})
            .meta({ description: 'Business metadata — typed by the linked content_type schema' })
            .optional(),
        source: RunSourceSchema.meta({ description: 'How the run was started' }).optional(),
        schedule_id: z
            .string()
            .meta({ description: 'Schedule ID — set when this run was triggered by a Temporal schedule' })
            .optional(),
        source_type: AgentRunTypeSchema.meta({ description: 'Replacement for legacy AgentRun.type' }).optional(),
        type: AgentRunTypeSchema.meta({
            description: 'Deprecated: Use source_type for creation source and run_type for runtime mode.',
            deprecated: true,
            'x-deprecated-message': 'Use source_type for creation source and run_type for runtime mode.',
        }).optional(),
        id: z.string().meta({ description: 'The stable identifier used by all client code' }),
        run_kind: z.literal('agent').meta({ description: 'Internal discriminator key' }),
        parent_run_id: z
            .string()
            .meta({
                description:
                    'Process run this agent belongs to — set when a process agent node recorded this run. Its conversation lives on the parent run under `workstream_id`.',
            })
            .optional(),
        workstream_id: z
            .string()
            .meta({ description: 'Workstream this run occupies inside its parent run (the process node id).' })
            .optional(),
        run_type: z.literal('autonomous'),
        account: z.string().meta({ description: 'Account ID' }),
        project: z.string().meta({ description: 'Project ID' }),
        workflow_id: z.string().meta({ description: 'Temporal workflow ID (stable across continueAsNew)' }).optional(),
        first_workflow_run_id: z
            .string()
            .meta({ description: 'First Temporal workflow run ID (used for Redis channel and artifact resolution)' })
            .optional(),
        artifacts_path: z.string().meta({ description: 'Artifact storage path for this run' }).optional(),
        status: AgentRunStatusSchema.meta({ description: 'Current status of the agent run' }),
        activity_state: ConversationActivityStateSchema.meta({
            description: 'Whether the agent is currently working or idle (waiting for user input)',
        }).optional(),
        started_by: z.string().meta({ description: 'User or service that initiated the run' }),
        started_at: z.string().meta({ description: 'When the run started', format: 'date-time' }),
        completed_at: z
            .string()
            .meta({ description: 'When the run completed (or failed/cancelled)', format: 'date-time' })
            .optional(),
        title: z.string().meta({ description: 'Conversation title (short, human-readable)' }).optional(),
        event_subscription_id: z
            .string()
            .meta({ description: 'Event subscription ID — set when this run was triggered by the event bus.' })
            .optional(),
        event_ref: EventRefSchema.meta({
            description: 'Event reference — set when this run was triggered by the event bus.',
        }).optional(),
        archive_state: AgentRunArchiveStateSchema.meta({ description: 'Archive lifecycle state' }).optional(),
        created_at: z.string().meta({ description: 'Timestamp when the document was created', format: 'date-time' }),
        updated_at: z
            .string()
            .meta({ description: 'Timestamp when the document was last updated', format: 'date-time' }),
        interaction_name: z.string().meta({ description: 'Human-readable interaction name' }).optional(),
        interactionRef: InteractionRefSchema,
        environmentRef: ResourceRefSchema.meta({
            description:
                'Resolved environment reference (name resolved from `config.environment` id). Populated by the list endpoint; may be absent on other endpoints or when the id cannot be resolved, in which case consumers should fall back to `config.environment`.',
        }).optional(),
        topic: z
            .string()
            .meta({ description: 'Conversation topic (longer description from topic analysis)' })
            .optional(),
        generate_topic: z
            .boolean()
            .meta({ description: 'Whether automatic conversation title/topic generation is enabled for this run.' })
            .optional(),
        generate_lessons: z
            .boolean()
            .meta({ description: 'Whether automatic lessons generation is enabled for this run.' })
            .optional(),
        lessons_learned: z
            .array(z.string())
            .meta({ description: 'Lessons learned from the conversation (extracted at completion)' })
            .optional(),
        archived_at: z
            .string()
            .meta({ description: 'When the last successful archive completed', format: 'date-time' })
            .optional(),
        archive_version: z
            .number()
            .meta({ description: 'Archive format version (for forward compatibility)' })
            .optional(),
        last_archive_error: z
            .string()
            .meta({ description: "Last archive error message (when archive_state === 'failed')" })
            .optional(),
        forked_from: z
            .string()
            .meta({ description: 'Source agent run ID when this run was forked (enables message history chaining)' })
            .optional(),
    })
    .meta({
        id: 'AutonomousRunResponse',
        description:
            'AgentRun — the client-facing stable identity for a running or completed agent.\n\nAll operations use `id` as the sole identifier. Temporal workflow internals are never exposed to clients.',
    });

export const AgentRunSchema = z
    .strictObject({
        interaction: z.string().meta({ description: 'Interaction ID or code (e.g. "sys:generic_question").' }),
        data: z.looseObject({}).meta({ description: 'Input parameters, typed per interaction' }).optional(),
        config: InteractionExecutionConfigurationSchema.meta({
            description: 'Execution configuration (environment, model, model_options, etc.)',
        }).optional(),
        interactive: z.boolean().meta({ description: 'Whether the agent accepts user input' }).optional(),
        tool_approval_mode: AgentToolApprovalModeSchema.meta({
            description: 'How side-effecting tool actions are approved for interactive runs.',
        }).optional(),
        tool_names: z
            .array(z.string())
            .meta({ description: 'Tools configured for this run (+/- syntax supported)' })
            .optional(),
        initial_skills: z
            .array(z.string())
            .meta({ description: 'Builtin system skills activated before the first model turn.' })
            .optional(),
        initial_tool_calls: z
            .array(InitialToolCallSchema)
            .meta({ description: 'Ordered, bounded hydration/read calls executed before the first model turn.' })
            .optional(),
        excluded_tools: z
            .array(z.string())
            .meta({
                description: 'Hard denylist of tool names: never exposed to the model, refused at execution time.',
            })
            .optional(),
        collection_id: z.string().meta({ description: 'Scoped collection (if any)' }).optional(),
        disabled_mcp_collections: z
            .array(z.string())
            .meta({
                description:
                    'Denylist of MCP tool-collection ids deactivated for this run. `undefined`/empty means all installed/connected MCP collections are active (back-compat, and new servers stay active by default). Listed collections are excluded even if connected.',
            })
            .optional(),
        content_type: ContentObjectTypeRefSchema.meta({
            description: 'Content type linked to this run — defines the schema for `properties`',
        }).optional(),
        visibility: ConversationVisibilitySchema.meta({ description: 'Conversation/process visibility' }).optional(),
        tags: z.array(z.string()).meta({ description: 'User-defined or system tags for categorization' }).optional(),
        categories: z.array(z.string()).meta({ description: 'Categories for organizing runs' }).optional(),
        properties: z
            .looseObject({})
            .meta({ description: 'Business metadata — typed by the linked content_type schema' })
            .optional(),
        source: RunSourceSchema.meta({ description: 'How the run was started' }).optional(),
        schedule_id: z
            .string()
            .meta({ description: 'Schedule ID — set when this run was triggered by a Temporal schedule' })
            .optional(),
        source_type: AgentRunTypeSchema.meta({ description: 'Replacement for legacy AgentRun.type' }).optional(),
        type: AgentRunTypeSchema.meta({
            description: 'Deprecated: Use source_type for creation source and run_type for runtime mode.',
            deprecated: true,
            'x-deprecated-message': 'Use source_type for creation source and run_type for runtime mode.',
        }).optional(),
        id: z.string().meta({ description: 'The stable identifier used by all client code' }),
        run_kind: z.literal('agent').meta({ description: 'Internal discriminator key' }),
        parent_run_id: z
            .string()
            .meta({
                description:
                    'Process run this agent belongs to — set when a process agent node recorded this run. Its conversation lives on the parent run under `workstream_id`.',
            })
            .optional(),
        workstream_id: z
            .string()
            .meta({ description: 'Workstream this run occupies inside its parent run (the process node id).' })
            .optional(),
        run_type: z.literal('autonomous').meta({ description: 'Public-facing runtime mode' }),
        account: z.string().meta({ description: 'Account ID' }),
        project: z.string().meta({ description: 'Project ID' }),
        workflow_id: z.string().meta({ description: 'Temporal workflow ID (stable across continueAsNew)' }).optional(),
        first_workflow_run_id: z
            .string()
            .meta({ description: 'First Temporal workflow run ID (used for Redis channel and artifact resolution)' })
            .optional(),
        artifacts_path: z.string().meta({ description: 'Artifact storage path for this run' }).optional(),
        status: AgentRunStatusSchema.meta({ description: 'Current status of the agent run' }),
        activity_state: ConversationActivityStateSchema.meta({
            description: 'Whether the agent is currently working or idle (waiting for user input)',
        }).optional(),
        started_by: z.string().meta({ description: 'User or service that initiated the run' }),
        started_at: z.string().meta({ description: 'When the run started', format: 'date-time' }),
        completed_at: z
            .string()
            .meta({ description: 'When the run completed (or failed/cancelled)', format: 'date-time' })
            .optional(),
        title: z.string().meta({ description: 'Conversation title (short, human-readable)' }).optional(),
        event_subscription_id: z
            .string()
            .meta({ description: 'Event subscription ID — set when this run was triggered by the event bus.' })
            .optional(),
        event_ref: EventRefSchema.meta({
            description: 'Event reference — set when this run was triggered by the event bus.',
        }).optional(),
        archive_state: AgentRunArchiveStateSchema.meta({ description: 'Archive lifecycle state' }).optional(),
        created_at: z.string().meta({ description: 'Timestamp when the document was created', format: 'date-time' }),
        updated_at: z
            .string()
            .meta({ description: 'Timestamp when the document was last updated', format: 'date-time' }),
        interaction_name: z.string().meta({ description: 'Human-readable interaction name' }).optional(),
        interactionRef: InteractionRefSchema,
        environmentRef: ResourceRefSchema.meta({
            description:
                'Resolved environment reference (name resolved from `config.environment` id). Populated by the list endpoint; may be absent on other endpoints or when the id cannot be resolved, in which case consumers should fall back to `config.environment`.',
        }).optional(),
        topic: z
            .string()
            .meta({ description: 'Conversation topic (longer description from topic analysis)' })
            .optional(),
        generate_topic: z
            .boolean()
            .meta({ description: 'Whether automatic conversation title/topic generation is enabled for this run.' })
            .optional(),
        generate_lessons: z
            .boolean()
            .meta({ description: 'Whether automatic lessons generation is enabled for this run.' })
            .optional(),
        lessons_learned: z
            .array(z.string())
            .meta({ description: 'Lessons learned from the conversation (extracted at completion)' })
            .optional(),
        archived_at: z
            .string()
            .meta({ description: 'When the last successful archive completed', format: 'date-time' })
            .optional(),
        archive_version: z
            .number()
            .meta({ description: 'Archive format version (for forward compatibility)' })
            .optional(),
        last_archive_error: z
            .string()
            .meta({ description: "Last archive error message (when archive_state === 'failed')" })
            .optional(),
        forked_from: z
            .string()
            .meta({ description: 'Source agent run ID when this run was forked (enables message history chaining)' })
            .optional(),
    })
    .meta({
        id: 'AgentRun',
        description:
            'AgentRun — the client-facing stable identity for a running or completed agent.\n\nAll operations use `id` as the sole identifier. Temporal workflow internals are never exposed to clients.',
    });

export const CreateAgentRunPayloadSchema = z
    .strictObject({
        interaction: z.string().meta({ description: 'Interaction ID or code (e.g. "sys:generic_question").' }),
        ...ConversationEnrichmentFields,
        data: z.looseObject({}).meta({ description: 'Input parameters, typed per interaction' }).optional(),
        config: InteractionExecutionConfigurationSchema.meta({
            description: 'Execution configuration (environment, model, model_options, etc.)',
        }).optional(),
        interactive: z.boolean().meta({ description: 'Whether the agent accepts user input' }).optional(),
        tool_approval_mode: AgentToolApprovalModeSchema.meta({
            description: 'How side-effecting tool actions are approved for interactive runs.',
        }).optional(),
        tool_names: z
            .array(z.string())
            .meta({ description: 'Tools configured for this run (+/- syntax supported)' })
            .optional(),
        initial_skills: z
            .array(z.string())
            .meta({ description: 'Builtin system skills activated before the first model turn.' })
            .optional(),
        initial_tool_calls: z
            .array(InitialToolCallSchema)
            .meta({ description: 'Ordered, bounded hydration/read calls executed before the first model turn.' })
            .optional(),
        excluded_tools: z
            .array(z.string())
            .meta({
                description: 'Hard denylist of tool names: never exposed to the model, refused at execution time.',
            })
            .optional(),
        collection_id: z.string().meta({ description: 'Scoped collection (if any)' }).optional(),
        disabled_mcp_collections: z
            .array(z.string())
            .meta({
                description:
                    'Denylist of MCP tool-collection ids deactivated for this run. `undefined`/empty means all installed/connected MCP collections are active (back-compat, and new servers stay active by default). Listed collections are excluded even if connected.',
            })
            .optional(),
        content_type: ContentObjectTypeRefSchema.meta({
            description: 'Content type linked to this run — defines the schema for `properties`',
        }).optional(),
        visibility: ConversationVisibilitySchema.meta({ description: 'Conversation visibility' }).optional(),
        tags: z.array(z.string()).meta({ description: 'User-defined or system tags for categorization' }).optional(),
        categories: z
            .array(z.string())
            .meta({ description: 'Categories for organizing runs (e.g. "support", "analysis", "generation")' })
            .optional(),
        properties: z
            .looseObject({})
            .meta({ description: 'Business metadata — typed by the linked content_type schema' })
            .optional(),
        source: RunSourceSchema.meta({ description: 'How the run was started' }).optional(),
        schedule_id: z
            .string()
            .meta({ description: 'Schedule ID — set when this run was triggered by a Temporal schedule' })
            .optional(),
        source_type: AgentRunTypeSchema.meta({ description: 'How the run was created' }).optional(),
        type: AgentRunTypeSchema.meta({
            description: 'Deprecated: Use source_type for creation source and run_type for runtime mode.',
            deprecated: true,
            'x-deprecated-message': 'Use source_type for creation source and run_type for runtime mode.',
        }).optional(),
        search_scope: AgentSearchScopeSchema.meta({ description: 'Search scope for RAG queries' }).optional(),
        user_channels: z
            .array(UserChannelSchema)
            .meta({ description: 'User communication channels (email, interactive)' })
            .optional(),
        checkpoint_tokens: z
            .number()
            .meta({
                description:
                    'Token budget for checkpointing, in thousands (K). Wins over every other checkpoint setting.',
            })
            .optional(),
        checkpoint: AgentCheckpointConfigurationSchema.meta({
            description:
                "Structured checkpoint override for this run. Field-wise it takes precedence over the interaction's `agent_runner_options.checkpoint` and the project's `configuration.agent.checkpoint`; the legacy `checkpoint_tokens` above still wins over everything when set.",
        }).optional(),
        max_iterations: z.number().meta({ description: 'Maximum conversation iterations (default: 20)' }).optional(),
        notify_endpoints: z.array(z.string()).meta({ description: 'Webhook URLs to notify on completion' }).optional(),
        debug_mode: z.boolean().meta({ description: 'Enable debug mode for verbose logging' }).optional(),
        started_by: z
            .string()
            .meta({ description: 'Principal ref of the user who initiated the run (for server-to-server forwarding)' })
            .optional(),
    })
    .meta({ id: 'CreateAgentRunPayload', description: 'Payload to create and start a new agent run.' });

/**
 * The other shape `POST /agents` accepts — a process run rather than an agent run.
 *
 * `AgentsApi.start` is overloaded on exactly these two payloads and the handler branches on
 * `isProcessStartPayload`, so an endpoint contract naming only the agent one rejects every process
 * start: it has no `interaction`, and its own fields read as undeclared extras.
 */
const processRunFields = {
    // Optional here on purpose: `isProcessStartPayload` only rejects a run_type it cannot parse, so a
    // process start that omits it is valid today and requiring it would reject those callers.
    run_type: ProcessSchemas.ProcessRunTypeSchema.optional(),
    process_version: z
        .number()
        .meta({ description: 'Published process version to pin. Defaults to the head revision.' })
        .optional(),
    data: z.looseObject({}).meta({ description: 'Input parameters, typed per process.' }).optional(),
    config: ProcessSchemas.ProcessRunConfigSchema.optional(),
    visibility: ConversationVisibilitySchema.optional(),
    tags: z.array(z.string()).optional(),
    categories: z.array(z.string()).optional(),
    source: RunSourceSchema.meta({ description: 'How the run was started' }).optional(),
    started_by: z
        .string()
        .meta({ description: 'Principal ref of the user who initiated the run (for server-to-server forwarding)' })
        .optional(),
};

/**
 * Starting a stored process by id.
 *
 * Split from {@link CreateProcessRunWithDefinitionPayloadSchema} rather than making both references
 * optional, because the process reference is what `isProcessStartPayload` actually keys on. With both
 * optional this branch would match ANY object, and the union below would then accept an agent payload
 * whose `interaction` was misspelled — making the agent branch's validation worthless.
 */
export const CreateProcessRunByIdPayloadSchema = z
    .object({ ...processRunFields, process_id: z.string().meta({ description: 'Process to start.' }) })
    .meta({ id: 'CreateProcessRunByIdPayload', description: 'Payload to start a stored process by id.' });

/**
 * Starting a process from an inline definition that is not stored. See the sibling above.
 *
 * The field carries no `.meta({description})`: `ProcessDefinitionBody` is recursive, and re-metaing a
 * registered recursive component clones it under the same id with a different shape, which the
 * adapter rejects as a duplicate.
 */
export const CreateProcessRunWithDefinitionPayloadSchema = z
    .object({ ...processRunFields, process_definition: ProcessSchemas.ProcessDefinitionBodySchema })
    .meta({
        id: 'CreateProcessRunWithDefinitionPayload',
        description: 'Payload to start a process from an inline definition.',
    });

/**
 * What `POST /agents` actually accepts.
 *
 * A plain union rather than a discriminated one: the two kinds are told apart by which fields are
 * PRESENT, not by a shared literal, and OpenAPI's discriminator has to be required in every branch.
 */
export const CreateRunPayloadSchema = z
    .union([
        CreateAgentRunPayloadSchema,
        CreateProcessRunByIdPayloadSchema,
        CreateProcessRunWithDefinitionPayloadSchema,
    ])
    .meta({ id: 'CreateRunPayload', description: 'Payload to create and start an agent run or a process run.' });

export const SearchAgentRunsResponseSchema = z
    .strictObject({
        hits: z.array(AgentRunSearchHitSchema).meta({ description: 'Search results' }),
        total: z.number().meta({ description: 'Total matching results' }),
    })
    .meta({ id: 'SearchAgentRunsResponse', description: 'Response from the agent runs search endpoint.' });

export const AgentMessageDetailsSchema = z
    .looseObject({
        ack: z.string().optional(),
        event_class: z.string().optional(),
        tool: z.string().optional(),
        tools: z.array(z.string()).optional(),
        tool_event: z.enum(['started', 'progress', 'completed', 'failed']).optional(),
        streamed: z.boolean().optional(),
        display_role: z.string().optional(),
        activity_id: z.string().optional(),
        activity_group_id: z.string().optional(),
        batch_id: z.string().optional(),
        tool_run_id: z.string().optional(),
        tool_use_id: z.string().optional(),
        tool_status: z.enum(['running', 'completed', 'error', 'warning']).optional(),
        tool_iteration: z.number().optional(),
        message_to_human: z.string().optional(),
        duration_ms: z.number().optional(),
        observation: z.unknown().optional(),
        token_usage: ExecutionTokenUsageSchema.optional(),
        checkpoint_at: z.number().optional(),
        checkpoint_threshold: z.number().optional(),
        workflow_run_id: z.string().optional(),
        outputFiles: z.array(z.string()).optional(),
        files: z
            .array(
                z.union([ConversationFileSchema, z.string()]).meta({
                    anyOf: undefined,
                    oneOf: [{ $ref: 'ConversationFile' }, { type: 'string' }],
                }),
            )
            .optional(),
        plan: z.array(PlanTaskSchema).optional(),
        resources: z
            .array(AgentResourceReferenceSchema)
            .meta({
                description:
                    'Deep-linkable references to resources a tool created/updated/deleted (see AgentResourceReference).',
            })
            .optional(),
        streaming_id: z.string().optional(),
        streaming_id_scope: z.enum(['workflow_run', 'workstream']).optional(),
        chunk_index: z.number().optional(),
        is_final: z.boolean().optional(),
        _optimistic: z.boolean().optional(),
        _messageId: z.string().optional(),
        _deliveryStatus: z.enum(['sending', 'received', 'consumed', 'failed']).optional(),
    })
    .meta({ id: 'AgentMessageDetails' });

export const CompactMessageSchema = z
    .strictObject({
        t: AgentMessageTypeSchema.meta({ description: 'Message type (integer enum)' }),
        m: z.string().meta({ description: 'Message content' }).optional(),
        w: z.string().meta({ description: 'Workstream ID (only when not "main")' }).optional(),
        d: AgentMessageDetailsSchema.nullable().meta({ description: 'Type-specific details' }).optional(),
        f: z
            .union([z.literal(0), z.literal(1)])
            .meta({
                anyOf: undefined,
                type: 'number',
                enum: [0, 1],
                description: 'Is final chunk (only for STREAMING_CHUNK, 0 or 1)',
            })
            .optional(),
        ts: z.number().meta({ description: 'Timestamp (only for stored/persisted messages)' }).optional(),
        i: z
            .string()
            .meta({ description: 'Activity ID for deduplication between streaming chunks and final messages' })
            .optional(),
    })
    .meta({
        id: 'CompactMessage',
        description:
            'Compact message format for efficient wire transfer. Primary type used throughout the system. ~85% smaller than legacy AgentMessage format.',
    });

export const PostAgentRunUpdatePayloadSchema = z
    .strictObject({
        timestamp: z.number().optional(),
        workflow_run_id: z.string().optional(),
        type: AgentMessageTypeSchema.optional(),
        message: z.string().optional(),
        details: AgentMessageDetailsSchema.optional(),
        workstream_id: z.string().optional(),
    })
    .meta({
        id: 'PostAgentRunUpdatePayload',
        description: "Payload for posting an update into an agent's workflow stream.",
    });

export const AgentRunUpdatesResponseSchema = z
    .strictObject({
        messages: z.array(CompactMessageSchema),
    })
    .meta({ id: 'AgentRunUpdatesResponse', description: 'Response payload for retrieving compact agent updates.' });

export const AgentRunResponseSchema: z.ZodType = z
    .discriminatedUnion('run_type', [
        AutonomousRunResponseSchema,
        z.lazy(() => SupervisedRunResponseSchema) as unknown as z.ZodObject,
        z.lazy(() => ProgrammaticRunResponseSchema) as unknown as z.ZodObject,
    ])
    .meta({ id: 'AgentRunResponse' });

export const ListAgentRunsResponseSchema: z.ZodType = z
    .strictObject({
        items: z.array(z.lazy(() => AgentRunResponseSchema)),
        total_count: z.number(),
        next_cursor: nullableStringSchema,
    })
    .meta({ id: 'ListAgentRunsResponse' });

export const ProgrammaticRunResponseSchema: z.ZodType = z
    .strictObject({
        run_type: z.literal('programmatic'),
        id: z.string().meta({ description: 'The stable identifier used by all client code' }),
        run_kind: z.literal('process').meta({ description: 'Internal discriminator key' }),
        account: z.string().meta({ description: 'Account ID' }),
        project: z.string().meta({ description: 'Project ID' }),
        workflow_id: z.string().meta({ description: 'Temporal workflow ID (stable across continueAsNew)' }).optional(),
        first_workflow_run_id: z
            .string()
            .meta({ description: 'First Temporal workflow run ID (used for Redis channel and artifact resolution)' })
            .optional(),
        artifacts_path: z.string().meta({ description: 'Artifact storage path for this run' }).optional(),
        status: AgentRunStatusSchema.meta({ description: 'Current status of the run' }),
        activity_state: ConversationActivityStateSchema.meta({
            description: 'Whether the run is currently working or idle',
        }).optional(),
        visibility: ConversationVisibilitySchema.meta({ description: 'Conversation/process visibility' }).optional(),
        started_by: z.string().meta({ description: 'User or service that initiated the run' }),
        started_at: z.string().meta({ description: 'When the run started', format: 'date-time' }),
        completed_at: z
            .string()
            .meta({ description: 'When the run completed (or failed/cancelled)', format: 'date-time' })
            .optional(),
        title: z.string().meta({ description: 'Short human-readable title' }).optional(),
        tags: z.array(z.string()).meta({ description: 'User-defined or system tags for categorization' }).optional(),
        categories: z.array(z.string()).meta({ description: 'Categories for organizing runs' }).optional(),
        source: RunSourceSchema.meta({ description: 'How the run was started' }).optional(),
        source_type: AgentRunTypeSchema.meta({ description: 'Replacement for legacy AgentRun.type' }).optional(),
        schedule_id: z
            .string()
            .meta({ description: 'Schedule ID — set when this run was triggered by a Temporal schedule' })
            .optional(),
        event_subscription_id: z
            .string()
            .meta({ description: 'Event subscription ID — set when this run was triggered by the event bus.' })
            .optional(),
        event_ref: EventRefSchema.meta({
            description: 'Event reference — set when this run was triggered by the event bus.',
        }).optional(),
        archive_state: AgentRunArchiveStateSchema.meta({ description: 'Archive lifecycle state' }).optional(),
        created_at: z.string().meta({ description: 'Timestamp when the document was created', format: 'date-time' }),
        updated_at: z
            .string()
            .meta({ description: 'Timestamp when the document was last updated', format: 'date-time' }),
        process_id: z.string().optional(),
        process_definition_snapshot: z.lazy(() => ProcessDefinitionBodySchema),
        process_version: z.number().optional(),
        process_state: ProcessStateSchema,
        config: ProcessRunConfigSchema.optional(),
    })
    .meta({ id: 'ProgrammaticRunResponse' });

export const SupervisedRunResponseSchema: z.ZodType = z
    .strictObject({
        run_type: z.literal('supervised'),
        id: z.string().meta({ description: 'The stable identifier used by all client code' }),
        run_kind: z.literal('process').meta({ description: 'Internal discriminator key' }),
        account: z.string().meta({ description: 'Account ID' }),
        project: z.string().meta({ description: 'Project ID' }),
        workflow_id: z.string().meta({ description: 'Temporal workflow ID (stable across continueAsNew)' }).optional(),
        first_workflow_run_id: z
            .string()
            .meta({ description: 'First Temporal workflow run ID (used for Redis channel and artifact resolution)' })
            .optional(),
        artifacts_path: z.string().meta({ description: 'Artifact storage path for this run' }).optional(),
        status: AgentRunStatusSchema.meta({ description: 'Current status of the run' }),
        activity_state: ConversationActivityStateSchema.meta({
            description: 'Whether the run is currently working or idle',
        }).optional(),
        visibility: ConversationVisibilitySchema.meta({ description: 'Conversation/process visibility' }).optional(),
        started_by: z.string().meta({ description: 'User or service that initiated the run' }),
        started_at: z.string().meta({ description: 'When the run started', format: 'date-time' }),
        completed_at: z
            .string()
            .meta({ description: 'When the run completed (or failed/cancelled)', format: 'date-time' })
            .optional(),
        title: z.string().meta({ description: 'Short human-readable title' }).optional(),
        tags: z.array(z.string()).meta({ description: 'User-defined or system tags for categorization' }).optional(),
        categories: z.array(z.string()).meta({ description: 'Categories for organizing runs' }).optional(),
        source: RunSourceSchema.meta({ description: 'How the run was started' }).optional(),
        source_type: AgentRunTypeSchema.meta({ description: 'Replacement for legacy AgentRun.type' }).optional(),
        schedule_id: z
            .string()
            .meta({ description: 'Schedule ID — set when this run was triggered by a Temporal schedule' })
            .optional(),
        event_subscription_id: z
            .string()
            .meta({ description: 'Event subscription ID — set when this run was triggered by the event bus.' })
            .optional(),
        event_ref: EventRefSchema.meta({
            description: 'Event reference — set when this run was triggered by the event bus.',
        }).optional(),
        archive_state: AgentRunArchiveStateSchema.meta({ description: 'Archive lifecycle state' }).optional(),
        created_at: z.string().meta({ description: 'Timestamp when the document was created', format: 'date-time' }),
        updated_at: z
            .string()
            .meta({ description: 'Timestamp when the document was last updated', format: 'date-time' }),
        process_id: z.string().optional(),
        process_definition_snapshot: z.lazy(() => ProcessDefinitionBodySchema),
        process_version: z.number().optional(),
        process_state: ProcessStateSchema,
        config: ProcessRunConfigSchema.optional(),
    })
    .meta({ id: 'SupervisedRunResponse' });

export const AgentRunArtifactUploadHeadersSchema = z
    .object({
        'content-type': z.string().optional(),
    })
    .meta({ id: 'AgentRunArtifactUploadHeaders' });

export const AgentRunArtifactQuerySchema = z
    .object({
        url: z.boolean().optional(),
        disposition: z.enum(['inline', 'attachment']).optional(),
        filename: z.string().optional(),
    })
    .meta({ id: 'AgentRunArtifactQuery' });

export const AgentRunDetailsQuerySchema = z
    .object({
        include_history: z.boolean().optional(),
        hydrate_payloads: z.boolean().optional(),
    })
    .meta({ id: 'AgentRunDetailsQuery' });

export const AgentRunArtifactsQuerySchema = z
    .object({
        visibility: z.enum(['user', 'internal', 'all']).optional(),
    })
    .meta({ id: 'AgentRunArtifactsQuery' });

export const ListAgentRunsQuerySchema = z
    .object({
        id: z.string().meta({ description: 'Filter by agent run ID' }).optional(),
        status: z.array(AgentRunStatusSchema).meta({ description: 'Filter by status (single or multiple)' }).optional(),
        interaction: z.string().meta({ description: 'Filter by interaction ID or code' }).optional(),
        started_by: z.string().meta({ description: 'Filter by user who started the run' }).optional(),
        since: z
            .string()
            .meta({ description: 'Only return runs started after this date', format: 'date-time' })
            .optional(),
        until: z
            .string()
            .meta({ description: 'Only return runs started at or before this date', format: 'date-time' })
            .optional(),
        limit: z.number().meta({ description: 'Maximum number of results (default: 50)' }).optional(),
        offset: z.number().meta({ description: 'Offset for pagination' }).optional(),
        cursor: z.string().meta({ description: 'Cursor for stable pagination' }).optional(),
        schedule_id: z.string().meta({ description: 'Filter by schedule ID' }).optional(),
        type: AgentRunTypeSchema.meta({ description: 'Filter by run type' }).optional(),
        run_type: z.array(RunTypeSchema).meta({ description: 'Filter by public runtime mode' }).optional(),
        run_kind: RunKindSchema.meta({ description: 'Filter by internal run discriminator' }).optional(),
        sort: z.enum(['started_at', 'updated_at']).meta({ description: 'Field to sort by' }).optional(),
        order: z.enum(['asc', 'desc']).meta({ description: 'Sort order' }).optional(),
    })
    .meta({ id: 'ListAgentRunsQuery' });

export const AgentRunUpdatesQuerySchema = z
    .object({
        since: z.number().optional(),
    })
    .meta({ id: 'AgentRunUpdatesQuery' });

export const SearchAgentRunsQuerySchema = z
    .object({
        query: z
            .string()
            .meta({ description: 'Full-text search across name, title, topic, interaction_name, and content' })
            .optional(),
        status: z.array(AgentRunStatusSchema).meta({ description: 'Filter by status (single or multiple)' }).optional(),
        interaction: z.string().meta({ description: 'Filter by interaction ID or code' }).optional(),
        started_by: z.string().meta({ description: 'Filter by user who started the run' }).optional(),
        categories: z.array(z.string()).meta({ description: 'Filter by categories' }).optional(),
        tags: z.array(z.string()).meta({ description: 'Filter by tags' }).optional(),
        content_type_name: z.string().meta({ description: 'Filter by content type name' }).optional(),
        run_type: z.array(RunTypeSchema).meta({ description: 'Filter by public runtime mode' }).optional(),
        since: z
            .string()
            .meta({ description: 'Only return runs started after this date', format: 'date-time' })
            .optional(),
        until: z
            .string()
            .meta({ description: 'Only return runs started at or before this date', format: 'date-time' })
            .optional(),
        limit: z.number().meta({ description: 'Maximum number of results (default: 50)' }).optional(),
        offset: z.number().meta({ description: 'Offset for pagination' }).optional(),
        sort: z
            .array(z.string())
            .meta({
                description:
                    "Multi-field sort. Each item has the form `field` or `field:order`, where   field is one of: `started_at`, `updated_at`   order is one of: `asc`, `desc` (default: `desc`) The first item is the primary sort; subsequent items are tie-breakers. Example: `['updated_at:desc', 'started_at:asc']`. Defaults to `['started_at:desc']` when omitted.",
            })
            .optional(),
    })
    .meta({ id: 'SearchAgentRunsQuery' });

export const StreamAgentRunQuerySchema = AgentRunUpdatesQuerySchema.extend({
    skipHistory: z.boolean().optional(),
}).meta({ id: 'StreamAgentRunQuery' });

export const RecordAgentRunPayloadSchema = z
    .strictObject({
        workflow_id: z.string(),
        first_workflow_run_id: z.string(),
        run_kind: z.literal('agent').optional(),
        interaction: z.string(),
        ...ConversationEnrichmentFields,
        parent_run_id: z.string().optional(),
        workstream_id: z.string().optional(),
        schedule_id: z.string().optional(),
        visibility: ConversationVisibilitySchema.optional(),
        data: z.looseObject({}).optional(),
        type: AgentRunTypeSchema.optional(),
    })
    .meta({ id: 'RecordAgentRunPayload' });

export const RecordRunPayloadSchema = z
    .union([RecordAgentRunPayloadSchema, RecordProcessRunPayloadSchema])
    .meta({ id: 'RecordRunPayload' });

export const UpdateAgentRunStatusPayloadSchema = z
    .strictObject({
        status: AgentRunStatusSchema.optional(),
        activity_state: ConversationActivityStateSchema.optional(),
        title: z.string().optional(),
        topic: z.string().optional(),
        lessons_learned: z.array(z.string()).optional(),
        properties: z.looseObject({}).optional(),
        content: z.string().optional(),
        disabled_mcp_collections: z.array(z.string()).optional(),
        tool_approval_mode: AgentToolApprovalModeSchema.optional(),
        model: z.string().min(1).optional(),
        effort: ReasoningEffortSchema.nullable().optional(),
        archive_state: AgentRunArchiveStateSchema.optional(),
        archived_at: z.string().optional(),
        archive_version: z.number().optional(),
        last_archive_error: z.string().optional(),
        sequence: z.number().optional(),
        process_state: ProcessStateSchema.optional(),
    })
    .meta({ id: 'UpdateAgentRunStatusPayload' });

export const AgentRunInternalsSchema = z
    .strictObject({
        id: z.string(),
        workflow_id: z.string().optional(),
        first_workflow_run_id: z.string().optional(),
        artifacts_path: z.string().optional(),
        status: AgentRunStatusSchema,
        run_kind: RunKindSchema.optional(),
        run_type: RunTypeSchema.optional(),
        interaction: z.string().optional(),
        interaction_name: z.string().optional(),
        config: InteractionExecutionConfigurationSchema.optional(),
        interactive: z.boolean().optional(),
        process_id: z.string().optional(),
        process_definition_snapshot: ProcessDefinitionBodySchema.optional(),
        process_version: z.number().optional(),
        process_state: ProcessStateSchema.optional(),
        started_at: z.string().meta({ format: 'date-time' }),
        completed_at: z.string().meta({ format: 'date-time' }).optional(),
        started_by: z.string(),
        created_at: z.string().meta({ format: 'date-time' }),
        updated_at: z.string().meta({ format: 'date-time' }),
    })
    .meta({ id: 'AgentRunInternals' });
