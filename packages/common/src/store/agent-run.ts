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

import { AgentSearchScope, ConversationVisibility, InteractionExecutionConfiguration, RunSource } from "../interaction.js";
import { UserChannel } from "../email.js";
import { ContentObjectTypeRef } from "./store.js";
import { ConversationActivityState } from "./workflow.js";
import { ProcessDefinitionBody, ProcessState } from "./process.js";

/**
 * Status of an agent run through its lifecycle.
 */
export type AgentRunStatus = 'created' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Archive lifecycle state for an agent run.
 *
 * - `none`:      No archive exists (default)
 * - `pending`:   Terminal status recorded; archive workflow triggered
 * - `archiving`: Archive workflow is running
 * - `complete`:  Archive stored in GCS successfully
 * - `failed`:    Archive attempt failed (see `last_archive_error`)
 */
export type AgentRunArchiveState = 'none' | 'pending' | 'archiving' | 'complete' | 'failed';

/**
 * How the agent run was created.
 */
export type AgentRunType = 'api' | 'schedule';

/**
 * Internal discriminator key for documents stored in the agent_runs collection.
 */
export type RunKind = 'agent' | 'process';

/**
 * Public-facing runtime mode.
 */
export type RunType = 'autonomous' | 'supervised' | 'programmatic';
export type ProcessRunType = 'supervised' | 'programmatic';

/**
 * Shared fields for all records stored in the agent_runs collection.
 */
export interface RunBase {
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
    started_at: Date;

    /** When the run completed (or failed/cancelled) */
    completed_at?: Date;

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

    /** Archive lifecycle state */
    archive_state?: AgentRunArchiveState;

    /** Timestamp when the document was created */
    created_at: Date;

    /** Timestamp when the document was last updated */
    updated_at: Date;
}

/**
 * Shared fields between CreateAgentRunPayload and AgentRun.
 *
 * @typeParam TData - The interaction's expected input data type.
 * @typeParam TProperties - The content type's property schema.
 */
export interface AgentRunBase<TData = Record<string, any>, TProperties = Record<string, any>> {
    /** Interaction ID or code (e.g. "sys:generic_question") */
    interaction: string;

    /** Input parameters, typed per interaction */
    data?: TData;

    /** Execution configuration (environment, model, model_options, etc.) */
    config?: InteractionExecutionConfiguration;

    /** Whether the agent accepts user input */
    interactive?: boolean;

    /** Tools configured for this run (+/- syntax supported) */
    tool_names?: string[];

    /** Scoped collection (if any) */
    collection_id?: string;

    /** Content type linked to this run — defines the schema for `properties` */
    content_type?: ContentObjectTypeRef;

    /** Conversation visibility */
    visibility?: ConversationVisibility;

    /** User-defined or system tags for categorization */
    tags?: string[];

    /** Categories for organizing runs (e.g. "support", "analysis", "generation") */
    categories?: string[];

    /** Business metadata — typed by the linked content_type schema */
    properties?: TProperties;

    /** How the run was started */
    source?: RunSource;

    /** Schedule ID — set when this run was triggered by a Temporal schedule */
    schedule_id?: string;

    /** How the run was created */
    source_type?: AgentRunType;

    /**
     * @deprecated Use source_type for creation source and run_type for runtime mode.
     */
    type?: AgentRunType;
}

/**
 * AgentRun — the client-facing stable identity for a running or completed agent.
 *
 * All operations use `id` as the sole identifier.
 * Temporal workflow internals are never exposed to clients.
 *
 * @typeParam TData - The interaction's expected input data type.
 * @typeParam TProperties - The content type's property schema.
 */
export interface AgentRun<TData = Record<string, any>, TProperties = Record<string, any>> extends RunBase, AgentRunBase<TData, TProperties> {
    run_kind: 'agent';
    run_type: 'autonomous';

    // --- Temporal workflow references ---

    /** Temporal workflow ID (stable across continueAsNew) */
    workflow_id?: string;

    /** First Temporal workflow run ID (used for Redis channel and artifact resolution) */
    first_workflow_run_id?: string;

    // --- Interaction info ---

    /** Human-readable interaction name */
    interaction_name?: string;

    // --- Lifecycle ---

    /** Current status of the agent run */
    status: AgentRunStatus;

    /** Whether the agent is currently working or idle (waiting for user input) */
    activity_state?: ConversationActivityState;

    /** When the run started */
    started_at: Date;

    /** When the run completed (or failed/cancelled) */
    completed_at?: Date;

    /** User or service that initiated the run */
    started_by: string;

    // --- Metadata ---

    /** Conversation title (short, human-readable) */
    title?: string;

    /** Conversation topic (longer description from topic analysis) */
    topic?: string;

    /** Lessons learned from the conversation (extracted at completion) */
    lessons_learned?: string[];

    // --- Archival ---

    /** Archive lifecycle state */
    archive_state?: AgentRunArchiveState;

    /** When the last successful archive completed */
    archived_at?: Date;

    /** Archive format version (for forward compatibility) */
    archive_version?: number;

    /** Last archive error message (when archive_state === 'failed') */
    last_archive_error?: string;

    /** Source agent run ID when this run was forked (enables message history chaining) */
    forked_from?: string;
}

export interface ProcessRunConfig {
    model?: string;
    /**
     * Free-form message from the user when starting a run. Passed to the
     * orchestrator LLM in supervised mode; stored on the run regardless
     * so programmatic runs retain the intent that triggered them.
     */
    user_message?: string;
}

export interface ProcessRun extends RunBase {
    run_kind: 'process';
    run_type: ProcessRunType;
    process_id?: string;
    process_definition_snapshot: ProcessDefinitionBody;
    process_version?: number;
    process_state: ProcessState;
    config?: ProcessRunConfig;
}

export type AnyAgentRun = AgentRun | ProcessRun;
export type AutonomousRunResponse<TData = Record<string, any>, TProperties = Record<string, any>> = AgentRun<TData, TProperties>;
export type SupervisedRunResponse = ProcessRun & { run_type: 'supervised' };
export type ProgrammaticRunResponse = ProcessRun & { run_type: 'programmatic' };
export type AgentRunResponse<TData = Record<string, any>, TProperties = Record<string, any>> =
    | AutonomousRunResponse<TData, TProperties>
    | SupervisedRunResponse
    | ProgrammaticRunResponse;

/**
 * Payload to create and start a new agent run.
 *
 * @typeParam TData - The interaction's expected input data type.
 * @typeParam TProperties - The content type's property schema.
 */
export interface CreateAgentRunPayload<TData = Record<string, any>, TProperties = Record<string, any>> extends AgentRunBase<TData, TProperties> {
    /** Search scope for RAG queries */
    search_scope?: AgentSearchScope;

    /** User communication channels (email, interactive) */
    user_channels?: UserChannel[];

    /** Token budget for checkpointing */
    checkpoint_tokens?: number;

    /** Maximum conversation iterations (default: 20) */
    max_iterations?: number;

    /** Webhook URLs to notify on completion */
    notify_endpoints?: string[];

    /** Enable debug mode for verbose logging */
    debug_mode?: boolean;

    /** Principal ref of the user who initiated the run (for server-to-server forwarding) */
    started_by?: string;
}

export interface ProcessRunInputPayload<TData = Record<string, any>, TSource = RunSource> {
    process_id?: string;
    process_definition?: ProcessDefinitionBody;
    data?: TData;
    config?: ProcessRunConfig;
    visibility?: ConversationVisibility;
    tags?: string[];
    categories?: string[];
    source?: TSource;
    started_by?: string;
}

export interface CreateProcessRunPayload<TData = Record<string, any>, TSource = RunSource> extends ProcessRunInputPayload<TData, TSource> {
    run_type: ProcessRunType;
}

export interface RecordRunWorkflowPayload {
    /** Temporal workflow id. */
    workflow_id: string;
    /** First Temporal run id for this workflow. Required when the workflow has already started. */
    first_workflow_run_id?: string;
}

/**
 * @internal Used by workflow activities that need to create a stable run
 * document for a workflow they already own.
 */
export interface RecordAgentRunPayload<TData = Record<string, any>> extends RecordRunWorkflowPayload {
    run_kind?: 'agent';
    interaction: string;
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
export interface RecordProcessRunPayload<TData = Record<string, any>, TSource = RunSource>
    extends ProcessRunInputPayload<TData, TSource>, RecordRunWorkflowPayload {
    run_kind: 'process';
    run_type?: ProcessRunType;
}

export type RecordRunPayload<TData = Record<string, any>, TSource = RunSource> =
    | RecordAgentRunPayload<TData>
    | RecordProcessRunPayload<TData, TSource>;

/**
 * @internal Attaches the first Temporal run id after a pre-created run record
 * has successfully started its workflow.
 */
export interface BindRunWorkflowPayload extends Required<RecordRunWorkflowPayload> {
    status?: AgentRunStatus;
    activity_state?: ConversationActivityState;
}

/**
 * Filters for listing agent runs.
 */
export interface ListAgentRunsQuery {
    /** Filter by agent run ID */
    id?: string;

    /** Filter by status (single or multiple) */
    status?: AgentRunStatus | AgentRunStatus[];

    /** Filter by interaction ID or code */
    interaction?: string;

    /** Filter by user who started the run */
    started_by?: string;

    /** Only return runs started after this date */
    since?: Date;

    /** Only return runs started at or before this date */
    until?: Date;

    /** Maximum number of results (default: 50) */
    limit?: number;

    /** Offset for pagination */
    offset?: number;

    /** Filter by schedule ID */
    schedule_id?: string;

    /** Filter by run type */
    type?: AgentRunType;

    /** Filter by public runtime mode */
    run_type?: RunType | RunType[];

    /** Filter by internal run discriminator */
    run_kind?: RunKind;

    /** Field to sort by */
    sort?: 'started_at' | 'updated_at';

    /** Sort order */
    order?: 'asc' | 'desc';
}

/**
 * Query for searching agent runs via Elasticsearch.
 */
export interface SearchAgentRunsQuery {
    /** Full-text search across name, title, topic, interaction_name, and content */
    query?: string;

    /** Filter by status (single or multiple) */
    status?: AgentRunStatus | AgentRunStatus[];

    /** Filter by interaction ID or code */
    interaction?: string;

    /** Filter by user who started the run */
    started_by?: string;

    /** Filter by categories */
    categories?: string[];

    /** Filter by tags */
    tags?: string[];

    /** Filter by content type name */
    content_type_name?: string;

    /** Filter by public runtime mode */
    run_type?: RunType | RunType[];

    /** Only return runs started after this date */
    since?: Date;

    /** Only return runs started at or before this date */
    until?: Date;

    /** Maximum number of results (default: 50) */
    limit?: number;

    /** Offset for pagination */
    offset?: number;
}

/**
 * A single search hit from Elasticsearch.
 */
export interface AgentRunSearchHit {
    /** Agent run ID */
    id: string;

    /** Relevance score */
    score: number;

    /** Interaction ID */
    interaction?: string;

    /** Public-facing runtime mode */
    run_type?: RunType;

    /** Internal run discriminator */
    run_kind?: RunKind;

    /** Human-readable interaction name */
    interaction_name?: string;

    /** Current status */
    status: AgentRunStatus;

    /** Whether the agent is currently working or idle */
    activity_state?: ConversationActivityState;

    /** When the run started */
    started_at: string;

    /** When the run completed */
    completed_at?: string;

    /** Who started the run */
    started_by: string;

    /** Conversation title */
    title?: string;

    /** Conversation topic */
    topic?: string;

    /** Lessons learned from the conversation */
    lessons_learned?: string[];

    /** Tags */
    tags?: string[];

    /** Categories */
    categories?: string[];

    /** Whether the agent accepts user input */
    interactive: boolean;

    /** Collection ID */
    collection_id?: string;

    /** Content type */
    content_type?: ContentObjectTypeRef;

    /** Tools configured for this run */
    tool_names?: string[];

    /** Schedule ID (if schedule-triggered) */
    schedule_id?: string;

    /** How the run was created */
    source_type?: AgentRunType;

    /**
     * @deprecated Use source_type for creation source and run_type for runtime mode.
     */
    type?: AgentRunType;

    /** Created timestamp */
    created_at: string;

    /** Updated timestamp */
    updated_at: string;
}

/**
 * Response from the agent runs search endpoint.
 */
export interface SearchAgentRunsResponse {
    /** Search results */
    hits: AgentRunSearchHit[];

    /** Total matching results */
    total: number;
}

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
    started_at: Date;
    completed_at?: Date;
    started_by: string;
    created_at: Date;
    updated_at: Date;
}
