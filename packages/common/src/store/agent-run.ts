/**
 * AgentRun Types
 *
 * Defines the stable identity layer for running or completed agents.
 * Decouples the application from Temporal's internal run lifecycle,
 * enabling future continueAsNew support without breaking client references.
 *
 * The AgentRun is stored in MongoDB and provides a stable ID that doesn't
 * change when Temporal workflows restart via continueAsNew.
 *
 * Client code only ever uses `AgentRun.id` — all Temporal workflow details
 * (workflowId, runId) are internal server concerns.
 */

import type { ReasoningEffort } from '@llumiverse/common';
import type { ConversationVisibility, InteractionExecutionConfiguration, RunSource } from '../interaction.js';
import type { EventRef } from '../platform-event.js';
import type * as Wire from '../wire-types.generated.js';
import type { AgentToolApprovalMode } from './agent-approval.js';
import type { ProcessDefinitionBody, ProcessState } from './process.js';
import type { ModelConfigChangedSignal, StopSignal, UserInputSignal } from './signals.js';
import type {
    ConversationActivityState,
    ConversationFileBatchRef,
    ConversationFileRef,
    ConversationFileRemovedRef,
    WorkflowRunEvent,
} from './workflow.js';

export * from './agent-run-values.js';

export type AgentRunStatus = Wire.AgentRunStatus;

export type AgentRunArchiveState = Wire.AgentRunArchiveState;

export type AgentRunType = Wire.AgentRunType;

export type RunKind = Wire.RunKind;

export type RunType = Wire.RunType;
export type ProcessRunType = Wire.ProcessRunType;

/**
 * Shared fields for all records stored in the agent_runs collection.
 */
interface RunBase {
    /** The stable identifier used by all client code */
    id: string;

    /** Internal discriminator key */
    run_kind: RunKind;

    /** Public-facing runtime mode */
    run_type: RunType;

    /** Account ID */
    account: string;

    /** Project ID */
    project: string;

    /** Temporal workflow ID (stable across continueAsNew) */
    workflow_id?: string;

    /** First Temporal workflow run ID (used for Redis channel and artifact resolution) */
    first_workflow_run_id?: string;

    /** Artifact storage path for this run */
    artifacts_path?: string;

    /** Current status of the run */
    status: AgentRunStatus;

    /** Whether the run is currently working or idle */
    activity_state?: ConversationActivityState;

    /** Conversation/process visibility */
    visibility?: ConversationVisibility;

    /** User or service that initiated the run */
    started_by: string;

    /** When the run started */
    started_at: string;

    /** When the run completed (or failed/cancelled) */
    completed_at?: string;

    /** Short human-readable title */
    title?: string;

    /** User-defined or system tags for categorization */
    tags?: string[];

    /** Categories for organizing runs */
    categories?: string[];

    /** How the run was started */
    source?: RunSource;

    /** Replacement for legacy AgentRun.type */
    source_type?: AgentRunType;

    /** Schedule ID — set when this run was triggered by a Temporal schedule */
    schedule_id?: string;

    /** Event subscription ID — set when this run was triggered by the event bus. */
    event_subscription_id?: string;

    /** Event reference — set when this run was triggered by the event bus. */
    event_ref?: EventRef;

    /** Archive lifecycle state */
    archive_state?: AgentRunArchiveState;

    /** Timestamp when the document was created */
    created_at: string;

    /** Timestamp when the document was last updated */
    updated_at: string;
}

type AgentRunWire = Wire.AgentRunWire;

/**
 * The wire contract is schema-derived; the two generic data bags remain caller-specializable.
 * A single concrete `z.infer` cannot express those type parameters.
 */
export type AgentRun<TData = Record<string, unknown>, TProperties = Record<string, unknown>> = Omit<
    AgentRunWire,
    'data' | 'properties'
> & {
    data?: TData;
    properties?: TProperties;
};

export type ProcessRunConfig = Wire.ProcessRunConfig;

export interface ProcessRun extends RunBase {
    run_kind: 'process';
    run_type: ProcessRunType;
    process_id?: string;
    process_definition_snapshot: ProcessDefinitionBody;
    process_version?: number;
    process_state: ProcessState;
    config?: ProcessRunConfig;
}
export type AutonomousRunResponse<TData = Record<string, unknown>, TProperties = Record<string, unknown>> = AgentRun<
    TData,
    TProperties
>;
export type SupervisedRunResponse = ProcessRun & { run_type: 'supervised' };
export type ProgrammaticRunResponse = ProcessRun & { run_type: 'programmatic' };
/**
 * @discriminator run_type
 */
export type AgentRunResponse<TData = Record<string, unknown>, TProperties = Record<string, unknown>> =
    | AutonomousRunResponse<TData, TProperties>
    | SupervisedRunResponse
    | ProgrammaticRunResponse;

type CreateAgentRunWire = Wire.CreateAgentRunPayloadWire;
export type CreateAgentRunPayload<TData = Record<string, unknown>, TProperties = Record<string, unknown>> = Omit<
    CreateAgentRunWire,
    'data' | 'properties'
> & {
    data?: TData;
    properties?: TProperties;
};

interface ProcessRunInputPayload<TData = Record<string, unknown>, TSource = RunSource> {
    process_id?: string;
    /** Optional published process version to pin. Defaults to the latest/head revision. */
    process_version?: number;
    process_definition?: ProcessDefinitionBody;
    data?: TData;
    config?: ProcessRunConfig;
    visibility?: ConversationVisibility;
    tags?: string[];
    categories?: string[];
    source?: TSource;
    started_by?: string;
}

export interface CreateProcessRunPayload<TData = Record<string, unknown>, TSource = RunSource>
    extends ProcessRunInputPayload<TData, TSource> {
    run_type: ProcessRunType;
}

interface RecordRunWorkflowPayload {
    /** Temporal workflow id. */
    workflow_id: string;
    /** First Temporal run id for this workflow. Required when the workflow has already started. */
    first_workflow_run_id?: string;
}

/**
 * @internal Used by workflow activities that need to create a stable run
 * document for a workflow they already own.
 */
export interface RecordAgentRunPayload<TData = Record<string, unknown>> extends RecordRunWorkflowPayload {
    run_kind?: 'agent';
    /**
     * Process run that owns this agent, when a process agent node recorded it. The run's
     * conversation stays on the parent under {@link workstream_id} — see the note on RunBase.
     */
    parent_run_id?: string;
    /** Workstream this run occupies inside its parent run (the process node id). */
    workstream_id?: string;
    interaction: string;
    title?: string;
    topic?: string;
    generate_topic?: boolean;
    generate_lessons?: boolean;
    first_workflow_run_id: string;
    schedule_id?: string;
    visibility?: ConversationVisibility;
    data?: TData;
    type?: AgentRunType;
}

/**
 * @internal Used by process workflows to reserve a child ProcessRun before
 * starting its Temporal child workflow.
 */
export interface RecordProcessRunPayload<TData = Record<string, unknown>, TSource = RunSource>
    extends ProcessRunInputPayload<TData, TSource>,
        RecordRunWorkflowPayload {
    run_kind: 'process';
    run_type?: ProcessRunType;
    schedule_id?: string;
    type?: AgentRunType;
}

export type RecordRunPayload<TData = Record<string, unknown>, TSource = RunSource> =
    | RecordAgentRunPayload<TData>
    | RecordProcessRunPayload<TData, TSource>;

/**
 * @internal Attaches the first Temporal run id after a pre-created run record
 * has successfully started its workflow.
 */
export type BindRunWorkflowPayload = Wire.BindRunWorkflowPayload;

export type TerminateAgentRunResponse = Wire.TerminateAgentRunResponse;

export type AgentRunFeedbackRating = Wire.AgentRunFeedbackRating;
export type AgentRunFeedbackReasonCode = Wire.AgentRunFeedbackReasonCode;
export type AgentRunFeedbackPayload = Wire.AgentRunFeedbackPayload;
export type AgentRunFeedbackStatus = Wire.AgentRunFeedbackStatus;
export type AgentRunFeedbackCounts = Wire.AgentRunFeedbackCounts;
export type AgentRunFeedbackResponse = Wire.AgentRunFeedbackResponse;
export type AgentRunFeedbackEntry = Wire.AgentRunFeedbackEntry;
export type AgentRunEvaluationRollup = Wire.AgentRunEvaluationRollup;
export type AgentRunJudgeResult = Wire.AgentRunJudgeResult;
export type AgentRunContradictionReason = Wire.AgentRunContradictionReason;
export type AgentRunEvaluation = Wire.AgentRunEvaluation;

/**
 * Payload for updating an AgentRun's lifecycle and derived metadata.
 */
export interface UpdateAgentRunStatusPayload {
    status?: AgentRunStatus;
    activity_state?: ConversationActivityState;
    title?: string;
    topic?: string;
    lessons_learned?: string[];
    /** Shallow-merged into the run's existing properties. */
    properties?: Record<string, unknown>;
    /** ES-only: conversation content text (not stored in MongoDB) */
    content?: string;
    /**
     * MCP collections deactivated for this run. Persisted when the user toggles activation
     * mid-conversation so a page reload reflects the live state. An empty array clears the denylist.
     */
    disabled_mcp_collections?: string[];
    /** Tool approval mode persisted for interactive agent runs. */
    tool_approval_mode?: AgentToolApprovalMode;
    /** Model selected for subsequent conversation turns. */
    model?: string;
    /** Reasoning effort selected for subsequent turns; null clears the explicit override. */
    effort?: ReasoningEffort | null;
    /** Archive state fields (set by the archive workflow) */
    archive_state?: AgentRunArchiveState;
    archived_at?: string;
    archive_version?: number;
    last_archive_error?: string;
    sequence?: number;
    process_state?: ProcessState;
    /**
     * Fold of the run's turn evaluations, written by the conversation workflow. The server applies
     * it atomically and ignores a rollup whose `seq` is not newer than the one it holds.
     */
    evaluation_rollup?: AgentRunEvaluationRollup;
}

// The wire contract is deliberately open because signal payloads are selected by `signalName`.
// Preserve the known authoring shapes while still allowing custom signal objects.
export type SignalAgentPayload =
    | UserInputSignal
    | StopSignal
    | ModelConfigChangedSignal
    | ConversationFileRef
    | ConversationFileRemovedRef
    | ConversationFileBatchRef
    | Record<string, unknown>;

export type SignalAgentResponse = Wire.SignalAgentResponse;

export type AgentRunUpdatesResponse = Wire.AgentRunUpdatesResponse;

export type AgentRunUpdatesQuery = Wire.AgentRunUpdatesQuery;

export type StreamAgentRunQuery = Wire.StreamAgentRunQuery;

export type AgentRunDetailsQuery = Wire.AgentRunDetailsQuery;

export type AgentRunArtifactsQuery = Wire.AgentRunArtifactsQuery;

export type AgentRunArtifactUploadHeaders = Wire.AgentRunArtifactUploadHeaders;

export type AgentRunArtifactQuery = Wire.AgentRunArtifactQuery;

export type PostAgentRunUpdatePayload = Wire.PostAgentRunUpdatePayload;

export type PostAgentRunUpdateResponse = Wire.PostAgentRunUpdateResponse;

export type AgentArtifactUrlResponse = Wire.AgentArtifactUrlResponse;

export type AgentArtifactContentResponse = Wire.AgentArtifactContentResponse;

export type UpdateAgentArtifactContentPayload = Wire.UpdateAgentArtifactContentPayload;

export type UpdateAgentArtifactContentResponse = Wire.UpdateAgentArtifactContentResponse;

/**
 * Telemetry ingestion payload for an agent run.
 */
export type IngestAgentEventsPayload = Wire.IngestAgentEventsPayload;

/**
 * Telemetry ingestion response for an agent run.
 */
export type IngestAgentEventsResponse = Wire.IngestAgentEventsResponse;

/**
 * History event payload emitted by the agent details SSE stream.
 */
interface AgentRunDetailsHistoryStreamEvent {
    runId?: string;
    event: WorkflowRunEvent;
}

/**
 * Control payload emitted by the agent details SSE stream.
 */
type AgentRunDetailsControlStreamEvent = { type: 'continueAsNew'; newRunId: string } | { type: 'done' };

/**
 * Error payload emitted by the agent details SSE stream.
 */
interface AgentRunDetailsErrorStreamEvent {
    type: 'error';
    message: string;
}

/**
 * Typed SSE event envelope for the agent details stream.
 */
export type AgentRunDetailsStreamEvent =
    | { type: 'history'; data: AgentRunDetailsHistoryStreamEvent }
    | { type: 'control'; data: AgentRunDetailsControlStreamEvent }
    | { type: 'error'; data: AgentRunDetailsErrorStreamEvent };

/** Evaluation severity filter values; `unrated` selects runs without an evaluation. */
export type ListAgentRunsEvaluationSeverity = Wire.ListAgentRunsEvaluationSeverity;

/**
 * Filters for listing agent runs.
 */
export type ListAgentRunsQuery = Wire.ListAgentRunsQuery;

export interface ListAgentRunsResponse {
    items: AgentRunResponse[];
    total_count: number;
    next_cursor: string | null;
}

/**
 * Query for searching agent runs via Elasticsearch.
 */
export type SearchAgentRunsQuery = Wire.SearchAgentRunsQuery;

export type AgentRunSearchHit = Wire.AgentRunSearchHit;

export type SearchAgentRunsResponse = Wire.SearchAgentRunsResponse;

/**
 * Internal/Temporal details for an AgentRun.
 * Includes fields normally stripped from client responses.
 */
export interface AgentRunInternals {
    id: string;
    workflow_id?: string;
    first_workflow_run_id?: string;
    artifacts_path?: string;
    status: AgentRunStatus;
    run_kind?: RunKind;
    run_type?: RunType;
    interaction?: string;
    interaction_name?: string;
    config?: InteractionExecutionConfiguration;
    interactive?: boolean;
    process_id?: string;
    process_definition_snapshot?: ProcessDefinitionBody;
    process_version?: number;
    process_state?: ProcessState;
    started_at: string;
    completed_at?: string;
    started_by: string;
    created_at: string;
    updated_at: string;
}

export type CreateProcessRunByIdPayload = Wire.CreateProcessRunByIdPayload;

export type CreateProcessRunWithDefinitionPayload = Wire.CreateProcessRunWithDefinitionPayload;

export type CreateRunPayload = Wire.CreateRunPayload;

export type RestartAgentRunPayload = Wire.RestartAgentRunPayload;
