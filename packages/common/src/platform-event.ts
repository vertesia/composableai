import type { z } from 'zod';
import type { EventRefSchema } from './api-schemas/app-lifecycle.js';
import type { EventCategorySchema } from './api-schemas/audit-trail.js';
import type {
    AgentDeliveryMatchModeSchema,
    AgentEventDeliveryTargetSchema,
    AgentSemanticEvaluatorSchema,
    CancelEventDeliveryIntentsPayloadSchema,
    CancelEventDeliveryIntentsResponseSchema,
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
import type { ProcessDefinitionBody, ProcessRunType } from './store/index.js';

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

interface EventDeliveryStreamHeartbeat {
    type: 'heartbeat';
    emitted_at: string;
    cursor?: string;
}

interface EventDeliveryStreamError {
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

export type CancelEventDeliveryIntentsPayload = z.infer<typeof CancelEventDeliveryIntentsPayloadSchema>;

export type CancelEventDeliveryIntentsResponse = z.infer<typeof CancelEventDeliveryIntentsResponseSchema>;

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
