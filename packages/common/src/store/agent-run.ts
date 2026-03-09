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

/**
 * Status of an agent run through its lifecycle.
 */
export type AgentRunStatus = 'created' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * How the agent run was created.
 */
export type AgentRunType = 'api' | 'schedule';

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
export interface AgentRun<TData = Record<string, any>, TProperties = Record<string, any>> extends AgentRunBase<TData, TProperties> {
    /** The stable identifier used by all client code */
    id: string;

    /** Account ID */
    account: string;

    /** Project ID */
    project: string;

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

    /** When the run started */
    started_at: Date;

    /** When the run completed (or failed/cancelled) */
    completed_at?: Date;

    /** User or service that initiated the run */
    started_by: string;

    // --- Metadata ---

    /** Short slug or name for the run (calculated by the workflow via a model call) */
    name?: string;

    /** Conversation title (short, human-readable) */
    title?: string;

    /** Conversation topic (longer description from topic analysis) */
    topic?: string;

    /** Timestamp when the document was created */
    created_at: Date;

    /** Timestamp when the document was last updated */
    updated_at: Date;
}

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
}

/**
 * Filters for listing agent runs.
 */
export interface ListAgentRunsQuery {
    /** Filter by status (single or multiple) */
    status?: AgentRunStatus | AgentRunStatus[];

    /** Filter by interaction ID or code */
    interaction?: string;

    /** Filter by user who started the run */
    started_by?: string;

    /** Only return runs started after this date */
    since?: Date;

    /** Maximum number of results (default: 50) */
    limit?: number;

    /** Offset for pagination */
    offset?: number;

    /** Filter by schedule ID */
    schedule_id?: string;

    /** Filter by run type */
    type?: AgentRunType;

    /** Field to sort by */
    sort?: 'started_at' | 'updated_at';

    /** Sort order */
    order?: 'asc' | 'desc';
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
    interaction: string;
    interaction_name?: string;
    config?: InteractionExecutionConfiguration;
    interactive: boolean;
    started_at: Date;
    completed_at?: Date;
    started_by: string;
    created_at: Date;
    updated_at: Date;
}
