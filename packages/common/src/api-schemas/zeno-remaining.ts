import {
    ExecutionTokenUsageSchema,
    JSONObjectSchema,
    JSONSchemaSchema,
    JSONValueSchema,
} from '@llumiverse/common/schemas';
import type { StringValue } from 'ms';
import { z } from 'zod';
import type { CollectionStatus } from '../store/collections.js';
import { ContentObjectStatus, type WorkflowRuleInputType } from '../store/store.js';
import type { AgentMessageType, FileProcessingStatus } from '../store/workflow.js';
import type { ViewNavigationNode } from '../views.js';
import { SystemRolesSchema } from './apikey.js';
import { StringArrayMapSchema } from './dashboard.js';
import { WorkflowExecutionStatusSchema } from './document-processing.js';
import { StringValueMapSchema } from './files.js';
import {
    AgentResourceReferenceSchema,
    AgentSearchScopeSchema,
    AgentToolApprovalModeSchema,
    ComputedFacetResponseSchema,
    ConversationVisibilitySchema,
    FacetSpecSchema,
    InitialToolCallSchema,
    InteractionRefSchema,
    NumberValueMapSchema,
    PlanTaskSchema,
    RunSourceSchema,
    SortOptionSchema,
    UserChannelSchema,
} from './interaction.js';
import { AgentCheckpointConfigurationSchema } from './project-configuration.js';
import {
    ColumnLayoutSchema,
    ContentObjectTypeSchema,
    IntakeEmbeddingSwitchesSchema,
    InteractionExecutionConfigurationSchema,
} from './store.js';
import { TaskFieldSchema } from './task.js';

/**
 * Generated from the published components by `scripts/convert-to-zod.mjs`, then reviewed.
 *
 * Every schema below was checked against the document it replaces: `--verify` re-emits this
 * module through the registry adapter and diffs it, so the shapes are the shipped ones.
 */
export const AgentMessageTypeSchema = z
    .union([
        z.literal(0),
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.literal(4),
        z.literal(5),
        z.literal(6),
        z.literal(7),
        z.literal(8),
        z.literal(9),
        z.literal(10),
        z.literal(11),
        z.literal(12),
        z.literal(13),
        z.literal(14),
    ])
    .meta({
        id: 'AgentMessageType',
        anyOf: undefined,
        type: 'number',
        enum: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
    }) as z.ZodType<AgentMessageType>;

export const DurationValueSchema = z
    .union([z.string(), z.number()])
    .meta({ id: 'DurationValue', anyOf: undefined, type: ['string', 'number'] }) as z.ZodType<StringValue | number>;

export const ContentObjectProcessingPrioritySchema = z
    .enum(['normal', 'low'])
    .meta({ id: 'ContentObjectProcessingPriority' });

export const CostExportCsvResponseSchema = z.string().meta({ id: 'CostExportCsvResponse' });

export const AgentRunArtifactPathArraySchema = z.array(z.string()).meta({ id: 'AgentRunArtifactPathArray' });

export const ServerSentEventsResponseSchema = z.string().meta({ id: 'ServerSentEventsResponse' });

// Preserve the compact OpenAPI 3.1 nullable spelling produced by the legacy
// TypeScript generator. The forms validate identically, but this avoids changing
// generated SDK models solely because Zod normally emits an anyOf wrapper.
const nullableStringSchema = z
    .string()
    .nullable()
    .meta({ anyOf: undefined, type: ['string', 'null'] });
const nullableNumberSchema = z
    .number()
    .nullable()
    .meta({ anyOf: undefined, type: ['number', 'null'] });

export const ProcessDefinitionMetadataSchema = z.looseObject({}).meta({ id: 'ProcessDefinitionMetadata' });

export const JsonLogicRuleSchema = z.looseObject({}).meta({ id: 'JsonLogicRule' });

export const BranchJoinPolicySchema = z.literal('all').meta({ id: 'BranchJoinPolicy' });

export const ParallelFailurePolicySchema = z
    .enum(['fail_fast', 'collect_errors'])
    .meta({ id: 'ParallelFailurePolicy' });

export const ParallelCollectFieldSchema = z
    .enum([
        'status',
        'index',
        'item',
        'item_id',
        'branch_id',
        'branch_title',
        'output',
        'context_update',
        'error',
        'child_run_id',
        'child_workflow_id',
        'child_workflow_run_id',
    ])
    .meta({ id: 'ParallelCollectField' });

export const ParallelCollectModeSchema = z.literal('array').meta({ id: 'ParallelCollectMode' });

export const HumanTaskDefinitionSchema = z
    .strictObject({
        title: z.string(),
        description: z.string().optional(),
        assignee: z
            .string()
            .meta({
                description:
                    'Who owns the task. Either a group reference (`group:<name>`) or a concrete user id. Leave unset to make the task available to anyone who can see the inbox. `role:<name>` is not supported — use `group:<name>` instead.',
            })
            .optional(),
        fields: z.array(TaskFieldSchema),
    })
    .meta({ id: 'HumanTaskDefinition' });

export const TransitionTriggerSchema = z.enum(['auto', 'agent', 'user']).meta({ id: 'TransitionTrigger' });

export const ProcessNodeReturnsDefinitionSchema = z
    .strictObject({
        from: z
            .string()
            .meta({
                description:
                    'Path to read from the completed child process state. Use `context.foo` for child context values or `state.sequence` for process-state fields. If omitted, the child context is used as the node output.',
            })
            .optional(),
        context: z
            .array(z.string())
            .meta({
                description:
                    'Select specific fields from the completed child process context. Ignored when `from` is set.',
            })
            .optional(),
    })
    .meta({ id: 'ProcessNodeReturnsDefinition' });

export const ProcessNodeRunTypeSchema = z.enum(['supervised', 'programmatic']).meta({ id: 'ProcessNodeRunType' });

export const ProcessNodeTypeSchema = z
    .enum([
        'tool',
        'interaction',
        'agent',
        'script',
        'process',
        'human_task',
        'foreach',
        'branch',
        'condition',
        'final',
    ])
    .meta({ id: 'ProcessNodeType' });

export const ProcessContextDefinitionSchema = z
    .strictObject({
        schema: JSONSchemaSchema,
        initial: z.looseObject({}),
    })
    .meta({ id: 'ProcessContextDefinition' });

export const ProcessScriptInlineSourceSchema = z
    .strictObject({
        type: z.literal('inline'),
        files: StringValueMapSchema,
    })
    .meta({
        id: 'ProcessScriptInlineSource',
        description:
            'Script files stored directly in the process definition.\n\nThe source is a discriminated object so artifact- and Git-backed sources can be added without changing the surrounding script resource contract.',
    });

export const ProcessScriptLanguageSchema = z
    .enum(['python', 'javascript', 'typescript'])
    .meta({ id: 'ProcessScriptLanguage' });

export const ProcessDefinitionFormatVersionSchema = z.literal(1).meta({ id: 'ProcessDefinitionFormatVersion' });

export const ProcessDefinitionStatusSchema = z
    .enum(['draft', 'published', 'archived'])
    .meta({ id: 'ProcessDefinitionStatus' });

export const GenerationRunMetadataSchema = z
    .strictObject({
        id: z.string(),
        date: z.string(),
        model: z.string(),
        target: z.string().optional(),
        extraction_fingerprint: z
            .string()
            .meta({
                description:
                    'Fingerprint of the inputs used by property extraction (content etag, type + its object schema, source, instructions, interaction). Lets a later run skip re-extraction when nothing changed.',
            })
            .optional(),
    })
    .meta({ id: 'GenerationRunMetadata' });

export const ContentObjectUserPermissionsSchema = z
    .strictObject({
        can_write: z.boolean(),
        can_delete: z.boolean(),
    })
    .meta({
        id: 'ContentObjectUserPermissions',
        description:
            "Computed per-request permissions for the current user on a content object. Not stored in the database — computed on the fly by the API from the object's security field.",
    });

export const RevisionInfoSchema = z
    .strictObject({
        parent: z.string().meta({ description: 'Direct parent revision id (omit on the first revision)' }).optional(),
        root: z.string().meta({ description: 'The root revision id (omit on the first revision)' }),
        head: z.boolean().meta({ description: 'True if this revision is the head revision' }),
        label: z.string().meta({ description: 'Human‑friendly tag or state ("v1.2", "approved")' }).optional(),
    })
    .meta({ id: 'RevisionInfo' });

export const ContentSourceSchema = z
    .strictObject({
        source: z.string().optional(),
        type: z.string().optional(),
        name: z.string().optional(),
        etag: z.string().optional(),
    })
    .meta({ id: 'ContentSource' });

export const ContentObjectStatusSchema = z.enum(ContentObjectStatus).meta({ id: 'ContentObjectStatus' });

export const InheritedPropertyMetadataSchema = z
    .strictObject({
        name: z.string().meta({ description: 'The property name that was inherited' }),
        collection: z.string().meta({ description: 'The collection ID that provided this property' }),
    })
    .meta({ id: 'InheritedPropertyMetadata', description: 'Metadata about a single inherited property.' });

export const TranscriptSegmentSchema = z
    .strictObject({
        start: z.number(),
        text: z.string(),
        speaker: z.number().optional(),
        end: z.number().optional(),
        confidence: z.number().optional(),
        language: z.string().optional(),
    })
    .meta({ id: 'TranscriptSegment' });

export const EmbeddingSchema = z
    .strictObject({
        model: z.string(),
        values: z.array(z.number()),
        etag: z.string().optional(),
    })
    .meta({ id: 'Embedding' });

export const EventPrioritySchema = z.enum(['high', 'normal', 'low']).meta({ id: 'EventPriority' });

export const ProcessRunTypeSchema = z.enum(['supervised', 'programmatic']).meta({ id: 'ProcessRunType' });

export const AgentRunStatusSchema = z
    .enum(['created', 'running', 'completed', 'failed', 'cancelled'])
    .meta({ id: 'AgentRunStatus', description: 'Status of an agent run through its lifecycle.' });

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

export const EventCategorySchema = z
    .enum(['content', 'workflow', 'security', 'billing', 'system', 'external'])
    .meta({ id: 'EventCategory' });

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

export const CollectionSecuritySettingsResponseSchema = z
    .strictObject({
        id: z.string(),
        security: StringArrayMapSchema,
    })
    .meta({ id: 'CollectionSecuritySettingsResponse' });

export const CollectionMembersUpdateResultSchema = z
    .strictObject({
        id: z.string(),
    })
    .meta({ id: 'CollectionMembersUpdateResult' });

export const CollectionMembersUpdatePayloadSchema = z
    .strictObject({
        action: z.enum(['add', 'delete']),
        members: z.array(z.string()),
    })
    .meta({ id: 'CollectionMembersUpdatePayload' });

export const CollectionChildrenUpdateResultSchema = z
    .strictObject({
        count: z.number(),
    })
    .meta({ id: 'CollectionChildrenUpdateResult' });

export const CollectionChildrenUpdatePayloadSchema = z
    .strictObject({
        action: z.enum(['add', 'delete']),
        children: z.array(z.string()),
    })
    .meta({ id: 'CollectionChildrenUpdatePayload' });

export const UpdateAgentArtifactContentResponseSchema = z
    .strictObject({
        path: z.string(),
        generation: z.string(),
    })
    .meta({ id: 'UpdateAgentArtifactContentResponse', description: 'Result of a conditional agent artifact update.' });

export const UpdateAgentArtifactContentPayloadSchema = z
    .strictObject({
        content: z.string(),
        generation: z.string(),
    })
    .meta({ id: 'UpdateAgentArtifactContentPayload', description: 'Conditional text update for an agent artifact.' });

export const TerminateAgentRunResponseSchema = z
    .strictObject({
        message: z.string(),
        reason: z.string().optional(),
    })
    .meta({ id: 'TerminateAgentRunResponse', description: 'Response from terminating an agent run.' });

export const StartContentObjectExportResponseSchema = z
    .strictObject({
        workflow_id: z.string(),
        run_id: z.string(),
        export_id: z.string(),
    })
    .meta({ id: 'StartContentObjectExportResponse' });

export const ExportContentObjectsIncludeOptionsSchema = z
    .strictObject({
        embeddings: z
            .boolean()
            .meta({ description: 'Include stored embeddings. Disabled by default for generic object exports.' })
            .optional(),
        content: z.boolean().meta({ description: 'Include content source metadata. Enabled by default.' }).optional(),
        status: z.boolean().meta({ description: 'Include object lifecycle status. Enabled by default.' }).optional(),
        properties: z.boolean().meta({ description: 'Include object properties. Enabled by default.' }).optional(),
        metadata: z
            .boolean()
            .meta({
                description: 'Include technical object metadata. Disabled by default because metadata may be large.',
            })
            .optional(),
        revision: z.boolean().meta({ description: 'Include object revision details. Enabled by default.' }).optional(),
    })
    .meta({
        id: 'ExportContentObjectsIncludeOptions',
        description: 'Optional object context to include in content object export rows.',
    });

export const ExportContentObjectsFilterSchema = z
    .strictObject({
        types: z.array(z.string()).optional(),
        created_from: z.string().optional(),
        created_to: z.string().optional(),
        updated_from: z.string().optional(),
        updated_to: z.string().optional(),
    })
    .meta({
        id: 'ExportContentObjectsFilter',
        description: 'Bounded filters supported by the bulk content object export API.',
    });

export const SupportedEmbeddingTypesSchema = z
    .enum(['text', 'image', 'properties'])
    .meta({ id: 'SupportedEmbeddingTypes' });

export const SignalAgentPayloadSchema = z.looseObject({}).meta({
    id: 'SignalAgentPayload',
    additionalProperties: true,
    description: 'Generic signal payload sent to a running agent workflow.',
});

export const SetObjectEmbeddingsResponseSchema = z
    .strictObject({
        type: EmbeddingSchema.optional(),
    })
    .meta({ id: 'SetObjectEmbeddingsResponse' });

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

export const ContentObjectApiRevisionSchema = z
    .strictObject({
        parent: z.string().optional(),
        root: z.string(),
        head: z.boolean(),
        label: z.string().optional(),
    })
    .meta({ id: 'ContentObjectApiRevision' });

export const InCodeTypeRefSchema = z
    .strictObject({
        ref_type: z.literal('incode'),
        id: z.string().meta({
            description: 'Namespaced identifier for in-code types (e.g. "sys:Invoice", "app:myapp:Contract")',
        }),
        name: z.string(),
        default_view: z
            .enum(['auto', 'text', 'pdf', 'image', 'properties'])
            .meta({
                description:
                    "Display hint from the type's intake policy (`intake.default_view`). Enriched by the API on single-object reads so clients can pick the initial view without fetching the type. Absent on list responses and older servers.",
            })
            .optional(),
    })
    .meta({ id: 'InCodeTypeRef' });

export const StoredTypeRefSchema = z
    .strictObject({
        ref_type: z.literal('stored'),
        id: z.string().meta({ description: 'MongoDB ObjectId string for stored types' }),
        name: z.string(),
        default_view: z
            .enum(['auto', 'text', 'pdf', 'image', 'properties'])
            .meta({
                description:
                    "Display hint from the type's intake policy (`intake.default_view`). Enriched by the API on single-object reads so clients can pick the initial view without fetching the type. Absent on list responses and older servers.",
            })
            .optional(),
    })
    .meta({ id: 'StoredTypeRef' });

export const scoreAggregationTypesSchema = z.enum(['rrf', 'rsf', 'smart']).meta({ id: 'scoreAggregationTypes' });

export const dynamicScalingTypesSchema = z.enum(['off', 'on']).meta({ id: 'dynamicScalingTypes' });

export const Record_SearchTypes_numberSchema = z
    .object({})
    .catchall(z.number())
    .meta({ id: 'Record_SearchTypes_number' });

export const EmbeddingSearchConfigSchema = IntakeEmbeddingSwitchesSchema.meta({ id: 'EmbeddingSearchConfig' });

export const CollectionStatusSchema = z
    .enum(['active', 'archived'])
    .meta({ id: 'CollectionStatus' }) as z.ZodType<CollectionStatus>;

export const AgentRunTypeSchema = z
    .enum(['api', 'schedule', 'event_subscription'])
    .meta({ id: 'AgentRunType', description: 'How the agent run was created.' });

export const EventRefSchema = z
    .strictObject({
        event_id: z.string(),
        root_event_id: z.string(),
        caused_by_event_id: z.string().optional(),
        hop_count: z.number(),
        event_category: EventCategorySchema,
        action: z.string(),
        resource_type: z.string(),
        resource_id: z.string(),
        account_id: nullableStringSchema,
        project_id: nullableStringSchema,
        tenant_id: nullableStringSchema,
    })
    .meta({ id: 'EventRef' });

export const ConversationActivityStateSchema = z.enum(['working', 'idle']).meta({ id: 'ConversationActivityState' });

export const RunKindSchema = z.enum(['agent', 'process']).meta({
    id: 'RunKind',
    description: 'Internal discriminator key for documents stored in the agent_runs collection.',
});

export const RunTypeSchema = z
    .enum(['autonomous', 'supervised', 'programmatic'])
    .meta({ id: 'RunType', description: 'Public-facing runtime mode.' });

export const RevertProcessDefinitionPayloadSchema = z
    .strictObject({
        confirmed: z.boolean().meta({ description: 'Required explicit confirmation from the caller.' }),
        comment: z
            .string()
            .meta({ description: 'Optional note explaining why this version is being restored as the draft.' })
            .optional(),
    })
    .meta({ id: 'RevertProcessDefinitionPayload' });

export const RetryProcessNodePayloadSchema = z
    .strictObject({
        node: z.string().optional(),
        reason: z.string().optional(),
    })
    .meta({ id: 'RetryProcessNodePayload' });

export const nd_restart_count_numberSchema = z
    .strictObject({
        nd_restart_count: z.number().optional(),
    })
    .meta({ id: 'nd_restart_count_number' });

export const WorkflowQueryResultSchema = JSONValueSchema.meta({ id: 'WorkflowQueryResult' });

export const PublishProcessDefinitionPayloadSchema = z
    .strictObject({
        confirmed: z.boolean().meta({ description: 'Required explicit confirmation from the caller.' }),
        tags: z
            .array(z.string())
            .meta({ description: 'Optional tags to merge into the published revision.' })
            .optional(),
        label: z.string().meta({ description: 'Optional human-readable revision label.' }).optional(),
        comment: z.string().meta({ description: 'Optional publish note.' }).optional(),
    })
    .meta({ id: 'PublishProcessDefinitionPayload' });

export const CollectionPropagationResponseSchema = z
    .strictObject({
        id: z.string(),
        message: z.string(),
        security: StringArrayMapSchema.optional(),
        shared_properties: z.array(z.string()).optional(),
    })
    .meta({ id: 'CollectionPropagationResponse' });

export const ViewSortClauseSchema = z
    .strictObject({
        field: z.string(),
        order: z.enum(['asc', 'desc']),
    })
    .meta({ id: 'ViewSortClause' });

export const ViewResultMediaSchema = z
    .strictObject({
        source: z.enum(['content_thumbnail', 'property', 'type_icon']),
        field: z.string().optional(),
        fit: z.enum(['cover', 'contain']).optional(),
        fallback: z.enum(['type_icon', 'placeholder', 'none']).optional(),
    })
    .meta({ id: 'ViewResultMedia' });

export const ViewResultFieldFormatSchema = z
    .enum(['text', 'date', 'number', 'badge', 'user', 'content_type', 'location'])
    .meta({ id: 'ViewResultFieldFormat' });

export const ViewBoardColumnSchema = z
    .strictObject({
        value: z.string(),
        label: z.string(),
        order: z.number().optional(),
    })
    .meta({ id: 'ViewBoardColumn' });

export const ViewTableColumnSchema = z
    .strictObject({
        field: z.string(),
        label: z.string().optional(),
        format: ViewResultFieldFormatSchema.optional(),
        fallback: z.string().optional(),
        width: z.number().optional(),
        sortable: z.boolean().optional(),
        sort_option: z.string().optional(),
    })
    .meta({ id: 'ViewTableColumn' });

export const AgenticViewSearchConfigurationSchema = z
    .strictObject({
        interaction: z.string().optional(),
        config: InteractionExecutionConfigurationSchema.optional(),
        instructions: z
            .string()
            .meta({ description: 'View-specific guidance for Elasticsearch query planning.' })
            .optional(),
        mode: z.literal('query').optional(),
        timeout_ms: z.number().optional(),
        minimum_confidence: z.number().optional(),
    })
    .meta({ id: 'AgenticViewSearchConfiguration' });

export const ViewSearchFieldTypeSchema = z
    .enum(['text', 'keyword', 'number', 'date', 'boolean'])
    .meta({ id: 'ViewSearchFieldType' });

export const ViewSearchFieldDefinitionSchema = z
    .strictObject({
        field: z.string(),
        description: z
            .string()
            .meta({ description: 'Meaning of the field for query planners, for example "Full OCR text".' })
            .optional(),
        type: ViewSearchFieldTypeSchema.meta({
            description: 'Mapping hint used only when the active index mapping does not expose a type.',
        }).optional(),
        mode: z
            .enum(['auto', 'full_text', 'exact'])
            .meta({
                description:
                    '`full_text` enables scoring text queries, `exact` limits the field to structured operators, and `auto` derives behavior from the mapped type.',
            })
            .optional(),
        boost: z
            .number()
            .meta({ description: 'Relative boost when this field participates in multi-field text search.' })
            .optional(),
    })
    .meta({
        id: 'ViewSearchFieldDefinition',
        description:
            'A mapped Elasticsearch field that a View may use for query planning and deterministic full-text fallback.',
    });

export const ViewRangeDefinitionSchema = z
    .strictObject({
        id: z.string(),
        label: z.string(),
        from: z.number().optional(),
        to: z.number().optional(),
    })
    .meta({ id: 'ViewRangeDefinition' });

export const ViewHierarchyLevelSchema = z
    .strictObject({
        id: z.string(),
        label: z.string(),
        field: z.string(),
        size: z.number().optional(),
        sort: z.enum(['count', 'label']).optional(),
    })
    .meta({ id: 'ViewHierarchyLevel' });

export const ViewTermsNavigationSchema = z
    .strictObject({
        id: z.string(),
        label: z.string(),
        presentation: z.enum(['tree', 'list', 'select', 'chips']).optional(),
        multi_select: z.boolean().optional(),
        order: z.number().optional(),
        renderer: z.string().optional(),
        source: z.literal('terms'),
        field: z.string(),
        size: z.number().optional(),
        sort: z.enum(['count', 'label']).optional(),
    })
    .meta({ id: 'ViewTermsNavigation' });

export const ViewCollectionNavigationSchema = z
    .strictObject({
        id: z.string(),
        label: z.string(),
        presentation: z.enum(['tree', 'list', 'select', 'chips']).optional(),
        multi_select: z.boolean().optional(),
        order: z.number().optional(),
        renderer: z.string().optional(),
        source: z.literal('collection'),
        roots: z.array(z.string()).optional(),
        include_descendants: z.boolean().optional(),
    })
    .meta({ id: 'ViewCollectionNavigation' });

export const ViewLocationNavigationSchema = z
    .strictObject({
        id: z.string(),
        label: z.string(),
        presentation: z.enum(['tree', 'list', 'select', 'chips']).optional(),
        multi_select: z.boolean().optional(),
        order: z.number().optional(),
        renderer: z.string().optional(),
        source: z.literal('location'),
        roots: z.array(z.string()).optional(),
        depth: z.number().optional(),
    })
    .meta({ id: 'ViewLocationNavigation' });

export const ViewElasticsearchQuerySchema = z.object({}).catchall(z.unknown()).meta({
    id: 'ViewElasticsearchQuery',
    description: 'An author-provided Elasticsearch query subtree validated by the View runtime.',
});

export const ViewExperienceLayoutSchema = z
    .strictObject({
        mode: z.enum(['browse', 'worklist']).optional(),
        navigation_position: z.enum(['sidebar', 'top']).optional(),
    })
    .meta({ id: 'ViewExperienceLayout' });

export const WorkflowUpdatePublishResponseSchema = z
    .strictObject({
        success: z.boolean(),
    })
    .meta({ id: 'WorkflowUpdatePublishResponse' });

export const PostAgentRunUpdateResponseSchema = z
    .strictObject({
        success: z.boolean(),
    })
    .meta({ id: 'PostAgentRunUpdateResponse', description: 'Response from posting an agent update.' });

export const FileProcessingStatusSchema = z.enum(['uploading', 'processing', 'ready', 'error']).meta({
    id: 'FileProcessingStatus',
    description: 'Status of a file being processed for conversation use.',
}) as z.ZodType<FileProcessingStatus>;

export const ListWorkflowRunsPayloadSchema = z
    .strictObject({
        document_id: z.string().meta({ description: 'The document ID passed to a workflow run.' }).optional(),
        event_name: z.string().meta({ description: 'The event name that triggered the workflow.' }).optional(),
        rule_id: z.string().meta({ description: 'Legacy workflow rule ID filter, when applicable.' }).optional(),
        start: z.string().meta({ description: 'The start time for filtering workflow runs.' }).optional(),
        end: z.string().meta({ description: 'The end time for filtering workflow runs.' }).optional(),
        status: z.string().meta({ description: 'The status of the workflow run.' }).optional(),
        search_term: z.string().meta({ description: 'search term to filter on workflow id and run id' }).optional(),
        initiated_by: z
            .string()
            .meta({ description: 'The user or service account that initiated the workflow run.' })
            .optional(),
        interaction: z.string().meta({ description: 'The interaction name used to filter conversations.' }).optional(),
        query: z
            .string()
            .meta({
                description:
                    'Lucene query string to search for the workflow runs. This is a full text search on the workflow run history.',
            })
            .optional(),
        type: z.string().optional(),
        page_size: z.number().meta({ description: 'The maximum number of results to return per page.' }).optional(),
        next_page_token: z.string().meta({ description: 'The page token for Temporal pagination.' }).optional(),
        has_reported_errors: z
            .boolean()
            .meta({ description: 'Filter by whether the workflow has reported errors (TemporalReportedProblems).' })
            .optional(),
        activity_state: ConversationActivityStateSchema.meta({
            description: 'Filter by the activity state of the conversation (running or idle).',
        }).optional(),
        interactive: z.boolean().meta({ description: 'Filter by whether the conversation is interactive.' }).optional(),
    })
    .meta({ id: 'ListWorkflowRunsPayload' });

export const WorkflowRuleItemSchema = z
    .strictObject({
        id: z.string().meta({ description: 'Unique identifier for the object' }),
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

export const WorkflowDefinitionRefSchema = z
    .strictObject({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
        created_at: z.string().meta({ format: 'date-time' }),
        updated_at: z.string().meta({ format: 'date-time' }),
    })
    .meta({ id: 'WorkflowDefinitionRef' });

export const ProcessDefinitionRevisionInfoSchema = z
    .strictObject({
        parent: z
            .string()
            .meta({ description: 'Direct parent revision id. Omitted for the first revision in a bucket.' })
            .optional(),
        root: z
            .string()
            .meta({ description: 'Root revision id shared by all revisions of the same process definition.' }),
        head: z
            .boolean()
            .meta({ description: 'True when this is the latest revision returned by default list/resolve calls.' }),
        label: z.string().meta({ description: 'Optional human-readable label for the revision.' }).optional(),
        comment: z
            .string()
            .meta({ description: 'Optional publish note captured when a draft is promoted.' })
            .optional(),
    })
    .meta({ id: 'ProcessDefinitionRevisionInfo' });

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

export const ContentObjectTypeArraySchema = z.array(ContentObjectTypeSchema).meta({ id: 'ContentObjectTypeArray' });

export const ContentObjectExportArtifactFileSchema = z
    .strictObject({
        role: z.enum(['data', 'manifest']),
        path: z.string(),
        filename: z.string(),
        content_type: z.string(),
        bytes: z.number(),
    })
    .meta({ id: 'ContentObjectExportArtifactFile' });

export const ProcessRunConfigSchema = z
    .strictObject({
        model: z.string().optional(),
        user_message: z
            .string()
            .meta({
                description:
                    'Free-form message from the user when starting a run. Passed to the orchestrator LLM in supervised mode; stored on the run regardless so programmatic runs retain the intent that triggered them.',
            })
            .optional(),
        process_workstream_monitor: z
            .strictObject({
                monitor_workflow_id: z.string(),
                launch_id: z.string().optional(),
                workstream_id: z.string().optional(),
            })
            .meta({
                description:
                    'Optional monitor workflow used when a process is launched as a conversation workstream. The process workflow sends checkpoint status signals to this monitor so long-running human-task processes do not need tight polling.',
            })
            .optional(),
    })
    .meta({ id: 'ProcessRunConfig' });

export const ProcessHistoryRefSchema = z
    .strictObject({
        path: z.string(),
        latest_sequence: z.number(),
        count: z.number(),
    })
    .meta({ id: 'ProcessHistoryRef' });

export const NodeHistoryEntrySchema = z
    .strictObject({
        id: z.string().optional(),
        node: z.string(),
        attempt: z.number().optional(),
        entered_at: z.string().meta({ format: 'date-time' }),
        exited_at: z.string().meta({ format: 'date-time' }).optional(),
        status: z.enum(['running', 'completed', 'skipped', 'failed', 'cancelled']),
        context_diff: z.looseObject({}).optional(),
        data_ref: z.string().optional(),
        sequence: z.number().optional(),
        child_run_id: z.string().optional(),
        child_workflow_id: z.string().optional(),
        child_workflow_run_id: z.string().optional(),
        artifacts: z.array(z.string()).optional(),
        log_ref: z.string().optional(),
    })
    .meta({ id: 'NodeHistoryEntry' });

export const AgentRunArchiveStateSchema = z.enum(['none', 'pending', 'archiving', 'complete', 'failed']).meta({
    id: 'AgentRunArchiveState',
    description:
        'Archive lifecycle state for an agent run.\n\n- `none`:      No archive exists (default)\n- `pending`:   Terminal status recorded; archive workflow triggered\n- `archiving`: Archive workflow is running\n- `complete`:  Archive stored in GCS successfully\n- `failed`:    Archive attempt failed (see `last_archive_error`)',
});

export const ResourceRefSchema = z
    .strictObject({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        email: z.string().optional(),
        description: z.string().optional(),
        version: z.number().optional(),
        status: z.string().optional(),
        tags: z.array(z.string()).optional(),
        endpoint: z.string().optional(),
    })
    .meta({ id: 'ResourceRef' });

export const WorkflowRunSchema = z
    .strictObject({
        status: z.union([WorkflowExecutionStatusSchema, z.string()]).optional(),
        type: z.string().meta({ description: 'The Temporal Workflow Type of this Workflow Run.' }).optional(),
        started_at: nullableStringSchema,
        closed_at: nullableStringSchema,
        execution_duration: z.number().optional(),
        run_id: z.string().optional(),
        workflow_id: z.string().optional(),
        initiated_by: z.string().optional(),
        interaction_name: z.string().optional(),
        input: z.unknown().optional(),
        result: z.unknown().optional(),
        error: z.unknown().optional(),
        has_reported_errors: z.boolean().optional(),
        raw: z.unknown().optional(),
        vertesia_workflow_type: z
            .string()
            .meta({
                description:
                    'The Vertesia Workflow Type of this Workflow Run.  - For DSL workflows (`type:dslWorkflow`), the vertesia_type refers to the "Workflow Rule Name" specified in the    DSL. For example, "Standard Document Intake" or "Standard Image Intake".  - For non-DSL workflows, the vertesia_type is the name of the Temporal Workflow Type.',
            })
            .optional(),
        interactions: z
            .array(InteractionRefSchema)
            .meta({ description: 'An interaction is used to start the agent, the data is stored on temporal "vars"' })
            .optional(),
        visibility: ConversationVisibilitySchema.meta({
            description:
                "The visibility of the workflow run.\n- 'private': Only visible to the user who initiated the workflow\n- 'project': Visible to all users in the project",
        }).optional(),
        topic: z.string().meta({ description: 'A brief summary of the conversation workflow.' }).optional(),
        activity_state: ConversationActivityStateSchema.meta({
            description:
                "The current activity state of the conversation.\n- 'working': The agent is actively processing\n- 'idle': The agent is waiting for user input",
        }).optional(),
        interactive: z
            .boolean()
            .meta({ description: 'Whether this conversation is interactive (accepts user input).' })
            .optional(),
    })
    .meta({ id: 'WorkflowRun' });

export const ProcessHistoryResponseSchema = z
    .strictObject({
        run_id: z.string(),
        current_node: z.string(),
        node_history_ref: z
            .strictObject({
                path: z.string(),
                latest_sequence: z.number(),
                count: z.number(),
            })
            .optional(),
    })
    .meta({ id: 'ProcessHistoryResponse' });

export const ProcessContextResponseSchema = z
    .strictObject({
        run_id: z.string(),
        current_node: z.string(),
    })
    .meta({ id: 'ProcessContextResponse' });

export const ContentObjectTextResponseSchema = z
    .strictObject({
        text: z.string().optional(),
    })
    .meta({ id: 'ContentObjectTextResponse' });

export const GetRenditionResponseSchema = z
    .strictObject({
        status: z.enum(['found', 'generating', 'failed']),
        renditions: z.array(z.string()).optional(),
        workflow_run_id: z.string().optional(),
    })
    .meta({ id: 'GetRenditionResponse' });

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

export const ContentObjectExportResultSchema = z
    .strictObject({
        status: z.literal('completed'),
        path: z.string(),
        filename: z.string(),
        content_type: z.string(),
        manifest_path: z.string().optional(),
        manifest_filename: z.string().optional(),
        manifest_content_type: z.string().optional(),
        manifest_bytes: z.number().optional(),
        records: z.number(),
        bytes: z.number(),
        started_at: z.string(),
        completed_at: z.string(),
        duration_ms: z.number(),
    })
    .meta({ id: 'ContentObjectExportResult' });

export const ContentObjectExportProgressSchema = z
    .strictObject({
        status: z.enum(['queued', 'planning', 'exporting', 'composing', 'completed', 'failed']),
        records: z.number(),
        bytes: z.number(),
        path: z.string().optional(),
        filename: z.string().optional(),
        completed_shards: z.number().optional(),
        total_shards: z.number().optional(),
        started_at: z.string().optional(),
        completed_at: z.string().optional(),
        error: z.string().optional(),
    })
    .meta({ id: 'ContentObjectExportProgress' });

export const PendingActivitySchema = z
    .strictObject({
        activityId: z.string().optional(),
        activityType: z.string().optional(),
        attempt: z.number(),
        maximumAttempts: z.number(),
        lastFailure: z.string().optional(),
        lastStartedTime: nullableStringSchema,
    })
    .meta({ id: 'PendingActivity' });

export const AgentTaskSchema = z
    .strictObject({
        taskType: z
            .enum(['tool_call', 'llm_call', 'input', 'timer', 'subagent', 'processing', 'signal'])
            .meta({ description: 'Type discriminator for future task types' }),
        toolName: z.string().meta({ description: 'Tool-specific fields' }),
        toolUseId: z.string().optional(),
        toolRunId: z.string().optional(),
        toolType: z.enum(['builtin', 'interaction', 'remote', 'skill']).optional(),
        iteration: z.number().optional(),
        scheduled_at: nullableStringSchema.meta({ description: 'Execution details' }),
        started_at: nullableStringSchema,
        completed_at: nullableStringSchema,
        status: z.enum(['running', 'completed', 'error', 'warning', 'received', 'sent']),
        parameters: z.looseObject({}).meta({ description: 'Tool data' }).optional(),
        result: z.string().optional(),
        error: z
            .strictObject({
                type: z.string(),
                message: z.string(),
            })
            .optional(),
        retries: z.number().meta({ description: 'Number of activity retries' }).optional(),
        activeTools: z.array(z.string()).meta({ description: 'Active tools for this LLM call' }).optional(),
        availableSkills: z.array(z.string()).meta({ description: 'Available skills for this LLM call' }).optional(),
        runId: z.string().meta({ description: 'Temporal run ID that produced this task.' }).optional(),
        workstreamId: z.string().meta({ description: 'Workstream tracking' }).optional(),
        direction: z
            .enum(['sending', 'receiving'])
            .meta({ description: 'Signal direction for signal tasks' })
            .optional(),
        finish_reason: z
            .string()
            .meta({ description: 'LLM stop reason for llm_call tasks (e.g., "stop", "length", "tool_use")' })
            .optional(),
        warnings: z
            .array(z.string())
            .meta({ description: 'Warnings about the task outcome (e.g. unexpected model behavior).' })
            .optional(),
    })
    .meta({
        id: 'AgentTask',
        description:
            'Agent task information for workflow history UI representation. This is separate from the analytics AgentEvent types. Consistent with WorkflowTask naming convention.\n\nCurrently represents tool calls, but designed to be extensible for other task types (LLM calls, checkpoints, etc.)',
    });

export const TaskStatusSchema = z
    .enum(['scheduled', 'running', 'completed', 'failed', 'canceled', 'timed_out', 'terminated', 'sent', 'received'])
    .meta({ id: 'TaskStatus' });

export const TaskType_TIMERSchema = z.literal('timer').meta({ id: 'TaskType_TIMER' });

export const TaskType_SIGNALSchema = z.literal('signal').meta({ id: 'TaskType_SIGNAL' });

export const TaskType_CHILD_WORKFLOWSchema = z.literal('childWorkflow').meta({ id: 'TaskType_CHILD_WORKFLOW' });

export const TaskType_ACTIVITYSchema = z.literal('activity').meta({ id: 'TaskType_ACTIVITY' });

export const EventErrorSchema = z
    .strictObject({
        message: z.string().optional(),
        source: z.string().optional(),
        stacktrace: z.string().optional(),
        type: z.string().optional(),
    })
    .meta({ id: 'EventError', description: 'Error information from failed workflow events' });

export const SignalEventPropertiesSchema = z
    .strictObject({
        direction: z.enum(['receiving', 'sending']),
        signalName: z.string().optional(),
        input: z.unknown().optional(),
        sender: z
            .strictObject({
                workflowId: z.string().optional(),
                runId: z.string().optional(),
            })
            .optional(),
        recipient: z
            .strictObject({
                workflowId: z.string().optional(),
                runId: z.string().optional(),
            })
            .optional(),
        initiatedEventId: z.string().optional(),
    })
    .meta({ id: 'SignalEventProperties', description: 'Signal event properties for workflow events' });

export const AgentArtifactContentResponseSchema = z
    .strictObject({
        path: z.string(),
        content: z.string(),
        generation: z.string(),
    })
    .meta({
        id: 'AgentArtifactContentResponse',
        description: 'Text content and concurrency token for an agent artifact.',
    });

export const ExportPropertiesResponseSchema = z
    .strictObject({
        type: z.string(),
        name: z.string(),
        data: z.string(),
    })
    .meta({ id: 'ExportPropertiesResponse' });

export const WorkflowExecutionStartResultSchema = z
    .strictObject({
        run_id: z.string(),
        workflow_id: z.string(),
    })
    .meta({ id: 'WorkflowExecutionStartResult' });

export const WorkflowInputFileSchema = z
    .strictObject({
        url: z.string(),
        mimetype: z.string(),
    })
    .meta({ id: 'WorkflowInputFile', description: 'File reference with URL and mimetype' });

export const ViewNavigationNodeSchema: z.ZodType<ViewNavigationNode> = z
    .strictObject({
        id: z.string(),
        label: z.string(),
        count: z.number(),
        selected: z.boolean().optional(),
        expandable: z.boolean().optional(),
        children: z.array(z.lazy(() => ViewNavigationNodeSchema)).optional(),
        path: z.string().optional(),
    })
    .meta({ id: 'ViewNavigationNode' });

export const ViewHitAnnotationSchema = z
    .strictObject({
        why_match: z.string().optional(),
        answer: z.string().optional(),
        excerpt: z.string().optional(),
    })
    .meta({ id: 'ViewHitAnnotation' });

export const ViewExecutionWarningSchema = z
    .strictObject({
        code: z.string(),
        message: z.string(),
        path: z.string().optional(),
    })
    .meta({ id: 'ViewExecutionWarning' });

export const ViewQueryPlanningFailureCodeSchema = z
    .enum(['interaction_failed', 'invalid_output', 'invalid_query', 'low_confidence', 'timeout', 'unknown'])
    .meta({ id: 'ViewQueryPlanningFailureCode' });

export const ExecuteViewRequestSchema = z
    .strictObject({
        query: z.string().optional(),
        key_terms: StringArrayMapSchema.optional(),
        navigation: StringArrayMapSchema.optional(),
        display: z.string().optional(),
        sort: z.string().optional(),
        offset: z.number().optional(),
        limit: z.number().optional(),
    })
    .meta({ id: 'ExecuteViewRequest' });

export const DeleteContentObjectResultSchema = z
    .strictObject({
        id: z.string(),
        count: z.number(),
    })
    .meta({ id: 'DeleteContentObjectResult' });

export const DeleteContentObjectExportResponseSchema = z
    .strictObject({
        success: z.boolean(),
        export_id: z.string(),
        path: z.string(),
    })
    .meta({ id: 'DeleteContentObjectExportResponse' });

export const WorkflowRuleSchema = z
    .strictObject({
        id: z.string().meta({ description: 'Unique identifier for the object' }),
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

export const CreateWorkflowRulePayloadSchema = z
    .strictObject({
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
        endpoint: z.string(),
        input_type: WorkflowRuleInputTypeSchema.optional(),
        name: z.string().meta({ description: 'Human-readable name or title' }),
        description: z.string().meta({ description: 'Optional detailed description of the object' }).optional(),
        tags: z.array(z.string()).meta({ description: 'Optional array of categorization tags' }).optional(),
        updated_by: z.string().meta({ description: 'Identifier of the user who last modified the object' }).optional(),
        created_by: z.string().meta({ description: 'Identifier of the user who created the object' }).optional(),
    })
    .meta({ id: 'CreateWorkflowRulePayload' });

export const ActivityFetchSpecSchema = z
    .strictObject({
        type: z.enum(['document', 'document_type', 'interaction_run']).meta({ description: 'The data provider name' }),
        source: z.string().meta({ description: 'An optional URI to the data source.' }).optional(),
        query: z.looseObject({}).meta({ description: 'The query to be executed by the data provider' }),
        select: z
            .string()
            .meta({
                description:
                    'a string of space separated field names. Prefix a field name with "-" to exclude it from the result.',
            })
            .optional(),
        limit: z
            .number()
            .meta({
                description:
                    'The number of results to return. If the result is limited to 1 the result will be a single object',
            })
            .optional(),
        on_not_found: z
            .enum(['ignore', 'throw'])
            .meta({
                description:
                    'How to handle not found objects. 1. ignore - Ignore and return an empty array for multi objects query (or undefined for single object query) or empty array for multiple objects throw an error. 2. throw - Throw an error if the object or no objects are found.',
            })
            .optional(),
    })
    .meta({ id: 'ActivityFetchSpec' });

export const ImportSpecSchema = z.array(z.unknown()).meta({ id: 'ImportSpec' });

export const WorkflowSearchAttributeValueSchema = z
    .array(
        z.union([z.string(), z.number(), z.boolean()]).meta({
            anyOf: undefined,
            oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
        }),
    )
    .meta({ id: 'WorkflowSearchAttributeValue' });

export const EmbeddingMapSchema = z.object({}).catchall(EmbeddingSchema).meta({ id: 'EmbeddingMap' });

export const CreateCollectionPayloadSchema = z
    .strictObject({
        name: z.string(),
        dynamic: z.boolean(),
        description: z.string().optional(),
        skip_head_sync: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
        type: nullableStringSchema.optional(),
        query: z.looseObject({}).optional(),
        properties: z.looseObject({}).optional(),
        parent: nullableStringSchema.optional(),
        table_layout: z
            .array(ColumnLayoutSchema)
            .nullable()
            .meta({ anyOf: undefined, type: ['array', 'null'], items: { $ref: 'ColumnLayout' } })
            .optional(),
        allowed_types: z.array(z.string()).optional(),
        updated_by: z.string().optional(),
        shared_properties: z.array(z.string()).optional(),
        sensitivity: z.number().meta({ description: 'BLP sensitivity level for member documents' }).optional(),
        compartments: z.array(z.string()).meta({ description: 'Compartments for member documents' }).optional(),
    })
    .meta({ id: 'CreateCollectionPayload' });

export const AgentArtifactUrlResponseSchema = z
    .strictObject({
        url: z.string(),
        path: z.string(),
    })
    .meta({ id: 'AgentArtifactUrlResponse', description: 'Signed artifact URL response for agent artifacts.' });

export const FindPayloadSchema = z
    .strictObject({
        query: z.looseObject({}),
        offset: z.number().optional(),
        limit: z.number().optional(),
        select: z.string().optional(),
        all_revisions: z.boolean().optional(),
        from_root: z.string().optional(),
    })
    .meta({ id: 'FindPayload' });

export const WorkflowActionResponseSchema = z
    .strictObject({
        message: z.string(),
    })
    .meta({ id: 'WorkflowActionResponse' });

export const AnswerProcessTaskPayloadSchema = z
    .strictObject({
        task_id: z.string(),
    })
    .meta({ id: 'AnswerProcessTaskPayload' });

export const SignalAgentResponseSchema = z
    .strictObject({
        status: z.string(),
        message: z.string(),
    })
    .meta({ id: 'SignalAgentResponse', description: 'Response from signaling an agent workflow.' });

export const AdvanceProcessPayloadSchema = z
    .strictObject({
        target: z.string().optional(),
        reason: z.string().optional(),
    })
    .meta({ id: 'AdvanceProcessPayload' });

export const BranchDefinitionSchema = z
    .strictObject({
        to: z.string(),
        when: JsonLogicRuleSchema.optional(),
        default: z.boolean().optional(),
        metadata: ProcessDefinitionMetadataSchema.optional(),
    })
    .meta({ id: 'BranchDefinition' });

export const ParallelCollectDefinitionSchema = z
    .strictObject({
        into: z.string().meta({ description: 'Context key that receives the collected results.' }),
        mode: ParallelCollectModeSchema.optional(),
        include: z
            .array(ParallelCollectFieldSchema)
            .meta({
                description:
                    'Fields to include in each collected item. Defaults to the operational envelope: status, index, item_id, output, error, and child_run_id.',
            })
            .optional(),
    })
    .meta({ id: 'ParallelCollectDefinition' });

export const TransitionDefinitionSchema = z
    .strictObject({
        to: z.string(),
        guard: JsonLogicRuleSchema.optional(),
        trigger: TransitionTriggerSchema.optional(),
        label: z.string().optional(),
        metadata: ProcessDefinitionMetadataSchema.optional(),
    })
    .meta({ id: 'TransitionDefinition' });

export const ProcessScriptSourceSchema = ProcessScriptInlineSourceSchema.meta({ id: 'ProcessScriptSource' });

export const TranscriptSchema = z
    .strictObject({
        text: z.string().optional(),
        segments: z.array(TranscriptSegmentSchema).optional(),
        etag: z.string().optional(),
    })
    .meta({ id: 'Transcript' });

export const Partial_Record_SupportedEmbeddingTypes_EmbeddingSchema = z
    .strictObject({
        text: EmbeddingSchema.optional(),
        image: EmbeddingSchema.optional(),
        properties: EmbeddingSchema.optional(),
    })
    .meta({ id: 'Partial_Record_SupportedEmbeddingTypes_Embedding' });

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
        signing_mode: WebhookSigningModeSchema.optional(),
        payload_mode: WebhookPayloadModeSchema.optional(),
        headers: StringValueMapSchema.optional(),
        encrypted_headers: z.boolean().optional(),
        timeout_ms: z.number().optional(),
        result_path: z.string().optional(),
        custom_data: z.looseObject({}).optional(),
    })
    .meta({ id: 'WebhookEventDeliveryTargetInput' });

export const WorkflowEventDeliveryTargetInputSchema = z
    .strictObject({
        type: z.literal('workflow'),
        endpoint: z.string(),
        workflow_class: z.string().optional(),
        task_queue: z.string().optional(),
        vars: z.looseObject({}).optional(),
        input_type: WorkflowRuleInputTypeSchema.optional(),
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

export const StartContentObjectExportRequestSchema = z
    .strictObject({
        embedding_types: z
            .array(SupportedEmbeddingTypesSchema)
            .meta({
                description:
                    'Embedding types to export when include.embeddings is true. Defaults to all supported embedding types.',
            })
            .optional(),
        filter: ExportContentObjectsFilterSchema.meta({
            description:
                "Explicit export filters. This intentionally does not accept the search API's full Mongo/search DSL.",
        }).optional(),
        all_revisions: z
            .boolean()
            .meta({ description: 'Include all revisions. Defaults to false, exporting only head revisions.' })
            .optional(),
        include: ExportContentObjectsIncludeOptionsSchema.meta({
            description: 'Optional object context selectors.',
        }).optional(),
        compression: z.boolean().meta({ description: 'Compress the export with gzip. Defaults to true.' }).optional(),
    })
    .meta({ id: 'StartContentObjectExportRequest' });

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

export const ContentObjectTypeRefSchema = z
    .discriminatedUnion('ref_type', [StoredTypeRefSchema, InCodeTypeRefSchema])
    .meta({ id: 'ContentObjectTypeRef' });

export const VectorSearchQuerySchema = z
    .strictObject({
        objectId: z.string().optional(),
        values: z.array(z.number()).optional(),
        text: z.string().optional(),
        image: z.string().optional(),
        config: EmbeddingSearchConfigSchema.optional(),
    })
    .meta({ id: 'VectorSearchQuery' });

export const ComplexCollectionSearchQuerySchema = z
    .strictObject({
        parent: nullableStringSchema.optional(),
        dynamic: z.boolean().optional(),
        status: CollectionStatusSchema.optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
        name: z.string().optional(),
        type: z.string().optional(),
        types: z.array(z.string()).optional(),
        match: z.looseObject({}).optional(),
    })
    .meta({ id: 'ComplexCollectionSearchQuery' });

export const AgentRunSearchHitSchema = z
    .strictObject({
        id: z.string().meta({ description: 'Agent run ID' }),
        score: z.number().meta({ description: 'Relevance score' }),
        interaction: z.string().meta({ description: 'Interaction ID' }).optional(),
        run_type: RunTypeSchema.meta({ description: 'Public-facing runtime mode' }).optional(),
        run_kind: RunKindSchema.meta({ description: 'Internal run discriminator' }).optional(),
        interaction_name: z.string().meta({ description: 'Human-readable interaction name' }).optional(),
        status: AgentRunStatusSchema.meta({ description: 'Current status' }),
        activity_state: ConversationActivityStateSchema.meta({
            description: 'Whether the agent is currently working or idle',
        }).optional(),
        started_at: z.string().meta({ description: 'When the run started' }),
        completed_at: z.string().meta({ description: 'When the run completed' }).optional(),
        started_by: z.string().meta({ description: 'Who started the run' }),
        title: z.string().meta({ description: 'Conversation title' }).optional(),
        topic: z.string().meta({ description: 'Conversation topic' }).optional(),
        lessons_learned: z.array(z.string()).meta({ description: 'Lessons learned from the conversation' }).optional(),
        tags: z.array(z.string()).meta({ description: 'Tags' }).optional(),
        categories: z.array(z.string()).meta({ description: 'Categories' }).optional(),
        interactive: z.boolean().meta({ description: 'Whether the agent accepts user input' }),
        collection_id: z.string().meta({ description: 'Collection ID' }).optional(),
        content_type: ContentObjectTypeRefSchema.meta({ description: 'Content type' }).optional(),
        tool_names: z.array(z.string()).meta({ description: 'Tools configured for this run' }).optional(),
        schedule_id: z.string().meta({ description: 'Schedule ID (if schedule-triggered)' }).optional(),
        event_subscription_id: z
            .string()
            .meta({ description: 'Event subscription ID (if event-triggered)' })
            .optional(),
        event_ref: EventRefSchema.meta({ description: 'Event reference (if event-triggered)' }).optional(),
        source_type: AgentRunTypeSchema.meta({ description: 'How the run was created' }).optional(),
        type: AgentRunTypeSchema.meta({
            description: 'Deprecated: Use source_type for creation source and run_type for runtime mode.',
            deprecated: true,
            'x-deprecated-message': 'Use source_type for creation source and run_type for runtime mode.',
        }).optional(),
        created_at: z.string().meta({ description: 'Created timestamp' }),
        updated_at: z.string().meta({ description: 'Updated timestamp' }),
    })
    .meta({ id: 'AgentRunSearchHit', description: 'A single search hit from Elasticsearch.' });

export const ViewSortOptionSchema = z
    .strictObject({
        id: z.string(),
        label: z.string(),
        sort: z.array(ViewSortClauseSchema),
    })
    .meta({ id: 'ViewSortOption' });

export const ViewResultFieldSchema = z
    .strictObject({
        field: z.string(),
        label: z.string().optional(),
        format: ViewResultFieldFormatSchema.optional(),
        fallback: z.string().optional(),
    })
    .meta({ id: 'ViewResultField' });

export const ViewTableDisplaySchema = z
    .strictObject({
        id: z.string(),
        label: z.string(),
        renderer: z.string().optional(),
        page_size: z.number().optional(),
        type: z.literal('table'),
        columns: z.array(ViewTableColumnSchema),
    })
    .meta({ id: 'ViewTableDisplay' });

export const ViewListDisplaySchema = z
    .strictObject({
        id: z.string(),
        label: z.string(),
        renderer: z.string().optional(),
        page_size: z.number().optional(),
        type: z.literal('list'),
        title: ViewResultFieldSchema,
        subtitle: z.array(ViewResultFieldSchema).optional(),
        description: ViewResultFieldSchema.optional(),
        media: ViewResultMediaSchema.optional(),
        badges: z.array(ViewResultFieldSchema).optional(),
    })
    .meta({ id: 'ViewListDisplay' });

const displayColumnCountSchema = z
    .union([z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)])
    .meta({ anyOf: undefined, type: 'number', enum: [2, 3, 4, 5, 6] });

export const ViewGalleryDisplaySchema = z
    .strictObject({
        id: z.string(),
        label: z.string(),
        renderer: z.string().optional(),
        page_size: z.number().optional(),
        type: z.literal('gallery'),
        media: ViewResultMediaSchema,
        title: ViewResultFieldSchema,
        caption: z.array(ViewResultFieldSchema).optional(),
        columns: displayColumnCountSchema.optional(),
    })
    .meta({ id: 'ViewGalleryDisplay' });

export const ViewCardsDisplaySchema = z
    .strictObject({
        id: z.string(),
        label: z.string(),
        renderer: z.string().optional(),
        page_size: z.number().optional(),
        type: z.literal('cards'),
        title: ViewResultFieldSchema,
        description: ViewResultFieldSchema.optional(),
        media: ViewResultMediaSchema.optional(),
        fields: z.array(ViewResultFieldSchema).optional(),
        badges: z.array(ViewResultFieldSchema).optional(),
        columns: displayColumnCountSchema.optional(),
    })
    .meta({ id: 'ViewCardsDisplay' });

export const ViewKeyTermDefinitionSchema = z
    .strictObject({
        id: z.string(),
        label: z.string(),
        field: z.string().optional(),
        type: ViewSearchFieldTypeSchema,
        multiple: z.boolean().optional(),
        operator: z.enum(['match', 'term', 'range']).optional(),
    })
    .meta({ id: 'ViewKeyTermDefinition' });

export const ViewRangeNavigationSchema = z
    .strictObject({
        id: z.string(),
        label: z.string(),
        presentation: z.enum(['tree', 'list', 'select', 'chips']).optional(),
        multi_select: z.boolean().optional(),
        order: z.number().optional(),
        renderer: z.string().optional(),
        source: z.literal('range'),
        field: z.string(),
        ranges: z.array(ViewRangeDefinitionSchema),
    })
    .meta({ id: 'ViewRangeNavigation' });

export const ViewHierarchyNavigationSchema = z
    .strictObject({
        id: z.string(),
        label: z.string(),
        presentation: z.enum(['tree', 'list', 'select', 'chips']).optional(),
        multi_select: z.boolean().optional(),
        order: z.number().optional(),
        renderer: z.string().optional(),
        source: z.literal('hierarchy'),
        levels: z.array(ViewHierarchyLevelSchema),
    })
    .meta({
        id: 'ViewHierarchyNavigation',
        description:
            'A drill-down hierarchy assembled from independently mapped properties.\n\nHierarchies represent one selected path, so multi_select may only be false. Selection ids are opaque runtime values and must not be constructed by clients.',
    });

export const ViewExperienceScopeSchema = z
    .strictObject({
        type_ids: z.array(z.string()).optional(),
        locations: z.array(z.string()).optional(),
        collection_ids: z.array(z.string()).optional(),
        include_collection_descendants: z.boolean().optional(),
        fixed_filter: ViewElasticsearchQuerySchema.optional(),
        head_only: z.boolean().optional(),
    })
    .meta({ id: 'ViewExperienceScope' });

export const ConversationFileSchema = z
    .strictObject({
        id: z.string().meta({ description: 'Unique ID for tracking this file (generated client-side)' }),
        name: z.string().meta({ description: 'Original filename' }),
        content_type: z.string().meta({ description: 'MIME type' }),
        size: z.number().meta({ description: 'Size in bytes' }),
        status: FileProcessingStatusSchema.meta({ description: 'Current processing status' }),
        artifact_path: z
            .string()
            .meta({ description: 'Artifact path (e.g., "files/document.pdf") - set after upload' })
            .optional(),
        reference: z
            .string()
            .meta({ description: 'Full artifact reference URI (e.g., "artifact:files/document.pdf")' })
            .optional(),
        md_path: z
            .string()
            .meta({ description: 'Path to extracted text markdown (e.g., "files/document.pdf.md")' })
            .optional(),
        text_extracted: z.boolean().meta({ description: 'Whether text extraction completed successfully' }).optional(),
        error: z.string().meta({ description: 'Error message if status is ERROR' }).optional(),
        started_at: z.number().meta({ description: 'Timestamp when upload started' }),
        completed_at: z.number().meta({ description: 'Timestamp when processing completed' }).optional(),
    })
    .meta({ id: 'ConversationFile', description: 'Represents a file being processed in a conversation workflow.' });

export const WorkflowRuleItemArraySchema = z.array(WorkflowRuleItemSchema).meta({ id: 'WorkflowRuleItemArray' });

export const WorkflowDefinitionRefArraySchema = z
    .array(WorkflowDefinitionRefSchema)
    .meta({ id: 'WorkflowDefinitionRefArray' });

export const CollectionSchema = z
    .strictObject({
        id: z.string().meta({ description: 'Unique identifier for the object' }),
        name: z.string().meta({ description: 'Human-readable name or title' }),
        description: z.string().meta({ description: 'Optional detailed description of the object' }).optional(),
        tags: z.array(z.string()).meta({ description: 'Optional array of categorization tags' }).optional(),
        updated_by: z.string().meta({ description: 'Identifier of the user who last modified the object' }),
        created_by: z.string().meta({ description: 'Identifier of the user who created the object' }),
        created_at: z.string().meta({ description: 'ISO timestamp of when the object was created' }),
        updated_at: z.string().meta({ description: 'ISO timestamp of when the object was last updated' }),
        dynamic: z.boolean().meta({
            description:
                'A flag to indicate if the collection is dynamic or static. If the collection is dynamic, the members are determined by a query using the query field. If the collection is static, the members are explicitly defined using the members array.',
        }),
        status: CollectionStatusSchema,
        type: ContentObjectTypeRefSchema.optional(),
        skip_head_sync: z.boolean().meta({
            description:
                'A flag to indicate whether to track and sync member HEAD revisions. The default is to sync HEAD revisions for collection members (skip_head_sync: false)',
        }),
        parents: z
            .array(z.string())
            .nullable()
            .meta({
                anyOf: undefined,
                type: ['array', 'null'],
                items: { type: 'string' },
                description: 'The parent collections if any. A collection can have multiple parents.',
            })
            .optional(),
        table_layout: z
            .array(ColumnLayoutSchema)
            .meta({
                description:
                    'The table layout to use for the collection. The layout defined in the type could serve as a fallback if not defined here.',
            })
            .optional(),
        allowed_types: z.array(z.string()).meta({ description: 'The allowed types for the collection.' }).optional(),
        properties: z.looseObject({}).optional(),
        query: z.looseObject({}).optional(),
        security: StringArrayMapSchema.optional(),
        sensitivity: z
            .number()
            .meta({ description: 'BLP sensitivity level — propagated to member documents (max across collections)' })
            .optional(),
        compartments: z
            .array(z.string())
            .meta({ description: 'Compartments — propagated to member documents (union across collections)' })
            .optional(),
        shared_properties: z
            .array(z.string())
            .meta({
                description:
                    "List of property names from the collection's properties that should be shared with (injected into) member objects. These properties will be propagated to all members of this collection and merged as arrays.",
            })
            .optional(),
    })
    .meta({ id: 'Collection' });

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

export const ContentObjectExportArtifactSchema = z
    .strictObject({
        export_id: z.string(),
        path: z.string(),
        filename: z.string(),
        content_type: z.string(),
        bytes: z.number(),
        created_at: z.string().optional(),
        files: z.array(ContentObjectExportArtifactFileSchema).optional(),
    })
    .meta({ id: 'ContentObjectExportArtifact' });

export const ProcessStateSchema = z
    .strictObject({
        context: z.looseObject({}),
        current_node: z.string(),
        node_history: z.array(NodeHistoryEntrySchema),
        node_history_ref: ProcessHistoryRefSchema.optional(),
        sequence: z.number(),
    })
    .meta({ id: 'ProcessState' });

export const AutonomousRunResponseSchema = z
    .strictObject({
        interaction: z.string().meta({ description: 'Interaction ID or code (e.g. "sys:generic_question").' }),
        data: z.looseObject({}).meta({ description: 'Input parameters, typed per interaction' }).optional(),
        config: InteractionExecutionConfigurationSchema.meta({
            description: 'Execution configuration (environment, model, model_options, etc.)',
        }).optional(),
        interactive: z.boolean().meta({ description: 'Whether the agent accepts user input' }).optional(),
        tool_approval_mode: AgentToolApprovalModeSchema.meta({
            description: 'How side-effecting tool actions are approved for interactive runs.',
        }).optional(),
        tool_names: z
            .array(z.string())
            .meta({ description: 'Tools configured for this run (+/- syntax supported)' })
            .optional(),
        initial_skills: z
            .array(z.string())
            .meta({ description: 'Builtin system skills activated before the first model turn.' })
            .optional(),
        initial_tool_calls: z
            .array(InitialToolCallSchema)
            .meta({ description: 'Ordered, bounded hydration/read calls executed before the first model turn.' })
            .optional(),
        excluded_tools: z
            .array(z.string())
            .meta({
                description: 'Hard denylist of tool names: never exposed to the model, refused at execution time.',
            })
            .optional(),
        collection_id: z.string().meta({ description: 'Scoped collection (if any)' }).optional(),
        disabled_mcp_collections: z
            .array(z.string())
            .meta({
                description:
                    'Denylist of MCP tool-collection ids deactivated for this run. `undefined`/empty means all installed/connected MCP collections are active (back-compat, and new servers stay active by default). Listed collections are excluded even if connected.',
            })
            .optional(),
        content_type: ContentObjectTypeRefSchema.meta({
            description: 'Content type linked to this run — defines the schema for `properties`',
        }).optional(),
        visibility: ConversationVisibilitySchema.meta({ description: 'Conversation/process visibility' }).optional(),
        tags: z.array(z.string()).meta({ description: 'User-defined or system tags for categorization' }).optional(),
        categories: z.array(z.string()).meta({ description: 'Categories for organizing runs' }).optional(),
        properties: z
            .looseObject({})
            .meta({ description: 'Business metadata — typed by the linked content_type schema' })
            .optional(),
        source: RunSourceSchema.meta({ description: 'How the run was started' }).optional(),
        schedule_id: z
            .string()
            .meta({ description: 'Schedule ID — set when this run was triggered by a Temporal schedule' })
            .optional(),
        source_type: AgentRunTypeSchema.meta({ description: 'Replacement for legacy AgentRun.type' }).optional(),
        type: AgentRunTypeSchema.meta({
            description: 'Deprecated: Use source_type for creation source and run_type for runtime mode.',
            deprecated: true,
            'x-deprecated-message': 'Use source_type for creation source and run_type for runtime mode.',
        }).optional(),
        id: z.string().meta({ description: 'The stable identifier used by all client code' }),
        run_kind: z.literal('agent').meta({ description: 'Internal discriminator key' }),
        run_type: z.literal('autonomous'),
        account: z.string().meta({ description: 'Account ID' }),
        project: z.string().meta({ description: 'Project ID' }),
        workflow_id: z.string().meta({ description: 'Temporal workflow ID (stable across continueAsNew)' }).optional(),
        first_workflow_run_id: z
            .string()
            .meta({ description: 'First Temporal workflow run ID (used for Redis channel and artifact resolution)' })
            .optional(),
        artifacts_path: z.string().meta({ description: 'Artifact storage path for this run' }).optional(),
        status: AgentRunStatusSchema.meta({ description: 'Current status of the agent run' }),
        activity_state: ConversationActivityStateSchema.meta({
            description: 'Whether the agent is currently working or idle (waiting for user input)',
        }).optional(),
        started_by: z.string().meta({ description: 'User or service that initiated the run' }),
        started_at: z.string().meta({ description: 'When the run started', format: 'date-time' }),
        completed_at: z
            .string()
            .meta({ description: 'When the run completed (or failed/cancelled)', format: 'date-time' })
            .optional(),
        title: z.string().meta({ description: 'Conversation title (short, human-readable)' }).optional(),
        event_subscription_id: z
            .string()
            .meta({ description: 'Event subscription ID — set when this run was triggered by the event bus.' })
            .optional(),
        event_ref: EventRefSchema.meta({
            description: 'Event reference — set when this run was triggered by the event bus.',
        }).optional(),
        archive_state: AgentRunArchiveStateSchema.meta({ description: 'Archive lifecycle state' }).optional(),
        created_at: z.string().meta({ description: 'Timestamp when the document was created', format: 'date-time' }),
        updated_at: z
            .string()
            .meta({ description: 'Timestamp when the document was last updated', format: 'date-time' }),
        interaction_name: z.string().meta({ description: 'Human-readable interaction name' }).optional(),
        interactionRef: InteractionRefSchema,
        environmentRef: ResourceRefSchema.meta({
            description:
                'Resolved environment reference (name resolved from `config.environment` id). Populated by the list endpoint; may be absent on other endpoints or when the id cannot be resolved, in which case consumers should fall back to `config.environment`.',
        }).optional(),
        topic: z
            .string()
            .meta({ description: 'Conversation topic (longer description from topic analysis)' })
            .optional(),
        lessons_learned: z
            .array(z.string())
            .meta({ description: 'Lessons learned from the conversation (extracted at completion)' })
            .optional(),
        archived_at: z
            .string()
            .meta({ description: 'When the last successful archive completed', format: 'date-time' })
            .optional(),
        archive_version: z
            .number()
            .meta({ description: 'Archive format version (for forward compatibility)' })
            .optional(),
        last_archive_error: z
            .string()
            .meta({ description: "Last archive error message (when archive_state === 'failed')" })
            .optional(),
        forked_from: z
            .string()
            .meta({ description: 'Source agent run ID when this run was forked (enables message history chaining)' })
            .optional(),
    })
    .meta({
        id: 'AutonomousRunResponse',
        description:
            'AgentRun — the client-facing stable identity for a running or completed agent.\n\nAll operations use `id` as the sole identifier. Temporal workflow internals are never exposed to clients.',
    });

export const ListWorkflowRunsResponseSchema = z
    .strictObject({
        runs: z.array(WorkflowRunSchema),
        next_page_token: z.string().optional(),
        has_more: z.boolean().optional(),
    })
    .meta({ id: 'ListWorkflowRunsResponse' });

export const EventDeliveryQueueSubscriptionSummarySchema = z
    .strictObject({
        subscription_id: z.string(),
        subscription_name: z.string(),
        target_type: z.enum(['workflow', 'webhook', 'agent', 'process']),
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
        target_type: z.array(z.enum(['workflow', 'webhook', 'agent', 'process'])).optional(),
        sort_by: EventDeliveryQueueSortFieldSchema.optional(),
        sort_order: z.enum(['asc', 'desc']).optional(),
    })
    .meta({ id: 'EventDeliveryQueueSummaryPayload' });

export const ContentObjectExportStatusResponseSchema = z
    .strictObject({
        workflow_id: z.string(),
        run_id: z.string(),
        status: z.enum(['queued', 'running', 'completed', 'failed', 'canceled', 'terminated', 'timed_out', 'unknown']),
        done: z.boolean(),
        progress: ContentObjectExportProgressSchema.optional(),
        result: ContentObjectExportResultSchema.optional(),
        error: z.string().optional(),
    })
    .meta({ id: 'ContentObjectExportStatusResponse' });

export const TimerTaskSchema = z
    .strictObject({
        type: TaskType_TIMERSchema,
        activityId: z.string(),
        activityName: z.string().optional(),
        input: z.unknown().optional(),
        scheduled: nullableStringSchema,
        status: TaskStatusSchema,
        attempts: z.number(),
        started: nullableStringSchema,
        completed: nullableStringSchema,
        error: nullableStringSchema,
        result: z.unknown(),
        runId: z
            .string()
            .meta({
                description:
                    'Temporal run ID that produced this task (set when aggregating across continueAsNew runs).',
            })
            .optional(),
        timerId: z.string().optional(),
        duration: z.string().optional(),
    })
    .meta({ id: 'TimerTask' });

export const SignalTaskSchema = z
    .strictObject({
        type: TaskType_SIGNALSchema,
        activityId: z.string(),
        activityName: z.string().optional(),
        input: z.unknown().optional(),
        scheduled: nullableStringSchema,
        status: TaskStatusSchema,
        attempts: z.number(),
        started: nullableStringSchema,
        completed: nullableStringSchema,
        error: nullableStringSchema,
        result: z.unknown(),
        runId: z
            .string()
            .meta({
                description:
                    'Temporal run ID that produced this task (set when aggregating across continueAsNew runs).',
            })
            .optional(),
        signalName: z.string().optional(),
        direction: z.enum(['sending', 'receiving']).optional(),
        sender: z
            .strictObject({
                workflowId: z.string().optional(),
                runId: z.string().optional(),
            })
            .optional(),
        recipient: z
            .strictObject({
                workflowId: z.string().optional(),
                runId: z.string().optional(),
            })
            .optional(),
    })
    .meta({ id: 'SignalTask' });

export const ChildWorkflowTaskSchema = z
    .strictObject({
        type: TaskType_CHILD_WORKFLOWSchema,
        activityId: z.string(),
        activityName: z.string().optional(),
        input: z.unknown().optional(),
        scheduled: nullableStringSchema,
        status: TaskStatusSchema,
        attempts: z.number(),
        started: nullableStringSchema,
        completed: nullableStringSchema,
        error: nullableStringSchema,
        result: z.unknown(),
        runId: z
            .string()
            .meta({
                description:
                    'Temporal run ID that produced this task (set when aggregating across continueAsNew runs).',
            })
            .optional(),
        workflowType: z.string().optional(),
    })
    .meta({ id: 'ChildWorkflowTask' });

export const ActivityTaskSchema = z
    .strictObject({
        type: TaskType_ACTIVITYSchema,
        activityId: z.string(),
        activityName: z.string().optional(),
        input: z.unknown().optional(),
        scheduled: nullableStringSchema,
        status: TaskStatusSchema,
        attempts: z.number(),
        started: nullableStringSchema,
        completed: nullableStringSchema,
        error: nullableStringSchema,
        result: z.unknown(),
        runId: z
            .string()
            .meta({
                description:
                    'Temporal run ID that produced this task (set when aggregating across continueAsNew runs).',
            })
            .optional(),
    })
    .meta({ id: 'ActivityTask' });

export const WorkflowRunEventSchema = z
    .strictObject({
        event_id: z.number(),
        event_time: nullableStringSchema,
        event_type: z.string(),
        task_id: z.string().optional(),
        attempt: z.number(),
        activity: z
            .strictObject({
                name: z.string().optional(),
                id: z.string().optional(),
                input: z.unknown().optional(),
                scheduledEventId: z.string().optional(),
                startedEventId: z.string().optional(),
            })
            .optional(),
        childWorkflow: z
            .strictObject({
                workflowId: z.string().optional(),
                workflowType: z.string().optional(),
                runId: z.string().optional(),
                scheduledEventId: z.string().optional(),
                startedEventId: z.string().optional(),
                input: z.unknown().optional(),
                result: z.unknown().optional(),
            })
            .optional(),
        signal: SignalEventPropertiesSchema.optional(),
        timer: z
            .strictObject({
                timerId: z.string().optional(),
                duration: z.string().optional(),
                summary: z.string().optional(),
            })
            .optional(),
        error: EventErrorSchema.optional(),
        result: z.unknown().optional(),
    })
    .meta({ id: 'WorkflowRunEvent' });

export const WorkflowExecutionStartResultArraySchema = z
    .array(WorkflowExecutionStartResultSchema)
    .meta({ id: 'WorkflowExecutionStartResultArray' });

export const WorkflowInputSchema = z
    .discriminatedUnion('inputType', [
        z.strictObject({
            inputType: z.literal('objectIds'),
            objectIds: z.array(z.string()),
        }),
        z.strictObject({
            inputType: z.literal('files'),
            files: z.array(WorkflowInputFileSchema),
        }),
    ])
    .meta({
        id: 'WorkflowInput',
        type: 'object',
        required: ['inputType'],
        discriminator: { propertyName: 'inputType' },
    });

export const ViewNavigationResultSchema = z
    .strictObject({
        id: z.string(),
        selected: z.array(z.string()),
        nodes: z.array(ViewNavigationNodeSchema),
        breadcrumbs: z
            .array(ViewNavigationNodeSchema)
            .meta({ description: 'Selected hierarchy path from its root through the current value.' })
            .optional(),
        truncated: z.boolean().optional(),
    })
    .meta({ id: 'ViewNavigationResult' });

export const ViewExecutionQueryPlanSchema = z
    .strictObject({
        status: z.enum(['applied', 'fallback']),
        query: ViewElasticsearchQuerySchema.optional(),
        confidence: z.number().optional(),
        error_code: ViewQueryPlanningFailureCodeSchema.optional(),
        error_message: z.string().optional(),
    })
    .meta({
        id: 'ViewExecutionQueryPlan',
        description:
            'Safe query-planning diagnostics. The query contains only the model-authored subtree; server-owned scope and content-security filters are never exposed.',
    });

export const ViewExecutionSearchConfigurationSchema = z
    .strictObject({
        renderer: z.string().optional(),
        mode: z.enum(['deterministic', 'agentic']).optional(),
        placeholder: z.string().optional(),
        fields: z.array(ViewSearchFieldDefinitionSchema).optional(),
        key_terms: z.array(ViewKeyTermDefinitionSchema).optional(),
    })
    .meta({
        id: 'ViewExecutionSearchConfiguration',
        description:
            'Client-visible search controls. Agentic planner instructions, interaction, and model configuration are intentionally omitted.',
    });

export const DSLRetryPolicySchema = z
    .strictObject({
        backoffCoefficient: z.number().optional(),
        initialInterval: DurationValueSchema.optional(),
        maximumAttempts: z.number().optional(),
        maximumInterval: DurationValueSchema.optional(),
        nonRetryableErrorTypes: z.array(z.string()).optional(),
    })
    .meta({ id: 'DSLRetryPolicy', description: 'The payload for a DSL retry policy.' });

export const ActivityFetchSpecMapSchema = z
    .object({})
    .catchall(ActivityFetchSpecSchema)
    .meta({ id: 'ActivityFetchSpecMap' });

export const WorkflowSearchAttributeValueMapSchema = z
    .object({})
    .catchall(WorkflowSearchAttributeValueSchema)
    .meta({ id: 'WorkflowSearchAttributeValueMap' });

export const CreateContentObjectPayloadSchema = z
    .strictObject({
        text: z.string().optional(),
        text_etag: z.string().optional(),
        embeddings: Partial_Record_SupportedEmbeddingTypes_EmbeddingSchema.optional(),
        parts: z.array(z.string()).optional(),
        parts_etag: z.string().optional(),
        transcript: TranscriptSchema.optional(),
        security: StringArrayMapSchema.optional(),
        sensitivity: z
            .number()
            .meta({
                description:
                    'BLP sensitivity level — set directly or inherited from collections (max across collections).',
            })
            .optional(),
        compartments: z
            .array(z.string())
            .meta({
                description: 'Compartments — set directly or inherited from collections (union across collections).',
            })
            .optional(),
        inherited_properties: z
            .array(InheritedPropertyMetadataSchema)
            .meta({
                description:
                    'Inherited properties metadata - tracks which properties were inherited from parent collections. Used to display readonly inherited properties in the UI and enable incremental sync optimization.',
            })
            .optional(),
        parent: z.string().optional(),
        location: z.string().meta({ description: 'An optional path based location for the object' }).optional(),
        status: ContentObjectStatusSchema.meta({
            description:
                'Object status.\n- created: the object was created and is being processed\n- processing: the object is being processed\n- completed: the object was processed and is ready to use\n- failed: the object processing failed\n- archived: the object was archived and is no longer available',
        }).optional(),
        content: ContentSourceSchema.meta({
            description: 'Content source information, typically a link to an object store',
        }).optional(),
        external_id: z
            .string()
            .meta({ description: 'External identifier for integration with other systems' })
            .optional(),
        properties: z
            .looseObject({})
            .meta({
                description:
                    'The object properties. This is a JSON object that describes the object, matching the object type schema',
            })
            .optional(),
        metadata: z.looseObject({}).meta({ description: 'Technical metadata of the object' }).optional(),
        tokens: z
            .strictObject({
                count: z.number().optional(),
                encoding: z.string().optional(),
                etag: z.string().optional(),
            })
            .meta({ description: 'Token information' })
            .optional(),
        revision: RevisionInfoSchema.meta({
            description: 'Revision information. This is used to track the history of the object.',
        }).optional(),
        is_deleted: z
            .boolean()
            .meta({
                description:
                    'Soft delete flag. When true, the object should be considered deleted but is still retained in the database for historical purposes.',
            })
            .optional(),
        is_locked: z
            .boolean()
            .meta({
                description:
                    'Soft lock flag. When true, the object should be considered read-only and modification attempts should be rejected.',
            })
            .optional(),
        score: z.number().meta({ description: 'The document score, used for ranking and sorting.' }).optional(),
        user_permissions: ContentObjectUserPermissionsSchema.meta({
            description: "Computed per-request: the current user's effective permissions on this object.",
        }).optional(),
        name: z.string().meta({ description: 'Human-readable name or title' }).optional(),
        description: z.string().meta({ description: 'Optional detailed description of the object' }).optional(),
        tags: z.array(z.string()).meta({ description: 'Optional array of categorization tags' }).optional(),
        updated_by: z.string().meta({ description: 'Identifier of the user who last modified the object' }).optional(),
        created_by: z.string().meta({ description: 'Identifier of the user who created the object' }).optional(),
        id: z.string().optional(),
        type: z.string().optional(),
        generation_run_info: GenerationRunMetadataSchema.optional(),
    })
    .meta({
        id: 'CreateContentObjectPayload',
        description: 'When creating from an uploaded file the content should be an URL to the uploaded file',
    });

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

export const AgentRunSchema = z
    .strictObject({
        interaction: z.string().meta({ description: 'Interaction ID or code (e.g. "sys:generic_question").' }),
        data: z.looseObject({}).meta({ description: 'Input parameters, typed per interaction' }).optional(),
        config: InteractionExecutionConfigurationSchema.meta({
            description: 'Execution configuration (environment, model, model_options, etc.)',
        }).optional(),
        interactive: z.boolean().meta({ description: 'Whether the agent accepts user input' }).optional(),
        tool_approval_mode: AgentToolApprovalModeSchema.meta({
            description: 'How side-effecting tool actions are approved for interactive runs.',
        }).optional(),
        tool_names: z
            .array(z.string())
            .meta({ description: 'Tools configured for this run (+/- syntax supported)' })
            .optional(),
        initial_skills: z
            .array(z.string())
            .meta({ description: 'Builtin system skills activated before the first model turn.' })
            .optional(),
        initial_tool_calls: z
            .array(InitialToolCallSchema)
            .meta({ description: 'Ordered, bounded hydration/read calls executed before the first model turn.' })
            .optional(),
        excluded_tools: z
            .array(z.string())
            .meta({
                description: 'Hard denylist of tool names: never exposed to the model, refused at execution time.',
            })
            .optional(),
        collection_id: z.string().meta({ description: 'Scoped collection (if any)' }).optional(),
        disabled_mcp_collections: z
            .array(z.string())
            .meta({
                description:
                    'Denylist of MCP tool-collection ids deactivated for this run. `undefined`/empty means all installed/connected MCP collections are active (back-compat, and new servers stay active by default). Listed collections are excluded even if connected.',
            })
            .optional(),
        content_type: ContentObjectTypeRefSchema.meta({
            description: 'Content type linked to this run — defines the schema for `properties`',
        }).optional(),
        visibility: ConversationVisibilitySchema.meta({ description: 'Conversation/process visibility' }).optional(),
        tags: z.array(z.string()).meta({ description: 'User-defined or system tags for categorization' }).optional(),
        categories: z.array(z.string()).meta({ description: 'Categories for organizing runs' }).optional(),
        properties: z
            .looseObject({})
            .meta({ description: 'Business metadata — typed by the linked content_type schema' })
            .optional(),
        source: RunSourceSchema.meta({ description: 'How the run was started' }).optional(),
        schedule_id: z
            .string()
            .meta({ description: 'Schedule ID — set when this run was triggered by a Temporal schedule' })
            .optional(),
        source_type: AgentRunTypeSchema.meta({ description: 'Replacement for legacy AgentRun.type' }).optional(),
        type: AgentRunTypeSchema.meta({
            description: 'Deprecated: Use source_type for creation source and run_type for runtime mode.',
            deprecated: true,
            'x-deprecated-message': 'Use source_type for creation source and run_type for runtime mode.',
        }).optional(),
        id: z.string().meta({ description: 'The stable identifier used by all client code' }),
        run_kind: z.literal('agent').meta({ description: 'Internal discriminator key' }),
        run_type: z.literal('autonomous').meta({ description: 'Public-facing runtime mode' }),
        account: z.string().meta({ description: 'Account ID' }),
        project: z.string().meta({ description: 'Project ID' }),
        workflow_id: z.string().meta({ description: 'Temporal workflow ID (stable across continueAsNew)' }).optional(),
        first_workflow_run_id: z
            .string()
            .meta({ description: 'First Temporal workflow run ID (used for Redis channel and artifact resolution)' })
            .optional(),
        artifacts_path: z.string().meta({ description: 'Artifact storage path for this run' }).optional(),
        status: AgentRunStatusSchema.meta({ description: 'Current status of the agent run' }),
        activity_state: ConversationActivityStateSchema.meta({
            description: 'Whether the agent is currently working or idle (waiting for user input)',
        }).optional(),
        started_by: z.string().meta({ description: 'User or service that initiated the run' }),
        started_at: z.string().meta({ description: 'When the run started', format: 'date-time' }),
        completed_at: z
            .string()
            .meta({ description: 'When the run completed (or failed/cancelled)', format: 'date-time' })
            .optional(),
        title: z.string().meta({ description: 'Conversation title (short, human-readable)' }).optional(),
        event_subscription_id: z
            .string()
            .meta({ description: 'Event subscription ID — set when this run was triggered by the event bus.' })
            .optional(),
        event_ref: EventRefSchema.meta({
            description: 'Event reference — set when this run was triggered by the event bus.',
        }).optional(),
        archive_state: AgentRunArchiveStateSchema.meta({ description: 'Archive lifecycle state' }).optional(),
        created_at: z.string().meta({ description: 'Timestamp when the document was created', format: 'date-time' }),
        updated_at: z
            .string()
            .meta({ description: 'Timestamp when the document was last updated', format: 'date-time' }),
        interaction_name: z.string().meta({ description: 'Human-readable interaction name' }).optional(),
        interactionRef: InteractionRefSchema,
        environmentRef: ResourceRefSchema.meta({
            description:
                'Resolved environment reference (name resolved from `config.environment` id). Populated by the list endpoint; may be absent on other endpoints or when the id cannot be resolved, in which case consumers should fall back to `config.environment`.',
        }).optional(),
        topic: z
            .string()
            .meta({ description: 'Conversation topic (longer description from topic analysis)' })
            .optional(),
        lessons_learned: z
            .array(z.string())
            .meta({ description: 'Lessons learned from the conversation (extracted at completion)' })
            .optional(),
        archived_at: z
            .string()
            .meta({ description: 'When the last successful archive completed', format: 'date-time' })
            .optional(),
        archive_version: z
            .number()
            .meta({ description: 'Archive format version (for forward compatibility)' })
            .optional(),
        last_archive_error: z
            .string()
            .meta({ description: "Last archive error message (when archive_state === 'failed')" })
            .optional(),
        forked_from: z
            .string()
            .meta({ description: 'Source agent run ID when this run was forked (enables message history chaining)' })
            .optional(),
    })
    .meta({
        id: 'AgentRun',
        description:
            'AgentRun — the client-facing stable identity for a running or completed agent.\n\nAll operations use `id` as the sole identifier. Temporal workflow internals are never exposed to clients.',
    });

export const CreateAgentRunPayloadSchema = z
    .strictObject({
        interaction: z.string().meta({ description: 'Interaction ID or code (e.g. "sys:generic_question").' }),
        data: z.looseObject({}).meta({ description: 'Input parameters, typed per interaction' }).optional(),
        config: InteractionExecutionConfigurationSchema.meta({
            description: 'Execution configuration (environment, model, model_options, etc.)',
        }).optional(),
        interactive: z.boolean().meta({ description: 'Whether the agent accepts user input' }).optional(),
        tool_approval_mode: AgentToolApprovalModeSchema.meta({
            description: 'How side-effecting tool actions are approved for interactive runs.',
        }).optional(),
        tool_names: z
            .array(z.string())
            .meta({ description: 'Tools configured for this run (+/- syntax supported)' })
            .optional(),
        initial_skills: z
            .array(z.string())
            .meta({ description: 'Builtin system skills activated before the first model turn.' })
            .optional(),
        initial_tool_calls: z
            .array(InitialToolCallSchema)
            .meta({ description: 'Ordered, bounded hydration/read calls executed before the first model turn.' })
            .optional(),
        excluded_tools: z
            .array(z.string())
            .meta({
                description: 'Hard denylist of tool names: never exposed to the model, refused at execution time.',
            })
            .optional(),
        collection_id: z.string().meta({ description: 'Scoped collection (if any)' }).optional(),
        disabled_mcp_collections: z
            .array(z.string())
            .meta({
                description:
                    'Denylist of MCP tool-collection ids deactivated for this run. `undefined`/empty means all installed/connected MCP collections are active (back-compat, and new servers stay active by default). Listed collections are excluded even if connected.',
            })
            .optional(),
        content_type: ContentObjectTypeRefSchema.meta({
            description: 'Content type linked to this run — defines the schema for `properties`',
        }).optional(),
        visibility: ConversationVisibilitySchema.meta({ description: 'Conversation visibility' }).optional(),
        tags: z.array(z.string()).meta({ description: 'User-defined or system tags for categorization' }).optional(),
        categories: z
            .array(z.string())
            .meta({ description: 'Categories for organizing runs (e.g. "support", "analysis", "generation")' })
            .optional(),
        properties: z
            .looseObject({})
            .meta({ description: 'Business metadata — typed by the linked content_type schema' })
            .optional(),
        source: RunSourceSchema.meta({ description: 'How the run was started' }).optional(),
        schedule_id: z
            .string()
            .meta({ description: 'Schedule ID — set when this run was triggered by a Temporal schedule' })
            .optional(),
        source_type: AgentRunTypeSchema.meta({ description: 'How the run was created' }).optional(),
        type: AgentRunTypeSchema.meta({
            description: 'Deprecated: Use source_type for creation source and run_type for runtime mode.',
            deprecated: true,
            'x-deprecated-message': 'Use source_type for creation source and run_type for runtime mode.',
        }).optional(),
        search_scope: AgentSearchScopeSchema.meta({ description: 'Search scope for RAG queries' }).optional(),
        user_channels: z
            .array(UserChannelSchema)
            .meta({ description: 'User communication channels (email, interactive)' })
            .optional(),
        checkpoint_tokens: z
            .number()
            .meta({
                description:
                    'Token budget for checkpointing, in thousands (K). Wins over every other checkpoint setting.',
            })
            .optional(),
        checkpoint: AgentCheckpointConfigurationSchema.meta({
            description:
                "Structured checkpoint override for this run. Field-wise it takes precedence over the interaction's `agent_runner_options.checkpoint` and the project's `configuration.agent.checkpoint`; the legacy `checkpoint_tokens` above still wins over everything when set.",
        }).optional(),
        max_iterations: z.number().meta({ description: 'Maximum conversation iterations (default: 20)' }).optional(),
        notify_endpoints: z.array(z.string()).meta({ description: 'Webhook URLs to notify on completion' }).optional(),
        debug_mode: z.boolean().meta({ description: 'Enable debug mode for verbose logging' }).optional(),
        started_by: z
            .string()
            .meta({ description: 'Principal ref of the user who initiated the run (for server-to-server forwarding)' })
            .optional(),
    })
    .meta({ id: 'CreateAgentRunPayload', description: 'Payload to create and start a new agent run.' });

export const ComputeCollectionFacetPayloadSchema = z
    .strictObject({
        facets: z.array(FacetSpecSchema),
        query: ComplexCollectionSearchQuerySchema.optional(),
    })
    .meta({ id: 'ComputeCollectionFacetPayload' });

export const ProcessScriptResourceSchema = z
    .strictObject({
        language: ProcessScriptLanguageSchema,
        entrypoint: z.string(),
        source: ProcessScriptSourceSchema,
        packages: z.array(z.string()).optional(),
    })
    .meta({ id: 'ProcessScriptResource' });

export const Partial_CreateContentObjectPayloadSchema = z
    .strictObject({
        text: z.string().optional(),
        text_etag: z.string().optional(),
        embeddings: Partial_Record_SupportedEmbeddingTypes_EmbeddingSchema.optional(),
        parts: z.array(z.string()).optional(),
        parts_etag: z.string().optional(),
        transcript: TranscriptSchema.optional(),
        security: StringArrayMapSchema.optional(),
        sensitivity: z
            .number()
            .meta({
                description:
                    'BLP sensitivity level — set directly or inherited from collections (max across collections).',
            })
            .optional(),
        compartments: z
            .array(z.string())
            .meta({
                description: 'Compartments — set directly or inherited from collections (union across collections).',
            })
            .optional(),
        inherited_properties: z
            .array(InheritedPropertyMetadataSchema)
            .meta({
                description:
                    'Inherited properties metadata - tracks which properties were inherited from parent collections. Used to display readonly inherited properties in the UI and enable incremental sync optimization.',
            })
            .optional(),
        parent: z.string().optional(),
        location: z.string().meta({ description: 'An optional path based location for the object' }).optional(),
        status: ContentObjectStatusSchema.meta({
            description:
                'Object status.\n- created: the object was created and is being processed\n- processing: the object is being processed\n- completed: the object was processed and is ready to use\n- failed: the object processing failed\n- archived: the object was archived and is no longer available',
        }).optional(),
        content: ContentSourceSchema.meta({
            description: 'Content source information, typically a link to an object store',
        }).optional(),
        external_id: z
            .string()
            .meta({ description: 'External identifier for integration with other systems' })
            .optional(),
        properties: z
            .looseObject({})
            .meta({
                description:
                    'The object properties. This is a JSON object that describes the object, matching the object type schema',
            })
            .optional(),
        metadata: z.looseObject({}).meta({ description: 'Technical metadata of the object' }).optional(),
        tokens: z
            .strictObject({
                count: z.number().optional(),
                encoding: z.string().optional(),
                etag: z.string().optional(),
            })
            .meta({ description: 'Token information' })
            .optional(),
        revision: RevisionInfoSchema.meta({
            description: 'Revision information. This is used to track the history of the object.',
        }).optional(),
        is_deleted: z
            .boolean()
            .meta({
                description:
                    'Soft delete flag. When true, the object should be considered deleted but is still retained in the database for historical purposes.',
            })
            .optional(),
        is_locked: z
            .boolean()
            .meta({
                description:
                    'Soft lock flag. When true, the object should be considered read-only and modification attempts should be rejected.',
            })
            .optional(),
        score: z.number().meta({ description: 'The document score, used for ranking and sorting.' }).optional(),
        user_permissions: ContentObjectUserPermissionsSchema.meta({
            description: "Computed per-request: the current user's effective permissions on this object.",
        }).optional(),
        name: z.string().meta({ description: 'Human-readable name or title' }).optional(),
        description: z.string().meta({ description: 'Optional detailed description of the object' }).optional(),
        tags: z.array(z.string()).meta({ description: 'Optional array of categorization tags' }).optional(),
        updated_by: z.string().meta({ description: 'Identifier of the user who last modified the object' }).optional(),
        created_by: z.string().meta({ description: 'Identifier of the user who created the object' }).optional(),
        id: z.string().optional(),
        type: z.string().optional(),
        generation_run_info: GenerationRunMetadataSchema.optional(),
    })
    .meta({
        id: 'Partial_CreateContentObjectPayload',
        description: 'When creating from an uploaded file the content should be an URL to the uploaded file',
    });

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
        target_type: z.enum(['workflow', 'webhook', 'agent', 'process']),
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

export const ContentObjectApiTypeRefSchema = ContentObjectTypeRefSchema.meta({ id: 'ContentObjectApiTypeRef' });

export const ComplexSearchQuerySchema = z
    .strictObject({
        name: z.string().optional(),
        status: z.array(z.string()).optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
        id: z.string().optional(),
        ids: z.array(z.string()).optional(),
        createdFrom: z.string().optional(),
        createdTo: z.string().optional(),
        updatedFrom: z.string().optional(),
        updatedTo: z.string().optional(),
        location: z.string().optional(),
        parent: z.string().optional(),
        type: z.string().optional(),
        types: z.array(z.string()).optional(),
        all_revisions: z.boolean().optional(),
        from_root: z.string().optional(),
        vector: VectorSearchQuerySchema.optional(),
        full_text: z
            .string()
            .meta({ description: 'If present, do a full text search (snake_case version).' })
            .optional(),
        weights: Record_SearchTypes_numberSchema.optional(),
        dynamic_scaling: dynamicScalingTypesSchema
            .meta({
                description:
                    "dynamicScaling rescales the weights when a particular search type is not present in the results, per object. e.g. Weights of 5,3,2 will be treated as 0,3,2 if the first search type is not present in the results. Ignored when scoreAggregation is 'smart' Default is 'on'",
            })
            .optional(),
        score_aggregation: scoreAggregationTypesSchema
            .meta({
                description:
                    'rrf: Reciprocal Rank Fusion rsf: Reciprocal Score Fusion smart: Our own algorithm (default and recommended)',
            })
            .optional(),
        match: z.looseObject({}).optional(),
    })
    .meta({
        id: 'ComplexSearchQuery',
        description: 'ComplexSearchQuery is used for full-text search and vector embedding search.',
    });

export const SearchAgentRunsResponseSchema = z
    .strictObject({
        hits: z.array(AgentRunSearchHitSchema).meta({ description: 'Search results' }),
        total: z.number().meta({ description: 'Total matching results' }),
    })
    .meta({ id: 'SearchAgentRunsResponse', description: 'Response from the agent runs search endpoint.' });

export const ViewBoardCardConfigurationSchema = z
    .strictObject({
        title: ViewResultFieldSchema,
        description: ViewResultFieldSchema.optional(),
        media: ViewResultMediaSchema.optional(),
        fields: z.array(ViewResultFieldSchema).optional(),
        badges: z.array(ViewResultFieldSchema).optional(),
    })
    .meta({ id: 'ViewBoardCardConfiguration' });

export const ViewSearchConfigurationSchema = z
    .strictObject({
        renderer: z.string().optional(),
        mode: z.enum(['deterministic', 'agentic']).optional(),
        placeholder: z.string().optional(),
        fields: z.array(ViewSearchFieldDefinitionSchema).optional(),
        key_terms: z.array(ViewKeyTermDefinitionSchema).optional(),
        agentic: AgenticViewSearchConfigurationSchema.optional(),
    })
    .meta({ id: 'ViewSearchConfiguration' });

export const ViewNavigationItemSchema = z
    .discriminatedUnion('source', [
        ViewLocationNavigationSchema,
        ViewCollectionNavigationSchema,
        ViewTermsNavigationSchema,
        ViewHierarchyNavigationSchema,
        ViewRangeNavigationSchema,
    ])
    .meta({ id: 'ViewNavigationItem' });

export const AgentMessageDetailsSchema = z
    .looseObject({
        ack: z.string().optional(),
        event_class: z.string().optional(),
        tool: z.string().optional(),
        tools: z.array(z.string()).optional(),
        tool_event: z.enum(['started', 'progress', 'completed', 'failed']).optional(),
        streamed: z.boolean().optional(),
        display_role: z.string().optional(),
        activity_id: z.string().optional(),
        activity_group_id: z.string().optional(),
        batch_id: z.string().optional(),
        tool_run_id: z.string().optional(),
        tool_use_id: z.string().optional(),
        tool_status: z.enum(['running', 'completed', 'error', 'warning']).optional(),
        tool_iteration: z.number().optional(),
        message_to_human: z.string().optional(),
        duration_ms: z.number().optional(),
        observation: z.unknown().optional(),
        token_usage: ExecutionTokenUsageSchema.optional(),
        checkpoint_at: z.number().optional(),
        checkpoint_threshold: z.number().optional(),
        workflow_run_id: z.string().optional(),
        outputFiles: z.array(z.string()).optional(),
        files: z
            .array(
                z.union([ConversationFileSchema, z.string()]).meta({
                    anyOf: undefined,
                    oneOf: [{ $ref: 'ConversationFile' }, { type: 'string' }],
                }),
            )
            .optional(),
        plan: z.array(PlanTaskSchema).optional(),
        resources: z
            .array(AgentResourceReferenceSchema)
            .meta({
                description:
                    'Deep-linkable references to resources a tool created/updated/deleted (see AgentResourceReference).',
            })
            .optional(),
        streaming_id: z.string().optional(),
        streaming_id_scope: z.enum(['workflow_run', 'workstream']).optional(),
        chunk_index: z.number().optional(),
        is_final: z.boolean().optional(),
        _optimistic: z.boolean().optional(),
        _messageId: z.string().optional(),
        _deliveryStatus: z.enum(['sending', 'received', 'consumed', 'failed']).optional(),
    })
    .meta({ id: 'AgentMessageDetails' });

export const CompactMessageSchema = z
    .strictObject({
        t: AgentMessageTypeSchema.meta({ description: 'Message type (integer enum)' }),
        m: z.string().meta({ description: 'Message content' }).optional(),
        w: z.string().meta({ description: 'Workstream ID (only when not "main")' }).optional(),
        d: AgentMessageDetailsSchema.nullable().meta({ description: 'Type-specific details' }).optional(),
        f: z
            .union([z.literal(0), z.literal(1)])
            .meta({
                anyOf: undefined,
                type: 'number',
                enum: [0, 1],
                description: 'Is final chunk (only for STREAMING_CHUNK, 0 or 1)',
            })
            .optional(),
        ts: z.number().meta({ description: 'Timestamp (only for stored/persisted messages)' }).optional(),
        i: z
            .string()
            .meta({ description: 'Activity ID for deduplication between streaming chunks and final messages' })
            .optional(),
    })
    .meta({
        id: 'CompactMessage',
        description:
            'Compact message format for efficient wire transfer. Primary type used throughout the system. ~85% smaller than legacy AgentMessage format.',
    });

export const CollectionArraySchema = z.array(CollectionSchema).meta({ id: 'CollectionArray' });

export const EventIngestChannelArraySchema = z.array(EventIngestChannelSchema).meta({ id: 'EventIngestChannelArray' });

export const ListContentObjectExportsResponseSchema = z
    .strictObject({
        items: z.array(ContentObjectExportArtifactSchema),
        limit: z.number(),
    })
    .meta({ id: 'ListContentObjectExportsResponse' });

export const WorkflowRunUpdatesResponseSchema = z
    .strictObject({
        messages: z.array(CompactMessageSchema),
    })
    .meta({ id: 'WorkflowRunUpdatesResponse' });

export const EventDeliveryQueueSummaryResponseSchema = z
    .strictObject({
        generated_at: z.string(),
        outbox: EventOutboxQueueSummarySchema,
        deliveries: z.array(EventDeliveryQueueSubscriptionSummarySchema),
    })
    .meta({ id: 'EventDeliveryQueueSummaryResponse' });

export const WorkflowTaskSchema = z
    .discriminatedUnion('type', [ActivityTaskSchema, ChildWorkflowTaskSchema, SignalTaskSchema, TimerTaskSchema])
    .meta({
        id: 'WorkflowTask',
        type: 'object',
        required: ['type'],
        discriminator: {
            propertyName: 'type',
            mapping: {
                activity: '#/components/schemas/ActivityTask',
                childWorkflow: '#/components/schemas/ChildWorkflowTask',
                signal: '#/components/schemas/SignalTask',
                timer: '#/components/schemas/TimerTask',
            },
        },
    });

export const ExportPropertiesPayloadSchema = z
    .strictObject({
        objectIds: z.array(z.string()),
        type: z.string(),
        query: ComplexSearchQuerySchema.optional(),
        table_layout: z.array(ColumnLayoutSchema).optional(),
    })
    .meta({ id: 'ExportPropertiesPayload' });

export const ExecuteWorkflowPayloadSchema = z
    .strictObject({
        task_queue: z
            .string()
            .meta({
                description: 'The task queue to assign the workflow to. Deprecated, queues are choosend server side',
            })
            .optional(),
        objectIds: z
            .array(z.string())
            .meta({
                description:
                    'Docuument IDs pon which the workflow will be executed, deprecated, replaced params in vars',
            })
            .optional(),
        input: WorkflowInputSchema.meta({
            description:
                'New format: Workflow input (either objectIds or files). Takes precedence over the deprecated `objectIds` field.',
        }).optional(),
        vars: z.looseObject({}).meta({ description: 'Parameters to pass to the workflow' }).optional(),
        unique: z
            .boolean()
            .meta({ description: 'Make the workflow ID unique by always adding a random token to the ID.' })
            .optional(),
        custom_id: z
            .string()
            .meta({ description: 'A custom ID to use for the workflow execution id instead of the generated one.' })
            .optional(),
        timeout: z
            .number()
            .meta({ description: 'Timeout for the workflow execution to complete, in seconds.' })
            .optional(),
        run_at: z
            .string()
            .meta({
                description:
                    'Schedule the workflow to run at a specific time (ISO 8601 datetime). Example: "2024-02-15T16:00:00Z" If in the past or not provided, workflow runs immediately.',
            })
            .optional(),
    })
    .meta({ id: 'ExecuteWorkflowPayload' });

export const ViewNavigationResultMapSchema = z
    .object({})
    .catchall(ViewNavigationResultSchema)
    .meta({ id: 'ViewNavigationResultMap' });

export const ViewExecutionSearchResultSchema = z
    .strictObject({
        input: z.string().optional(),
        interpretation: z.string().optional(),
        key_terms: StringArrayMapSchema.optional(),
        plan: ViewExecutionQueryPlanSchema.optional(),
        requested_mode: z.enum(['browse', 'deterministic', 'agentic']),
        applied_mode: z.enum(['browse', 'deterministic', 'query']),
        fallback_reason: z.string().optional(),
        warnings: z.array(ViewExecutionWarningSchema),
    })
    .meta({ id: 'ViewExecutionSearchResult' });

export const DSLActivityOptionsSchema = z
    .strictObject({
        startToCloseTimeout: DurationValueSchema.optional(),
        heartbeatTimeout: DurationValueSchema.optional(),
        scheduleToStartTimeout: DurationValueSchema.optional(),
        scheduleToCloseTimeout: DurationValueSchema.optional(),
        retry: DSLRetryPolicySchema.optional(),
    })
    .meta({ id: 'DSLActivityOptions', description: 'The payload for a DSL activity options.' });

export const DSLActivitySpecSchema = z
    .strictObject({
        name: z.string().meta({ description: 'The name of the activity function' }),
        title: z
            .string()
            .meta({ description: 'Title of the activity to be displayed in the UI workflow builder' })
            .optional(),
        description: z
            .string()
            .meta({ description: 'The description of the activity to e displayed in the UI workflow builder' })
            .optional(),
        params: z
            .looseObject({})
            .meta({
                description:
                    'Activities parameters. These parameters can be either literals (hardcoded strings, numbers, booleans, objects, arrays etc.), either references to the workflow variables. The workflow variables are built from the workflow params (e.g. the workflow configuration) and from the result of the previous activities.',
            })
            .optional(),
        output: z
            .string()
            .meta({
                description:
                    'The name of the workflow variable that will store the result of the activity If not specified the result will not be stored The parameters describe how the actual parameters will be obtained from the workflow execution vars. since it may contain references to workflow execution vars.',
            })
            .optional(),
        condition: z
            .looseObject({})
            .meta({
                description:
                    'A JSON expression which evaluate to true or false similar to mongo matches. We support for now basic expression like: $true, $false, $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $regexp {$eq: {name: value}}, Ex: {$eq: {wfVarName: value}}',
            })
            .optional(),
        import: ImportSpecSchema.meta({
            description:
                'The import spec is used to import data from workflow variables. The import spec is a list of variable names to import from the workflow context. You can also use objects to rename the imported variables, or to reference an expression. Example: ["runId", {"typeId": "docType.id"}]',
        }).optional(),
        fetch: ActivityFetchSpecMapSchema.meta({
            description: 'The fetch phase is used to fetch data from external sources.',
        }).optional(),
        projection: z
            .looseObject({})
            .meta({ description: 'Projection to apply to the result. Not all activities support this.' })
            .optional(),
        parallel: z
            .boolean()
            .meta({
                description:
                    'If true the activity will be executed in parallel with the other activities. (i.e. the workflow will not wait for the activity to finish before starting the next one)',
            })
            .optional(),
        await: z.string().meta({ description: 'Await for a parallel activity execution to return.' }).optional(),
        options: DSLActivityOptionsSchema.meta({
            description:
                'Activity options for configuring the activity execution, which overrides the activity options defined at workflow level.',
        }).optional(),
    })
    .meta({ id: 'DSLActivitySpec' });

export const WorkflowSearchAttributesSchema = WorkflowSearchAttributeValueMapSchema.meta({
    id: 'WorkflowSearchAttributes',
});

export const DSLActivityStepSchema = z
    .strictObject({
        type: z.literal('activity').meta({ description: 'The type fo the step. If not set defaults to "activity"' }),
        name: z.string().meta({ description: 'The name of the activity function' }),
        title: z
            .string()
            .meta({ description: 'Title of the activity to be displayed in the UI workflow builder' })
            .optional(),
        description: z
            .string()
            .meta({ description: 'The description of the activity to e displayed in the UI workflow builder' })
            .optional(),
        params: z
            .looseObject({})
            .meta({
                description:
                    'Activities parameters. These parameters can be either literals (hardcoded strings, numbers, booleans, objects, arrays etc.), either references to the workflow variables. The workflow variables are built from the workflow params (e.g. the workflow configuration) and from the result of the previous activities.',
            })
            .optional(),
        output: z
            .string()
            .meta({
                description:
                    'The name of the workflow variable that will store the result of the activity If not specified the result will not be stored The parameters describe how the actual parameters will be obtained from the workflow execution vars. since it may contain references to workflow execution vars.',
            })
            .optional(),
        condition: z
            .looseObject({})
            .meta({
                description:
                    'A JSON expression which evaluate to true or false similar to mongo matches. We support for now basic expression like: $true, $false, $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $regexp {$eq: {name: value}}, Ex: {$eq: {wfVarName: value}}',
            })
            .optional(),
        import: ImportSpecSchema.meta({
            description:
                'The import spec is used to import data from workflow variables. The import spec is a list of variable names to import from the workflow context. You can also use objects to rename the imported variables, or to reference an expression. Example: ["runId", {"typeId": "docType.id"}]',
        }).optional(),
        fetch: ActivityFetchSpecMapSchema.meta({
            description: 'The fetch phase is used to fetch data from external sources.',
        }).optional(),
        projection: z
            .looseObject({})
            .meta({ description: 'Projection to apply to the result. Not all activities support this.' })
            .optional(),
        parallel: z
            .boolean()
            .meta({
                description:
                    'If true the activity will be executed in parallel with the other activities. (i.e. the workflow will not wait for the activity to finish before starting the next one)',
            })
            .optional(),
        await: z.string().meta({ description: 'Await for a parallel activity execution to return.' }).optional(),
        options: DSLActivityOptionsSchema.meta({
            description:
                'Activity options for configuring the activity execution, which overrides the activity options defined at workflow level.',
        }).optional(),
    })
    .meta({ id: 'DSLActivityStep' });

export const ContentObjectApiResponseSchema = z
    .strictObject({
        id: z.string().meta({ description: 'Unique identifier for the object' }),
        name: z.string().meta({ description: 'Human-readable name or title' }),
        description: z.string().meta({ description: 'Optional detailed description of the object' }).optional(),
        tags: z.array(z.string()).meta({ description: 'Optional array of categorization tags' }).optional(),
        updated_by: z.string().meta({ description: 'Identifier of the user who last modified the object' }),
        created_by: z.string().meta({ description: 'Identifier of the user who created the object' }),
        created_at: z.string().meta({ description: 'ISO timestamp of when the object was created' }),
        updated_at: z.string().meta({ description: 'ISO timestamp of when the object was last updated' }),
        parent: z.string().optional(),
        location: z.string(),
        status: ContentObjectStatusSchema,
        type: ContentObjectApiTypeRefSchema.optional(),
        content: ContentSourceSchema.optional(),
        external_id: z.string().optional(),
        properties: JSONObjectSchema,
        metadata: z.looseObject({}).optional(),
        tokens: z
            .strictObject({
                count: z.number().optional(),
                encoding: z.string().optional(),
                etag: z.string().optional(),
            })
            .optional(),
        revision: ContentObjectApiRevisionSchema,
        is_deleted: z.boolean().optional(),
        is_locked: z.boolean().optional(),
        score: z.number().optional(),
        user_permissions: ContentObjectUserPermissionsSchema.optional(),
        text: z.string().optional(),
        text_etag: z.string().optional(),
        embeddings: EmbeddingMapSchema.optional(),
        parts: z.array(z.string()).optional(),
        parts_etag: z.string().optional(),
        transcript: z.looseObject({}).optional(),
        security: StringArrayMapSchema.optional(),
        inherited_properties: z.array(InheritedPropertyMetadataSchema).optional(),
    })
    .meta({ id: 'ContentObjectApiResponse' });

export const ComputeObjectFacetPayloadSchema = z
    .strictObject({
        facets: z.array(FacetSpecSchema),
        query: ComplexSearchQuerySchema.optional(),
    })
    .meta({ id: 'ComputeObjectFacetPayload' });

export const ProcessScriptResourceMapSchema = z
    .object({})
    .catchall(ProcessScriptResourceSchema)
    .meta({ id: 'ProcessScriptResourceMap' });

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

export const ContentObjectItemApiResponseSchema = z
    .strictObject({
        id: z.string().meta({ description: 'Unique identifier for the object' }),
        name: z.string().meta({ description: 'Human-readable name or title' }),
        description: z.string().meta({ description: 'Optional detailed description of the object' }).optional(),
        tags: z.array(z.string()).meta({ description: 'Optional array of categorization tags' }).optional(),
        updated_by: z.string().meta({ description: 'Identifier of the user who last modified the object' }),
        created_by: z.string().meta({ description: 'Identifier of the user who created the object' }),
        created_at: z.string().meta({ description: 'ISO timestamp of when the object was created' }),
        updated_at: z.string().meta({ description: 'ISO timestamp of when the object was last updated' }),
        parent: z.string().optional(),
        location: z.string(),
        status: ContentObjectStatusSchema,
        type: ContentObjectApiTypeRefSchema.optional(),
        content: ContentSourceSchema.optional(),
        external_id: z.string().optional(),
        properties: JSONObjectSchema,
        metadata: z.looseObject({}).optional(),
        tokens: z
            .strictObject({
                count: z.number().optional(),
                encoding: z.string().optional(),
                etag: z.string().optional(),
            })
            .optional(),
        revision: ContentObjectApiRevisionSchema,
        is_deleted: z.boolean().optional(),
        is_locked: z.boolean().optional(),
        score: z.number().optional(),
        user_permissions: ContentObjectUserPermissionsSchema.optional(),
    })
    .meta({ id: 'ContentObjectItemApiResponse' });

export const ComplexSearchPayloadSchema = z
    .strictObject({
        facets: z.array(FacetSpecSchema).optional(),
        limit_facets: z
            .boolean()
            .meta({
                description:
                    'If the facets should be limited to the current page of results. Defaults to false. When false, the facets are independent of the search results page.',
            })
            .optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
        select: z.string().optional(),
        all_revisions: z.boolean().optional(),
        from_root: z.string().optional(),
        sort: z
            .array(SortOptionSchema)
            .meta({
                description: 'Sort criteria. Multiple entries enable multi-field sorting (first entry is primary).',
            })
            .optional(),
        aggs: z
            .looseObject({})
            .meta({
                description:
                    'Arbitrary Elasticsearch aggregation definitions. Ignored when search falls back to MongoDB.',
            })
            .optional(),
        query: ComplexSearchQuerySchema.optional(),
    })
    .meta({ id: 'ComplexSearchPayload' });

export const ViewBoardDisplaySchema = z
    .strictObject({
        id: z.string(),
        label: z.string(),
        renderer: z.string().optional(),
        page_size: z.number().optional(),
        type: z.literal('board'),
        group_by: z.string(),
        columns: z.array(ViewBoardColumnSchema).optional(),
        card: ViewBoardCardConfigurationSchema,
    })
    .meta({ id: 'ViewBoardDisplay' });

export const Partial_AgentMessageSchema = z
    .strictObject({
        timestamp: z.number().optional(),
        workflow_run_id: z.string().optional(),
        type: AgentMessageTypeSchema.optional(),
        message: z.string().optional(),
        details: AgentMessageDetailsSchema.optional(),
        workstream_id: z.string().optional(),
    })
    .meta({ id: 'Partial_AgentMessage' });

export const ContentObjectItemApiResponseArraySchema = z
    .array(ContentObjectItemApiResponseSchema)
    .meta({ id: 'ContentObjectItemApiResponseArray' });

export const AgentRunUpdatesResponseSchema = z
    .strictObject({
        messages: z.array(CompactMessageSchema),
    })
    .meta({ id: 'AgentRunUpdatesResponse', description: 'Response payload for retrieving compact agent updates.' });

export const WorkflowHistorySchema = z
    .discriminatedUnion('type', [
        z.strictObject({
            type: z.literal('events'),
            events: z.array(WorkflowRunEventSchema),
        }),
        z.strictObject({
            type: z.literal('tasks'),
            tasks: z.array(WorkflowTaskSchema),
        }),
        z.strictObject({
            type: z.literal('agent'),
            agentTasks: z.array(AgentTaskSchema),
        }),
    ])
    .meta({ id: 'WorkflowHistory', type: 'object', required: ['type'], discriminator: { propertyName: 'type' } });

export const ViewHitSchema = z
    .strictObject({
        id: z.string(),
        score: z.number().optional(),
        document: ContentObjectItemApiResponseSchema,
        annotation: ViewHitAnnotationSchema.optional(),
    })
    .meta({ id: 'ViewHit' });

export const ProcessResourcesDefinitionSchema = z
    .strictObject({
        scripts: ProcessScriptResourceMapSchema.optional(),
    })
    .meta({ id: 'ProcessResourcesDefinition' });

export const ListEventDeliveriesResponseSchema = z
    .strictObject({
        deliveries: z.array(EventDeliverySummarySchema),
    })
    .meta({ id: 'ListEventDeliveriesResponse' });

export const ObjectSearchResponseSchema = z
    .strictObject({
        results: z.array(ContentObjectItemApiResponseSchema),
        facets: ComputedFacetResponseSchema,
        aggregations: z.looseObject({}).optional(),
    })
    .meta({ id: 'ObjectSearchResponse' });

export const ViewDisplayConfigurationSchema = z
    .discriminatedUnion('type', [
        ViewListDisplaySchema,
        ViewTableDisplaySchema,
        ViewCardsDisplaySchema,
        ViewGalleryDisplaySchema,
        ViewBoardDisplaySchema,
    ])
    .meta({ id: 'ViewDisplayConfiguration' });

export const PostAgentRunUpdatePayloadSchema = Partial_AgentMessageSchema.meta({
    id: 'PostAgentRunUpdatePayload',
    description: "Payload for posting an update into an agent's workflow stream.",
});

export const WorkflowRunWithDetailsSchema = z
    .strictObject({
        status: z.union([WorkflowExecutionStatusSchema, z.string()]).optional(),
        type: z.string().meta({ description: 'The Temporal Workflow Type of this Workflow Run.' }).optional(),
        started_at: nullableStringSchema,
        closed_at: nullableStringSchema,
        execution_duration: z.number().optional(),
        run_id: z.string().optional(),
        workflow_id: z.string().optional(),
        initiated_by: z.string().optional(),
        interaction_name: z.string().optional(),
        input: z.unknown().optional(),
        result: z.unknown().optional(),
        error: z.unknown().optional(),
        has_reported_errors: z.boolean().optional(),
        raw: z.unknown().optional(),
        vertesia_workflow_type: z
            .string()
            .meta({
                description:
                    'The Vertesia Workflow Type of this Workflow Run.  - For DSL workflows (`type:dslWorkflow`), the vertesia_type refers to the "Workflow Rule Name" specified in the    DSL. For example, "Standard Document Intake" or "Standard Image Intake".  - For non-DSL workflows, the vertesia_type is the name of the Temporal Workflow Type.',
            })
            .optional(),
        interactions: z
            .array(InteractionRefSchema)
            .meta({ description: 'An interaction is used to start the agent, the data is stored on temporal "vars"' })
            .optional(),
        visibility: ConversationVisibilitySchema.meta({
            description:
                "The visibility of the workflow run.\n- 'private': Only visible to the user who initiated the workflow\n- 'project': Visible to all users in the project",
        }).optional(),
        topic: z.string().meta({ description: 'A brief summary of the conversation workflow.' }).optional(),
        activity_state: ConversationActivityStateSchema.meta({
            description:
                "The current activity state of the conversation.\n- 'working': The agent is actively processing\n- 'idle': The agent is waiting for user input",
        }).optional(),
        interactive: z
            .boolean()
            .meta({ description: 'Whether this conversation is interactive (accepts user input).' })
            .optional(),
        history: WorkflowHistorySchema.optional(),
        memo: z.union([z.object({}).catchall(z.unknown()), z.null()]).optional(),
        pendingActivities: z.array(PendingActivitySchema).optional(),
    })
    .meta({ id: 'WorkflowRunWithDetails' });

export const ViewResultsConfigurationSchema = z
    .strictObject({
        default_display: z.string(),
        allow_display_switch: z.boolean().optional(),
        displays: z.array(ViewDisplayConfigurationSchema),
        default_sort: z.string().optional(),
        sort_options: z.array(ViewSortOptionSchema).optional(),
    })
    .meta({ id: 'ViewResultsConfiguration' });

export const ViewExecutionDefinitionSchema = z
    .strictObject({
        name: z.string(),
        description: z.string().optional(),
        enabled: z.boolean().optional(),
        layout: ViewExperienceLayoutSchema.optional(),
        navigation: z.array(ViewNavigationItemSchema).optional(),
        search: ViewExecutionSearchConfigurationSchema.optional(),
        results: ViewResultsConfigurationSchema.optional(),
    })
    .meta({
        id: 'ViewExecutionDefinition',
        description:
            'The reusable, client-visible part of the View definition used for an execution. Server-owned scope is intentionally omitted.',
    });

export const ViewExperienceConfigurationSchema = z
    .strictObject({
        name: z.string(),
        description: z.string().optional(),
        enabled: z.boolean().optional(),
        layout: ViewExperienceLayoutSchema.optional(),
        scope: ViewExperienceScopeSchema.optional(),
        navigation: z.array(ViewNavigationItemSchema).optional(),
        search: ViewSearchConfigurationSchema.optional(),
        results: ViewResultsConfigurationSchema.optional(),
    })
    .meta({ id: 'ViewExperienceConfiguration' });

export const ViewExecutionResultSchema = z
    .strictObject({
        view: z.string(),
        revision: z.number(),
        definition: ViewExecutionDefinitionSchema.meta({
            description: 'The runtime-safe rendering definition resolved by Zeno for this execution.',
        }),
        display: z.string().optional(),
        sort: z.string().optional(),
        search: ViewExecutionSearchResultSchema,
        hits: z.array(ViewHitSchema),
        total: z.number(),
        navigation: ViewNavigationResultMapSchema,
        took: z.number(),
    })
    .meta({ id: 'ViewExecutionResult' });

export const PreviewViewExperienceRequestSchema = z
    .strictObject({
        query: z.string().optional(),
        key_terms: StringArrayMapSchema.optional(),
        navigation: StringArrayMapSchema.optional(),
        display: z.string().optional(),
        sort: z.string().optional(),
        offset: z.number().optional(),
        limit: z.number().optional(),
        configuration: ViewExperienceConfigurationSchema.meta({
            description: 'The unsaved View configuration to validate and execute.',
        }),
    })
    .meta({
        id: 'PreviewViewExperienceRequest',
        description:
            'Execute an unsaved (draft) View configuration without persisting it. Combines the inline configuration with the same execution inputs as  {@link  ExecuteViewRequest }  so authors can validate and preview results before calling create/update.',
    });

export const AgentRunResponseSchema: z.ZodType = z
    .discriminatedUnion('run_type', [
        AutonomousRunResponseSchema,
        z.lazy(() => SupervisedRunResponseSchema) as unknown as z.ZodObject,
        z.lazy(() => ProgrammaticRunResponseSchema) as unknown as z.ZodObject,
    ])
    .meta({ id: 'AgentRunResponse' });

export const BranchNodeBranchDefinitionSchema: z.ZodType = z
    .strictObject({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        node: z.lazy(() => NodeDefinitionSchema),
        metadata: ProcessDefinitionMetadataSchema.optional(),
    })
    .meta({ id: 'BranchNodeBranchDefinition' });

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

export const CreateProcessDefinitionPayloadSchema: z.ZodType = z
    .strictObject({
        name: z.string(),
        description: z.string().optional(),
        status: ProcessDefinitionStatusSchema.meta({
            description:
                'Deprecated: Process definitions are created as drafts. Use the publish endpoint\nto create immutable published versions.',
            deprecated: true,
            'x-deprecated-message':
                'Process definitions are created as drafts. Use the publish endpoint\nto create immutable published versions.',
        }).optional(),
        version: z
            .number()
            .meta({
                description:
                    'Deprecated: Version is server-owned. Use the publish endpoint to create the next version.',
                deprecated: true,
                'x-deprecated-message': 'Version is server-owned. Use the publish endpoint to create the next version.',
            })
            .optional(),
        tags: z.array(z.string()).optional(),
        definition: z.lazy(() => ProcessDefinitionBodySchema),
    })
    .meta({ id: 'CreateProcessDefinitionPayload' });

export const DSLChildWorkflowStepSchema: z.ZodType = z
    .strictObject({
        type: z.literal('workflow').meta({ description: 'The type fo the step. If not set defaults to "activity"' }),
        name: z.string(),
        vars: z
            .looseObject({})
            .meta({
                description:
                    'The parameters to pass to the child workflow. These parameters will be merged over the parent workflow vars and passed altogether to the child workflow.',
            })
            .optional(),
        async: z.boolean().optional(),
        output: z
            .string()
            .meta({
                description:
                    'The name of the workflow variable that will store the result of the child workflow (if async the workflow id is stored) If not specified the result will not be stored The parameters describe how the actual parameters will be obtained from the workflow execution vars. since it may contain references to workflow execution vars.',
            })
            .optional(),
        condition: z
            .looseObject({})
            .meta({
                description:
                    'A JSON expression which evaluates to true or false similar to mongo matches. The child workflow will only execute if the condition is satisfied. Example: {$eq: {wfVarName: value}}',
            })
            .optional(),
        spec: z
            .lazy(() => DSLWorkflowSpecSchema)
            .meta({
                description:
                    'In case the dslWorkflow is used as a child workflow the spec is used to define the child workflow. If spec is defined then the name must be "dslWorkflow"',
            })
            .optional(),
        options: z
            .strictObject({
                memo: z.looseObject({}).optional(),
                retry: DSLRetryPolicySchema.optional(),
                searchAttributes: WorkflowSearchAttributesSchema.optional(),
                taskQueue: z.string().optional(),
                workflowExecutionTimeout: DurationValueSchema.optional(),
                workflowRunTimeout: DurationValueSchema.optional(),
                workflowTaskTimeout: DurationValueSchema.optional(),
                workflowId: z.string().optional(),
                cronSchedule: z.string().optional(),
                parentClosePolicy: z.enum(['TERMINATE', 'ABANDON', 'REQUEST_CANCEL']).optional(),
            })
            .optional(),
    })
    .meta({ id: 'DSLChildWorkflowStep' });

export const DSLWorkflowDefinitionSchema: z.ZodType = z
    .strictObject({
        name: z.string().meta({ description: 'Human-readable name or title' }),
        description: z.string().meta({ description: 'Optional detailed description of the object' }).optional(),
        tags: z.array(z.string()).meta({ description: 'Optional array of categorization tags' }).optional(),
        steps: z.array(z.lazy(() => DSLWorkflowStepSchema)).optional(),
        activities: z.array(DSLActivitySpecSchema).optional(),
        vars: z.looseObject({}),
        options: DSLActivityOptionsSchema.optional(),
        result: z.string().optional(),
        debug_mode: z.boolean().optional(),
        id: z.string().meta({ description: 'Unique identifier for the object' }),
        updated_by: z.string().meta({ description: 'Identifier of the user who last modified the object' }),
        created_by: z.string().meta({ description: 'Identifier of the user who created the object' }),
        created_at: z.string().meta({ description: 'ISO timestamp of when the object was created' }),
        updated_at: z.string().meta({ description: 'ISO timestamp of when the object was last updated' }),
        input_schema: z.looseObject({}).optional(),
    })
    .meta({ id: 'DSLWorkflowDefinition' });

export const DSLWorkflowDefinitionResponseSchema: z.ZodType = z
    .strictObject({
        name: z.string().meta({ description: 'Human-readable name or title' }),
        description: z.string().meta({ description: 'Optional detailed description of the object' }).optional(),
        tags: z.array(z.string()).meta({ description: 'Optional array of categorization tags' }).optional(),
        steps: z.array(z.lazy(() => DSLWorkflowStepSchema)).optional(),
        activities: z.array(DSLActivitySpecSchema).optional(),
        vars: z.looseObject({}),
        options: DSLActivityOptionsSchema.optional(),
        result: z.string().optional(),
        debug_mode: z.boolean().optional(),
        id: z.string().meta({ description: 'Unique identifier for the object' }),
        updated_by: z.string().meta({ description: 'Identifier of the user who last modified the object' }),
        created_by: z.string().meta({ description: 'Identifier of the user who created the object' }),
        created_at: z.string().meta({ description: 'ISO timestamp of when the object was created' }),
        updated_at: z.string().meta({ description: 'ISO timestamp of when the object was last updated' }),
        input_schema: z.looseObject({}).optional(),
        spec_format: z.enum(['steps', 'activities']),
    })
    .meta({ id: 'DSLWorkflowDefinitionResponse' });

export const DSLWorkflowSpecSchema: z.ZodType = z
    .discriminatedUnion('spec_format', [
        z.lazy(() => DSLWorkflowSpecWithStepsSchema) as unknown as z.ZodObject,
        z.lazy(() => DSLWorkflowSpecWithActivitiesSchema) as unknown as z.ZodObject,
    ])
    .meta({ id: 'DSLWorkflowSpec' });

export const DSLWorkflowSpecWithActivitiesSchema: z.ZodType = z
    .strictObject({
        name: z.string(),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
        steps: z.array(z.lazy(() => DSLWorkflowStepSchema)).optional(),
        activities: z.array(DSLActivitySpecSchema).meta({
            description: 'Deprecated: use steps instead',
            deprecated: true,
            'x-deprecated-message': 'use steps instead',
        }),
        vars: z.looseObject({}),
        options: DSLActivityOptionsSchema.optional(),
        result: z.string().optional(),
        debug_mode: z.boolean().optional(),
        spec_format: z.literal('activities'),
    })
    .meta({ id: 'DSLWorkflowSpecWithActivities' });

export const DSLWorkflowSpecWithStepsSchema: z.ZodType = z
    .strictObject({
        name: z.string(),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
        steps: z.array(z.lazy(() => DSLWorkflowStepSchema)),
        activities: z
            .array(DSLActivitySpecSchema)
            .meta({
                description: 'Deprecated: use steps instead',
                deprecated: true,
                'x-deprecated-message': 'use steps instead',
            })
            .optional(),
        vars: z.looseObject({}),
        options: DSLActivityOptionsSchema.optional(),
        result: z.string().optional(),
        debug_mode: z.boolean().optional(),
        spec_format: z.literal('steps'),
    })
    .meta({ id: 'DSLWorkflowSpecWithSteps' });

export const DSLWorkflowStepSchema: z.ZodType = z
    .discriminatedUnion('type', [
        DSLActivityStepSchema,
        z.lazy(() => DSLChildWorkflowStepSchema) as unknown as z.ZodObject,
    ])
    .meta({ id: 'DSLWorkflowStep' });

export const EventDeliveryTargetSchema: z.ZodType = z
    .discriminatedUnion('type', [
        WorkflowEventDeliveryTargetSchema,
        WebhookEventDeliveryTargetSchema,
        AgentEventDeliveryTargetSchema,
        z.lazy(() => ProcessEventDeliveryTargetSchema) as unknown as z.ZodObject,
    ])
    .meta({ id: 'EventDeliveryTarget' });

export const EventDeliveryTargetInputSchema: z.ZodType = z
    .discriminatedUnion('type', [
        WorkflowEventDeliveryTargetInputSchema,
        WebhookEventDeliveryTargetInputSchema,
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

export const ListAgentRunsResponseSchema: z.ZodType = z
    .strictObject({
        items: z.array(z.lazy(() => AgentRunResponseSchema)),
        total_count: z.number(),
        next_cursor: nullableStringSchema,
    })
    .meta({ id: 'ListAgentRunsResponse' });

export const NodeDefinitionSchema: z.ZodType = z
    .strictObject({
        type: ProcessNodeTypeSchema,
        tool: z.string().optional(),
        script: z
            .string()
            .meta({ description: 'Named entry in process resources.scripts for script nodes.' })
            .optional(),
        timeout: z
            .number()
            .meta({ description: 'Script execution timeout in seconds. Defaults to 300 and is capped at 600.' })
            .optional(),
        interaction: z.string().optional(),
        process: z.string().optional(),
        process_definition: z.lazy(() => ProcessDefinitionBodySchema).optional(),
        process_version: z.number().optional(),
        run_type: ProcessNodeRunTypeSchema.optional(),
        returns: ProcessNodeReturnsDefinitionSchema.optional(),
        result_schema: JSONSchemaSchema.meta({
            description:
                'Optional JSON Schema for structured output produced by interaction and agent nodes. When omitted, the process engine derives a schema from `writes` and the process context schema.',
        }).optional(),
        prompt: z.string().optional(),
        input: z.looseObject({}).optional(),
        config: z.looseObject({}).optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        human_description: z
            .string()
            .meta({
                description:
                    'End-user-facing explanation of what this node does. Authored by the process designer (often an LLM) in plain language — one or two sentences — and rendered in run observability so a human reading the run can understand why this node exists without reading the config. Distinct from `description`, which is developer-facing.',
            })
            .optional(),
        writes: z.array(z.string()).optional(),
        skippable: z.boolean().optional(),
        max_retries: z.number().optional(),
        transitions: z.array(TransitionDefinitionSchema).optional(),
        tools: z.array(z.string()).optional(),
        model: z
            .string()
            .meta({
                description:
                    "Model id override for this node. If unset, falls back to the process run's `config.model`, then to the project's default. Useful when a specific node needs heavier reasoning (e.g. Opus for legal flagging) while the rest of the process uses a cheaper default.",
            })
            .optional(),
        task: HumanTaskDefinitionSchema.optional(),
        foreach: z.string().optional(),
        as: z.string().optional(),
        item_id: z.string().optional(),
        node: z.lazy(() => NodeDefinitionSchema).optional(),
        max_concurrency: z.number().optional(),
        collect: z.union([z.string(), ParallelCollectDefinitionSchema]).optional(),
        failure_policy: ParallelFailurePolicySchema.optional(),
        join: BranchJoinPolicySchema.optional(),
        branches: z.array(z.union([BranchDefinitionSchema, z.lazy(() => BranchNodeBranchDefinitionSchema)])).optional(),
        metadata: ProcessDefinitionMetadataSchema.optional(),
    })
    .meta({ id: 'NodeDefinition' });

export const NodeDefinitionMapSchema: z.ZodType = z
    .object({})
    .catchall(z.lazy(() => NodeDefinitionSchema))
    .meta({ id: 'NodeDefinitionMap' });

export const ProcessDefinitionSchema: z.ZodType = z
    .strictObject({
        id: z.string(),
        account: z.string(),
        project: z.string(),
        name: z.string(),
        description: z.string().optional(),
        status: ProcessDefinitionStatusSchema,
        version: z.number(),
        revision: ProcessDefinitionRevisionInfoSchema.optional(),
        tags: z.array(z.string()).optional(),
        definition: z.lazy(() => ProcessDefinitionBodySchema),
        created_at: z.string().meta({ format: 'date-time' }),
        updated_at: z.string().meta({ format: 'date-time' }),
        created_by: z.string(),
        updated_by: z.string(),
    })
    .meta({ id: 'ProcessDefinition' });

export const ProcessDefinitionArraySchema: z.ZodType = z
    .array(z.lazy(() => ProcessDefinitionSchema))
    .meta({ id: 'ProcessDefinitionArray' });

export const ProcessDefinitionBodySchema: z.ZodType = z
    .strictObject({
        format_version: ProcessDefinitionFormatVersionSchema,
        process: z.string(),
        description: z.string().optional(),
        initial: z.string(),
        model: z.string().optional(),
        resources: ProcessResourcesDefinitionSchema.optional(),
        context: ProcessContextDefinitionSchema,
        nodes: z.lazy(() => NodeDefinitionMapSchema),
        metadata: ProcessDefinitionMetadataSchema.optional(),
    })
    .meta({ id: 'ProcessDefinitionBody' });

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

export const ProgrammaticRunResponseSchema: z.ZodType = z
    .strictObject({
        run_type: z.literal('programmatic'),
        id: z.string().meta({ description: 'The stable identifier used by all client code' }),
        run_kind: z.literal('process').meta({ description: 'Internal discriminator key' }),
        account: z.string().meta({ description: 'Account ID' }),
        project: z.string().meta({ description: 'Project ID' }),
        workflow_id: z.string().meta({ description: 'Temporal workflow ID (stable across continueAsNew)' }).optional(),
        first_workflow_run_id: z
            .string()
            .meta({ description: 'First Temporal workflow run ID (used for Redis channel and artifact resolution)' })
            .optional(),
        artifacts_path: z.string().meta({ description: 'Artifact storage path for this run' }).optional(),
        status: AgentRunStatusSchema.meta({ description: 'Current status of the run' }),
        activity_state: ConversationActivityStateSchema.meta({
            description: 'Whether the run is currently working or idle',
        }).optional(),
        visibility: ConversationVisibilitySchema.meta({ description: 'Conversation/process visibility' }).optional(),
        started_by: z.string().meta({ description: 'User or service that initiated the run' }),
        started_at: z.string().meta({ description: 'When the run started', format: 'date-time' }),
        completed_at: z
            .string()
            .meta({ description: 'When the run completed (or failed/cancelled)', format: 'date-time' })
            .optional(),
        title: z.string().meta({ description: 'Short human-readable title' }).optional(),
        tags: z.array(z.string()).meta({ description: 'User-defined or system tags for categorization' }).optional(),
        categories: z.array(z.string()).meta({ description: 'Categories for organizing runs' }).optional(),
        source: RunSourceSchema.meta({ description: 'How the run was started' }).optional(),
        source_type: AgentRunTypeSchema.meta({ description: 'Replacement for legacy AgentRun.type' }).optional(),
        schedule_id: z
            .string()
            .meta({ description: 'Schedule ID — set when this run was triggered by a Temporal schedule' })
            .optional(),
        event_subscription_id: z
            .string()
            .meta({ description: 'Event subscription ID — set when this run was triggered by the event bus.' })
            .optional(),
        event_ref: EventRefSchema.meta({
            description: 'Event reference — set when this run was triggered by the event bus.',
        }).optional(),
        archive_state: AgentRunArchiveStateSchema.meta({ description: 'Archive lifecycle state' }).optional(),
        created_at: z.string().meta({ description: 'Timestamp when the document was created', format: 'date-time' }),
        updated_at: z
            .string()
            .meta({ description: 'Timestamp when the document was last updated', format: 'date-time' }),
        process_id: z.string().optional(),
        process_definition_snapshot: z.lazy(() => ProcessDefinitionBodySchema),
        process_version: z.number().optional(),
        process_state: ProcessStateSchema,
        config: ProcessRunConfigSchema.optional(),
    })
    .meta({ id: 'ProgrammaticRunResponse' });

export const SupervisedRunResponseSchema: z.ZodType = z
    .strictObject({
        run_type: z.literal('supervised'),
        id: z.string().meta({ description: 'The stable identifier used by all client code' }),
        run_kind: z.literal('process').meta({ description: 'Internal discriminator key' }),
        account: z.string().meta({ description: 'Account ID' }),
        project: z.string().meta({ description: 'Project ID' }),
        workflow_id: z.string().meta({ description: 'Temporal workflow ID (stable across continueAsNew)' }).optional(),
        first_workflow_run_id: z
            .string()
            .meta({ description: 'First Temporal workflow run ID (used for Redis channel and artifact resolution)' })
            .optional(),
        artifacts_path: z.string().meta({ description: 'Artifact storage path for this run' }).optional(),
        status: AgentRunStatusSchema.meta({ description: 'Current status of the run' }),
        activity_state: ConversationActivityStateSchema.meta({
            description: 'Whether the run is currently working or idle',
        }).optional(),
        visibility: ConversationVisibilitySchema.meta({ description: 'Conversation/process visibility' }).optional(),
        started_by: z.string().meta({ description: 'User or service that initiated the run' }),
        started_at: z.string().meta({ description: 'When the run started', format: 'date-time' }),
        completed_at: z
            .string()
            .meta({ description: 'When the run completed (or failed/cancelled)', format: 'date-time' })
            .optional(),
        title: z.string().meta({ description: 'Short human-readable title' }).optional(),
        tags: z.array(z.string()).meta({ description: 'User-defined or system tags for categorization' }).optional(),
        categories: z.array(z.string()).meta({ description: 'Categories for organizing runs' }).optional(),
        source: RunSourceSchema.meta({ description: 'How the run was started' }).optional(),
        source_type: AgentRunTypeSchema.meta({ description: 'Replacement for legacy AgentRun.type' }).optional(),
        schedule_id: z
            .string()
            .meta({ description: 'Schedule ID — set when this run was triggered by a Temporal schedule' })
            .optional(),
        event_subscription_id: z
            .string()
            .meta({ description: 'Event subscription ID — set when this run was triggered by the event bus.' })
            .optional(),
        event_ref: EventRefSchema.meta({
            description: 'Event reference — set when this run was triggered by the event bus.',
        }).optional(),
        archive_state: AgentRunArchiveStateSchema.meta({ description: 'Archive lifecycle state' }).optional(),
        created_at: z.string().meta({ description: 'Timestamp when the document was created', format: 'date-time' }),
        updated_at: z
            .string()
            .meta({ description: 'Timestamp when the document was last updated', format: 'date-time' }),
        process_id: z.string().optional(),
        process_definition_snapshot: z.lazy(() => ProcessDefinitionBodySchema),
        process_version: z.number().optional(),
        process_state: ProcessStateSchema,
        config: ProcessRunConfigSchema.optional(),
    })
    .meta({ id: 'SupervisedRunResponse' });

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

export const UpdateProcessDefinitionPayloadSchema: z.ZodType = z
    .strictObject({
        name: z.string().optional(),
        description: z.string().optional(),
        status: ProcessDefinitionStatusSchema.meta({
            description:
                'Deprecated: Status is server-owned. Use publish/archive endpoints instead of updating it directly.',
            deprecated: true,
            'x-deprecated-message':
                'Status is server-owned. Use publish/archive endpoints instead of updating it directly.',
        }).optional(),
        version: z
            .number()
            .meta({
                description:
                    'Deprecated: Version is server-owned. Use the publish endpoint to create the next version.',
                deprecated: true,
                'x-deprecated-message': 'Version is server-owned. Use the publish endpoint to create the next version.',
            })
            .optional(),
        tags: z.array(z.string()).optional(),
        definition: z.lazy(() => ProcessDefinitionBodySchema).optional(),
    })
    .meta({ id: 'UpdateProcessDefinitionPayload' });

export const AgentRunArtifactUploadHeadersSchema = z
    .object({
        'content-type': z.string().optional(),
    })
    .meta({ id: 'AgentRunArtifactUploadHeaders' });

export const CreateContentObjectHeadersSchema = z
    .object({
        'x-collection-id': z.string().optional(),
        'x-processing-priority': ContentObjectProcessingPrioritySchema.optional(),
    })
    .meta({ id: 'CreateContentObjectHeaders' });

export const CreateContentObjectQuerySchema = z
    .object({
        collection_id: z.string().optional(),
        processing_priority: ContentObjectProcessingPrioritySchema.optional(),
    })
    .meta({ id: 'CreateContentObjectQuery' });

export const AgentRunArtifactQuerySchema = z
    .object({
        url: z.boolean().optional(),
        disposition: z.enum(['inline', 'attachment']).optional(),
        filename: z.string().optional(),
    })
    .meta({ id: 'AgentRunArtifactQuery' });

export const AgentRunDetailsQuerySchema = z
    .object({
        include_history: z.boolean().optional(),
        hydrate_payloads: z.boolean().optional(),
    })
    .meta({ id: 'AgentRunDetailsQuery' });

export const GetObjectRenditionQuerySchema = z
    .object({
        block_on_generation: z.boolean().optional(),
        generate_if_missing: z.boolean().optional(),
        max_hw: z.number().optional(),
        sign_url: z.boolean().optional(),
    })
    .meta({ id: 'GetObjectRenditionQuery' });

export const WorkflowRunDetailsQuerySchema = z
    .object({
        include_history: z.boolean().optional(),
        history_format: z.enum(['events', 'tasks', 'agent']).optional(),
        hydrate_payloads: z.boolean().optional(),
    })
    .meta({ id: 'WorkflowRunDetailsQuery' });

export const WorkflowRunUpdatesQuerySchema = z
    .object({
        since: z.number().optional(),
    })
    .meta({ id: 'WorkflowRunUpdatesQuery' });

export const AgentRunArtifactsQuerySchema = z
    .object({
        visibility: z.enum(['user', 'internal', 'all']).optional(),
    })
    .meta({ id: 'AgentRunArtifactsQuery' });

export const ListAgentRunsQuerySchema = z
    .object({
        id: z.string().meta({ description: 'Filter by agent run ID' }).optional(),
        status: z.array(AgentRunStatusSchema).meta({ description: 'Filter by status (single or multiple)' }).optional(),
        interaction: z.string().meta({ description: 'Filter by interaction ID or code' }).optional(),
        started_by: z.string().meta({ description: 'Filter by user who started the run' }).optional(),
        since: z
            .string()
            .meta({ description: 'Only return runs started after this date', format: 'date-time' })
            .optional(),
        until: z
            .string()
            .meta({ description: 'Only return runs started at or before this date', format: 'date-time' })
            .optional(),
        limit: z.number().meta({ description: 'Maximum number of results (default: 50)' }).optional(),
        offset: z.number().meta({ description: 'Offset for pagination' }).optional(),
        cursor: z.string().meta({ description: 'Cursor for stable pagination' }).optional(),
        schedule_id: z.string().meta({ description: 'Filter by schedule ID' }).optional(),
        type: AgentRunTypeSchema.meta({ description: 'Filter by run type' }).optional(),
        run_type: z.array(RunTypeSchema).meta({ description: 'Filter by public runtime mode' }).optional(),
        run_kind: RunKindSchema.meta({ description: 'Filter by internal run discriminator' }).optional(),
        sort: z.enum(['started_at', 'updated_at']).meta({ description: 'Field to sort by' }).optional(),
        order: z.enum(['asc', 'desc']).meta({ description: 'Sort order' }).optional(),
    })
    .meta({ id: 'ListAgentRunsQuery' });

export const AgentRunUpdatesQuerySchema = z
    .object({
        since: z.number().optional(),
    })
    .meta({ id: 'AgentRunUpdatesQuery' });

export const CollectionMembersQuerySchema = z
    .object({
        status: z.string().optional(),
        type: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
    })
    .meta({ id: 'CollectionMembersQuery' });

export const ListProcessDefinitionsQuerySchema = z
    .object({
        status: ProcessDefinitionStatusSchema.optional(),
        process: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
        all_versions: z.boolean().optional(),
    })
    .meta({ id: 'ListProcessDefinitionsQuery' });

export const SearchAgentRunsQuerySchema = z
    .object({
        query: z
            .string()
            .meta({ description: 'Full-text search across name, title, topic, interaction_name, and content' })
            .optional(),
        status: z.array(AgentRunStatusSchema).meta({ description: 'Filter by status (single or multiple)' }).optional(),
        interaction: z.string().meta({ description: 'Filter by interaction ID or code' }).optional(),
        started_by: z.string().meta({ description: 'Filter by user who started the run' }).optional(),
        categories: z.array(z.string()).meta({ description: 'Filter by categories' }).optional(),
        tags: z.array(z.string()).meta({ description: 'Filter by tags' }).optional(),
        content_type_name: z.string().meta({ description: 'Filter by content type name' }).optional(),
        run_type: z.array(RunTypeSchema).meta({ description: 'Filter by public runtime mode' }).optional(),
        since: z
            .string()
            .meta({ description: 'Only return runs started after this date', format: 'date-time' })
            .optional(),
        until: z
            .string()
            .meta({ description: 'Only return runs started at or before this date', format: 'date-time' })
            .optional(),
        limit: z.number().meta({ description: 'Maximum number of results (default: 50)' }).optional(),
        offset: z.number().meta({ description: 'Offset for pagination' }).optional(),
        sort: z
            .array(z.string())
            .meta({
                description:
                    "Multi-field sort. Each item has the form `field` or `field:order`, where   field is one of: `started_at`, `updated_at`   order is one of: `asc`, `desc` (default: `desc`) The first item is the primary sort; subsequent items are tie-breakers. Example: `['updated_at:desc', 'started_at:asc']`. Defaults to `['started_at:desc']` when omitted.",
            })
            .optional(),
    })
    .meta({ id: 'SearchAgentRunsQuery' });

export const StreamAgentRunQuerySchema = AgentRunUpdatesQuerySchema.extend({
    skipHistory: z.boolean().optional(),
}).meta({ id: 'StreamAgentRunQuery' });

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

export const WorkflowRunStreamQuerySchema = WorkflowRunUpdatesQuerySchema.extend({
    skipHistory: z.boolean().optional(),
}).meta({ id: 'WorkflowRunStreamQuery' });

export const UpdateContentObjectHeadersSchema = z
    .object({
        'if-match': z.string().optional(),
        'x-create-revision': z.boolean().optional(),
        'x-revision-label': z.string().optional(),
        'x-processing-priority': ContentObjectProcessingPrioritySchema.optional(),
        'x-suppress-workflows': z
            .boolean()
            .meta({
                description:
                    'Deprecated: Events are now always emitted. This suppresses the Temporal-backed delivery targets (workflow, agent, and process) — webhook deliveries still fire.',
                deprecated: true,
                'x-deprecated-message':
                    'Events are now always emitted. This suppresses the Temporal-backed delivery targets (workflow, agent, and process) — webhook deliveries still fire.',
            })
            .optional(),
    })
    .meta({ id: 'UpdateContentObjectHeaders' });

export const UpdateContentObjectQuerySchema = z
    .object({
        create_revision: z.boolean().optional(),
        revision_label: z.string().optional(),
        processing_priority: ContentObjectProcessingPrioritySchema.optional(),
    })
    .meta({ id: 'UpdateContentObjectQuery' });

export const ContentObjectApiResponseArraySchema = z
    .array(ContentObjectApiResponseSchema)
    .meta({ id: 'ContentObjectApiResponseArray' });

export const RecordAgentRunPayloadSchema = z
    .strictObject({
        workflow_id: z.string(),
        first_workflow_run_id: z.string(),
        run_kind: z.literal('agent').optional(),
        interaction: z.string(),
        schedule_id: z.string().optional(),
        visibility: ConversationVisibilitySchema.optional(),
        data: z.looseObject({}).optional(),
        type: AgentRunTypeSchema.optional(),
    })
    .meta({ id: 'RecordAgentRunPayload' });

export const RecordProcessRunPayloadSchema = z
    .strictObject({
        workflow_id: z.string(),
        first_workflow_run_id: z.string().optional(),
        run_kind: z.literal('process'),
        run_type: ProcessRunTypeSchema.optional(),
        process_id: z.string().optional(),
        process_version: z.number().optional(),
        process_definition: ProcessDefinitionBodySchema.optional(),
        data: z.looseObject({}).optional(),
        config: ProcessRunConfigSchema.optional(),
        visibility: ConversationVisibilitySchema.optional(),
        tags: z.array(z.string()).optional(),
        categories: z.array(z.string()).optional(),
        source: RunSourceSchema.optional(),
        started_by: z.string().optional(),
    })
    .meta({ id: 'RecordProcessRunPayload' });

export const RecordRunPayloadSchema = z
    .union([RecordAgentRunPayloadSchema, RecordProcessRunPayloadSchema])
    .meta({ id: 'RecordRunPayload' });

export const BindRunWorkflowPayloadSchema = z
    .strictObject({
        workflow_id: z.string(),
        first_workflow_run_id: z.string(),
        status: AgentRunStatusSchema.optional(),
        activity_state: ConversationActivityStateSchema.optional(),
    })
    .meta({ id: 'BindRunWorkflowPayload' });

export const UpdateAgentRunStatusPayloadSchema = z
    .strictObject({
        status: AgentRunStatusSchema.optional(),
        activity_state: ConversationActivityStateSchema.optional(),
        title: z.string().optional(),
        topic: z.string().optional(),
        lessons_learned: z.array(z.string()).optional(),
        properties: z.looseObject({}).optional(),
        content: z.string().optional(),
        disabled_mcp_collections: z.array(z.string()).optional(),
        tool_approval_mode: AgentToolApprovalModeSchema.optional(),
        archive_state: AgentRunArchiveStateSchema.optional(),
        archived_at: z.string().optional(),
        archive_version: z.number().optional(),
        last_archive_error: z.string().optional(),
        sequence: z.number().optional(),
        process_state: ProcessStateSchema.optional(),
    })
    .meta({ id: 'UpdateAgentRunStatusPayload' });

export const AgentRunInternalsSchema = z
    .strictObject({
        id: z.string(),
        workflow_id: z.string().optional(),
        first_workflow_run_id: z.string().optional(),
        artifacts_path: z.string().optional(),
        status: AgentRunStatusSchema,
        run_kind: RunKindSchema.optional(),
        run_type: RunTypeSchema.optional(),
        interaction: z.string().optional(),
        interaction_name: z.string().optional(),
        config: InteractionExecutionConfigurationSchema.optional(),
        interactive: z.boolean().optional(),
        process_id: z.string().optional(),
        process_definition_snapshot: ProcessDefinitionBodySchema.optional(),
        process_version: z.number().optional(),
        process_state: ProcessStateSchema.optional(),
        started_at: z.string().meta({ format: 'date-time' }),
        completed_at: z.string().meta({ format: 'date-time' }).optional(),
        started_by: z.string(),
        created_at: z.string().meta({ format: 'date-time' }),
        updated_at: z.string().meta({ format: 'date-time' }),
    })
    .meta({ id: 'AgentRunInternals' });
