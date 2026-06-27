import type { AuditMeter } from './audit-trail.js';
import type { ConversationVisibility, InteractionExecutionConfiguration } from './interaction.js';
import type { SystemRoles } from './project.js';
import type {
    AgentRunStatus,
    JsonLogicRule,
    ProcessDefinitionBody,
    ProcessRunType,
    WorkflowRuleInputType,
} from './store/index.js';

export type EventCategory = 'content' | 'workflow' | 'security' | 'billing' | 'system' | 'external';

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
    | 'evaluating'
    | 'starting'
    | 'running'
    | 'succeeded'
    | 'retrying'
    | 'failed'
    | 'cancelled'
    | 'skipped';

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
    /** LLM-evaluated predicate applied after all structural filters have matched. */
    semantic_condition?: EventSemanticCondition;
}

// --- Semantic conditions ---
// A semantic_condition is an LLM-evaluated natural-language predicate applied AFTER all structural
// filters (categories, actions, resource types, JSONLogic condition) have matched.

export type SemanticConditionMode = 'enforce' | 'shadow';

export type SemanticConditionOnError = 'fail_open' | 'fail_closed';

export type SemanticEvaluationStatus = 'pending' | 'running' | 'matched' | 'not_matched' | 'error';

/**
 * Evaluates the semantic condition with a single LLM call (no tools). The event envelope —
 * optionally enriched with an excerpt of the content object text — is classified against the
 * instruction.
 */
export interface InteractionSemanticEvaluator {
    type: 'interaction';
    /**
     * Optional stored interaction ref used as the classifier. When omitted a built-in ad-hoc
     * classifier prompt is used.
     */
    interaction_ref?: string;
    config?: InteractionExecutionConfiguration;
    /** Include an excerpt of the content object text when the event resource is a content object. */
    enrich_with_content?: boolean;
    /** Maximum characters of content text included in the classifier prompt. */
    max_content_chars?: number;
}

/**
 * Evaluates the semantic condition with a non-interactive agent run that may use tools to enrich its
 * decision (fetch documents, inspect processes, ...). Slower and more expensive than the interaction
 * evaluator; the delivery intent stays in `evaluating` until the agent completes.
 */
export interface AgentSemanticEvaluator {
    type: 'agent';
    /** Agent interaction ref. Defaults to the general-purpose system agent. */
    interaction_ref?: string;
    tool_names?: string[];
    max_iterations?: number;
    config?: InteractionExecutionConfiguration;
}

export type SemanticEvaluator = InteractionSemanticEvaluator | AgentSemanticEvaluator;

/**
 * A natural-language predicate evaluated by an LLM after all structural filters
 * (categories, actions, resource types, JSONLogic condition) have matched.
 */
export interface EventSemanticCondition {
    /** Natural-language predicate, e.g. "the document appears to be a signed contract amendment". */
    instruction: string;
    /** Defaults to the interaction evaluator. */
    evaluator?: SemanticEvaluator;
    /**
     * enforce: a negative verdict skips delivery. shadow: the verdict is recorded on the delivery
     * intent but never blocks delivery. Defaults to enforce.
     */
    mode?: SemanticConditionMode;
    /**
     * What to do when evaluation errors out after retries: fail_open delivers anyway, fail_closed
     * does not deliver. Defaults to fail_closed.
     */
    on_error?: SemanticConditionOnError;
}

export interface SemanticEvaluationRecord {
    status: SemanticEvaluationStatus;
    evaluator_type: 'interaction' | 'agent';
    mode: SemanticConditionMode;
    matched?: boolean;
    rationale?: string;
    error?: string;
    /** Temporal workflow id of the evaluation agent run (agent evaluator only). */
    workflow_id?: string;
    agent_run_id?: string;
    evaluated_at?: string;
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

/**
 * Routes a matching event to an *existing* agent run (the event bus otherwise only starts runs) by
 * sending it a signal — the follow-up path for external work-item threads (GitHub issue comments, ...).
 *
 * Correlation is provider-neutral: the run started for the thread is auto-tagged with
 * `eventThreadTag(event_ref)` and this target recomputes the same tag from its own event to find the
 * run. No `workflow_id` is involved, so the dispatcher resolves the delivery inline (it bypasses the
 * workflow-admission capacity gate and the Temporal reconciler).
 */
export interface AgentSignalEventDeliveryTarget {
    type: 'agent_signal';
    /**
     * Signal sent to the run. Only `UserInput` is implemented (the payload is UserInput-shaped:
     * message + metadata); other signal names are rejected by validation.
     */
    signal_name?: 'UserInput';
    /**
     * Interaction id/ref of the run to signal. Disambiguates when several event-started agents are
     * active on the same external thread; when omitted, the newest signalable run on the thread is used.
     */
    interaction_ref?: string;
    /** Dot-path into the PlatformEvent for the message body delivered to the run. */
    message_path: string;
    /** Dot-path to a stable per-message id, carried on the signal for (future) exactly-once dedupe. */
    client_message_id_path?: string;
    /** Run statuses eligible to receive the signal. Defaults to ['running']. */
    statuses?: AgentRunStatus[];
    /** If this dot-path resolves to a value, the delivery is skipped (e.g. `details.payload.issue.pull_request`). */
    skip_if_path_exists?: string;
    /** Dot-path to the message author (e.g. `details.payload.comment.user.login`), for the loop guard. */
    author_path?: string;
    /** Regex patterns matched against the resolved author; a match skips the delivery (loop guard). */
    ignore_author_patterns?: string[];
    /** The message must start with one of these prefixes to be delivered (e.g. ['/vertesia']). */
    require_command_prefixes?: string[];
    /** ...or contain one of these mentions (e.g. ['@vertesia-bot']). Combined with prefixes as OR. */
    require_mentions?: string[];
    /** No correlated run found yet (race between open and follow-up): 'retry' (default) or 'skip'. */
    missing_thread?: 'retry' | 'skip';
    /**
     * Behaviour when only terminal runs match (the live run already ended, e.g. a late follow-up after
     * the agent finished): `skip` (default) ends the delivery; `restart` re-activates the newest terminal
     * run (loads its conversation history, status back to running) and then delivers the message to it.
     */
    on_terminal?: 'skip' | 'restart';
    /**
     * Extra fields merged into the signal's metadata. Values support the same `{{event.*}}` / `$event.x`
     * templating as `target.data` (e.g. `{ comment_url: '{{event.details.payload.comment.html_url}}' }`).
     */
    metadata?: Record<string, unknown>;
}

export type EventDeliveryTarget =
    | WorkflowEventDeliveryTarget
    | WebhookEventDeliveryTarget
    | AgentEventDeliveryTarget
    | AgentSignalEventDeliveryTarget
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
    | AgentSignalEventDeliveryTarget
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
    semantic_evaluation?: SemanticEvaluationRecord | null;
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

export type EventDeliverySortField = 'created_at' | 'status' | 'resource_type' | 'event_category' | 'action';

export interface ListEventDeliveriesPayload {
    limit?: number;
    event_id?: string;
    resource_id?: string;
    subscription_id?: string;
    status?: EventDeliveryIntentStatus[];
    outbox_status?: EventOutboxStatus[];
    /** Filter by outbox event category (e.g. external, content). */
    event_category?: string[];
    /** Filter by outbox action (e.g. opened, created). */
    action?: string[];
    /** Filter by outbox resource type (e.g. github_issue, content_object). */
    resource_type?: string[];
    /** Sort field (default created_at). */
    sort_by?: EventDeliverySortField;
    /** Sort order (default desc). */
    sort_order?: 'asc' | 'desc';
}

export interface ListEventDeliveriesResponse {
    deliveries: EventDeliverySummary[];
}

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

export type EventDeliveryQueueSortField = 'subscription_name' | 'queued' | 'active' | 'failed' | 'oldest';

export interface EventDeliveryQueueSummaryPayload {
    subscription_id?: string;
    target_type?: EventDeliveryTarget['type'][];
    sort_by?: EventDeliveryQueueSortField;
    sort_order?: 'asc' | 'desc';
}

export interface EventOutboxQueueSummary {
    total: number;
    active: number;
    failed: number;
    dropped: number;
    by_status: Record<string, number>;
    oldest_active_at?: string;
}

export interface EventDeliveryQueueFailureSummary {
    intent_id: string;
    event_id: string;
    status: EventDeliveryIntentStatus;
    attempt_count: number;
    last_error?: string | null;
    updated_at: string;
}

export interface EventDeliveryQueueSubscriptionSummary {
    subscription_id: string;
    subscription_name: string;
    target_type: EventDeliveryTarget['type'];
    total: number;
    queued: number;
    deferred: number;
    active: number;
    failed: number;
    skipped: number;
    max_attempt_count: number;
    oldest_queued_at?: string;
    oldest_deferred_at?: string;
    latest_failure?: EventDeliveryQueueFailureSummary;
}

export interface EventDeliveryQueueSummaryResponse {
    generated_at: string;
    outbox: EventOutboxQueueSummary;
    deliveries: EventDeliveryQueueSubscriptionSummary[];
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

// --- External event ingest channels ---
// An ingest channel is a token-authenticated inbound endpoint that lets external systems publish
// events into the platform event bus. Ingested events get event_category 'external' and
// source 'external:<source>', and match event subscriptions like any other platform event.

/**
 * Declarative mapping from a raw third-party webhook body to platform event fields, for senders that
 * cannot shape their payload (GitHub, Slack, DocuSign, Salesforce, ...). Each `*_path` is a dot-path
 * into the JSON body (array indices supported, e.g. `commits.0.id`). Extracted values override the
 * channel defaults; the full raw body is always preserved under `event.details.payload`.
 */
export interface EventIngestTransform {
    /** Dot-path to the value used as `event.action`, e.g. `event.type`. */
    action_path?: string;
    /** Dot-path to the value used as `event.resource_type`. */
    resource_type_path?: string;
    /** Dot-path to the value used as `event.resource_id`. */
    resource_id_path?: string;
    /** Dot-path to a deduplication key (same semantics as `idempotency_key`). */
    idempotency_key_path?: string;
    /**
     * Request **header** to use as the deduplication key when the body has no stable per-delivery id —
     * e.g. GitHub App's `x-github-delivery`, unique per delivery for all event types, which is the only
     * reliable dedup key when one App webhook delivers heterogeneous payloads (issues + comments) to a
     * single channel. Lower precedence than `idempotency_key_path`.
     */
    idempotency_key_header?: string;
    /** Dot-path to an ISO 8601 event timestamp. */
    timestamp_path?: string;
    /** Static fields merged into `event.details`. */
    static_details?: Record<string, unknown>;
}

/**
 * How an ingest channel authenticates inbound requests in addition to the channel ingest token:
 * - none (default): token only.
 * - hmac: the sender signs the raw request body with a shared secret (GitHub/Stripe style) and the
 *   server verifies the signature. The token may then be optional (`token_optional`).
 */
export type EventIngestSignatureAlgorithm = 'sha256' | 'sha1';

export type EventIngestSignatureEncoding = 'hex' | 'base64';

/**
 * Optional HMAC signature verification for an ingest channel. When configured, the server recomputes
 * `HMAC(algorithm, signing_secret, rawBody)` and compares it (timing-safe) to the value in
 * `header`, after stripping `prefix`. Covers GitHub-style `X-Hub-Signature-256: sha256=<hex>` and a
 * plain Salesforce Apex-callout HMAC.
 */
export interface EventIngestSignatureConfig {
    /** Request header carrying the signature, e.g. `x-hub-signature-256`. */
    header: string;
    algorithm?: EventIngestSignatureAlgorithm;
    encoding?: EventIngestSignatureEncoding;
    /** Literal prefix stripped from the header value before comparison, e.g. `sha256=`. */
    prefix?: string;
    /** Server-managed: whether a signing secret is stored for this channel. */
    has_secret?: boolean;
    /** Server-managed: label/hint of the stored signing secret. */
    secret_hint?: string;
}

/**
 * An inbound channel that lets external systems publish events into the platform event bus. Events
 * ingested through a channel get `event_category: 'external'` and `source: 'external:<source>'`, and
 * are matched against event subscriptions like any other platform event.
 */
export interface EventIngestChannel {
    id: string;
    name: string;
    description?: string;
    account_id: string;
    project_id: string;
    /** Source label stamped on ingested events as `external:<source>`. */
    source: string;
    enabled: boolean;
    /** Action used when the ingest payload does not specify one. */
    default_action?: string;
    /** Resource type used when the ingest payload does not specify one. */
    default_resource_type?: string;
    /** Optional mapping from raw third-party payloads to event fields. */
    transform?: EventIngestTransform;
    /** Optional HMAC signature verification config. */
    signature?: EventIngestSignatureConfig;
    priority: EventPriority;
    /** Server-managed: whether an ingest token is active for this channel. */
    has_token: boolean;
    /** Server-managed: last characters of the active token, for identification. */
    token_hint?: string;
    created_by?: string;
    updated_by?: string;
    created_at?: string;
    updated_at?: string;
}

export interface CreateEventIngestChannelPayload {
    name: string;
    description?: string;
    /** Defaults to a slug derived from the name. */
    source?: string;
    default_action?: string;
    default_resource_type?: string;
    transform?: EventIngestTransform;
    signature?: EventIngestSignatureConfig;
    priority?: EventPriority;
    enabled?: boolean;
}

export interface UpdateEventIngestChannelPayload {
    name?: string;
    description?: string;
    source?: string;
    default_action?: string;
    default_resource_type?: string;
    /** Pass null to remove the transform. */
    transform?: EventIngestTransform | null;
    /** Pass null to remove signature verification. */
    signature?: EventIngestSignatureConfig | null;
    priority?: EventPriority;
    enabled?: boolean;
    /** Request rotation of the channel ingest token on update. */
    rotate_token?: boolean;
    /** Request rotation of the HMAC signing secret on update. */
    rotate_signing_secret?: boolean;
}

export interface EventIngestChannelMutationResponse {
    channel: EventIngestChannel;
    /** Returned once on creation or rotation; it cannot be retrieved later. */
    ingest_token?: string;
    /** Returned once on creation or rotation of the signing secret; it cannot be retrieved later. */
    signing_secret?: string;
}

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
