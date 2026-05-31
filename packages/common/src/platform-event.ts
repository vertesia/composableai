import type { AuditMeter } from './audit-trail.js';
import type { JsonLogicRule, WorkflowRuleInputType } from './store/index.js';

export type EventCategory = 'content' | 'workflow' | 'security' | 'billing' | 'system';

export type EventPriority = 'high' | 'normal' | 'low';

export type WebhookSigningMode = 'signed' | 'legacy_unsigned';

export type WebhookPayloadMode = 'event_envelope' | 'legacy_notify_endpoint';

export type EventOutboxStatus = 'pending' | 'routing' | 'routed' | 'partially_routed' | 'failed' | 'dropped';

export type EventDeliveryIntentStatus =
    | 'pending'
    | 'enqueued'
    | 'delivering'
    | 'succeeded'
    | 'retrying'
    | 'failed'
    | 'cancelled';

export type EventDeliveryTaskType = 'webhook' | 'workflow';

export interface EventRef {
    event_id: string;
    root_event_id: string;
    caused_by_event_id?: string;
    hop_count: number;
    event_category: EventCategory;
    action: string;
    resource_type: string;
    resource_id: string;
    account_id: string | null;
    project_id: string | null;
    tenant_id: string | null;
}

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

export interface EventSubscriptionFilter {
    event_category?: (EventCategory | '*')[];
    exclude_event_category?: EventCategory[];
    action?: string[];
    resource_type?: string[];
    condition?: JsonLogicRule;
}

export interface WorkflowEventDeliveryTarget {
    type: 'workflow';
    endpoint: string;
    task_queue?: string;
    vars?: Record<string, unknown>;
    input_type?: WorkflowRuleInputType;
    migrated_rule_name?: string;
}

export interface WebhookEventDeliveryTarget {
    type: 'webhook';
    url: string;
    has_secret: boolean;
    secret_label?: string;
    signing_mode?: WebhookSigningMode;
    payload_mode?: WebhookPayloadMode;
    headers?: Record<string, string>;
    encrypted_headers?: boolean;
    timeout_ms?: number;
    result_path?: string;
    custom_data?: Record<string, unknown>;
}

export type EventDeliveryTarget = WorkflowEventDeliveryTarget | WebhookEventDeliveryTarget;

export interface MatchedEventSubscriptionSnapshot {
    subscription_id: string;
    subscription_name: string;
    target: EventDeliveryTarget;
    priority: EventPriority;
}

export interface EventDeliveryTaskPayload {
    task_type: EventDeliveryTaskType;
    intent_id: string;
    event_id: string;
    account_id: string | null;
    project_id: string | null;
    tenant_id: string | null;
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
    is_system: boolean;
    protected: boolean;
    enabled: boolean;
    priority?: EventPriority;
    created_by?: string;
    updated_by?: string;
    created_at?: string;
    updated_at?: string;
    migrated_from_workflow_rule_id?: string;
}

export interface CreateEventSubscriptionPayload {
    name: string;
    description?: string;
    scope?: 'account' | 'project';
    filter: EventSubscriptionFilter;
    target: EventDeliveryTarget;
    enabled?: boolean;
    priority?: EventPriority;
}

export interface UpdateEventSubscriptionPayload {
    name?: string;
    description?: string;
    filter?: EventSubscriptionFilter;
    target?: EventDeliveryTarget;
    enabled?: boolean;
    priority?: EventPriority;
}

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
    enqueued_intent_count: number;
}

export interface WorkflowEventInput<T = Record<string, unknown>> {
    event_ref: EventRef;
    payload: T;
}
