import { ConversationVisibility, InteractionRef, UserChannel } from "../interaction.js";
import { JSONSchema } from "../json-schema.js";
import type { WorkflowInput } from "./dsl-workflow.js";

export enum ContentEventName {
    create = "create",
    change_type = "change_type",
    update = "update",
    revision_created = "revision_created",
    delete = "delete",
    workflow_finished = "workflow_finished",
    workflow_execution_request = "workflow_execution_request",
    api_request = "api_request",
}

export interface Queue {
    name: string;
    // use either suffix or full name. fullname has precedence over suffix
    queue_suffix?: string; // suffix to append to the base queue name
    queue_full_name?: string; // full name
}

export interface WorkflowAncestor {
    run_id: string;
    workflow_id: string;
    /**
     * the depth of nested parent workflows
     */
    run_depth: number;
}

export interface WorkflowExecutionBaseParams<T = Record<string, any>> {
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
     * In the case of workflows started by events (e.g. using a a workflow rule) the user input vars will be initialized with the workflow rule configuration field.
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
    ancestors?: WorkflowAncestor[]

    /**
     * If true, copy workspace artifacts (scripts/, files/, skills/, docs/, out/)
     * from parent workflow to this workflow on startup.
     * Defaults to true when spawning child workflows.
     * conversation.json and tools.json are never copied.
     */
    inherit_artifacts?: boolean;

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
    data?: Record<string, any>;
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

export interface WorkflowExecutionPayload<T = Record<string, any>> extends WorkflowExecutionBaseParams<T> {
    /**
     * The event which started the workflow who created the activity.
     */
    event: ContentEventName;

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

export function getDocumentIds(payload: WorkflowExecutionPayload): string[] {
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

export interface ExecuteWorkflowPayload {
    /**
     * The task queue to assign the workflow to. Deprecated, queues are choosend server side
     */
    //@deprecated
    task_queue?: string;

    /**
     * Docuument IDs pon which the workflow will be executed, deprecated, replaced params in vars
     */
    //@deprecated
    objectIds?: string[];

    /**
     * New format: Workflow input (either objectIds or files).
     * Takes precedence over the deprecated `objectIds` field.
     */
    input?: WorkflowInput;

    /**
     * Parameters to pass to the workflow
     */
    vars?: Record<string, any>;

    /**
     * Make the workflow ID unique by always adding a random token to the ID.
     */
    unique?: boolean;

    /**
     * A custom ID to use for the workflow execution id instead of the generated one.
     */
    custom_id?: string;

    /**
     * Timeout for the workflow execution to complete, in seconds.
     */
    timeout?: number; //timeout in seconds

    /**
     * Schedule the workflow to run at a specific time (ISO 8601 datetime).
     * Example: "2024-02-15T16:00:00Z"
     * If in the past or not provided, workflow runs immediately.
     */
    run_at?: string;
}

export type ConversationActivityState = 'working' | 'idle';

export interface ListWorkflowRunsPayload {
    /**
     * The document ID passed to a workflow run.
     */

    document_id?: string;

    /**
     * The event name that triggered the workflow.
     */
    event_name?: string;

    /**
     * The workflow rule ID that triggered the workflow.
     */
    rule_id?: string;

    /**
     * The start time for filtering workflow runs.
     */
    start?: string;

    /**
     * The end time for filtering workflow runs.
     */
    end?: string;

    /**
     * The status of the workflow run.
     */
    status?: string;

    /**
     * search term to filter on workflow id and run id
     */
    search_term?: string;

    /**
     * The user or service account that initiated the workflow run.
     */
    initiated_by?: string;

    /**
     * The interaction name used to filter conversations.
     */
    interaction?: string;

    /**
     * Lucene query string to search for the workflow runs.
     * This is a full text search on the workflow run history.
     */
    query?: string;

    type?: string;

    /**
     * The maximum number of results to return per page.
     */
    page_size?: number;

    /**
     * The page token for Temporal pagination.
     */
    next_page_token?: string;

    /**
     * Filter by whether the workflow has reported errors (TemporalReportedProblems).
     */
    has_reported_errors?: boolean;

    /**
     * Filter by the activity state of the conversation (running or idle).
     */
    activity_state?: ConversationActivityState;

    /**
     * Filter by whether the conversation is interactive.
     */
    interactive?: boolean;
}

/**
 * Signal event properties for workflow events
 */
export interface SignalEventProperties {
    direction: 'receiving' | 'sending';
    signalName?: string;
    input?: any;
    sender?: {
        workflowId?: string;
        runId?: string;
    };
    recipient?: {
        workflowId?: string;
        runId?: string;
    };
    initiatedEventId?: string;
}

/**
 * Error information from failed workflow events
 */
export interface EventError {
    message?: string;
    source?: string;
    stacktrace?: string;
    type?: string;
}

export interface WorkflowRunEvent {
    event_id: number;
    event_time: string | null;
    event_type: string;
    task_id?: string;
    attempt: number;

    activity?: {
        name?: string;
        id?: string;
        input?: any;
        scheduledEventId?: string;
        startedEventId?: string;
    };

    childWorkflow?: {
        workflowId?: string,
        workflowType?: string,
        runId?: string,
        scheduledEventId?: string,
        startedEventId?: string,
        input?: any,
        result?: any,
    };

    signal?: SignalEventProperties;

    timer?: {
        timerId?: string;
        duration?: string;
        summary?: string;
    };

    error?: EventError;

    result?: any;
}

// Task status enum for processed history
export enum TaskStatus {
    SCHEDULED = 'scheduled',
    RUNNING = 'running',
    COMPLETED = 'completed',
    FAILED = 'failed',
    CANCELED = 'canceled',
    TIMED_OUT = 'timed_out',
    TERMINATED = 'terminated',
    SENT = 'sent',        // for signals
    RECEIVED = 'received', // for signals
}

// Task type enum
export enum TaskType {
    ACTIVITY = 'activity',
    CHILD_WORKFLOW = 'childWorkflow',
    SIGNAL = 'signal',
    TIMER = 'timer',
}

// Base task interface
interface TaskBase {
    type: TaskType;
    activityId: string;
    activityName?: string;
    input?: any;
    scheduled: string | null;
    status: TaskStatus;
    attempts: number;
    started: string | null;
    completed: string | null;
    error: string | null;
    result: any;
}

// Activity-specific task
export interface ActivityTask extends TaskBase {
    type: TaskType.ACTIVITY;
}

// Child workflow-specific task
export interface ChildWorkflowTask extends TaskBase {
    type: TaskType.CHILD_WORKFLOW;
    workflowType?: string;
    runId?: string;
}

// Signal-specific task
export interface SignalTask extends TaskBase {
    type: TaskType.SIGNAL;
    signalName?: string;
    direction?: 'sending' | 'receiving';
    sender?: {
        workflowId?: string;
        runId?: string;
    };
    recipient?: {
        workflowId?: string;
        runId?: string;
    };
}

// Timer-specific task
export interface TimerTask extends TaskBase {
    type: TaskType.TIMER;
    timerId?: string;
    duration?: string;
}

// Union type for all processed tasks
export type WorkflowTask =
    | ActivityTask
    | ChildWorkflowTask
    | SignalTask
    | TimerTask;

// History format discriminated union
export type WorkflowHistory =
    | { type: 'events'; events: WorkflowRunEvent[] }
    | { type: 'tasks'; tasks: WorkflowTask[] }
    | { type: 'agent'; agentTasks: AgentTask[] };

// History format query parameter type
export type HistoryFormat = 'events' | 'tasks' | 'agent';

/**
 * Agent task information for workflow history UI representation.
 * This is separate from the analytics AgentEvent types.
 * Consistent with WorkflowTask naming convention.
 *
 * Currently represents tool calls, but designed to be extensible
 * for other task types (LLM calls, checkpoints, etc.)
 */
export interface AgentTask {
    /** Type discriminator for future task types */
    taskType: 'tool_call' | 'llm_call' | 'input' | 'timer' | 'subagent' | 'processing';

    /** Tool-specific fields */
    toolName: string;
    toolUseId?: string;
    toolRunId?: string;
    toolType?: 'builtin' | 'interaction' | 'remote' | 'skill';
    iteration?: number;

    /** Execution details */
    scheduled_at: string | null;
    started_at: string | null;
    completed_at: string | null;
    status: 'running' | 'completed' | 'error' | 'warning';

    /** Tool data */
    parameters?: Record<string, unknown>;
    result?: string;
    error?: { type: string; message: string };

    /** Number of activity retries */
    retries?: number;

    /** Active tools for this LLM call */
    activeTools?: string[];

    /** Available skills for this LLM call */
    availableSkills?: string[];

    /** Workstream tracking */
    workstreamId?: string;

    /** LLM stop reason for llm_call tasks (e.g., "stop", "length", "tool_use") */
    finish_reason?: string;
}

export interface WorkflowRun {
    status?: WorkflowExecutionStatus | string;
    /**
     * The Temporal Workflow Type of this Workflow Run.
     *
     * @see https://docs.temporal.io/workflows
     */
    type?: string;
    started_at: string | null;
    closed_at: string | null;
    execution_duration?: number;
    run_id?: string;
    workflow_id?: string;
    initiated_by?: string;
    interaction_name?: string;
    input?: any;
    result?: any;
    error?: any,
    has_reported_errors?: boolean;
    raw?: any;
    /**
     * The Vertesia Workflow Type of this Workflow Run.
     *  - For DSL workflows (`type:dslWorkflow`), the vertesia_type refers to the "Workflow Rule Name" specified in the
     *    DSL. For example, "Standard Document Intake" or "Standard Image Intake".
     *  - For non-DSL workflows, the vertesia_type is the name of the Temporal Workflow Type.
     */
    vertesia_workflow_type?: string;
    /**
     * An interaction is used to start the agent, the data is stored on temporal "vars"
     */
    interactions?: InteractionRef[];
    /**
     * The visibility of the workflow run.
     * - 'private': Only visible to the user who initiated the workflow
     * - 'project': Visible to all users in the project
     */
    visibility?: ConversationVisibility;
    /**
     * A brief summary of the conversation workflow.
     */
    topic?: string;
    /**
     * The current activity state of the conversation.
     * - 'working': The agent is actively processing
     * - 'idle': The agent is waiting for user input
     */
    activity_state?: ConversationActivityState;
    /**
     * Whether this conversation is interactive (accepts user input).
     */
    interactive?: boolean;
}

export interface PendingActivity {
    activityId?: string;
    activityType?: string;
    attempt: number;
    maximumAttempts: number;
    lastFailure?: string;
    lastStartedTime: string | null;
}

export interface WorkflowRunWithDetails extends WorkflowRun {
    history?: WorkflowHistory;
    memo?: {
        [key: string]: any;
    } | null;
    pendingActivities?: PendingActivity[];
}
export interface ListWorkflowRunsResponse {
    runs: WorkflowRun[];
    next_page_token?: string;
    has_more?: boolean;
}

export interface ListWorkflowInteractionsResponse {
    workflow_id: string,
    run_id: string,
    interaction: WorkflowInteractionVars
}

export interface WorkflowInteractionVars {
    type: string,
    interaction: string,
    interactive: boolean,
    debug_mode?: boolean,
    non_blocking_subagents?: boolean,
    /**
     * Array of channels to use for user communication.
     * Multiple channels can be active simultaneously.
     */
    user_channels?: UserChannel[],
    data?: Record<string, any>,
    tool_names: string[],
    config: {
        environment: string,
        model: string
    },
    interactionParamsSchema?: JSONSchema,
    collection_id?: string;
    /**
     * The token threshold in thousands (K) for creating checkpoints.
     * If total tokens exceed this value, a checkpoint will be created.
     * If not specified, default value of 150K tokens will be used.
     */
    checkpoint_tokens?: number;
    /**
     * Optional version of the interaction to use when restoring conversations.
     * If not specified, the latest version will be used.
     */
    version?: number;
}

export interface MultiDocumentsInteractionParams extends Omit<WorkflowExecutionPayload, "config"> {
    config: {
        interactionName: string;
        action: DocumentActionConfig;
        data: Record<string, any>;
    };
}

export interface DocumentActionConfig {
    contentTypeName?: string; //content type to use
    setAsProperties: boolean; //set result as properties
    setAsText: string; //set result as text, if result set the whole result as text
    setNameFrom: string; //result property to use as name
    upsert: boolean; //wether to upsert or update only
    documentId?: string; //doc Id to update
    parentId?: string; //parentId for the created doc
}

export enum WorkflowExecutionStatus {
    UNKNOWN = 0,
    RUNNING = 1,
    COMPLETED = 2,
    FAILED = 3,
    CANCELED = 4,
    TERMINATED = 5,
    CONTINUED_AS_NEW = 6,
    TIMED_OUT = 7,
}

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
    details?: any;
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

// ============================================
// AGENT MESSAGE DETAIL TYPES & TYPE GUARDS
// ============================================

/**
 * Details for THOUGHT messages representing tool calls (event_class: 'activity').
 */
export interface ToolCallDetails {
    event_class: 'activity';
    tool: string;
    tool_run_id?: string;
    tool_status?: 'running' | 'completed' | 'error' | 'warning';
    tool_iteration?: number;
    activity_group_id?: string;
    activity_id?: string;
    files?: string[];
    outputFiles?: string[];
    [key: string]: unknown;
}

/**
 * Details for UPDATE messages signaling document creation or update.
 */
export interface DocumentEventDetails {
    event_class: 'document_created' | 'document_updated';
    document_id: string;
    title?: string;
    [key: string]: unknown;
}

/**
 * Details for REQUEST_INPUT messages with UX configuration.
 */
export interface RequestInputDetails {
    ux?: {
        options?: Array<{ id: string; label: string }>;
        variant?: string;
        multiSelect?: boolean;
        allowFreeResponse?: boolean;
        placeholder?: string;
    };
    [key: string]: unknown;
}

/**
 * Details for PLAN messages containing the plan structure.
 */
export interface PlanMessageDetails {
    plan: PlanTask[];
    comment?: string;
    [key: string]: unknown;
}

// Type guards — check both message type and details shape for safety

export function isToolCallMessage(msg: AgentMessage): msg is AgentMessage & { details: ToolCallDetails } {
    return msg.type === AgentMessageType.THOUGHT &&
        !!msg.details &&
        typeof msg.details === 'object' &&
        typeof msg.details.tool === 'string';
}

export function isDocumentEventMessage(msg: AgentMessage): msg is AgentMessage & { details: DocumentEventDetails } {
    return msg.type === AgentMessageType.UPDATE &&
        !!msg.details &&
        typeof msg.details === 'object' &&
        (msg.details.event_class === 'document_created' || msg.details.event_class === 'document_updated') &&
        typeof msg.details.document_id === 'string';
}

export function isFileProcessingMessage(msg: AgentMessage): msg is AgentMessage & { details: FileProcessingDetails } {
    return msg.type === AgentMessageType.SYSTEM &&
        !!msg.details &&
        typeof msg.details === 'object' &&
        msg.details.system_type === 'file_processing' &&
        Array.isArray(msg.details.files);
}

export function isPlanMessage(msg: AgentMessage): msg is AgentMessage & { details: PlanMessageDetails } {
    return msg.type === AgentMessageType.PLAN &&
        !!msg.details &&
        typeof msg.details === 'object' &&
        Array.isArray(msg.details.plan);
}

export function isRequestInputMessage(msg: AgentMessage): msg is AgentMessage & { details: RequestInputDetails } {
    return msg.type === AgentMessageType.REQUEST_INPUT &&
        !!msg.details &&
        typeof msg.details === 'object';
}

/**
 * Details for STREAMING_CHUNK messages used for real-time LLM response streaming
 * @deprecated Use CompactMessage with f field for streaming chunks
 */
export interface StreamingChunkDetails {
    /** Unique identifier grouping chunks from the same stream */
    streaming_id: string;
    /** Order of this chunk within the stream (0-indexed) */
    chunk_index: number;
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
export interface CompactMessage {
    /** Message type (integer enum) */
    t: AgentMessageType;
    /** Message content */
    m?: string;
    /** Workstream ID (only when not "main") */
    w?: string;
    /** Type-specific details */
    d?: unknown;
    /** Is final chunk (only for STREAMING_CHUNK, 0 or 1) */
    f?: 0 | 1;
    /** Timestamp (only for stored/persisted messages) */
    ts?: number;
    /** Activity ID for deduplication between streaming chunks and final messages */
    i?: string;
}

/**
 * Legacy message format for backward compatibility.
 * @deprecated Use CompactMessage instead
 */
export type LegacyAgentMessage = AgentMessage;

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
    'system': AgentMessageType.SYSTEM,
    'thought': AgentMessageType.THOUGHT,
    'plan': AgentMessageType.PLAN,
    'update': AgentMessageType.UPDATE,
    'complete': AgentMessageType.COMPLETE,
    'warning': AgentMessageType.WARNING,
    'error': AgentMessageType.ERROR,
    'answer': AgentMessageType.ANSWER,
    'question': AgentMessageType.QUESTION,
    'request_input': AgentMessageType.REQUEST_INPUT,
    'idle': AgentMessageType.IDLE,
    'terminated': AgentMessageType.TERMINATED,
    'streaming_chunk': AgentMessageType.STREAMING_CHUNK,
    'batch_progress': AgentMessageType.BATCH_PROGRESS,
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
        details?: unknown;
        isFinal?: boolean;
        timestamp?: number;
    } = {}
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

    if (compact.d !== undefined) message.details = compact.d;

    // For streaming chunks, restore is_final and streaming_id in details
    // (streaming_id removed from wire format, use workstream_id as grouping key)
    if (compact.t === AgentMessageType.STREAMING_CHUNK) {
        message.details = {
            ...(typeof compact.d === 'object' ? compact.d : {}),
            streaming_id: compact.w || 'main', // Use workstream_id as streaming_id
            is_final: compact.f === 1,
            activity_id: compact.i, // For deduplication with final THOUGHT/ANSWER
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
    status: "pending" | "running" | "success" | "error";
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
    UPLOADING = "uploading",
    /** File uploaded, text extraction in progress */
    PROCESSING = "processing",
    /** File is ready for use in conversation */
    READY = "ready",
    /** File processing failed */
    ERROR = "error",
}

/**
 * Represents a file being processed in a conversation workflow.
 */
export interface ConversationFile {
    /** Unique ID for tracking this file (generated client-side) */
    id: string;
    /** Original filename */
    name: string;
    /** MIME type */
    content_type: string;
    /** Size in bytes */
    size: number;
    /** Current processing status */
    status: FileProcessingStatus;
    /** Artifact path (e.g., "files/document.pdf") - set after upload */
    artifact_path?: string;
    /** Full artifact reference URI (e.g., "artifact:files/document.pdf") */
    reference?: string;
    /** Path to extracted text markdown (e.g., "files/document.pdf.md") */
    md_path?: string;
    /** Whether text extraction completed successfully */
    text_extracted?: boolean;
    /** Error message if status is ERROR */
    error?: string;
    /** Timestamp when upload started */
    started_at: number;
    /** Timestamp when processing completed */
    completed_at?: number;
}

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
 * Get the Redis pub/sub channel name for workflow messages.
 * Used by both publishers (workflow activities, studio-server) and subscribers (zeno-server, clients).
 * @param workflowRunId - The Temporal workflow run ID (NOT the interaction execution run ID)
 */
export function getWorkflowChannel(workflowRunId: string): string {
    return `workflow:${workflowRunId}:channel`;
}

/**
 * Get the Redis list key for storing workflow message history.
 * Messages are stored here for retrieval by reconnecting clients.
 * @param workflowRunId - The Temporal workflow run ID (NOT the interaction execution run ID)
 */
export function getWorkflowUpdatesKey(workflowRunId: string): string {
    return `workflow:${workflowRunId}:updates`;
}

export interface PlanTask {
    id: number;
    goal: string;
    instructions: string[];
    comment?: string;
    status?: "pending" | "in_progress" | "completed" | "skipped";
}

export interface Plan {
    plan: PlanTask[];
    comment?: string;
}

export const LOW_PRIORITY_TASK_QUEUE = "low_priority";

/**
 * WebSocket message types for bidirectional communication
 */
export interface WebSocketSignalMessage {
    type: 'signal';
    signalName: string;
    data: any;
    requestId?: string | number;
}

export interface WebSocketPingMessage {
    type: 'ping';
}

export interface WebSocketPongMessage {
    type: 'pong';
}

export interface WebSocketAckMessage {
    type: 'ack';
    requestId: string | number;
}

export interface WebSocketErrorMessage {
    type: 'error';
    requestId?: string | number;
    error: string;
}

export type WebSocketClientMessage =
    | WebSocketSignalMessage
    | WebSocketPingMessage;

export type WebSocketServerMessage =
    | WebSocketPongMessage
    | WebSocketAckMessage
    | WebSocketErrorMessage
    | AgentMessage;

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
    model_options?: Record<string, unknown>;

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
}

// ---------------------------------------------------------------------------
// Workstream query types (used by client helpers)
// ---------------------------------------------------------------------------

/** Progress reported by a child workstream */
export interface WorkstreamProgressInfo {
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
}

/** Result of the ActiveWorkstreams Temporal query */
export interface ActiveWorkstreamsQueryResult {
    running: ActiveWorkstreamEntry[];
}
