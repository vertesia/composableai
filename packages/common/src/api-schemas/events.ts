// Runtime schemas for the events API domain.

import { z } from 'zod';
import type { WorkflowRuleInputType } from '../store/store.js';
import { SystemRolesSchema } from './apikey.js';
import { AgentRunStatusSchema } from './app-lifecycle.js';
import * as AuditTrailSchemas from './audit-trail.js';
import { StringValueMapSchema } from './files.js';
import { ConversationVisibilitySchema, NumberValueMapSchema } from './interaction.js';
import { JsonLogicRuleSchema, ProcessDefinitionBodySchema, ProcessRunTypeSchema } from './process.js';
import {
    EditRevisionSchema,
    ExpectedEditRevisionSchema,
    nullableNumberSchema,
    nullableStringSchema,
} from './schema-primitives.js';
import { InteractionExecutionConfigurationSchema } from './store.js';

export const ServerSentEventsResponseSchema = z.string().meta({ id: 'ServerSentEventsResponse' });

export const EventPrioritySchema = z.enum(['high', 'normal', 'low']).meta({ id: 'EventPriority' });

export const AgentDeliveryMatchModeSchema = z.enum(['start', 'signal', 'ensure']).meta({
    id: 'AgentDeliveryMatchMode',
    description:
        "How a matching event is applied to the external work-item thread's agent run:\n- `start` (default): always start a new run. Gating is done by the subscription filter; no   `message_path` is needed.\n- `signal`: deliver only to an *existing* run on the thread (never start) — the follow-up path.   `missing_thread` governs the no-run case.\n- `ensure`: deliver to the run on the thread, **starting one if none exists**.\n\nFor `signal`/`ensure` the message is delivered **exactly once**: as the run's initial instruction when starting, or as a signal to an existing/restarted run. Correlation is the provider-neutral `eventThreadTag(event_ref)` — the started run is auto-tagged with it and follow-ups recompute the same tag to find the run.",
});

export const WebhookPayloadModeSchema = z
    .enum(['event_envelope', 'legacy_notify_endpoint', 'workflow_notification'])
    .meta({
        id: 'WebhookPayloadMode',
        description:
            'Webhook delivery body format:\n- event_envelope: the full platform event + delivery metadata (default for new subscriptions)\n- legacy_notify_endpoint: pre-2025-10 notify_endpoints body {workflowId, runId, status, result}\n- workflow_notification: post-COMPLETION_RESULT_V1 notify_endpoints body   {workflow_id, workflow_name, workflow_run_id, event_name, detail}',
    });

export const WebhookSigningModeSchema = z.enum(['signed', 'legacy_unsigned']).meta({ id: 'WebhookSigningMode' });

export const WorkflowRuleInputTypeSchema = z
    .enum(['single', 'multiple', 'none'])
    .meta({ id: 'WorkflowRuleInputType' }) as z.ZodType<WorkflowRuleInputType>;

export const SemanticConditionOnErrorSchema = z
    .enum(['fail_open', 'fail_closed'])
    .meta({ id: 'SemanticConditionOnError' });

export const SemanticConditionModeSchema = z.enum(['enforce', 'shadow']).meta({ id: 'SemanticConditionMode' });

export const AgentSemanticEvaluatorSchema = z
    .strictObject({
        type: z.literal('agent'),
        interaction_ref: z
            .string()
            .meta({ description: 'Agent interaction ref. Defaults to the general-purpose system agent.' })
            .optional(),
        tool_names: z.array(z.string()).optional(),
        max_iterations: z.number().optional(),
        config: InteractionExecutionConfigurationSchema.optional(),
    })
    .meta({
        id: 'AgentSemanticEvaluator',
        description:
            'Evaluates the semantic condition with a non-interactive agent run that may use tools to enrich its decision (fetch documents, inspect processes, ...). Slower and more expensive than the interaction evaluator; the delivery intent stays in `evaluating` until the agent completes.',
    });

export const InteractionSemanticEvaluatorSchema = z
    .strictObject({
        type: z.literal('interaction'),
        interaction_ref: z
            .string()
            .meta({
                description:
                    'Optional stored interaction ref used as the classifier. When omitted a built-in ad-hoc classifier prompt is used.',
            })
            .optional(),
        config: InteractionExecutionConfigurationSchema.optional(),
        enrich_with_content: z
            .boolean()
            .meta({
                description:
                    'Include an excerpt of the content object text when the event resource is a content object.',
            })
            .optional(),
        max_content_chars: z
            .number()
            .meta({ description: 'Maximum characters of content text included in the classifier prompt.' })
            .optional(),
    })
    .meta({
        id: 'InteractionSemanticEvaluator',
        description:
            'Evaluates the semantic condition with a single LLM call (no tools). The event envelope — optionally enriched with an excerpt of the content object text — is classified against the instruction.',
    });

const EventCategorySchema = AuditTrailSchemas.EventCategorySchema;

export const EventIngestSignatureEncodingSchema = z
    .enum(['hex', 'base64'])
    .meta({ id: 'EventIngestSignatureEncoding' });

export const EventIngestSignatureAlgorithmSchema = z.enum(['sha256', 'sha1']).meta({
    id: 'EventIngestSignatureAlgorithm',
    description:
        'How an ingest channel authenticates inbound requests in addition to the channel ingest token:\n- none (default): token only.\n- hmac: the sender signs the raw request body with a shared secret (GitHub/Stripe style) and the   server verifies the signature. The token may then be optional (`token_optional`).',
});

export const EventIngestResourceRuleSchema = z
    .strictObject({
        event_type: z
            .array(z.string())
            .meta({ description: 'Match when the captured `event_type` (see `event_type_header`) is one of these.' })
            .optional(),
        when_path_exists: z
            .string()
            .meta({
                description:
                    'Match only when this dot-path resolves to a defined, non-null value (e.g. `issue.pull_request`).',
            })
            .optional(),
        when_path_absent: z
            .string()
            .meta({ description: 'Match only when this dot-path is undefined/null.' })
            .optional(),
        resource_type: z.string().meta({ description: '`resource_type` to set when this rule matches.' }).optional(),
        resource_id_path: z.string().meta({ description: '`resource_id` from a single dot-path.' }).optional(),
        resource_id_template: z
            .string()
            .meta({
                description:
                    '...or a composed `resource_id` from a `{{dot.path}}` template against the body, e.g. `{{repository.full_name}}#{{pull_request.number}}`. Takes precedence over `resource_id_path`.',
            })
            .optional(),
    })
    .meta({
        id: 'EventIngestResourceRule',
        description:
            "A conditional rule for deriving `resource_type` + `resource_id` from the body, evaluated in order (first match wins) when a single dot-path can't serve every payload shape a channel receives. A sender whose one webhook delivers heterogeneous events (e.g. a GitHub App: issues, issue comments, PR reviews) needs different thread identities per event family; these rules express that without baking provider knowledge into the server.",
    });

export const SemanticEvaluationStatusSchema = z
    .enum(['pending', 'running', 'matched', 'not_matched', 'error'])
    .meta({ id: 'SemanticEvaluationStatus' });

export const EventDeliveryIntentStatusSchema = z
    .enum(['pending', 'evaluating', 'starting', 'running', 'succeeded', 'retrying', 'failed', 'cancelled', 'skipped'])
    .meta({ id: 'EventDeliveryIntentStatus' });

export const EventOutboxStatusSchema = z
    .enum(['pending', 'routing', 'routed', 'partially_routed', 'failed', 'dropped'])
    .meta({ id: 'EventOutboxStatus' });

export const EventDeliverySortFieldSchema = z
    .enum(['created_at', 'status', 'resource_type', 'event_category', 'action'])
    .meta({ id: 'EventDeliverySortField' });

export const WorkflowRuleItemSchema = z
    .strictObject({
        id: z.string().meta({ description: 'Unique identifier for the object' }),
        edit_revision: EditRevisionSchema,
        name: z.string().meta({ description: 'Human-readable name or title' }),
        description: z.string().meta({ description: 'Optional detailed description of the object' }).optional(),
        tags: z.array(z.string()).meta({ description: 'Optional array of categorization tags' }).optional(),
        updated_by: z.string().meta({ description: 'Identifier of the user who last modified the object' }),
        created_by: z.string().meta({ description: 'Identifier of the user who created the object' }),
        created_at: z.string().meta({ description: 'ISO timestamp of when the object was created' }),
        updated_at: z.string().meta({ description: 'ISO timestamp of when the object was last updated' }),
        endpoint: z.string(),
        input_type: WorkflowRuleInputTypeSchema,
    })
    .meta({ id: 'WorkflowRuleItem' });

export const WebhookEventDeliveryTargetSchema = z
    .strictObject({
        type: z.literal('webhook'),
        url: z.string(),
        has_secret: z.boolean().meta({
            description: 'Server-managed: whether a signing secret is stored. Set by the server, never by callers.',
        }),
        secret_label: z
            .string()
            .meta({ description: 'Server-managed: label of the active signing secret.' })
            .optional(),
        signing_mode: WebhookSigningModeSchema.optional(),
        payload_mode: WebhookPayloadModeSchema.optional(),
        headers: StringValueMapSchema.optional(),
        encrypted_headers: z.boolean().optional(),
        timeout_ms: z.number().optional(),
        result_path: z.string().optional(),
        custom_data: z.looseObject({}).optional(),
    })
    .meta({ id: 'WebhookEventDeliveryTarget' });

export const AppEventDeliveryTargetSchema = z
    .strictObject({
        type: z.literal('app'),
        app_id: z.string(),
        installation_id: z.string(),
        hook: z.string(),
        url: z.string(),
        timeout_ms: z.number().optional(),
    })
    .meta({ id: 'AppEventDeliveryTarget' });

export const WorkflowEventDeliveryTargetSchema = z
    .strictObject({
        type: z.literal('workflow'),
        endpoint: z.string(),
        workflow_class: z.string().optional(),
        task_queue: z.string().optional(),
        vars: z.looseObject({}).optional(),
        input_type: WorkflowRuleInputTypeSchema.optional(),
        migrated_rule_name: z.string().optional(),
    })
    .meta({ id: 'WorkflowEventDeliveryTarget' });

export const EventDeliveryQueueFailureSummarySchema = z
    .strictObject({
        intent_id: z.string(),
        event_id: z.string(),
        status: EventDeliveryIntentStatusSchema,
        attempt_count: z.number(),
        last_error: nullableStringSchema.optional(),
        updated_at: z.string(),
    })
    .meta({ id: 'EventDeliveryQueueFailureSummary' });

export const EventOutboxQueueSummarySchema = z
    .strictObject({
        total: z.number(),
        active: z.number(),
        failed: z.number(),
        dropped: z.number(),
        by_status: NumberValueMapSchema,
        oldest_active_at: z.string().optional(),
    })
    .meta({ id: 'EventOutboxQueueSummary' });

export const EventDeliveryQueueSortFieldSchema = z
    .enum(['subscription_name', 'queued', 'active', 'failed', 'oldest'])
    .meta({ id: 'EventDeliveryQueueSortField' });

export const WorkflowRuleSchema = z
    .strictObject({
        id: z.string().meta({ description: 'Unique identifier for the object' }),
        edit_revision: EditRevisionSchema,
        name: z.string().meta({ description: 'Human-readable name or title' }),
        description: z.string().meta({ description: 'Optional detailed description of the object' }).optional(),
        tags: z.array(z.string()).meta({ description: 'Optional array of categorization tags' }).optional(),
        updated_by: z.string().meta({ description: 'Identifier of the user who last modified the object' }),
        created_by: z.string().meta({ description: 'Identifier of the user who created the object' }),
        created_at: z.string().meta({ description: 'ISO timestamp of when the object was created' }),
        updated_at: z.string().meta({ description: 'ISO timestamp of when the object was last updated' }),
        endpoint: z.string(),
        input_type: WorkflowRuleInputTypeSchema,
        match: z.looseObject({}).optional(),
        config: z.looseObject({}).meta({ description: 'Activities configuration if any.' }).optional(),
        debug: z.boolean().meta({ description: 'Debug mode for the rule', default: false }).optional(),
        customer_override: z
            .boolean()
            .meta({
                description:
                    'Customer override for the rule When set to true the rule will not be updated by the system',
            })
            .optional(),
        task_queue: z
            .string()
            .meta({ description: 'Optional task queue name to use when starting workflows for this rule' })
            .optional(),
        event_subscription_migration_status: z
            .enum(['migrated', 'unsupported_match', 'failed'])
            .meta({ description: 'Event subscription migration status for legacy workflow-rule cutover.' })
            .optional(),
        event_subscription_migration_error: z
            .string()
            .meta({ description: 'Migration failure or unsupported-match reason, when applicable.' })
            .optional(),
    })
    .meta({ id: 'WorkflowRule' });

/**
 * Everything a workflow-rule write accepts beyond `endpoint` and `name`. Shared so the update
 * payload below cannot drift from the create payload; spread rather than `.partial()`, because Zod
 * clones a schema's registry metadata and a derived component would collide with its base.
 */
const workflowRulePayloadFields = {
    match: z.looseObject({}).optional(),
    config: z.looseObject({}).meta({ description: 'Activities configuration if any.' }).optional(),
    debug: z.boolean().meta({ description: 'Debug mode for the rule', default: false }).optional(),
    customer_override: z
        .boolean()
        .meta({
            description: 'Customer override for the rule When set to true the rule will not be updated by the system',
        })
        .optional(),
    task_queue: z
        .string()
        .meta({ description: 'Optional task queue name to use when starting workflows for this rule' })
        .optional(),
    event_subscription_migration_status: z
        .enum(['migrated', 'unsupported_match', 'failed'])
        .meta({ description: 'Event subscription migration status for legacy workflow-rule cutover.' })
        .optional(),
    event_subscription_migration_error: z
        .string()
        .meta({ description: 'Migration failure or unsupported-match reason, when applicable.' })
        .optional(),
    input_type: WorkflowRuleInputTypeSchema.optional(),
    description: z.string().meta({ description: 'Optional detailed description of the object' }).optional(),
    tags: z.array(z.string()).meta({ description: 'Optional array of categorization tags' }).optional(),
    updated_by: z.string().meta({ description: 'Identifier of the user who last modified the object' }).optional(),
    created_by: z.string().meta({ description: 'Identifier of the user who created the object' }).optional(),
};

export const CreateWorkflowRulePayloadSchema = z
    .strictObject({
        ...workflowRulePayloadFields,
        endpoint: z.string(),
        name: z.string().meta({ description: 'Human-readable name or title' }),
    })
    .meta({ id: 'CreateWorkflowRulePayload' });

/**
 * `PUT /workflows/rules/:id` applies whatever fields the body carries. The create payload's required
 * `endpoint` and `name` would force every edit to restate them — the same defect the collection
 * update had, caught here by inspection rather than by a test.
 */
export const UpdateWorkflowRulePayloadSchema = z
    .strictObject({
        expected_edit_revision: ExpectedEditRevisionSchema,
        ...workflowRulePayloadFields,
        endpoint: z.string().optional(),
        name: z.string().meta({ description: 'Human-readable name or title' }).optional(),
    })
    .meta({ id: 'UpdateWorkflowRulePayload', description: 'Fields to change on a workflow rule. All optional.' });

export const AgentEventDeliveryTargetSchema = z
    .strictObject({
        type: z.literal('agent'),
        on_match: AgentDeliveryMatchModeSchema.meta({
            description: 'Behavior when an event matches. Defaults to `start`.',
        }).optional(),
        interaction_ref: z
            .string()
            .meta({
                description: 'Interaction ID, app ref, or system ref. Defaults to the general-purpose system agent.',
            })
            .optional(),
        data: z.looseObject({}).optional(),
        config: InteractionExecutionConfigurationSchema.optional(),
        interactive: z.boolean().optional(),
        visibility: ConversationVisibilitySchema.optional(),
        tags: z.array(z.string()).optional(),
        categories: z.array(z.string()).optional(),
        tool_names: z.array(z.string()).optional(),
        max_iterations: z.number().optional(),
        debug_mode: z.boolean().optional(),
        signal_name: z
            .literal('UserInput')
            .meta({ description: 'Signal sent to an existing/restarted run. Only `UserInput` is implemented.' })
            .optional(),
        message_path: z
            .string()
            .meta({
                description:
                    'Dot-path to the message (initial instruction when starting, else the signal). Required for signal/ensure.',
            })
            .optional(),
        client_message_id_path: z
            .string()
            .meta({
                description:
                    'Dot-path to a stable per-message id, carried on the signal for (future) exactly-once dedupe.',
            })
            .optional(),
        statuses: z
            .array(AgentRunStatusSchema)
            .meta({
                description: "Run statuses eligible to receive the signal when a run exists. Defaults to ['running'].",
            })
            .optional(),
        skip_if_path_exists: z
            .string()
            .meta({ description: 'If this dot-path resolves to a value, the delivery is skipped.' })
            .optional(),
        author_path: z.string().meta({ description: 'Dot-path to the message author, for the loop guard.' }).optional(),
        ignore_author_patterns: z
            .array(z.string())
            .meta({
                description:
                    'Regex patterns matched against the resolved author; a match skips the delivery (loop guard).',
            })
            .optional(),
        require_command_prefixes: z
            .array(z.string())
            .meta({ description: 'The message must start with one of these prefixes to be delivered.' })
            .optional(),
        require_mentions: z
            .array(z.string())
            .meta({ description: '...or contain one of these mentions. Combined with prefixes as OR.' })
            .optional(),
        missing_thread: z
            .enum(['retry', 'skip'])
            .meta({
                description:
                    "`signal` mode only — no run yet (open/follow-up race): 'retry' (default) or 'skip'. Ignored for `ensure`.",
            })
            .optional(),
        on_terminal: z
            .enum(['skip', 'restart'])
            .meta({
                description: 'Behaviour when only terminal runs match: `skip` (default) or `restart` then signal.',
            })
            .optional(),
        metadata: z
            .looseObject({})
            .meta({
                description:
                    "Extra fields merged into the signal's metadata; same `{{event.*}}` / `$event.x` templating as `data`.",
            })
            .optional(),
    })
    .meta({ id: 'AgentEventDeliveryTarget' });

export const WebhookEventDeliveryTargetInputSchema = z
    .strictObject({
        rotate_signing_secret: z
            .boolean()
            .meta({ description: 'Request rotation of the stored signing secret on update.' })
            .optional(),
        type: z.literal('webhook'),
        url: z.string(),
        // Accepted and ignored, not writable. Editing a webhook subscription means reading it and
        // sending the target back with one field changed, and the read target carries these two;
        // `normalizeEventSubscriptionTarget` strips them server-side, so rejecting them here would
        // only break that round-trip. The stored values are derived from the secret store.
        has_secret: z
            .boolean()
            .meta({ description: 'Server-managed: ignored on write, echoed back from a read.' })
            .optional(),
        secret_label: z
            .string()
            .meta({ description: 'Server-managed: ignored on write, echoed back from a read.' })
            .optional(),
        signing_mode: WebhookSigningModeSchema.optional(),
        payload_mode: WebhookPayloadModeSchema.optional(),
        headers: StringValueMapSchema.optional(),
        encrypted_headers: z.boolean().optional(),
        timeout_ms: z.number().optional(),
        result_path: z.string().optional(),
        custom_data: z.looseObject({}).optional(),
    })
    .meta({ id: 'WebhookEventDeliveryTargetInput' });

export const AppEventDeliveryTargetInputSchema = z
    .strictObject({
        type: z.literal('app'),
        app_id: z.string(),
        installation_id: z.string(),
        hook: z.string(),
        url: z.string(),
        timeout_ms: z.number().optional(),
    })
    .meta({ id: 'AppEventDeliveryTargetInput' });

export const WorkflowEventDeliveryTargetInputSchema = z
    .strictObject({
        type: z.literal('workflow'),
        endpoint: z.string(),
        workflow_class: z.string().optional(),
        task_queue: z.string().optional(),
        vars: z.looseObject({}).optional(),
        input_type: WorkflowRuleInputTypeSchema.optional(),
        // Same round-trip allowance as the webhook input above: the read target carries this, the
        // update handler re-applies it from the stored target rather than from the body.
        migrated_rule_name: z
            .string()
            .meta({ description: 'Server-managed: ignored on write, echoed back from a read.' })
            .optional(),
    })
    .meta({ id: 'WorkflowEventDeliveryTargetInput' });

export const SemanticEvaluatorSchema = z
    .discriminatedUnion('type', [InteractionSemanticEvaluatorSchema, AgentSemanticEvaluatorSchema])
    .meta({ id: 'SemanticEvaluator' });

export const EventIngestSignatureConfigSchema = z
    .strictObject({
        header: z.string().meta({ description: 'Request header carrying the signature, e.g. `x-hub-signature-256`.' }),
        algorithm: EventIngestSignatureAlgorithmSchema.optional(),
        encoding: EventIngestSignatureEncodingSchema.optional(),
        prefix: z
            .string()
            .meta({ description: 'Literal prefix stripped from the header value before comparison, e.g. `sha256=`.' })
            .optional(),
        has_secret: z
            .boolean()
            .meta({ description: 'Server-managed: whether a signing secret is stored for this channel.' })
            .optional(),
        secret_hint: z
            .string()
            .meta({ description: 'Server-managed: label/hint of the stored signing secret.' })
            .optional(),
    })
    .meta({
        id: 'EventIngestSignatureConfig',
        description:
            'Optional HMAC signature verification for an ingest channel. When configured, the server recomputes `HMAC(algorithm, signing_secret, rawBody)` and compares it (timing-safe) to the value in `header`, after stripping `prefix`. Covers GitHub-style `X-Hub-Signature-256: sha256=<hex>` and a plain Salesforce Apex-callout HMAC.',
    });

export const EventIngestTransformSchema = z
    .strictObject({
        action_path: z
            .string()
            .meta({ description: 'Dot-path to the value used as `event.action`, e.g. `event.type`.' })
            .optional(),
        resource_type_path: z
            .string()
            .meta({ description: 'Dot-path to the value used as `event.resource_type`.' })
            .optional(),
        resource_id_path: z
            .string()
            .meta({ description: 'Dot-path to the value used as `event.resource_id`.' })
            .optional(),
        event_type_header: z
            .string()
            .meta({
                description:
                    "Request **header** carrying the event family (e.g. GitHub's `x-github-event`), captured into `event.details.event_type`. Lets subscriptions and `resource_rules` discriminate event shapes when one channel receives heterogeneous payloads whose `action` alone is ambiguous (e.g. `created` for both an issue comment and a PR review comment).",
            })
            .optional(),
        resource_rules: z
            .array(EventIngestResourceRuleSchema)
            .meta({
                description:
                    "Ordered conditional rules for `resource_type` + `resource_id` (first match wins). Used when a single `resource_id_path` can't serve every payload shape. Falls back to `resource_type_path` / `resource_id_path` / channel defaults when no rule matches.",
            })
            .optional(),
        idempotency_key_path: z
            .string()
            .meta({ description: 'Dot-path to a deduplication key (same semantics as `idempotency_key`).' })
            .optional(),
        idempotency_key_header: z
            .string()
            .meta({
                description:
                    "Request **header** to use as the deduplication key when the body has no stable per-delivery id — e.g. GitHub App's `x-github-delivery`, unique per delivery for all event types, which is the only reliable dedup key when one App webhook delivers heterogeneous payloads (issues + comments) to a single channel. Lower precedence than `idempotency_key_path`.",
            })
            .optional(),
        timestamp_path: z.string().meta({ description: 'Dot-path to an ISO 8601 event timestamp.' }).optional(),
        static_details: z
            .looseObject({})
            .meta({ description: 'Static fields merged into `event.details`.' })
            .optional(),
    })
    .meta({
        id: 'EventIngestTransform',
        description:
            'Declarative mapping from a raw third-party webhook body to platform event fields, for senders that cannot shape their payload (GitHub, Slack, DocuSign, Salesforce, ...). Each `*_path` is a dot-path into the JSON body (array indices supported, e.g. `commits.0.id`). Extracted values override the channel defaults; the full raw body is always preserved under `event.details.payload`.',
    });

export const SemanticEvaluationRecordSchema = z
    .strictObject({
        status: SemanticEvaluationStatusSchema,
        evaluator_type: z.enum(['interaction', 'agent']),
        mode: SemanticConditionModeSchema,
        matched: z.boolean().optional(),
        rationale: z.string().optional(),
        error: z.string().optional(),
        workflow_id: z
            .string()
            .meta({ description: 'Temporal workflow id of the evaluation agent run (agent evaluator only).' })
            .optional(),
        agent_run_id: z.string().optional(),
        evaluated_at: z.string().optional(),
    })
    .meta({ id: 'SemanticEvaluationRecord' });

export const ListEventDeliveriesPayloadSchema = z
    .strictObject({
        limit: z.number().optional(),
        event_id: z.string().optional(),
        resource_id: z.string().optional(),
        subscription_id: z.string().optional(),
        status: z.array(EventDeliveryIntentStatusSchema).optional(),
        outbox_status: z.array(EventOutboxStatusSchema).optional(),
        event_category: z
            .array(EventCategorySchema)
            .meta({ description: 'Filter by outbox event category (e.g. external, content).' })
            .optional(),
        action: z.array(z.string()).meta({ description: 'Filter by outbox action (e.g. opened, created).' }).optional(),
        resource_type: z
            .array(z.string())
            .meta({ description: 'Filter by outbox resource type (e.g. github_issue, content_object).' })
            .optional(),
        sort_by: EventDeliverySortFieldSchema.meta({ description: 'Sort field (default created_at).' }).optional(),
        sort_order: z.enum(['asc', 'desc']).meta({ description: 'Sort order (default desc).' }).optional(),
    })
    .meta({ id: 'ListEventDeliveriesPayload' });

export const WorkflowRuleItemArraySchema = z.array(WorkflowRuleItemSchema).meta({ id: 'WorkflowRuleItemArray' });

export const EventIngestChannelSchema = z
    .strictObject({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        account_id: z.string(),
        project_id: z.string(),
        source: z.string().meta({ description: 'Source label stamped on ingested events as `external:<source>`.' }),
        enabled: z.boolean(),
        default_action: z
            .string()
            .meta({ description: 'Action used when the ingest payload does not specify one.' })
            .optional(),
        default_resource_type: z
            .string()
            .meta({ description: 'Resource type used when the ingest payload does not specify one.' })
            .optional(),
        transform: EventIngestTransformSchema.meta({
            description: 'Optional mapping from raw third-party payloads to event fields.',
        }).optional(),
        signature: EventIngestSignatureConfigSchema.meta({
            description: 'Optional HMAC signature verification config.',
        }).optional(),
        priority: EventPrioritySchema,
        has_token: z
            .boolean()
            .meta({ description: 'Server-managed: whether an ingest token is active for this channel.' }),
        token_hint: z
            .string()
            .meta({ description: 'Server-managed: last characters of the active token, for identification.' })
            .optional(),
        created_by: z.string().optional(),
        updated_by: z.string().optional(),
        created_at: z.string().optional(),
        updated_at: z.string().optional(),
    })
    .meta({
        id: 'EventIngestChannel',
        description:
            "An inbound channel that lets external systems publish events into the platform event bus. Events ingested through a channel get `event_category: 'external'` and `source: 'external:<source>'`, and are matched against event subscriptions like any other platform event.",
    });

export const EventDeliveryQueueSubscriptionSummarySchema = z
    .strictObject({
        subscription_id: z.string(),
        subscription_name: z.string(),
        target_type: z.enum(['workflow', 'webhook', 'app', 'agent', 'process']),
        total: z.number(),
        queued: z.number(),
        deferred: z.number(),
        active: z.number(),
        failed: z.number(),
        skipped: z.number(),
        max_attempt_count: z.number(),
        oldest_queued_at: z.string().optional(),
        oldest_deferred_at: z.string().optional(),
        latest_failure: EventDeliveryQueueFailureSummarySchema.optional(),
    })
    .meta({ id: 'EventDeliveryQueueSubscriptionSummary' });

export const EventDeliveryQueueSummaryPayloadSchema = z
    .strictObject({
        subscription_id: z.string().optional(),
        target_type: z.array(z.enum(['workflow', 'webhook', 'app', 'agent', 'process'])).optional(),
        sort_by: EventDeliveryQueueSortFieldSchema.optional(),
        sort_order: z.enum(['asc', 'desc']).optional(),
    })
    .meta({ id: 'EventDeliveryQueueSummaryPayload' });

export const CancelEventDeliveryIntentsPayloadSchema = z
    .strictObject({
        subscription_id: z
            .string()
            .min(1)
            .meta({ description: 'Restrict cancellation to one subscription.' })
            .optional(),
        target_type: z
            .array(z.enum(['workflow', 'webhook', 'app', 'agent', 'process']))
            .min(1)
            .meta({ description: 'Restrict cancellation to one or more delivery target types.' })
            .optional(),
    })
    .meta({ id: 'CancelEventDeliveryIntentsPayload' });

export const CancelEventDeliveryIntentsResponseSchema = z
    .strictObject({
        environment: z.string().meta({ description: 'Deployment environment whose queue was changed.' }),
        cleared_through: z.string().meta({
            description: 'Server-side watermark; intents created after this time were not changed.',
            format: 'date-time',
        }),
        cancelled: z
            .number()
            .int()
            .nonnegative()
            .meta({ description: 'Pending or retrying intents moved to the cancelled terminal state.' }),
        active_untouched: z.number().int().nonnegative().meta({
            description: 'Matching evaluating, starting, or running intents left for normal reconciliation.',
        }),
    })
    .meta({ id: 'CancelEventDeliveryIntentsResponse' });

export const EventIngestChannelMutationResponseSchema = z
    .strictObject({
        channel: EventIngestChannelSchema,
        ingest_token: z
            .string()
            .meta({ description: 'Returned once on creation or rotation; it cannot be retrieved later.' })
            .optional(),
        signing_secret: z
            .string()
            .meta({
                description:
                    'Returned once on creation or rotation of the signing secret; it cannot be retrieved later.',
            })
            .optional(),
    })
    .meta({ id: 'EventIngestChannelMutationResponse' });

export const CreateEventIngestChannelPayloadSchema = z
    .strictObject({
        name: z.string(),
        description: z.string().optional(),
        source: z.string().meta({ description: 'Defaults to a slug derived from the name.' }).optional(),
        default_action: z.string().optional(),
        default_resource_type: z.string().optional(),
        transform: EventIngestTransformSchema.optional(),
        signature: EventIngestSignatureConfigSchema.optional(),
        priority: EventPrioritySchema.optional(),
        enabled: z.boolean().optional(),
    })
    .meta({ id: 'CreateEventIngestChannelPayload' });

export const EventSemanticConditionSchema = z
    .strictObject({
        instruction: z.string().meta({
            description: 'Natural-language predicate, e.g. "the document appears to be a signed contract amendment".',
        }),
        evaluator: SemanticEvaluatorSchema.meta({ description: 'Defaults to the interaction evaluator.' }).optional(),
        mode: SemanticConditionModeSchema.meta({
            description:
                'enforce: a negative verdict skips delivery. shadow: the verdict is recorded on the delivery intent but never blocks delivery. Defaults to enforce.',
        }).optional(),
        on_error: SemanticConditionOnErrorSchema.meta({
            description:
                'What to do when evaluation errors out after retries: fail_open delivers anyway, fail_closed does not deliver. Defaults to fail_closed.',
        }).optional(),
    })
    .meta({
        id: 'EventSemanticCondition',
        description:
            'A natural-language predicate evaluated by an LLM after all structural filters (categories, actions, resource types, JSONLogic condition) have matched.',
    });

export const UpdateEventIngestChannelPayloadSchema = z
    .strictObject({
        name: z.string().optional(),
        description: z.string().optional(),
        source: z.string().optional(),
        default_action: z.string().optional(),
        default_resource_type: z.string().optional(),
        transform: z
            .union([EventIngestTransformSchema, z.null()])
            .meta({ description: 'Pass null to remove the transform.' })
            .optional(),
        signature: z
            .union([EventIngestSignatureConfigSchema, z.null()])
            .meta({ description: 'Pass null to remove signature verification.' })
            .optional(),
        priority: EventPrioritySchema.optional(),
        enabled: z.boolean().optional(),
        rotate_token: z
            .boolean()
            .meta({ description: 'Request rotation of the channel ingest token on update.' })
            .optional(),
        rotate_signing_secret: z
            .boolean()
            .meta({ description: 'Request rotation of the HMAC signing secret on update.' })
            .optional(),
    })
    .meta({ id: 'UpdateEventIngestChannelPayload' });

export const EventDeliveryIntentSummarySchema = z
    .strictObject({
        id: z.string(),
        event_id: z.string(),
        subscription_id: z.string(),
        subscription_name: z.string(),
        target_type: z.enum(['workflow', 'webhook', 'app', 'agent', 'process']),
        workflow_class: nullableStringSchema.optional(),
        priority: EventPrioritySchema,
        status: EventDeliveryIntentStatusSchema,
        attempt_count: z.number(),
        workflow_id: nullableStringSchema.optional(),
        workflow_run_id: nullableStringSchema.optional(),
        response_status: nullableNumberSchema.optional(),
        last_error: nullableStringSchema.optional(),
        next_attempt_at: nullableStringSchema.optional(),
        started_at: nullableStringSchema.optional(),
        completed_at: nullableStringSchema.optional(),
        semantic_evaluation: z.union([SemanticEvaluationRecordSchema, z.null()]).optional(),
        created_at: z.string(),
        updated_at: z.string(),
    })
    .meta({ id: 'EventDeliveryIntentSummary' });

export const EventIngestChannelArraySchema = z.array(EventIngestChannelSchema).meta({ id: 'EventIngestChannelArray' });

export const EventDeliveryQueueSummaryResponseSchema = z
    .strictObject({
        generated_at: z.string(),
        outbox: EventOutboxQueueSummarySchema,
        deliveries: z.array(EventDeliveryQueueSubscriptionSummarySchema),
    })
    .meta({ id: 'EventDeliveryQueueSummaryResponse' });

export const EventSubscriptionFilterSchema = z
    .strictObject({
        event_category: z.array(z.union([EventCategorySchema, z.literal('*')])).optional(),
        exclude_event_category: z.array(EventCategorySchema).optional(),
        action: z.array(z.string()).optional(),
        resource_type: z.array(z.string()).optional(),
        condition: JsonLogicRuleSchema.optional(),
        semantic_condition: EventSemanticConditionSchema.meta({
            description: 'LLM-evaluated predicate applied after all structural filters have matched.',
        }).optional(),
    })
    .meta({ id: 'EventSubscriptionFilter' });

export const EventDeliverySummarySchema = z
    .strictObject({
        event_id: z.string(),
        event_category: EventCategorySchema,
        action: z.string(),
        resource_type: z.string(),
        resource_id: z.string(),
        source: z.string(),
        priority: EventPrioritySchema,
        status: EventOutboxStatusSchema,
        matched_subscription_count: z.number(),
        materialized_intent_count: z.number(),
        routing_attempt_count: z.number(),
        routing_error: nullableStringSchema.optional(),
        routed_at: nullableStringSchema.optional(),
        created_at: z.string(),
        updated_at: z.string(),
        intents: z.array(EventDeliveryIntentSummarySchema),
    })
    .meta({ id: 'EventDeliverySummary' });

export const ListEventDeliveriesResponseSchema = z
    .strictObject({
        deliveries: z.array(EventDeliverySummarySchema),
    })
    .meta({ id: 'ListEventDeliveriesResponse' });

export const CreateEventSubscriptionPayloadSchema: z.ZodType = z
    .strictObject({
        name: z.string(),
        description: z.string().optional(),
        scope: z.enum(['account', 'project']).optional(),
        filter: EventSubscriptionFilterSchema,
        target: z.lazy(() => EventDeliveryTargetInputSchema),
        run_as_role: SystemRolesSchema.meta({
            description:
                'Identity the delivery runs as. Required at creation so a subscription never silently runs as the originating (possibly deleted) user. Use "automation" for the standard identity.',
        }),
        enabled: z.boolean().optional(),
        priority: EventPrioritySchema.optional(),
    })
    .meta({ id: 'CreateEventSubscriptionPayload' });

export const EventDeliveryTargetSchema: z.ZodType = z
    .discriminatedUnion('type', [
        WorkflowEventDeliveryTargetSchema,
        WebhookEventDeliveryTargetSchema,
        AppEventDeliveryTargetSchema,
        AgentEventDeliveryTargetSchema,
        z.lazy(() => ProcessEventDeliveryTargetSchema) as unknown as z.ZodObject,
    ])
    .meta({ id: 'EventDeliveryTarget' });

export const EventDeliveryTargetInputSchema: z.ZodType = z
    .discriminatedUnion('type', [
        WorkflowEventDeliveryTargetInputSchema,
        WebhookEventDeliveryTargetInputSchema,
        AppEventDeliveryTargetInputSchema,
        AgentEventDeliveryTargetSchema,
        z.lazy(() => ProcessEventDeliveryTargetSchema) as unknown as z.ZodObject,
    ])
    .meta({ id: 'EventDeliveryTargetInput' });

export const EventSubscriptionSchema: z.ZodType = z
    .strictObject({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        account_id: z.string(),
        project_id: z.string().optional(),
        scope: z.enum(['account', 'project']),
        filter: EventSubscriptionFilterSchema,
        target: z.lazy(() => EventDeliveryTargetSchema),
        run_as_role: SystemRolesSchema,
        is_system: z.boolean(),
        protected: z.boolean(),
        enabled: z.boolean(),
        priority: EventPrioritySchema.optional(),
        app_installation_id: z.string().optional(),
        app_id: z.string().optional(),
        app_subscription_id: z.string().optional(),
        created_by: z.string().optional(),
        updated_by: z.string().optional(),
        created_at: z.string().optional(),
        updated_at: z.string().optional(),
        migrated_from_workflow_rule_id: z.string().optional(),
        overrides_system_subscription_id: z
            .string()
            .meta({
                description:
                    'System subscription ID replaced by this stored subscription. Set only for tenant-specific system overrides created by migrations or platform code.',
            })
            .optional(),
        customer_override: z
            .boolean()
            .meta({ description: 'True when this system subscription was created from a legacy customer override.' })
            .optional(),
    })
    .meta({ id: 'EventSubscription' });

export const EventSubscriptionArraySchema: z.ZodType = z
    .array(z.lazy(() => EventSubscriptionSchema))
    .meta({ id: 'EventSubscriptionArray' });

export const EventSubscriptionMutationResponseSchema: z.ZodType = z
    .strictObject({
        subscription: z.lazy(() => EventSubscriptionSchema),
        webhook_signing_secret: z.string().optional(),
    })
    .meta({ id: 'EventSubscriptionMutationResponse' });

export const ProcessEventDeliveryTargetSchema: z.ZodType = z
    .strictObject({
        type: z.literal('process'),
        process_ref: z
            .string()
            .meta({
                description:
                    'Stored process ID, app ref, or system ref. Required unless process_definition is supplied.',
            })
            .optional(),
        process_version: z.number().optional(),
        process_definition: z.lazy(() => ProcessDefinitionBodySchema).optional(),
        run_type: ProcessRunTypeSchema.optional(),
        data: z.looseObject({}).optional(),
        config: z.looseObject({}).optional(),
        visibility: ConversationVisibilitySchema.optional(),
        tags: z.array(z.string()).optional(),
        categories: z.array(z.string()).optional(),
    })
    .meta({ id: 'ProcessEventDeliveryTarget' });

export const UpdateEventSubscriptionPayloadSchema: z.ZodType = z
    .strictObject({
        name: z.string().optional(),
        description: z.string().optional(),
        filter: EventSubscriptionFilterSchema.optional(),
        target: z.lazy(() => EventDeliveryTargetInputSchema).optional(),
        run_as_role: SystemRolesSchema.optional(),
        enabled: z.boolean().optional(),
        priority: EventPrioritySchema.optional(),
    })
    .meta({ id: 'UpdateEventSubscriptionPayload' });

export const StreamEventDeliveriesQuerySchema = z
    .object({
        limit: z.number().optional(),
        event_id: z.string().optional(),
        resource_id: z.string().optional(),
        resource_type: z.array(z.string()).optional(),
        event_category: z.array(EventCategorySchema).optional(),
        action: z.array(z.string()).optional(),
        outbox_status: z.array(EventOutboxStatusSchema).optional(),
        since_event_id: z.string().optional(),
        since_created_at: z.string().optional(),
        include_event: z.boolean().optional(),
        poll_interval_ms: z.number().optional(),
    })
    .meta({ id: 'StreamEventDeliveriesQuery' });
