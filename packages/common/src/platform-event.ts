import type { AuditMeter } from './audit-trail.js';
import type { ConversationVisibility, InteractionExecutionConfiguration } from './interaction.js';
import type { SystemRoles } from './project.js';
import type { JsonLogicRule, ProcessDefinitionBody, ProcessRunType, WorkflowRuleInputType } from './store/index.js';

export type EventCategory = 'content' | 'workflow' | 'security' | 'billing' | 'system';

export type EventPriority = 'high' | 'normal' | 'low';

export type WebhookSigningMode = 'signed' | 'legacy_unsigned';

/**
 * Webhook delivery body format:
 * - event_envelope: the full platform event + delivery metadata (default for new subscriptions)
 * - legacy_notify_endpoint: pre-2025-10 notify_endpoints body {workflowId, runId, status, result}
 * - workflow_notification: post-COMPLETION_RESULT_V1 notify_endpoints body
 *   {workflow_id, workflow_name, workflow_run_id, event_name, detail}
 */
export type WebhookPayloadMode = 'event_envelope' | 'legacy_notify_endpoint' | 'workflow_notification';

export type EventOutboxStatus = 'pending' | 'routing' | 'routed' | 'partially_routed' | 'failed' | 'dropped';

export type EventDeliveryIntentStatus =
    | 'pending'
    | 'starting'
    | 'running'
    | 'succeeded'
    | 'retrying'
    | 'failed'
    | 'cancelled';

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

/**
 * Lifecycle actions published by the workflow completion interceptor. The names intentionally
 * match the legacy notify_endpoints event_name values so migrated webhook subscribers receive
 * byte-identical status/event_name fields.
 */
export type WorkflowLifecycleAction = 'workflow_completed' | 'workflow_failed';

/**
 * Resource flavor of a workflow lifecycle event, derived from the Temporal workflow type:
 * ExecuteConversationWorkflow -> agent_run, ExecuteProcessWorkflow -> process_run,
 * anything else -> workflow_run.
 */
export type WorkflowLifecycleResourceType = 'workflow_run' | 'agent_run' | 'process_run';

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
    workflow_class?: string;
    task_queue?: string;
    vars?: Record<string, unknown>;
    input_type?: WorkflowRuleInputType;
    migrated_rule_name?: string;
}

export interface WebhookEventDeliveryTarget {
    type: 'webhook';
    url: string;
    /** Server-managed: whether a signing secret is stored. Set by the server, never by callers. */
    has_secret: boolean;
    /** Server-managed: label of the active signing secret. */
    secret_label?: string;
    signing_mode?: WebhookSigningMode;
    payload_mode?: WebhookPayloadMode;
    headers?: Record<string, string>;
    encrypted_headers?: boolean;
    timeout_ms?: number;
    result_path?: string;
    custom_data?: Record<string, unknown>;
}

export const DEFAULT_EVENT_AGENT_INTERACTION_REF = 'sys:GeneralAgent';

export interface AgentEventDeliveryTarget {
    type: 'agent';
    /**
     * Interaction ID, app ref, or system ref. Defaults to the general-purpose system agent.
     */
    interaction_ref?: string;
    data?: Record<string, unknown>;
    config?: InteractionExecutionConfiguration;
    interactive?: boolean;
    visibility?: ConversationVisibility;
    tags?: string[];
    categories?: string[];
    tool_names?: string[];
    max_iterations?: number;
    debug_mode?: boolean;
}

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

export type WorkflowEventDeliveryTargetInput = Omit<WorkflowEventDeliveryTarget, 'migrated_rule_name'>;

export type WebhookEventDeliveryTargetInput = Omit<WebhookEventDeliveryTarget, 'has_secret' | 'secret_label'> & {
    /** Request rotation of the stored signing secret on update. */
    rotate_signing_secret?: boolean;
};

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
    run_as_role?: SystemRoles;
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

export interface EventDeliveryIntentSummary {
    id: string;
    event_id: string;
    subscription_id: string;
    subscription_name: string;
    target_type: EventDeliveryTarget['type'];
    workflow_class?: string | null;
    priority: EventPriority;
    status: EventDeliveryIntentStatus;
    attempt_count: number;
    workflow_id?: string | null;
    workflow_run_id?: string | null;
    response_status?: number | null;
    last_error?: string | null;
    next_attempt_at?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
    created_at: string;
    updated_at: string;
}

export interface EventDeliverySummary {
    event_id: string;
    event_category: EventCategory;
    action: string;
    resource_type: string;
    resource_id: string;
    source: string;
    priority: EventPriority;
    status: EventOutboxStatus;
    matched_subscription_count: number;
    materialized_intent_count: number;
    routing_attempt_count: number;
    routing_error?: string | null;
    routed_at?: string | null;
    created_at: string;
    updated_at: string;
    intents: EventDeliveryIntentSummary[];
}

export interface ListEventDeliveriesPayload {
    limit?: number;
    event_id?: string;
    resource_id?: string;
    subscription_id?: string;
    status?: EventDeliveryIntentStatus[];
    outbox_status?: EventOutboxStatus[];
}

export interface ListEventDeliveriesResponse {
    deliveries: EventDeliverySummary[];
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
}

export interface WorkflowEventInput<T = Record<string, unknown>> {
    event_ref: EventRef;
    payload: T;
}
