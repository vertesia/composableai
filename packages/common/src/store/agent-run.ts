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

import { ConversationVisibility, RunSource } from "../interaction.js";
import { ContentObjectTypeRef } from "./store.js";

/**
 * Status of an agent run through its lifecycle.
 */
export type AgentRunStatus = 'created' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * AgentRun — the client-facing stable identity for a running or completed agent.
 *
 * All operations use `id` as the sole identifier.
 * Temporal workflow internals are never exposed to clients.
 *
 * @typeParam TData - The interaction's expected input data type.
 * Defaults to Record<string, any> for untyped interactions.
 */
export interface AgentRun<TData = Record<string, any>> {
    /** The stable identifier used by all client code */
    id: string;

    /** Account ID */
    account: string;

    /** Project ID */
    project: string;

    // --- Interaction info ---

    /** Interaction ID or code (e.g. "sys:generic_question") */
    interaction: string;

    /** Human-readable interaction name */
    interaction_name?: string;

    /** Input parameters, typed per interaction */
    data?: TData;

    // --- Configuration ---

    /** LLM environment ID */
    environment: string;

    /** Model used */
    model?: string;

    /** Whether the agent accepts user input */
    interactive: boolean;

    /** Tools configured for this run */
    tool_names?: string[];

    /** Scoped collection (if any) */
    collection_id?: string;

    /** Content type linked to this run (e.g. the document type being processed) */
    content_type?: ContentObjectTypeRef;

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

    /** User-defined or system tags for categorization */
    tags?: string[];

    /** Categories for organizing runs (e.g. "support", "analysis", "generation") */
    categories?: string[];

    /** Business metadata — arbitrary key/value pairs for domain-specific data */
    properties?: Record<string, any>;

    /** How the run was started */
    source?: RunSource;

    /** Visibility of the conversation */
    visibility?: ConversationVisibility;

    /** Timestamp when the document was created */
    created_at: Date;

    /** Timestamp when the document was last updated */
    updated_at: Date;
}

/**
 * Payload to create and start a new agent run.
 *
 * @typeParam TData - The interaction's expected input data type.
 */
export interface CreateAgentRunPayload<TData = Record<string, any>> {
    /** Interaction ID or name */
    interaction: string;

    /** Input parameters */
    data?: TData;

    /** Override default environment */
    environment?: string;

    /** Override default model */
    model?: string;

    /** Whether the agent accepts user input (default: true) */
    interactive?: boolean;

    /** Override interaction default tools (+/- syntax supported) */
    tool_names?: string[];

    /** Scope to a collection */
    collection_id?: string;

    /** Content type linked to this run */
    content_type?: ContentObjectTypeRef;

    /** Conversation visibility */
    visibility?: ConversationVisibility;

    /** Tags for categorization */
    tags?: string[];

    /** Categories for organizing runs */
    categories?: string[];

    /** Business metadata */
    properties?: Record<string, any>;

    /** How the run was started */
    source?: RunSource;
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

    /** Field to sort by */
    sort?: 'started_at' | 'updated_at';

    /** Sort order */
    order?: 'asc' | 'desc';
}
