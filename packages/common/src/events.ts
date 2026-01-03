/**
 * Unified Event Pipeline Types
 *
 * Event types for the Vertesia event system. All events flow through a common
 * pipeline with Temporal workflows ensuring reliable webhook delivery.
 */

// ==================== Event Types & Categories ====================

export enum EventType {
    // Ask User events
    AskUserRequested = 'ask_user.requested',
    AskUserResolved = 'ask_user.resolved',
    // Agent Run events
    AgentRunStarted = 'agent_run.started',
    AgentRunCompleted = 'agent_run.completed',
    AgentRunFailed = 'agent_run.failed',
    // Document events
    DocumentCreated = 'document.created',
    DocumentDeleted = 'document.deleted',
}

export enum EventCategory {
    AskUser = 'ask_user',
    AgentRun = 'agent_run',
    Document = 'document',
}

/**
 * Get the category for an event type.
 */
export function getEventCategory(type: EventType): EventCategory {
    if (type.startsWith('ask_user.')) return EventCategory.AskUser;
    if (type.startsWith('agent_run.')) return EventCategory.AgentRun;
    if (type.startsWith('document.')) return EventCategory.Document;
    throw new Error(`Unknown event type: ${type}`);
}

// ==================== Event Envelope ====================

export interface EventMetadata {
    /** Source of the event */
    source?: 'workflow' | 'api' | 'activity';
    /** Temporal workflow run ID */
    workflowRunId?: string;
    /** Workflow definition ID */
    workflowId?: string;
    /** Name of the agent that triggered the event */
    agentName?: string;
    /** Correlation ID for tracking related events */
    correlationId?: string;
}

/**
 * Standard event envelope that wraps all events.
 */
export interface EventEnvelope<T = unknown> {
    /** Unique event ID (UUID) */
    id: string;
    /** Event type */
    type: EventType;
    /** Event category */
    category: EventCategory;
    /** ISO 8601 timestamp */
    timestamp: string;
    /** Account ID */
    accountId: string;
    /** Project ID */
    projectId: string;
    /** Event-specific payload */
    payload: T;
    /** Optional metadata */
    metadata?: EventMetadata;
}

// ==================== Channel Info for Webhooks ====================

/**
 * Simplified channel info for webhook payloads.
 * Contains only the information relevant for external systems.
 */
export interface WebhookChannelInfo {
    type: 'email' | 'interactive';
    email?: string;
}

// ==================== Event Payloads ====================

/**
 * Question structure for ask_user events.
 */
export interface AskUserQuestion {
    /** Question ID */
    id: string;
    /** Question text */
    question: string;
}

/**
 * Channel notification info for ask_user events.
 */
export interface AskUserChannels {
    /** Whether UI was notified */
    ui?: boolean;
    /** Whether email was sent */
    email?: boolean;
}

/**
 * Payload for ask_user.requested event.
 * Fired when an agent calls ask_user and is waiting for user input.
 */
export interface AskUserRequestedPayload {
    /** Unique ID for this ask (used to resolve it) */
    askId: string;
    /** Temporal workflow run ID */
    runId: string;
    /** Workflow definition ID */
    workflowId: string;
    /** Name of the agent asking */
    agentName: string;
    /** Whether this is an interactive (chat) run */
    interactive?: boolean;
    /** Questions being asked */
    questions: AskUserQuestion[];
    /** Channels that were notified */
    channels?: AskUserChannels;
    /** Timeout in milliseconds before the ask expires */
    timeout?: number;
}

/**
 * Payload for ask_user.resolved event.
 * Fired when a user responds to an ask_user request.
 */
export interface AskUserResolvedPayload {
    /** The ask ID that was resolved */
    askId: string;
    /** Temporal workflow run ID */
    runId: string;
    /** Workflow definition ID */
    workflowId: string;
    /** Name of the agent that asked */
    agentName: string;
    /** Resolution status */
    status: 'answered' | 'timeout' | 'cancelled';
    /** User's responses (if answered) */
    responses?: string[];
    /** How the response was submitted */
    responseSource?: 'ui' | 'email' | 'api';
}

/**
 * Payload for agent_run.started event.
 * Fired when an agent run begins execution.
 */
export interface AgentRunStartedPayload {
    /** Temporal workflow run ID */
    runId: string;
    /** Workflow definition ID */
    workflowId: string;
    /** Name of the agent */
    agentName: string;
    /** Whether this is an interactive (chat) run */
    interactive: boolean;
    /** Model being used */
    model?: string;
    /** Environment name */
    environment?: string;
}

/**
 * Payload for agent_run.completed event.
 * Fired when an agent run completes successfully.
 */
export interface AgentRunCompletedPayload {
    /** Temporal workflow run ID */
    runId: string;
    /** Workflow definition ID */
    workflowId: string;
    /** Name of the agent */
    agentName: string;
    /** Whether this was an interactive (chat) run */
    interactive: boolean;
    /** Total execution duration (milliseconds) */
    durationMs: number;
    /** Token usage statistics */
    tokenUsage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    /** Number of tool calls made */
    toolCallCount?: number;
}

/**
 * Payload for agent_run.failed event.
 * Fired when an agent run fails.
 */
export interface AgentRunFailedPayload {
    /** Temporal workflow run ID */
    runId: string;
    /** Workflow definition ID */
    workflowId: string;
    /** Name of the agent */
    agentName: string;
    /** Whether this was an interactive (chat) run */
    interactive: boolean;
    /** Error code */
    errorCode?: string;
    /** Error message */
    errorMessage: string;
    /** Duration before failure (milliseconds) */
    durationMs?: number;
}

/**
 * Payload for document.created event.
 * Fired when a new document is created in the project.
 */
export interface DocumentCreatedPayload {
    /** Document ID */
    documentId: string;
    /** Document name/title */
    name?: string;
    /** Document type ID (if typed) */
    typeId?: string;
    /** Document type name (if typed) */
    typeName?: string;
    /** MIME type of the content */
    mimeType?: string;
    /** Size in bytes (if known) */
    size?: number;
    /** User who created the document */
    createdBy?: string;
    /** Source of the document (upload, api, workflow, etc.) */
    source?: string;
}

/**
 * Payload for document.deleted event.
 * Fired when a document is deleted from the project.
 */
export interface DocumentDeletedPayload {
    /** Document ID */
    documentId: string;
    /** Document name/title (at time of deletion) */
    name?: string;
    /** Document type ID (if typed) */
    typeId?: string;
    /** Document type name (if typed) */
    typeName?: string;
    /** User who deleted the document */
    deletedBy?: string;
}

// ==================== Webhook Subscription ====================

/**
 * Filters to apply when matching events to subscriptions.
 */
export interface EventFilter {
    /** Only match events from these agents */
    agentNames?: string[];
    /** For agent_run events: filter by completion status */
    status?: ('success' | 'failure')[];
    /** For agent_run events: filter by interactive mode */
    interactive?: boolean;
}

/**
 * Retry configuration for webhook delivery.
 */
export interface WebhookRetryConfig {
    /** Maximum number of retry attempts (default: 3) */
    maxAttempts?: number;
    /** Initial retry interval in seconds (default: 10) */
    initialIntervalSecs?: number;
    /** Maximum retry interval in seconds (default: 300) */
    maxIntervalSecs?: number;
}

/**
 * Webhook subscription configuration.
 * Stored in MongoDB, defines how events should be delivered.
 */
export interface WebhookSubscription {
    /** Unique subscription ID */
    id: string;
    /** Account ID */
    accountId: string;
    /** Project ID */
    projectId: string;
    /** Human-readable name */
    name: string;
    /** Whether the subscription is active */
    enabled: boolean;
    /** Event types to subscribe to */
    eventTypes: EventType[];
    /** Optional filters to apply */
    filters?: EventFilter;
    /** Webhook endpoint URL */
    url: string;
    /** Secret for HMAC signature (Svix format: whsec_...) */
    secret?: string;
    /** Custom headers to include in requests */
    headers?: Record<string, string>;
    /** Retry configuration */
    retry?: WebhookRetryConfig;
    /** When the subscription was created */
    createdAt: Date;
    /** When the subscription was last updated */
    updatedAt: Date;
    /** User who created the subscription */
    createdBy: string;
    /** User who last updated the subscription */
    updatedBy?: string;
}

// ==================== Webhook Delivery ====================

export type WebhookDeliveryStatus = 'pending' | 'success' | 'failed';

/**
 * Record of a webhook delivery attempt.
 * Stored transiently in Redis for debugging.
 */
export interface WebhookDelivery {
    /** Unique delivery ID */
    id: string;
    /** Subscription ID */
    subscriptionId: string;
    /** Event ID */
    eventId: string;
    /** Event type */
    eventType: EventType;
    /** Delivery status */
    status: WebhookDeliveryStatus;
    /** HTTP status code (if delivered) */
    statusCode?: number;
    /** Number of attempts made */
    attemptCount: number;
    /** Error message (if failed) */
    error?: string;
    /** Request latency in milliseconds */
    latencyMs?: number;
    /** When the delivery was first attempted */
    createdAt: string;
    /** When the delivery was last updated */
    updatedAt: string;
}

/**
 * Detailed delivery information including request/response.
 */
export interface WebhookDeliveryDetails extends WebhookDelivery {
    /** Request headers sent */
    requestHeaders?: Record<string, string>;
    /** Response headers received */
    responseHeaders?: Record<string, string>;
    /** Response body (truncated if large) */
    responseBody?: string;
}

// ==================== API Request/Response Types ====================

export interface CreateSubscriptionRequest {
    name: string;
    eventTypes: EventType[];
    url: string;
    filters?: EventFilter;
    headers?: Record<string, string>;
    retry?: WebhookRetryConfig;
    /** If true, generate a secret automatically */
    generateSecret?: boolean;
}

export interface UpdateSubscriptionRequest {
    name?: string;
    enabled?: boolean;
    eventTypes?: EventType[];
    url?: string;
    filters?: EventFilter;
    headers?: Record<string, string>;
    retry?: WebhookRetryConfig;
}

export interface ListSubscriptionsResponse {
    subscriptions: WebhookSubscription[];
}

export interface RotateSecretResponse {
    /** New secret (only shown once) */
    secret: string;
}

export interface TestWebhookResponse {
    success: boolean;
    statusCode?: number;
    error?: string;
    latencyMs?: number;
}

export interface EmitEventRequest<T = unknown> {
    type: EventType;
    payload: T;
    metadata?: Omit<EventMetadata, 'source'>;
}

export interface EmitEventResponse {
    accepted: boolean;
    eventId: string;
}

// ==================== Pending Ask Storage ====================

/**
 * Data stored in Redis for pending ask_user requests.
 * Used to track and resolve asks from the portal.
 */
export interface PendingAskData {
    askId: string;
    runId: string;
    workflowId: string;
    projectId: string;
    accountId: string;
    agentName: string;
    questions: AskUserQuestion[];
    timeout?: number;
    channels?: AskUserChannels;
    createdAt: number;
    expiresAt?: number;
    status: 'pending' | 'resolved' | 'expired';
    resolvedAt?: number;
    responses?: string[];
}

export interface ListPendingAsksResponse {
    asks: PendingAskData[];
}
