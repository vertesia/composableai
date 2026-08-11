import type {
    CompletionResult,
    ExecutionTokenUsage,
    JSONSchema,
    Modalities,
    ModelOptions,
    StatelessExecutionOptions,
    ToolUse,
} from '@llumiverse/common';
import type { z } from 'zod';
import type {
    AgentResourceActionSchema,
    AgentResourceReferenceSchema,
    AgentResourceTypeSchema,
    AgentRunnerOptionsSchema,
    AsyncCompletionModeSchema,
    AsyncCompletionOptionsSchema,
    AsyncConversationExecutionPayloadSchema,
    AsyncExecutionPayloadSchema,
    AsyncExecutionResultSchema,
    AsyncInteractionExecutionPayloadSchema,
    BatchDispatchResultSchema,
    BatchFlushReasonSchema,
    BatchPollResultSchema,
    BatchPoolInfoSchema,
    BatchReconcileRequestSchema,
    BatchReconcileResponseSchema,
    CachePolicySchema,
    CatalogInteractionRefSchema,
    ConversationStripOptionsSchema,
    ConversationVisibilitySchema,
    ExecutionRunInteractionSchema,
    ExecutionRunRefSchema,
    ExecutionRunWorkflowSchema,
    GeneratedInteractionDefinitionSchema,
    GeneratedInteractionPromptSegmentSchema,
    GeneratedInteractionPromptTemplateSchema,
    GeneratedTestDataRecordSchema,
    GenerateInteractionPayloadSchema,
    GenerateTestDataPayloadSchema,
    ImprovePromptPayloadConfigSchema,
    ImprovePromptPayloadSchema,
    InCodePromptSchema,
    InferenceBatchSchema,
    InitialToolCallSchema,
    InteractionCreatePayloadSchema,
    InteractionEndpointQuerySchema,
    InteractionEndpointSchema,
    InteractionExecutionErrorSchema,
    InteractionExecutionPayloadSchema,
    InteractionForkPayloadSchema,
    InteractionNameSchema,
    InteractionPublishPayloadSchema,
    InteractionRefSchema,
    InteractionRefWithSchemaSchema,
    InteractionSchema,
    InteractionsExportPayloadSchema,
    InteractionTagsSchema,
    InteractionUpdatePayloadSchema,
    InteractionVisibilitySchema,
    ListInferenceBatchesQuerySchema,
    NamedInteractionExecutionPayloadSchema,
    PromptImprovementResponseSchema,
    PromptModalitiesSchema,
    RateLimitRequestPayloadSchema,
    RateLimitRequestResponseSchema,
    ResolvedEnvironmentInfoSchema,
    ResolvedInteractionExecutionInfoSchema,
    ResolvedRuntimeConfigSchema,
    ResultStorageOptionsSchema,
    RunSourceSchema,
    SchemaRefSchema,
    SkillContextTriggersSchema,
    StreamingOptionsSchema,
    StreamingTelemetryContextSchema,
    ToolResultMetaSchema,
    ToolResultSchema,
    ToolResultsPayloadSchema,
    UpdateExecutionRunPayloadSchema,
    UserMessagePayloadSchema,
} from './api-schemas/interaction.js';
import type { InteractionExecutionConfigurationSchema } from './api-schemas/store.js';
import type { ExecutionEnvironmentRef } from './environment.js';
import type { ProjectRef } from './project.js';
import type { PopulatedPromptSegmentDef } from './prompt.js';
import type { TextArtifactReference } from './store/conversation-state.js';
import type { AccountRef } from './user.js';

/**
 * `RunDataStorageLevel` and `ConfigModes` live in `./interaction-values.js` so the API schemas can
 * read them without importing this module back. Re-exported here so every existing import path keeps
 * working.
 */
export * from './interaction-values.js';

import type { RunDataStorageLevel } from './interaction-values.js';

export type InteractionExecutionError = z.infer<typeof InteractionExecutionErrorSchema>;

/**
 * Configuration for stripping large data from conversation history
 * to prevent JSON serialization issues and reduce storage bloat.
 */
export type ConversationStripOptions = z.infer<typeof ConversationStripOptionsSchema>;

// ------------------ in code interactions -----------------
/**
 * Reference to an interaction in the catalog.
 * Used in catalog listing. The id is composed of the namespace and the interaction name.
 * Stored interactions can use `oid:` prefix.
 * If no prefix is used it fallback on `oid:`.
 */
export type CatalogInteractionRef = z.infer<typeof CatalogInteractionRefSchema>;

export interface CatalogTagQuery {
    tag?: string;
}

export interface StoredCatalogInteractionsQuery extends CatalogTagQuery {
    status?: string;
    published?: boolean;
}

export interface ExecuteInteractionByEndpointQuery {
    tag?: string;
}

export interface ExecuteInteractionByEndpointHeaders {
    'x-interaction-tag'?: string;
}

export interface ResolveInteractionQuery {
    environment?: string;
    model?: string;
    hasImage?: boolean;
    hasVideo?: boolean;
}

export type InCodePrompt = z.infer<typeof InCodePromptSchema>;
export interface InCodeInteraction {
    /**
     * The interaction type.
     */
    type: 'sys' | 'app' | 'stored' | 'draft';

    /**
     * The id of the interaction. Required.
     * The id is a unique identifier for the interaction.
     * It is recommended to use a URL safe string and not include spaces.
     * The id is composed of some namespace or prefix and the interaction name.
     * Example: sys:generic_question, app:review_contract, tmp:my_temp_interaction
     */
    id: string;

    /**
     * The interaction code name. Required.
     * Should be a URL safe string and not include spaces. It is recommended to use kebab-case or camel-case.
     * The endpoints must satisfy the following regexp: /^[a-zA-Z0-9-_]+$/. No whitespaces or special characters are allowed.
     */
    name: string;

    /**
     * Only applies for stored interactions. The version of the interaction.
     * Undefined for non stored interactions
     */
    version?: number;

    /**
     * Only applies for stored interactions. Whether the interaction is published or not.
     */
    published?: boolean;

    /**
     * A title for the interaction. If not provided, the endpoint will be used.
     */
    title?: string;

    /**
     * An optional description of the interaction.
     */
    description?: string;

    /**
     * The JSON schema to be used for the result if any.
     */
    result_schema?: JSONSchema | SchemaRef;

    /**
     * The modality of the interaction output.
     * If not specified Modalities.Text is assumed.
     */
    output_modality?: Modalities;

    /**
     * How to store the run data for executions of this interaction.
     * Defaults to STANDARD.
     */
    storage?: RunDataStorageLevel;

    /**
     * Optional tags for the interaction.
     */
    tags?: string[];

    /**
     * Agent Runner configuration options.
     */
    agent_runner_options?: AgentRunnerOptions;

    /**
     * Default options for the model to be used when executing this interaction.
     * (like temperature etc)
     */
    model_options?: ModelOptions;

    /**
     * The prompts composing the interaction. Required.
     */
    prompts: InCodePrompt[];

    /**
     * Optional reference to an external resource if any.
     * Used internally by the system to synchronize stored interactions with in-code interactions.
     */
    externalId?: string;

    /**
     * Runtime configuration (system use only)
     *
     * This field is populated by the system when converting stored interactions
     * and contains runtime-specific defaults like target model/environment IDs.
     *
     * DO NOT set this field manually when writing interaction definitions.
     * These values are environment-specific and not portable.
     *
     * @internal
     */
    runtime?: {
        /**
         * Default target environment for the interaction execution
         */
        environment?: string;

        /**
         * Default (recommended) target model for the interaction execution
         */
        model?: string;
    };
}
export interface InteractionSpec extends Omit<InCodeInteraction, 'id' | 'runtime' | 'type' | 'published' | 'version'> {}
// ---------------------------------------------------------

/**
 * The payload to query the interaction endpoints
 */
export type InteractionEndpointQuery = z.infer<typeof InteractionEndpointQuerySchema>;

/**
 * A description of an interaction endpoint.
 */
export type InteractionEndpoint = z.infer<typeof InteractionEndpointSchema>;

export type InteractionTags = z.infer<typeof InteractionTagsSchema>;

export type InteractionRef = z.infer<typeof InteractionRefSchema>;

/** An interaction reduced to the fields a name picker needs. */
export type InteractionName = z.infer<typeof InteractionNameSchema>;

/**
 * An interaction reference carrying the schemas an export needs to reconstruct it.
 *
 * An alias of the published component rather than the `Omit<InteractionRef, 'prompts'>` interface it
 * replaces. That `Omit` could not be resolved by the schema generator once `InteractionRef` became a
 * canonical alias — the alias publishes as a bare reference, with no members to omit — and the
 * interface also overstated each prompt template, which an export populates with `inputSchema` alone.
 */
export type InteractionRefWithSchema = z.infer<typeof InteractionRefWithSchemaSchema>;

export type InteractionsExportPayload = z.infer<typeof InteractionsExportPayloadSchema>;

export enum InteractionStatus {
    draft = 'draft',
    published = 'published',
    archived = 'archived',
    code = 'code', // for in-code interactions that are not stored in the database
    unknown = 'unknown', // for interactions with unknown status
}

export enum ExecutionRunStatus {
    created = 'created',
    processing = 'processing',
    completed = 'completed',
    failed = 'failed',
}

/**
 * How an execution may be routed with respect to provider batch inference.
 * - `direct`: always run synchronously, never batched (real-time / near-line: agent uploads, manual drops).
 * - `batch_preferred`: batch when it pays off (enough volume or the env:model slot is saturated), otherwise sync.
 * - `batch_only`: force batch to guarantee the cost saving, even when alone (flushed after max_wait).
 * Batch requires the environment's provider to support a batch API; otherwise these fall back to sync.
 */
export enum ExecutionMode {
    direct = 'direct',
    batch_preferred = 'batch_preferred',
    batch_only = 'batch_only',
}

/** Status of a submitted provider inference batch. */
export enum InferenceBatchStatus {
    queued = 'queued',
    running = 'running',
    succeeded = 'succeeded',
    failed = 'failed',
    cancelled = 'cancelled',
}

export type InferenceBatch = z.infer<typeof InferenceBatchSchema>;

export type ListInferenceBatchesQuery = z.infer<typeof ListInferenceBatchesQuerySchema>;

export type BatchPoolInfo = z.infer<typeof BatchPoolInfoSchema>;

export type BatchFlushReason = z.infer<typeof BatchFlushReasonSchema>;

export type BatchDispatchResult = z.infer<typeof BatchDispatchResultSchema>;

export type BatchPollResult = z.infer<typeof BatchPollResultSchema>;

export type BatchReconcilerWakeReason = 'startup' | 'run_parked' | 'scheduled';

/** A tenant whose batch accumulator should be reconciled. */
export interface BatchReconcilerTenant {
    account_id: string;
    project_id: string;
}

/** Durable wake-up sent to the singleton reconciler. */
export interface BatchReconcilerWake extends Partial<BatchReconcilerTenant> {
    reason: BatchReconcilerWakeReason;
}

/** Initial/continuation state for the singleton reconciler workflow. */
export interface BatchReconcilerWorkflowInput {
    studio_url: string;
    studio_audience?: string;
    pending?: Array<BatchReconcilerTenant & { due_at: number }>;
    cycles?: number;
}

export type BatchReconcileRequest = z.infer<typeof BatchReconcileRequestSchema>;

export type BatchReconcileResponse = z.infer<typeof BatchReconcileResponseSchema>;
/**
 * Schema can be stored or specified as a reference to an external schema.
 * We only support "store:" references for now
 */
export type SchemaRef = z.infer<typeof SchemaRefSchema>;
export type CachePolicy = z.infer<typeof CachePolicySchema>;
export type InteractionVisibility = z.infer<typeof InteractionVisibilitySchema>;
export type Interaction = z.infer<typeof InteractionSchema>;

export type InteractionCreatePayload = z.infer<typeof InteractionCreatePayloadSchema>;

export type InteractionUpdatePayload = z.infer<typeof InteractionUpdatePayloadSchema>;

export type InteractionPublishPayload = z.infer<typeof InteractionPublishPayloadSchema>;

export interface InteractionDeletePayload {
    /**
     * When true, also delete every interaction in the same family as the target:
     * - If the target is the root draft, its forks and published versions are deleted.
     * - If the target is a published version (or fork), the parent draft and all siblings are deleted.
     * Forward-only cascade — never deletes outside the target's family.
     */
    cascade?: boolean;
}

export type InteractionForkPayload = z.infer<typeof InteractionForkPayloadSchema>;

export type InteractionExecutionPayload = z.infer<typeof InteractionExecutionPayloadSchema>;

export type NamedInteractionExecutionPayload = z.infer<typeof NamedInteractionExecutionPayloadSchema>;

export type ConversationVisibility = z.infer<typeof ConversationVisibilitySchema>;

/**
 * Defines the scope for agent search operations.
 */
export enum AgentSearchScope {
    /**
     * Search is scoped to a specific collection.
     */
    Collection = 'collection',
}

/**
 * Context triggers for auto-injection of skills.
 * When these conditions match, the skill is automatically injected into the agent context.
 */
export type SkillContextTriggers = z.infer<typeof SkillContextTriggersSchema>;

/**
 * Configuration options for Agent Runner functionality.
 * These options control how interactions are exposed and executed in the Agent Runner.
 */
export type AgentRunnerOptions = z.infer<typeof AgentRunnerOptionsSchema>;

// ================= User Communication Channels ====================
// Import for local use

export type {
    EmailChannel,
    EmailRouteData,
    InteractiveChannel,
    UserChannel,
} from './email.js';
// Re-exported from email.ts for backwards compatibility
export {
    isEmailChannel,
    isInteractiveChannel,
} from './email.js';
// ================= end user communication channels ====================

/**
 * A tool invocation executed before the first model turn of a conversation.
 * Results are injected into the initial context so the agent starts with them in hand.
 */
export type InitialToolCall = z.infer<typeof InitialToolCallSchema>;

export type AsyncConversationExecutionPayload = z.infer<typeof AsyncConversationExecutionPayloadSchema>;

export type AsyncInteractionExecutionPayload = z.infer<typeof AsyncInteractionExecutionPayloadSchema>;

/**
 * @discriminator type
 */
export type AsyncExecutionPayload = z.infer<typeof AsyncExecutionPayloadSchema>;

export type AsyncExecutionResult = z.infer<typeof AsyncExecutionResultSchema>;

/**
 * Telemetry context for streaming mode.
 * Contains info not available in current_state needed to send LlmCallEvent.
 */
export type StreamingTelemetryContext = z.infer<typeof StreamingTelemetryContextSchema>;

/**
 * Options for storing inference results to cloud storage
 */
export type ResultStorageOptions = z.infer<typeof ResultStorageOptionsSchema>;

export type AsyncCompletionMode = z.infer<typeof AsyncCompletionModeSchema>;

/**
 * Streaming-specific options (only needed when stream=true)
 */
export type StreamingOptions = z.infer<typeof StreamingOptionsSchema>;

/**
 * Options for async completion and/or streaming LLM responses
 */
export type AsyncCompletionOptions = z.infer<typeof AsyncCompletionOptionsSchema>;

/**
 * The kinds of Vertesia resource an agent tool can report having created, updated, or deleted.
 * Restricted to resources that have a real detail route to navigate to — do not emit a reference
 * for a mutation with no meaningful navigation target. Add new kinds only once their route exists.
 */
export type AgentResourceType = z.infer<typeof AgentResourceTypeSchema>;

export type AgentResourceAction = z.infer<typeof AgentResourceActionSchema>;

/**
 * A navigable reference to a resource an agent tool mutated. Tools return these as tool-result
 * metadata (see {@link ToolResultMeta.resources}); the conversation runtime promotes them onto the
 * tool's completed lifecycle message so the UI can render deterministic deep links and an
 * end-of-turn "resources changed" summary — independent of any link the model writes in prose.
 */
export type AgentResourceReference = z.infer<typeof AgentResourceReferenceSchema>;

/**
 * Metadata a tool executor may attach to its result. Kept as an open record for forward
 * compatibility while typing the fields the runtime interprets.
 */
export type ToolResultMeta = z.infer<typeof ToolResultMetaSchema>;

export interface ToolResultContent {
    content: string;
    /**
     * Reference to text content stored outside Temporal/API payloads. Servers that
     * execute the next model turn should resolve this before constructing the
     * provider prompt.
     */
    content_ref?: TextArtifactReference;
    is_error: boolean;
    files?: string[];
    /**
     * Optional message to display in the UI instead of the content.
     * Use this when the content is large or technical (e.g., document text)
     * and you want to show a friendly message to the user.
     */
    display_message?: string;
    /**
     * Can contain metadata returned by the tool executor.
     */
    meta?: ToolResultMeta;
}

const AGENT_RESOURCE_TYPES: readonly AgentResourceType[] = [
    'document',
    'collection',
    'content_type',
    'interaction',
    'prompt',
    'agent',
    'workflow',
    'process',
    'process_run',
    'interaction_run',
    'view',
];

const AGENT_RESOURCE_ACTIONS: readonly AgentResourceAction[] = ['created', 'updated', 'deleted'];

/**
 * Validate and normalize an untrusted value into a clean list of resource references. References
 * cross the wire and may originate from external/MCP tools, so malformed entries are dropped
 * rather than throwing, and an empty/absent label falls back to the id.
 */
export function normalizeAgentResources(value: unknown): AgentResourceReference[] {
    if (!Array.isArray(value)) return [];
    const result: AgentResourceReference[] = [];
    for (const entry of value) {
        if (!entry || typeof entry !== 'object') continue;
        const ref = entry as Record<string, unknown>;
        const { type, id, label, action, revision_id } = ref;
        if (typeof type !== 'string' || !AGENT_RESOURCE_TYPES.includes(type as AgentResourceType)) continue;
        if (typeof id !== 'string' || id.length === 0) continue;
        if (typeof action !== 'string' || !AGENT_RESOURCE_ACTIONS.includes(action as AgentResourceAction)) continue;
        result.push({
            type: type as AgentResourceType,
            id,
            label: typeof label === 'string' && label.length > 0 ? label : id,
            action: action as AgentResourceAction,
            ...(typeof revision_id === 'string' && revision_id.length > 0 ? { revision_id } : {}),
        });
    }
    return result;
}

export type ToolResult = z.infer<typeof ToolResultSchema>;

/**
 * The payload to sent the tool responses back to the target LLM
 */
export type ToolResultsPayload = z.infer<typeof ToolResultsPayloadSchema>;

export type UserMessagePayload = z.infer<typeof UserMessagePayloadSchema>;

// ================= end async execution payloads ====================

export enum RunSourceTypes {
    api = 'api',
    cli = 'cli',
    ui = 'ui',
    webhook = 'webhook',
    test = 'test-data',
    system = 'system',
    schedule = 'schedule',
}

export type RunSource = z.infer<typeof RunSourceSchema>;

export type ExecutionRunInteraction = z.infer<typeof ExecutionRunInteractionSchema>;

export interface BaseExecutionRun<P = unknown> {
    readonly id: string;
    /**
     * Only used by runs that were created by a virtual run to point toward the virtual run parent
     */
    parent?: string | ExecutionRun;
    evaluation?: {
        score?: number;
        selected?: boolean;
        scores?: Record<string, number>;
    };
    result: CompletionResult[]; // Any new result will actually be CompletionResult[], the old typing is R, and R used to default to any.
    /**
     * The parameters used to create the interaction.
     * If the parameters contains the special property "@memory" it will be used
     * to locate a memory pack and the other properties will be used as the memory pack mapping.
     */
    parameters: P; //params used to create the interaction, only in varies on?
    tags?: string[];
    // The description that used to sit here now sits on `ExecutionRunInteractionSchema`, which is
    // where a `$ref` to an alias component can carry one. A `/** */` block here would publish a
    // SECOND copy on this property alone, and the property and the component it points at would then
    // be documented by two texts that have to be kept in step by hand.
    interaction?: string | ExecutionRunInteraction;
    /** Environment reference - populated with full object in API responses */
    environment: ExecutionEnvironmentRef;
    modelId?: string; //Can be undefined for virtual environments. In most cases should be defined.
    result_schema?: JSONSchema;
    ttl: number;
    status: ExecutionRunStatus;
    /** Batch routing mode; when `batch_preferred`/`batch_only` the run is parked in `created` for the accumulator. */
    execution_mode?: ExecutionMode;
    /** Id of the accumulator batch this run was assigned to, once claimed. */
    batch_id?: string;
    finish_reason?: string;
    prompt?: unknown;
    token_use?: ExecutionTokenUsage;
    chunks?: number;
    execution_time?: number; // ms
    // ISO strings, not `Date`. `ExecutionRunRef` — the shape every run endpoint actually returns —
    // is now inferred from the schema the document publishes, which says `type: string,
    // format: date-time`; `ExecutionRun` publishes the same two fields the same way. Typing them
    // `Date` here made the two disagree in TypeScript while agreeing on the wire. The `@format` tag
    // is what keeps the DERIVED schema saying `date-time` now that the type is no longer `Date`.
    /** @format date-time */
    created_at: string;
    /** @format date-time */
    updated_at: string;
    account: AccountRef;
    project: ProjectRef;
    config: InteractionExecutionConfiguration;
    error?: InteractionExecutionError;
    source: RunSource;

    /**
     * @deprecated This is deprecated. Use CompletionResult.type information instead.
     */
    output_modality?: Modalities;
    created_by: string;
    updated_by: string;

    /**
     * The Vertesia Workflow related to this Interaction Run.
     *
     * This is only set when the interaction is executed as part of a workflow.
     *
     * @since 0.60.0
     */
    workflow?: ExecutionRunWorkflow;
}

export interface ExecutionRun<P = unknown> extends BaseExecutionRun<P> {
    interaction?: ExecutionRunInteraction;
}

export interface PopulatedExecutionRun<P = unknown> extends BaseExecutionRun<P> {
    interaction?: ExecutionRunInteraction;
}

export type ExecutionRunWorkflow = z.infer<typeof ExecutionRunWorkflowSchema>;

export type PromptModalities = z.infer<typeof PromptModalitiesSchema>;

export interface InteractionExecutionResult<P = unknown>
    extends Omit<ExecutionRun<P>, 'account' | 'project' | 'interaction'> {
    account: string;
    project: string;
    interaction?: string;
    tool_use?: ToolUse[];
    conversation?: unknown;
    options?: StatelessExecutionOptions;
}

export type ExecutionRunRef = z.infer<typeof ExecutionRunRefSchema>;

export type InteractionExecutionConfiguration = z.infer<typeof InteractionExecutionConfigurationSchema>;

export type GenerateInteractionPayload = z.infer<typeof GenerateInteractionPayloadSchema>;

export type GenerateTestDataPayload = z.infer<typeof GenerateTestDataPayloadSchema>;

export type GeneratedTestDataRecord = z.infer<typeof GeneratedTestDataRecordSchema>;

export type ImprovePromptPayloadConfig = z.infer<typeof ImprovePromptPayloadConfigSchema>;

export type ImprovePromptPayload = z.infer<typeof ImprovePromptPayloadSchema>;

export type GeneratedInteractionPromptTemplate = z.infer<typeof GeneratedInteractionPromptTemplateSchema>;

export type GeneratedInteractionPromptSegment = z.infer<typeof GeneratedInteractionPromptSegmentSchema>;

export type GeneratedInteractionDefinition = z.infer<typeof GeneratedInteractionDefinitionSchema>;

export type PromptImprovementResponse = z.infer<typeof PromptImprovementResponseSchema>;

export type RateLimitRequestPayload = z.infer<typeof RateLimitRequestPayloadSchema>;

export type RateLimitRequestResponse = z.infer<typeof RateLimitRequestResponseSchema>;

/**
 * Source of the resolved model configuration
 */
export enum ModelSource {
    /** Model was explicitly provided in the execution config */
    config = 'config',
    /** Model comes from the interaction definition */
    interaction = 'interaction',
    /** Model comes from environment's default_model */
    environmentDefault = 'environmentDefault',
    /** Model comes from project system interaction defaults */
    projectSystemDefault = 'projectSystemDefault',
    /** Model comes from project base defaults */
    projectBaseDefault = 'projectBaseDefault',
    /** Model comes from project modality-specific defaults */
    projectModalityDefault = 'projectModalityDefault',
    /** Model comes from legacy project defaults */
    projectLegacyDefault = 'projectLegacyDefault',
}

/**
 * Resolved environment information
 */
export type ResolvedEnvironmentInfo = z.infer<typeof ResolvedEnvironmentInfoSchema>;

/**
 * Resolved runtime configuration for an interaction
 */
export type ResolvedRuntimeConfig = z.infer<typeof ResolvedRuntimeConfigSchema>;

/**
 * Resolved execution info for an interaction.
 * Contains the interaction ID, basic metadata, and the resolved runtime configuration
 * (environment, model) that would be used at execution time.
 */
export type ResolvedInteractionExecutionInfo = z.infer<typeof ResolvedInteractionExecutionInfoSchema>;

export interface PopulatedInteraction extends Omit<Interaction, 'prompts'> {
    prompts: PopulatedPromptSegmentDef[];
}

export type UpdateExecutionRunPayload = z.infer<typeof UpdateExecutionRunPayloadSchema>;
