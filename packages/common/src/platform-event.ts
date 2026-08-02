import type { z } from 'zod';
import type { EventRefSchema } from './api-schemas/app-lifecycle.js';
import type { EventCategorySchema } from './api-schemas/audit-trail.js';
import type {
    AgentDeliveryMatchModeSchema,
    AgentEventDeliveryTargetSchema,
    AgentSemanticEvaluatorSchema,
    CreateEventIngestChannelPayloadSchema,
    EventDeliveryIntentStatusSchema,
    EventDeliveryIntentSummarySchema,
    EventDeliveryQueueFailureSummarySchema,
    EventDeliveryQueueSortFieldSchema,
    EventDeliveryQueueSubscriptionSummarySchema,
    EventDeliveryQueueSummaryPayloadSchema,
    EventDeliveryQueueSummaryResponseSchema,
    EventDeliverySortFieldSchema,
    EventDeliverySummarySchema,
    EventIngestChannelMutationResponseSchema,
    EventIngestChannelSchema,
    EventIngestResourceRuleSchema,
    EventIngestSignatureAlgorithmSchema,
    EventIngestSignatureConfigSchema,
    EventIngestSignatureEncodingSchema,
    EventIngestTransformSchema,
    EventOutboxQueueSummarySchema,
    EventOutboxStatusSchema,
    EventPrioritySchema,
    EventSemanticConditionSchema,
    EventSubscriptionFilterSchema,
    InteractionSemanticEvaluatorSchema,
    ListEventDeliveriesPayloadSchema,
    ListEventDeliveriesResponseSchema,
    SemanticConditionModeSchema,
    SemanticConditionOnErrorSchema,
    SemanticEvaluationRecordSchema,
    SemanticEvaluationStatusSchema,
    SemanticEvaluatorSchema,
    StreamEventDeliveriesQuerySchema,
    UpdateEventIngestChannelPayloadSchema,
    WebhookEventDeliveryTargetInputSchema,
    WebhookEventDeliveryTargetSchema,
    WebhookPayloadModeSchema,
    WebhookSigningModeSchema,
    WorkflowEventDeliveryTargetInputSchema,
    WorkflowEventDeliveryTargetSchema,
} from './api-schemas/events.js';
import type { AuditMeter } from './audit-trail.js';
import type { ConversationVisibility } from './interaction.js';
import type { SystemRoles } from './project.js';
import type { GroundedVerificationBreakdown, ProcessDefinitionBody, ProcessRunType } from './store/index.js';

// Inferred from `./api-schemas/audit-trail.js`, which is where the schema sits: the audit trail is
// the only place the category is published, and the converter grouped it with the endpoints that
// publish it rather than with the event types that carry it.
export type EventCategory = z.infer<typeof EventCategorySchema>;

export type EventPriority = z.infer<typeof EventPrioritySchema>;

export type WebhookSigningMode = z.infer<typeof WebhookSigningModeSchema>;

export type WebhookPayloadMode = z.infer<typeof WebhookPayloadModeSchema>;

export type EventOutboxStatus = z.infer<typeof EventOutboxStatusSchema>;

export type EventDeliveryIntentStatus = z.infer<typeof EventDeliveryIntentStatusSchema>;

export type EventRef = z.infer<typeof EventRefSchema>;

export interface PlatformEvent extends EventRef {
    timestamp: string;
    source: string;
    audit_trail?: boolean;
    replay_of?: string;
    replay_root_event_id?: string;
    replayed_by?: string;
    request_id?: string | null;
    status?: number;
    success?: boolean;
    principal_id?: string | null;
    principal_type?: string | null;
    effective_principal_id?: string | null;
    roles?: string[];
    account_name?: string | null;
    project_name?: string | null;
    provider?: string | null;
    meters?: AuditMeter[];
    resource_data?: Record<string, unknown>;
    resource_version?: string;
    details?: Record<string, unknown>;
}

/**
 * Lifecycle actions published by the workflow completion interceptor. The names intentionally
 * match the legacy notify_endpoints event_name values so migrated webhook subscribers receive
 * byte-identical status/event_name fields.
 */
export type WorkflowLifecycleAction = 'workflow_completed' | 'workflow_failed';

export interface DocumentProcessingModelUsage {
    role: 'extraction' | 'review';
    run_id: string;
    model?: string;
    environment_id?: string;
    provider?: string;
}

/** Compact, content-free operational summary emitted after grounded IDP completes. */
export interface DocumentProcessedEventData {
    schema_version: 1;
    pipeline: 'grounded_extraction';
    object_id: string;
    page_count: number;
    ocr_page_count: number;
    vision_page_count: number;
    property_count: number;
    citation_count: number;
    verification: GroundedVerificationBreakdown;
    result_path: string;
    confidence?: number;
    coverage_min?: number;
    hardness?: number;
    escalated?: boolean;
    reviewed?: boolean;
    review_issue_count?: number;
    verdict?: 'good_to_go' | 'needs_review';
    verdict_reason?: string;
    models_used?: DocumentProcessingModelUsage[];
    review_agent_run_id?: string;
}

/**
 * Resource flavor of a workflow lifecycle event, derived from the Temporal workflow type:
 * ExecuteConversationWorkflow -> agent_run, ExecuteProcessWorkflow -> process_run,
 * document-scoped workflows may use content_object, and anything else -> workflow_run.
 */
export type WorkflowLifecycleResourceType = 'workflow_run' | 'agent_run' | 'process_run' | 'content_object';

/**
 * Body of POST /internal/events/publish (zeno-server, workload-identity gated). Sent by Temporal
 * workers to publish a workflow lifecycle event to the event bus; the server fills event ids,
 * tenant, timestamp and causality from caused_by.
 */
export interface PublishWorkflowLifecycleEventRequest {
    account_id: string;
    project_id: string;
    action: WorkflowLifecycleAction;
    resource_type: WorkflowLifecycleResourceType;
    /** Domain resource the workflow acted on. Defaults to workflow_id for workflow-scoped events. */
    resource_id?: string;
    workflow_id: string;
    workflow_run_id: string;
    workflow_type: string;
    /** Rule/subscription name that started the run (payload.wf_rule_name), used for filtering. */
    workflow_rule_name?: string;
    initiated_by?: string;
    /** Workflow return value for completed runs. */
    result?: unknown;
    /** Error message for failed runs. */
    error?: string;
    /** EventRef of the event that started the workflow (payload.vars.event_ref), if any. */
    caused_by?: EventRef;
    /** Optional IDP outcome published as a separate, subscribable content event. */
    document_processed?: DocumentProcessedEventData;
}

/**
 * A provider-neutral external work-item thread identity. The pair `(resource_type, resource_id)`
 * derives a stable `eventThreadTag` (see `@dglabs/event-bus`), so all events of the same thread
 * correlate to one agent run.
 */
export interface EventThreadRef {
    resource_type: string;
    resource_id: string;
}

/**
 * Body of the internal, workload-identity-gated run-threads endpoint. Sent by a Temporal worker so an
 * agent run can register additional external-thread identities on **itself** mid-run, so later events on
 * those threads route to the same run. The server computes the thread tags from `(account, project,
 * resource_type, resource_id)` and idempotently appends them to the run; the worker never supplies a raw
 * tag.
 */
export interface AppendAgentRunThreadsRequest {
    account_id: string;
    project_id: string;
    threads: EventThreadRef[];
}

export interface AppendAgentRunThreadsResponse {
    /** The thread tags that are now present on the run (the full event-thread tag set). */
    thread_tags: string[];
}

export type EventSubscriptionFilter = z.infer<typeof EventSubscriptionFilterSchema>;

// --- Semantic conditions ---
// A semantic_condition is an LLM-evaluated natural-language predicate applied AFTER all structural
// filters (categories, actions, resource types, JSONLogic condition) have matched.

export type SemanticConditionMode = z.infer<typeof SemanticConditionModeSchema>;

export type SemanticConditionOnError = z.infer<typeof SemanticConditionOnErrorSchema>;

export type SemanticEvaluationStatus = z.infer<typeof SemanticEvaluationStatusSchema>;

export type InteractionSemanticEvaluator = z.infer<typeof InteractionSemanticEvaluatorSchema>;

export type AgentSemanticEvaluator = z.infer<typeof AgentSemanticEvaluatorSchema>;

export type SemanticEvaluator = z.infer<typeof SemanticEvaluatorSchema>;

export type EventSemanticCondition = z.infer<typeof EventSemanticConditionSchema>;

export type SemanticEvaluationRecord = z.infer<typeof SemanticEvaluationRecordSchema>;

export type WorkflowEventDeliveryTarget = z.infer<typeof WorkflowEventDeliveryTargetSchema>;

export type WebhookEventDeliveryTarget = z.infer<typeof WebhookEventDeliveryTargetSchema>;

export const DEFAULT_EVENT_AGENT_INTERACTION_REF = 'sys:GeneralAgent';

export type AgentDeliveryMatchMode = z.infer<typeof AgentDeliveryMatchModeSchema>;

export type AgentEventDeliveryTarget = z.infer<typeof AgentEventDeliveryTargetSchema>;

export interface ProcessEventDeliveryTarget {
    type: 'process';
    /**
     * Stored process ID, app ref, or system ref. Required unless process_definition is supplied.
     */
    process_ref?: string;
    process_version?: number;
    process_definition?: ProcessDefinitionBody;
    run_type?: ProcessRunType;
    data?: Record<string, unknown>;
    config?: Record<string, unknown>;
    visibility?: ConversationVisibility;
    tags?: string[];
    categories?: string[];
}

export type EventDeliveryTarget =
    | WorkflowEventDeliveryTarget
    | WebhookEventDeliveryTarget
    | AgentEventDeliveryTarget
    | ProcessEventDeliveryTarget;

// --- Input (write) target shapes ---
// The full target types above are the read model (include server-managed fields). Create/update
// callers supply the input shapes below: server-managed fields (has_secret, secret_label,
// migrated_rule_name) are omitted, and write-only directives (rotate_signing_secret) are added.

export type WorkflowEventDeliveryTargetInput = z.infer<typeof WorkflowEventDeliveryTargetInputSchema>;

export type WebhookEventDeliveryTargetInput = z.infer<typeof WebhookEventDeliveryTargetInputSchema>;

export type EventDeliveryTargetInput =
    | WorkflowEventDeliveryTargetInput
    | WebhookEventDeliveryTargetInput
    | AgentEventDeliveryTarget
    | ProcessEventDeliveryTarget;

export interface MatchedEventSubscriptionSnapshot {
    subscription_id: string;
    subscription_name: string;
    target: EventDeliveryTarget;
    priority: EventPriority;
    run_as_role: SystemRoles;
    /** Semantic condition carried from the subscription filter, evaluated at delivery time. */
    semantic_condition?: EventSemanticCondition;
}

export interface EventSubscription {
    id: string;
    name: string;
    description?: string;
    account_id: string;
    project_id?: string;
    scope: 'account' | 'project';
    filter: EventSubscriptionFilter;
    target: EventDeliveryTarget;
    run_as_role: SystemRoles;
    is_system: boolean;
    protected: boolean;
    enabled: boolean;
    priority?: EventPriority;
    created_by?: string;
    updated_by?: string;
    created_at?: string;
    updated_at?: string;
    migrated_from_workflow_rule_id?: string;
    /**
     * System subscription ID replaced by this stored subscription. Set only for
     * tenant-specific system overrides created by migrations or platform code.
     */
    overrides_system_subscription_id?: string;
    /**
     * True when this system subscription was created from a legacy customer override.
     */
    customer_override?: boolean;
}

export interface CreateEventSubscriptionPayload {
    name: string;
    description?: string;
    scope?: 'account' | 'project';
    filter: EventSubscriptionFilter;
    target: EventDeliveryTargetInput;
    /** Identity the delivery runs as. Required at creation so a subscription never silently runs as the originating (possibly deleted) user. Use "automation" for the standard identity. */
    run_as_role: SystemRoles;
    enabled?: boolean;
    priority?: EventPriority;
}

// Update is Create made partial, minus `scope` (scope is fixed at creation).
export interface UpdateEventSubscriptionPayload {
    name?: string;
    description?: string;
    filter?: EventSubscriptionFilter;
    target?: EventDeliveryTargetInput;
    run_as_role?: SystemRoles;
    enabled?: boolean;
    priority?: EventPriority;
}

export interface EventSubscriptionMutationResponse {
    subscription: EventSubscription;
    webhook_signing_secret?: string;
}

export type EventDeliveryIntentSummary = z.infer<typeof EventDeliveryIntentSummarySchema>;

export type EventDeliverySummary = z.infer<typeof EventDeliverySummarySchema>;

export type EventDeliverySortField = z.infer<typeof EventDeliverySortFieldSchema>;

export type ListEventDeliveriesPayload = z.infer<typeof ListEventDeliveriesPayloadSchema>;

export type ListEventDeliveriesResponse = z.infer<typeof ListEventDeliveriesResponseSchema>;

export type StreamEventDeliveriesQuery = z.infer<typeof StreamEventDeliveriesQuerySchema>;

export interface EventDeliveryStreamItem {
    cursor: string;
    delivery: EventDeliverySummary;
    event?: PlatformEvent;
}

export interface EventDeliveryStreamSnapshot {
    type: 'snapshot';
    emitted_at: string;
    cursor?: string;
    deliveries: EventDeliveryStreamItem[];
}

export interface EventDeliveryStreamUpdate {
    type: 'event';
    emitted_at: string;
    cursor: string;
    item: EventDeliveryStreamItem;
}

export interface EventDeliveryStreamHeartbeat {
    type: 'heartbeat';
    emitted_at: string;
    cursor?: string;
}

export interface EventDeliveryStreamError {
    type: 'error';
    emitted_at: string;
    cursor?: string;
    error: string;
}

export type EventDeliveryStreamEnvelope =
    | EventDeliveryStreamSnapshot
    | EventDeliveryStreamUpdate
    | EventDeliveryStreamHeartbeat
    | EventDeliveryStreamError;

export type EventSubscriptionSortField = 'name' | 'scope' | 'target_type' | 'enabled' | 'updated_at';

export interface ListEventSubscriptionsQuery {
    enabled?: boolean;
    target_type?: EventDeliveryTarget['type'][];
    scope?: ('account' | 'project')[];
    sort_by?: EventSubscriptionSortField;
    sort_order?: 'asc' | 'desc';
}

export type EventIngestChannelSortField = 'name' | 'source' | 'enabled' | 'updated_at';

export interface ListEventIngestChannelsQuery {
    enabled?: boolean;
    source?: string[];
    sort_by?: EventIngestChannelSortField;
    sort_order?: 'asc' | 'desc';
}

export type EventDeliveryQueueSortField = z.infer<typeof EventDeliveryQueueSortFieldSchema>;

export type EventDeliveryQueueSummaryPayload = z.infer<typeof EventDeliveryQueueSummaryPayloadSchema>;

export type EventOutboxQueueSummary = z.infer<typeof EventOutboxQueueSummarySchema>;

export type EventDeliveryQueueFailureSummary = z.infer<typeof EventDeliveryQueueFailureSummarySchema>;

export type EventDeliveryQueueSubscriptionSummary = z.infer<typeof EventDeliveryQueueSubscriptionSummarySchema>;

export type EventDeliveryQueueSummaryResponse = z.infer<typeof EventDeliveryQueueSummaryResponseSchema>;

export interface PublishPlatformEventPayload {
    event: PlatformEvent;
    priority?: EventPriority;
}

export interface PublishPlatformEventResponse {
    event_id: string;
    outbox_id?: string;
    status: EventOutboxStatus;
    matched_subscription_count: number;
    materialized_intent_count: number;
}

export interface WorkflowEventInput<T = Record<string, unknown>> {
    event_ref: EventRef;
    payload: T;
}

// --- External event ingest channels ---
// An ingest channel is a token-authenticated inbound endpoint that lets external systems publish
// events into the platform event bus. Ingested events get event_category 'external' and
// source 'external:<source>', and match event subscriptions like any other platform event.

export type EventIngestResourceRule = z.infer<typeof EventIngestResourceRuleSchema>;

export type EventIngestTransform = z.infer<typeof EventIngestTransformSchema>;

export type EventIngestSignatureAlgorithm = z.infer<typeof EventIngestSignatureAlgorithmSchema>;

export type EventIngestSignatureEncoding = z.infer<typeof EventIngestSignatureEncodingSchema>;

export type EventIngestSignatureConfig = z.infer<typeof EventIngestSignatureConfigSchema>;

export type EventIngestChannel = z.infer<typeof EventIngestChannelSchema>;

export type CreateEventIngestChannelPayload = z.infer<typeof CreateEventIngestChannelPayloadSchema>;

export type UpdateEventIngestChannelPayload = z.infer<typeof UpdateEventIngestChannelPayloadSchema>;

export type EventIngestChannelMutationResponse = z.infer<typeof EventIngestChannelMutationResponseSchema>;

/**
 * Body accepted by the public ingest webhook
 * `POST /webhooks/events/:accountId/:projectId/:channelId`. All fields are optional: when omitted the
 * channel transform / defaults are applied. The raw body is preserved under `event.details.payload`.
 */
export interface IngestExternalEventPayload {
    action?: string;
    resource_type?: string;
    resource_id?: string;
    /** Domain payload; defaults to the full raw body when omitted. */
    payload?: Record<string, unknown>;
    /** Extra fields merged into `event.details`. */
    details?: Record<string, unknown>;
    /** Deduplication key: the same key produces the same event id. */
    idempotency_key?: string;
    /** ISO 8601 event timestamp; defaults to ingest time. */
    timestamp?: string;
}

export interface IngestExternalEventResponse {
    event_id: string;
}
