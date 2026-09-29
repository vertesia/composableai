import type { AuditMeter } from './audit-trail.js';
import type { ConversationVisibility } from './interaction.js';
import type { SystemRoles } from './project.js';
import type { ProcessDefinitionBody, ProcessRunType } from './store/index.js';
import type * as Wire from './wire-types.generated.js';

// Inferred from `./api-schemas/audit-trail.js`, which is where the schema sits: the audit trail is
// the only place the category is published, and the converter grouped it with the endpoints that
// publish it rather than with the event types that carry it.
export type EventCategory = Wire.EventCategory;

export type EventPriority = Wire.EventPriority;

export type WebhookSigningMode = Wire.WebhookSigningMode;

export type WebhookPayloadMode = Wire.WebhookPayloadMode;

export type EventOutboxStatus = Wire.EventOutboxStatus;

export type EventDeliveryIntentStatus = Wire.EventDeliveryIntentStatus;

export type EventRef = Wire.EventRef;

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

export type EventSubscriptionFilter = Wire.EventSubscriptionFilter;

// --- Semantic conditions ---
// A semantic_condition is an LLM-evaluated natural-language predicate applied AFTER all structural
// filters (categories, actions, resource types, JSONLogic condition) have matched.

export type SemanticConditionMode = Wire.SemanticConditionMode;

export type SemanticConditionOnError = Wire.SemanticConditionOnError;

export type SemanticEvaluationStatus = Wire.SemanticEvaluationStatus;

export type InteractionSemanticEvaluator = Wire.InteractionSemanticEvaluator;

export type AgentSemanticEvaluator = Wire.AgentSemanticEvaluator;

export type SemanticEvaluator = Wire.SemanticEvaluator;

export type EventSemanticCondition = Wire.EventSemanticCondition;

export type SemanticEvaluationRecord = Wire.SemanticEvaluationRecord;

export type WorkflowEventDeliveryTarget = Wire.WorkflowEventDeliveryTarget;

export type WebhookEventDeliveryTarget = Wire.WebhookEventDeliveryTarget;

export type AppEventDeliveryTarget = Wire.AppEventDeliveryTarget;

export const DEFAULT_EVENT_AGENT_INTERACTION_REF = 'sys:GeneralAgent';

export type AgentDeliveryMatchMode = Wire.AgentDeliveryMatchMode;

export type AgentEventDeliveryTarget = Wire.AgentEventDeliveryTarget;

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
    | AppEventDeliveryTarget
    | AgentEventDeliveryTarget
    | ProcessEventDeliveryTarget;

// --- Input (write) target shapes ---
// The full target types above are the read model (include server-managed fields). Create/update
// callers supply the input shapes below: server-managed fields (has_secret, secret_label,
// migrated_rule_name) are omitted, and write-only directives (rotate_signing_secret) are added.

export type WorkflowEventDeliveryTargetInput = Wire.WorkflowEventDeliveryTargetInput;

export type WebhookEventDeliveryTargetInput = Wire.WebhookEventDeliveryTargetInput;

export type AppEventDeliveryTargetInput = Wire.AppEventDeliveryTargetInput;

export type EventDeliveryTargetInput =
    | WorkflowEventDeliveryTargetInput
    | WebhookEventDeliveryTargetInput
    | AppEventDeliveryTargetInput
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
    app_installation_id?: string;
    app_id?: string;
    app_subscription_id?: string;
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

export type EventDeliveryIntentSummary = Wire.EventDeliveryIntentSummary;

export type EventDeliverySummary = Wire.EventDeliverySummary;

export type EventDeliverySortField = Wire.EventDeliverySortField;

export type ListEventDeliveriesPayload = Wire.ListEventDeliveriesPayload;

export type ListEventDeliveriesResponse = Wire.ListEventDeliveriesResponse;

export type StreamEventDeliveriesQuery = Wire.StreamEventDeliveriesQuery;

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
    app_installation_id?: string;
}

/** Trusted Studio -> Zeno request used to provision subscriptions declared by an installed app. */
export interface ProvisionAppEventSubscriptionsRequest {
    account_id: string;
    project_id: string;
    subscriptions: Array<
        CreateEventSubscriptionPayload & {
            target: AppEventDeliveryTargetInput;
            app_installation_id: string;
            app_id: string;
            app_subscription_id: string;
        }
    >;
}

/** Trusted Studio -> Zeno request used to remove every subscription owned by an app installation. */
export interface RemoveAppEventSubscriptionsRequest {
    account_id: string;
    project_id: string;
    app_installation_id: string;
}

export interface AppEventSubscriptionsMutationResponse {
    subscription_ids: string[];
}

export type EventIngestChannelSortField = 'name' | 'source' | 'enabled' | 'updated_at';

export interface ListEventIngestChannelsQuery {
    enabled?: boolean;
    source?: string[];
    sort_by?: EventIngestChannelSortField;
    sort_order?: 'asc' | 'desc';
}

export type EventDeliveryQueueSortField = Wire.EventDeliveryQueueSortField;

export type EventDeliveryQueueSummaryPayload = Wire.EventDeliveryQueueSummaryPayload;

export type EventOutboxQueueSummary = Wire.EventOutboxQueueSummary;

export type EventDeliveryQueueFailureSummary = Wire.EventDeliveryQueueFailureSummary;

export type EventDeliveryQueueSubscriptionSummary = Wire.EventDeliveryQueueSubscriptionSummary;

export type EventDeliveryQueueSummaryResponse = Wire.EventDeliveryQueueSummaryResponse;

export type CancelEventDeliveryIntentsPayload = Wire.CancelEventDeliveryIntentsPayload;

export type CancelEventDeliveryIntentsResponse = Wire.CancelEventDeliveryIntentsResponse;

// --- External event ingest channels ---
// An ingest channel is a token-authenticated inbound endpoint that lets external systems publish
// events into the platform event bus. Ingested events get event_category 'external' and
// source 'external:<source>', and match event subscriptions like any other platform event.

export type EventIngestResourceRule = Wire.EventIngestResourceRule;

export type EventIngestTransform = Wire.EventIngestTransform;

export type EventIngestSignatureAlgorithm = Wire.EventIngestSignatureAlgorithm;

export type EventIngestSignatureEncoding = Wire.EventIngestSignatureEncoding;

export type EventIngestSignatureConfig = Wire.EventIngestSignatureConfig;

export type EventIngestChannel = Wire.EventIngestChannel;

export type CreateEventIngestChannelPayload = Wire.CreateEventIngestChannelPayload;

export type UpdateEventIngestChannelPayload = Wire.UpdateEventIngestChannelPayload;

export type EventIngestChannelMutationResponse = Wire.EventIngestChannelMutationResponse;
