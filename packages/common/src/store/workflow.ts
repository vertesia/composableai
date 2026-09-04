import type { HttpTimeoutOptions, ModelOptions } from '@llumiverse/common';
import type { z } from 'zod';
import type {
    AgentMessageDetailsSchema,
    CompactMessageSchema,
    ConversationFileSchema,
} from '../api-schemas/agent-runs.js';
import type { ConversationActivityStateSchema } from '../api-schemas/app-lifecycle.js';
import type { WorkflowExecutionStatusSchema } from '../api-schemas/document-processing.js';
import type { PlanSchema, PlanTaskSchema, WorkflowAncestorSchema } from '../api-schemas/interaction.js';
import type { WorkflowExecutionStartResultSchema } from '../api-schemas/process.js';
import type {
    ActivityTaskSchema,
    AgentTaskSchema,
    ChildWorkflowTaskSchema,
    EventErrorSchema,
    ExecuteWorkflowPayloadSchema,
    ListWorkflowInteractionsResponseSchema,
    ListWorkflowRunsPayloadSchema,
    ListWorkflowRunsResponseSchema,
    PendingActivitySchema,
    SignalEventPropertiesSchema,
    SignalTaskSchema,
    TimerTaskSchema,
    WorkflowActionResponseSchema,
    WorkflowHistorySchema,
    WorkflowInteractionVarsSchema,
    WorkflowQueryResultSchema,
    WorkflowRunDetailsQuerySchema,
    WorkflowRunEventSchema,
    WorkflowRunSchema,
    WorkflowRunStreamQuerySchema,
    WorkflowRunUpdatesQuerySchema,
    WorkflowRunUpdatesResponseSchema,
    WorkflowRunWithDetailsSchema,
    WorkflowTaskSchema,
    WorkflowUpdatePublishResponseSchema,
} from '../api-schemas/workflow-runs.js';
import type { AgentResourceReference, InteractionExecutionConfiguration } from '../interaction.js';
import { normalizeAgentResources } from '../interaction.js';
import type { SupportedEmbeddingTypes } from '../project.js';
import type { WorkflowInput } from './dsl-workflow.js';

export enum ContentEventName {
    create = 'create',
    change_type = 'change_type',
    update = 'update',
    revision_created = 'revision_created',
    delete = 'delete',
    workflow_finished = 'workflow_finished',
    workflow_execution_request = 'workflow_execution_request',
    api_request = 'api_request',
}

export interface Queue {
    name: string;
    // use either suffix or full name. fullname has precedence over suffix
    queue_suffix?: string; // suffix to append to the base queue name
    queue_full_name?: string; // full name
}

export type WorkflowAncestor = z.infer<typeof WorkflowAncestorSchema>;

export interface WorkflowExecutionBaseParams<T = Record<string, unknown>> {
    /**
     * The ref of the user who initiated the workflow.
     */
    initiated_by?: string;

    /**
     * The account ID of the user who created the activity.
     * This is useful to select the right database to work on.
     */
    account_id: string;

    /**
     * The project ID of the account who created the activity.
     */
    project_id: string;

    /**
     * The vars field is mainly used to pass the user input to the workflow.
     * The user input ar custom user options that can be used to configure the workflow.
     * You can see the user input as the arguments for a command line app.
     *
     * In the case of workflows started by event subscriptions, the user input vars
     * are initialized from the subscription target configuration.
     *
     * In case of dsl workflows the workflow execution payload vars will be applied over the default vars values stored in the DSL vars field.
     */
    vars: T;

    /**
     * Auth Token to access Zeno and Composable from the workers
     */
    auth_token?: string;

    /**
     * The configuration for the workflow execution.
     */
    config?: {
        studio_url: string;
        store_url: string;
        slack_app_url?: string;
        enabled_integrations?: string[]; //list of enabled integrations
    };

    /**
     * The list of endpoints to notify when the workflow finishes.
     * It is handled by a sub-workflow execution, so the main workflow will not wait for the notification to be sent.
     */
    notify_endpoints?: (string | WebHookSpec)[];

    /** If this is a child workflow, parent contains parent's ids  */
    parent?: WorkflowAncestor;

    /**
     * Full ancestry chain from root to immediate parent (for hierarchical aggregation)
     */
    ancestors?: WorkflowAncestor[];

    /**
     *  List of enabled processing queues. Managed by the application.
     */
    _enabled_queues?: Queue[];
}

export interface WebHookSpec {
    /**
     * The webhook URL to call using POST method
     */
    url: string;
    /**
     * the API version to use if any
     */
    version?: number;
    /**
     * Custom headers to include in the webhook request
     */
    headers?: Record<string, string>;
    /**
     * Additional custom data to include in the webhook body.
     * When custom data is provided, the workflow result will always be nested
     * to prevent field collisions. Use result_path to control where it's nested.
     */
    data?: Record<string, unknown>;
    /**
     * Path where the workflow result should be nested in the webhook body.
     * Defaults to "result" when custom data is provided.
     *
     * Example: With result_path="workflow_result" and data={customer_id: "123"}:
     * {
     *   "workflow_result": { ...workflow result... },
     *   "customer_id": "123"
     * }
     *
     * Example: With data={customer_id: "123"} but no result_path (uses default):
     * {
     *   "result": { ...workflow result... },
     *   "customer_id": "123"
     * }
     */
    result_path?: string;
}

export interface WorkflowExecutionPayload<T = Record<string, unknown>, EventName extends string = string>
    extends WorkflowExecutionBaseParams<T> {
    /**
     * The event which started the workflow who created the activity.
     */
    event: EventName;

    /*
     * The Workflow Rule ID if any. If the workflow was started by a rule this field will contain the rule ID
     * otherwise if the workflow was started on demand the property will be undefined.
     */
    wf_rule_name?: string;

    /**
     * The ID of the target objects processed by the workflow (legacy format).
     * For backward compatibility. New workflows should use the `input` field.
     */
    objectIds?: string[];

    /**
     * New format: Workflow input (either objectIds or files).
     * Takes precedence over the legacy `objectIds` field.
     */
    input?: WorkflowInput;

    /**
     * Auth Token to access Zeno and Composable from the workers
     */
    auth_token: string;
}

export function getDocumentIds(payload: WorkflowExecutionPayload<Record<string, unknown>>): string[] {
    // Check new input format first
    if (payload.input?.inputType === 'objectIds') {
        return payload.input.objectIds;
    }
    // Fall back to legacy objectIds field
    if (payload.objectIds) {
        return payload.objectIds;
    }
    return [];
}

export type ExecuteWorkflowPayload = z.infer<typeof ExecuteWorkflowPayloadSchema>;

export type ConversationActivityState = z.infer<typeof ConversationActivityStateSchema>;

export type ListWorkflowRunsPayload = z.infer<typeof ListWorkflowRunsPayloadSchema>;

export type SignalEventProperties = z.infer<typeof SignalEventPropertiesSchema>;

export type EventError = z.infer<typeof EventErrorSchema>;

export type WorkflowRunEvent = z.infer<typeof WorkflowRunEventSchema>;

// Task status enum for processed history
export enum TaskStatus {
    SCHEDULED = 'scheduled',
    RUNNING = 'running',
    COMPLETED = 'completed',
    FAILED = 'failed',
    CANCELED = 'canceled',
    TIMED_OUT = 'timed_out',
    TERMINATED = 'terminated',
    SENT = 'sent', // for signals
    RECEIVED = 'received', // for signals
}

// Task type enum
export enum TaskType {
    ACTIVITY = 'activity',
    CHILD_WORKFLOW = 'childWorkflow',
    SIGNAL = 'signal',
    TIMER = 'timer',
}

// Activity-specific task
export type ActivityTask = z.infer<typeof ActivityTaskSchema>;

// Child workflow-specific task
export type ChildWorkflowTask = z.infer<typeof ChildWorkflowTaskSchema>;

// Signal-specific task
export type SignalTask = z.infer<typeof SignalTaskSchema>;

// Timer-specific task
export type TimerTask = z.infer<typeof TimerTaskSchema>;

// Union type for all processed tasks
export type WorkflowTask = z.infer<typeof WorkflowTaskSchema>;

// History format discriminated union
export type WorkflowHistory = z.infer<typeof WorkflowHistorySchema>;

export type AgentTask = z.infer<typeof AgentTaskSchema>;

export type WorkflowRun = z.infer<typeof WorkflowRunSchema>;

export type PendingActivity = z.infer<typeof PendingActivitySchema>;

export type WorkflowRunWithDetails = z.infer<typeof WorkflowRunWithDetailsSchema>;
export type ListWorkflowRunsResponse = z.infer<typeof ListWorkflowRunsResponseSchema>;

export type WorkflowExecutionStartResult = z.infer<typeof WorkflowExecutionStartResultSchema>;

export type ListWorkflowInteractionsResponse = z.infer<typeof ListWorkflowInteractionsResponseSchema>;

export type WorkflowRunUpdatesResponse = z.infer<typeof WorkflowRunUpdatesResponseSchema>;

export type WorkflowRunDetailsQuery = z.infer<typeof WorkflowRunDetailsQuerySchema>;

export type WorkflowRunUpdatesQuery = z.infer<typeof WorkflowRunUpdatesQuerySchema>;

export type WorkflowRunStreamQuery = z.infer<typeof WorkflowRunStreamQuerySchema>;

export type WorkflowUpdatePublishResponse = z.infer<typeof WorkflowUpdatePublishResponseSchema>;

export type WorkflowActionResponse = z.infer<typeof WorkflowActionResponseSchema>;

export type WorkflowQueryResult = z.infer<typeof WorkflowQueryResultSchema>;

export type WorkflowInteractionVars = z.infer<typeof WorkflowInteractionVarsSchema>;

export const WorkflowExecutionStatusValues = {
    UNKNOWN: 0,
    RUNNING: 1,
    COMPLETED: 2,
    FAILED: 3,
    CANCELED: 4,
    TERMINATED: 5,
    CONTINUED_AS_NEW: 6,
    TIMED_OUT: 7,
} as const;

// Keep numeric reverse lookup for existing callers without treating newer Temporal-only status
// codes as part of Vertesia's published enum. Unknown numeric codes therefore read as undefined.
export const WorkflowExecutionStatus: typeof WorkflowExecutionStatusValues & Readonly<Record<number, string>> = {
    ...WorkflowExecutionStatusValues,
    0: 'UNKNOWN',
    1: 'RUNNING',
    2: 'COMPLETED',
    3: 'FAILED',
    4: 'CANCELED',
    5: 'TERMINATED',
    6: 'CONTINUED_AS_NEW',
    7: 'TIMED_OUT',
};

export type WorkflowExecutionStatus = z.infer<typeof WorkflowExecutionStatusSchema>;

/**
 * Basic response for anything run with an async workflow
 */
export interface WorkflowRunStatus {
    workflow_id: string | null;
    workflow_run_id: string | null;
    status: WorkflowExecutionStatus;
}

/**
 * Workflow Update Message
 */
export interface AgentMessage {
    timestamp: number;
    workflow_run_id: string;
    type: AgentMessageType;
    message: string;
    details?: AgentMessageDetails;
    workstream_id?: string;
}

export enum AgentMessageType {
    SYSTEM = 0,
    THOUGHT = 1,
    PLAN = 2,
    UPDATE = 3,
    COMPLETE = 4,
    WARNING = 5,
    ERROR = 6,
    ANSWER = 7,
    QUESTION = 8,
    REQUEST_INPUT = 9,
    IDLE = 10,
    TERMINATED = 11,
    STREAMING_CHUNK = 12,
    BATCH_PROGRESS = 13,
    RESTARTING = 14,
}

export type AgentMessageDetails = z.infer<typeof AgentMessageDetailsSchema>;

// ============================================
// AGENT MESSAGE DETAIL TYPES & TYPE GUARDS
// ============================================

/**
 * Details for THOUGHT messages representing tool calls (event_class: 'activity').
 */
interface ToolCallDetails {
    event_class: 'activity';
    tool: string;
    tool_event?: 'started' | 'progress' | 'completed' | 'failed';
    tool_run_id?: string;
    tool_use_id?: string;
    tool_status?: 'running' | 'completed' | 'error' | 'warning';
    tool_iteration?: number;
    message_to_human?: string;
    duration_ms?: number;
    activity_group_id?: string;
    activity_id?: string;
    files?: string[];
    outputFiles?: string[];
    [key: string]: unknown;
}

// Type guards — check both message type and details shape for safety

export function isToolCallMessage(msg: AgentMessage): msg is AgentMessage & { details: ToolCallDetails } {
    const details = msg.details as Record<string, unknown> | undefined;
    return (
        msg.type === AgentMessageType.THOUGHT &&
        !!details &&
        typeof details === 'object' &&
        typeof details.tool === 'string'
    );
}

/** Extract the normalized resource references carried on a message's details, if any. */
export function getResourcesFromMessage(msg: AgentMessage): AgentResourceReference[] {
    return normalizeAgentResources((msg.details as AgentMessageDetails | undefined)?.resources);
}

/**
 * Details for STREAMING_CHUNK messages used for real-time LLM response streaming
 * @deprecated Use CompactMessage with f field for streaming chunks
 */
export interface StreamingChunkDetails {
    /** Unique identifier grouping chunks from the same stream */
    streaming_id: string;
    /** Order of this chunk within the stream (0-indexed) */
    chunk_index?: number;
    /** True if this is the final chunk of the stream */
    is_final: boolean;
    /** Activity ID for deduplication with final THOUGHT/ANSWER message */
    activity_id?: string;
}

// ============================================
// COMPACT MESSAGE FORMAT
// ============================================

/**
 * Compact message format for efficient wire transfer.
 * Primary type used throughout the system.
 * ~85% smaller than legacy AgentMessage format.
 */
export type CompactMessage = z.infer<typeof CompactMessageSchema>;

/**
 * Legacy message format for backward compatibility.
 * @deprecated Use CompactMessage instead
 */
type LegacyAgentMessage = AgentMessage;

// ============================================
// TYPE GUARDS
// ============================================

/**
 * Check if a message is in compact format
 */
export function isCompactMessage(msg: unknown): msg is CompactMessage {
    return typeof msg === 'object' && msg !== null && 't' in msg;
}

/**
 * Check if a message is in legacy format
 */
export function isLegacyMessage(msg: unknown): msg is LegacyAgentMessage {
    return typeof msg === 'object' && msg !== null && 'type' in msg && !('t' in msg);
}

// ============================================
// CONVERTERS
// ============================================

/**
 * Map old string enum values to AgentMessageType
 */
const STRING_TO_TYPE_MAP: Record<string, AgentMessageType> = {
    system: AgentMessageType.SYSTEM,
    thought: AgentMessageType.THOUGHT,
    plan: AgentMessageType.PLAN,
    update: AgentMessageType.UPDATE,
    complete: AgentMessageType.COMPLETE,
    warning: AgentMessageType.WARNING,
    error: AgentMessageType.ERROR,
    answer: AgentMessageType.ANSWER,
    question: AgentMessageType.QUESTION,
    request_input: AgentMessageType.REQUEST_INPUT,
    idle: AgentMessageType.IDLE,
    terminated: AgentMessageType.TERMINATED,
    streaming_chunk: AgentMessageType.STREAMING_CHUNK,
    batch_progress: AgentMessageType.BATCH_PROGRESS,
};

/**
 * Map integer values to AgentMessageType (primary format)
 */
const INT_TO_TYPE_MAP: Record<number, AgentMessageType> = {
    0: AgentMessageType.SYSTEM,
    1: AgentMessageType.THOUGHT,
    2: AgentMessageType.PLAN,
    3: AgentMessageType.UPDATE,
    4: AgentMessageType.COMPLETE,
    5: AgentMessageType.WARNING,
    6: AgentMessageType.ERROR,
    7: AgentMessageType.ANSWER,
    8: AgentMessageType.QUESTION,
    9: AgentMessageType.REQUEST_INPUT,
    10: AgentMessageType.IDLE,
    11: AgentMessageType.TERMINATED,
    12: AgentMessageType.STREAMING_CHUNK,
    13: AgentMessageType.BATCH_PROGRESS,
};

/**
 * Normalize message type from string or number to AgentMessageType
 */
export function normalizeMessageType(type: string | number | AgentMessageType): AgentMessageType {
    // Handle integer type (current format and AgentMessageType enum values)
    if (typeof type === 'number') {
        return INT_TO_TYPE_MAP[type] ?? AgentMessageType.UPDATE;
    }
    // Handle string type (legacy messages from Redis with 90-day TTL)
    if (typeof type === 'string') {
        return STRING_TO_TYPE_MAP[type] ?? AgentMessageType.UPDATE;
    }
    return AgentMessageType.UPDATE;
}

/**
 * Convert legacy AgentMessage to CompactMessage
 */
export function toCompactMessage(legacy: LegacyAgentMessage): CompactMessage {
    const compact: CompactMessage = {
        t: normalizeMessageType(legacy.type),
    };

    if (legacy.message) compact.m = legacy.message;
    if (legacy.workstream_id && legacy.workstream_id !== 'main') compact.w = legacy.workstream_id;
    if (legacy.timestamp) compact.ts = legacy.timestamp;

    // Handle legacy streaming chunk details
    if (compact.t === AgentMessageType.STREAMING_CHUNK && legacy.details) {
        const d = legacy.details as StreamingChunkDetails;
        if (d.is_final) compact.f = 1;
        // streaming_id and chunk_index are no longer needed
    } else if (legacy.details) {
        compact.d = legacy.details;
    }

    return compact;
}

/**
 * Parse any message format (compact or legacy) into CompactMessage.
 * Use this as the entry point for all received messages.
 */
export function parseMessage(data: string | object): CompactMessage {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    if (isCompactMessage(parsed)) return parsed;
    if (isLegacyMessage(parsed)) return toCompactMessage(parsed);
    throw new Error('Unknown message format');
}

/**
 * Create a compact message (convenience function for server-side)
 */
export function createCompactMessage(
    type: AgentMessageType,
    options: {
        message?: string;
        workstreamId?: string;
        details?: AgentMessageDetails;
        isFinal?: boolean;
        timestamp?: number;
    } = {},
): CompactMessage {
    const compact: CompactMessage = { t: type };

    if (options.message) compact.m = options.message;
    if (options.workstreamId && options.workstreamId !== 'main') compact.w = options.workstreamId;
    if (options.details) compact.d = options.details;
    if (options.isFinal) compact.f = 1;
    if (options.timestamp) compact.ts = options.timestamp;

    return compact;
}

/**
 * Convert CompactMessage back to AgentMessage (for UI components).
 * This allows UI to continue using familiar field names while wire format is compact.
 * @param compact The compact message to convert
 * @param workflowRunId Optional workflow_run_id (known from SSE context, not in compact format)
 */
export function toAgentMessage(compact: CompactMessage, workflowRunId: string = ''): AgentMessage {
    const message: AgentMessage = {
        type: compact.t,
        timestamp: compact.ts || Date.now(),
        workflow_run_id: workflowRunId,
        message: compact.m || '',
        workstream_id: compact.w || 'main',
    };

    if (compact.d !== undefined && compact.d !== null) message.details = compact.d;

    // For streaming chunks, restore is_final and preserve an explicit streaming_id
    // when present. Older chunks fall back to workstream_id as their grouping key.
    if (compact.t === AgentMessageType.STREAMING_CHUNK) {
        const details: AgentMessageDetails = typeof compact.d === 'object' && compact.d !== null ? compact.d : {};
        const streamingId = typeof details.streaming_id === 'string' ? details.streaming_id : compact.w || 'main';
        const activityId = compact.i ?? (typeof details.activity_id === 'string' ? details.activity_id : undefined);

        message.details = {
            ...details,
            streaming_id: streamingId,
            is_final: compact.f === 1,
            ...(activityId ? { activity_id: activityId } : {}),
        };
    }

    return message;
}

/**
 * Status of a single item in a batch execution
 */
export interface BatchItemStatus {
    /** Unique identifier for this batch item */
    id: string;
    /** Current status of the item */
    status: 'pending' | 'running' | 'success' | 'error';
    /** Optional message (e.g., error message or result summary) */
    message?: string;
    /** Execution duration in milliseconds (when completed) */
    duration_ms?: number;
}

/**
 * Details for BATCH_PROGRESS messages used for batch tool execution progress
 */
export interface BatchProgressDetails {
    /** Unique identifier for this batch execution */
    batch_id: string;
    /** Name of the tool being batch executed */
    tool_name: string;
    /** Total number of items in the batch */
    total: number;
    /** Number of items completed */
    completed: number;
    /** Number of items that succeeded */
    succeeded: number;
    /** Number of items that failed */
    failed: number;
    /** Status of individual items */
    items: BatchItemStatus[];
    /** Timestamp when batch started */
    started_at: number;
    /** Timestamp when batch completed (if done) */
    completed_at?: number;
}

/**
 * Status of a file being processed for conversation use.
 */
export enum FileProcessingStatus {
    /** File is being uploaded to artifact storage */
    UPLOADING = 'uploading',
    /** File uploaded, text extraction in progress */
    PROCESSING = 'processing',
    /** File is ready for use in conversation */
    READY = 'ready',
    /** File processing failed */
    ERROR = 'error',
}

export type ConversationFile = z.infer<typeof ConversationFileSchema>;

/**
 * Details for file processing SYSTEM messages.
 * Used when type is AgentMessageType.SYSTEM with system_type: 'file_processing'.
 */
export interface FileProcessingDetails {
    /** Discriminator for SYSTEM message subtypes */
    system_type: 'file_processing';
    /** Batch ID for grouping related file operations */
    batch_id: string;
    /** All files in this batch with their current status */
    files: ConversationFile[];
    /** Number of files still being processed */
    pending_count: number;
    /** Number of files ready for use */
    ready_count: number;
    /** Number of files that failed */
    error_count: number;
}

/**
 * Reference to a file uploaded via the UI for conversation use.
 */
export interface ConversationFileRef {
    /** Client-generated unique ID */
    id: string;
    /** Original filename */
    name: string;
    /** MIME type */
    content_type: string;
    /** Artifact reference (e.g., "artifact:files/document.pdf") */
    reference: string;
    /** Artifact path without prefix (e.g., "files/document.pdf") */
    artifact_path: string;
}

/**
 * Manifest closing a staged-upload batch (the FileBatchClosed signal). Sent by clients that
 * stage files before the run exists (the agent start screen) after every upload attempt has
 * finished: those clients cannot wait for text extraction themselves, so the workflow owns the
 * "[Files Ready]" user turn. The manifest is the batch's authoritative membership — the
 * workflow delivers once, and only once, every listed file has settled, so a fast first file
 * can never trigger delivery while later files are still uploading.
 */
export interface ConversationFileBatchRef {
    /** Client-generated batch id. Stable across retries so redelivering the manifest is a no-op. */
    batch_id: string;
    /**
     * Ids (ConversationFileRef.id) of the files successfully uploaded and signaled for this
     * batch. Files whose upload failed client-side are listed in `failed_uploads` instead;
     * empty when every upload failed.
     */
    file_ids: string[];
    /**
     * Files the client could not upload or signal. Without them a 1-of-2 batch would look
     * complete to the workflow, so the agent would never learn a file is missing.
     */
    failed_uploads?: { name: string; error?: string }[];
}

/**
 * Reference to a file removed from the conversation attachment set.
 */
export interface ConversationFileRemovedRef {
    /** Client-generated unique ID */
    id: string;
}

export type PlanTask = z.infer<typeof PlanTaskSchema>;

export type Plan = z.infer<typeof PlanSchema>;

export const LOW_PRIORITY_TASK_QUEUE = 'low_priority';

/**
 * WebSocket message types for bidirectional communication
 */
interface WebSocketSignalMessage {
    type: 'signal';
    signalName: string;
    data: unknown;
    requestId?: string | number;
}

interface WebSocketPingMessage {
    type: 'ping';
}

interface WebSocketPongMessage {
    type: 'pong';
}

interface WebSocketAckMessage {
    type: 'ack';
    requestId: string | number;
}

interface WebSocketErrorMessage {
    type: 'error';
    requestId?: string | number;
    error: string;
}

export type WebSocketClientMessage = WebSocketSignalMessage | WebSocketPingMessage;

export type WebSocketServerMessage = WebSocketPongMessage | WebSocketAckMessage | WebSocketErrorMessage | AgentMessage;

/**
 * Payload for applying actions to a workflow run (e.g., cancel, terminate).
 */
export interface WorkflowActionPayload {
    /**
     * Optional reason for the action.
     */
    reason?: string;
}

/**
 * Parameters for the AgentIntakeWorkflow.
 * This workflow uses an intelligent agent to process documents:
 * - Select or create appropriate content types
 * - Extract properties using schema-enforced interactions
 * - File documents into relevant collections
 */
export interface AgentIntakeWorkflowParams {
    /**
     * The interaction to use for document intake agent.
     * Defaults to "sys:DocumentIntakeAgent" if not specified.
     * Can be overridden with a project-level interaction.
     */
    intakeInteraction?: string;

    /**
     * The interaction to use for property extraction.
     * Defaults to "sys:ExtractInformation" if not specified.
     * Can be overridden with a project-level interaction.
     */
    extractionInteraction?: string;

    /**
     * Whether to generate table of contents for documents.
     * Defaults to true for documents, false for images/videos.
     */
    generateTableOfContents?: boolean;

    /**
     * Whether to generate embeddings after processing.
     * Defaults to true.
     */
    generateEmbeddings?: boolean;

    /**
     * Max iterations for the agent workflow.
     * Defaults to 50.
     */
    maxIterations?: number;

    /**
     * Environment ID for LLM execution.
     */
    environment?: string;

    /**
     * Model to use for the agent.
     */
    model?: string;

    /**
     * Additional model options.
     */
    model_options?: ModelOptions;

    /**
     * Per-run HTTP timeouts for upstream LLM-provider calls.
     */
    http_timeout?: HttpTimeoutOptions;

    /**
     * LLM execution config. Prefer this for event-subscription-driven execution settings.
     */
    config?: InteractionExecutionConfiguration;

    /**
     * Whether to use semantic layer (MagicPDF) for PDF processing.
     */
    useSemanticLayer?: boolean;

    /**
     * Whether to use vision for image-based extraction.
     */
    useVision?: boolean;
}

/**
 * Result of the AgentIntakeWorkflow
 */
export interface AgentIntakeWorkflowResult {
    /** The object ID that was processed */
    objectId: string;
    /** Whether text was extracted */
    hasText: boolean;
    /** Whether table of contents was generated */
    hasTableOfContents: boolean;
    /** The type ID assigned to the document */
    typeId?: string;
    /** Whether properties were extracted */
    hasProperties: boolean;
    /** Collection IDs the document was added to */
    collectionIds?: string[];
    /** Whether embeddings were generated */
    hasEmbeddings: boolean;
    /** Embedding kinds that were actually generated. Skipped or failed activity results are omitted. */
    generatedEmbeddings?: SupportedEmbeddingTypes[];
}

// ---------------------------------------------------------------------------
// Workstream query types (used by client helpers)
// ---------------------------------------------------------------------------

/** Progress reported by a child workstream */
interface WorkstreamProgressInfo {
    launch_id: string;
    workstream_id: string;
    phase: 'planning' | 'executing_tool' | 'synthesizing' | 'blocked' | 'done';
    current_step?: string;
    current_tool?: string;
    percent?: number;
    updated_at: number;
}

/** Entry returned by the ActiveWorkstreams query */
export interface ActiveWorkstreamEntry {
    launch_id: string;
    workstream_id: string;
    kind?: 'agent' | 'process';
    interaction: string;
    started_at: number;
    elapsed_ms: number;
    deadline_ms: number;
    status: 'running' | 'canceling';
    latest_progress?: WorkstreamProgressInfo;
    /** Child workflow ID — use to fetch per-workstream messages */
    child_workflow_id: string;
    /** Child workflow run ID — use with retrieveMessages / streamMessages */
    child_workflow_run_id?: string;
    process_run_id?: string;
    process_workflow_id?: string;
    process_name?: string;
    process_run_type?: 'programmatic' | 'supervised';
}

/** Recently completed workstream entry returned by the ActiveWorkstreams query */
export interface CompletedWorkstreamEntry {
    launch_id: string;
    workstream_id: string;
    kind?: 'agent' | 'process';
    status: 'completed' | 'failed' | 'canceled' | 'timeout';
    summary?: string;
    error?: string;
    duration_ms?: number;
    started_at?: number;
    interaction?: string;
    last_progress?: WorkstreamProgressInfo;
    child_workflow_id?: string;
    child_workflow_run_id?: string;
    process_run_id?: string;
    process_workflow_id?: string;
    process_name?: string;
}

/** Result of the ActiveWorkstreams Temporal query */
export interface ActiveWorkstreamsQueryResult {
    running: ActiveWorkstreamEntry[];
    completed?: CompletedWorkstreamEntry[];
    /** True when the workflow could not answer this optional query. */
    unavailable?: boolean;
}
