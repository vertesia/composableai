import type {
    CompletionResult,
    ExecutionTokenUsage,
    JSONSchema,
    Modalities,
    PromptCacheDiagnostic,
    StatelessExecutionOptions,
    ToolUse,
} from '@llumiverse/common';
import type { ExecutionEnvironmentRef } from './environment.js';
import type { InferenceProfileSnapshot } from './inference-profile.js';
import type { ProjectRef } from './project.js';
import type { PopulatedPromptSegmentDef } from './prompt.js';
import type { TextArtifactReference } from './store/conversation-state.js';
import type { AccountRef } from './user.js';
import type * as Wire from './wire-types.generated.js';

/**
 * `RunDataStorageLevel` and `ConfigModes` live in `./interaction-values.js` so the API schemas can
 * read them without importing this module back. Re-exported here so every existing import path keeps
 * working.
 */
export * from './interaction-values.js';

export type InteractionExecutionError = Wire.InteractionExecutionError;

/**
 * Configuration for stripping large data from conversation history
 * to prevent JSON serialization issues and reduce storage bloat.
 */
export type ConversationStripOptions = Wire.ConversationStripOptions;

// ------------------ in code interactions -----------------
/**
 * Reference to an interaction in the catalog.
 * Used in catalog listing. The id is composed of the namespace and the interaction name.
 * Stored interactions can use `oid:` prefix.
 * If no prefix is used it fallback on `oid:`.
 */
export type CatalogInteractionRef = Wire.CatalogInteractionRef;

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

export type ResolveInteractionQuery = Wire.ResolveInteractionQuery;

export type InCodePrompt = Wire.InCodePrompt;
export type InCodeInteraction = Wire.InCodeInteraction;
export type ResolvedCatalogInteraction = Wire.ResolvedCatalogInteraction;
export type InteractionSpec = Omit<InCodeInteraction, 'id' | 'runtime' | 'type' | 'published' | 'version'>;
// ---------------------------------------------------------

/**
 * The payload to query the interaction endpoints
 */
export type InteractionEndpointQuery = Wire.InteractionEndpointQuery;

/**
 * A description of an interaction endpoint.
 */
export type InteractionEndpoint = Wire.InteractionEndpoint;

export type InteractionTags = Wire.InteractionTags;

export type InteractionRef = Wire.InteractionRef;

/** An interaction reduced to the fields a name picker needs. */
export type InteractionName = Wire.InteractionName;

/**
 * An interaction reference carrying the schemas an export needs to reconstruct it.
 *
 * An alias of the published component rather than the `Omit<InteractionRef, 'prompts'>` interface it
 * replaces. That `Omit` could not be resolved by the schema generator once `InteractionRef` became a
 * canonical alias — the alias publishes as a bare reference, with no members to omit — and the
 * interface also overstated each prompt template, which an export populates with `inputSchema` alone.
 */
export type InteractionRefWithSchema = Wire.InteractionRefWithSchema;

export type InteractionsExportPayload = Wire.InteractionsExportPayload;

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
 * Schema can be stored or specified as a reference to an external schema.
 * We only support "store:" references for now
 */
export type SchemaRef = Wire.SchemaRef;
export type CachePolicy = Wire.CachePolicy;
export type InteractionVisibility = Wire.InteractionVisibility;
export type Interaction = Wire.Interaction;

export type InteractionCreatePayload = Wire.InteractionCreatePayload;

export type InteractionUpdatePayload = Wire.InteractionUpdatePayload;

export type InteractionPublishPayload = Wire.InteractionPublishPayload;

export interface InteractionDeletePayload {
    /**
     * When true, also delete every interaction in the same family as the target:
     * - If the target is the root draft, its forks and published versions are deleted.
     * - If the target is a published version (or fork), the parent draft and all siblings are deleted.
     * Forward-only cascade — never deletes outside the target's family.
     */
    cascade?: boolean;
}

export type InteractionForkPayload = Wire.InteractionForkPayload;

export type InteractionExecutionPayload = Wire.InteractionExecutionPayload;

export type NamedInteractionExecutionPayload = Wire.NamedInteractionExecutionPayload;

export type ConversationVisibility = Wire.ConversationVisibility;

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
export type SkillContextTriggers = Wire.SkillContextTriggers;

/**
 * Configuration options for Agent Runner functionality.
 * These options control how interactions are exposed and executed in the Agent Runner.
 */
export type AgentRunnerOptions = Wire.AgentRunnerOptions;

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
export type InitialToolCall = Wire.InitialToolCall;

export type AsyncConversationExecutionPayload = Wire.AsyncConversationExecutionPayload;

export type AsyncInteractionExecutionPayload = Wire.AsyncInteractionExecutionPayload;

/**
 * @discriminator type
 */
export type AsyncExecutionPayload = Wire.AsyncExecutionPayload;

export type AsyncExecutionResult = Wire.AsyncExecutionResult;

/**
 * Telemetry context for streaming mode.
 * Contains info not available in current_state needed to send LlmCallEvent.
 */
export type StreamingTelemetryContext = Wire.StreamingTelemetryContext;

/**
 * Options for storing inference results to cloud storage
 */
export type ResultStorageOptions = Wire.ResultStorageOptions;

export type AsyncCompletionMode = Wire.AsyncCompletionMode;

/**
 * Streaming-specific options (only needed when stream=true)
 */
export type StreamingOptions = Wire.StreamingOptions;

/**
 * Options for async completion and/or streaming LLM responses
 */
export type AsyncCompletionOptions = Wire.AsyncCompletionOptions;

/**
 * The kinds of Vertesia resource an agent tool can report having created, updated, or deleted.
 * Restricted to resources that have a real detail route to navigate to — do not emit a reference
 * for a mutation with no meaningful navigation target. Add new kinds only once their route exists.
 */
export type AgentResourceType = Wire.AgentResourceType;

export type AgentResourceAction = Wire.AgentResourceAction;

/**
 * A navigable reference to a resource an agent tool mutated. Tools return these as tool-result
 * metadata (see {@link ToolResultMeta.resources}); the conversation runtime promotes them onto the
 * tool's completed lifecycle message so the UI can render deterministic deep links and an
 * end-of-turn "resources changed" summary — independent of any link the model writes in prose.
 */
export type AgentResourceReference = Wire.AgentResourceReference;

/**
 * Metadata a tool executor may attach to its result. Kept as an open record for forward
 * compatibility while typing the fields the runtime interprets.
 */
export type ToolResultMeta = Wire.ToolResultMeta;

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

export type ToolResult = Wire.ToolResult;

/**
 * The payload to sent the tool responses back to the target LLM
 */
export type ToolResultsPayload = Wire.ToolResultsPayload;

export type UserMessagePayload = Wire.UserMessagePayload;

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

export type RunSource = Wire.RunSource;

export type ExecutionRunInteraction = Wire.ExecutionRunInteraction;

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
    finish_reason?: string;
    prompt?: unknown;
    token_use?: ExecutionTokenUsage;
    prompt_cache_diagnostics?: PromptCacheDiagnostic[];
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
    inference_profile?: InferenceProfileSnapshot;
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

export type ExecutionRunWorkflow = Wire.ExecutionRunWorkflow;

export type PromptModalities = Wire.PromptModalities;

export interface InteractionExecutionResult<P = unknown>
    extends Omit<ExecutionRun<P>, 'account' | 'project' | 'interaction'> {
    account: string;
    project: string;
    interaction?: string;
    tool_use?: ToolUse[];
    conversation?: unknown;
    options?: StatelessExecutionOptions;
}

export type ExecutionRunRef = Wire.ExecutionRunRef;

export type InteractionExecutionConfiguration = Wire.InteractionExecutionConfiguration;

export type GenerateInteractionPayload = Wire.GenerateInteractionPayload;

export type GenerateTestDataPayload = Wire.GenerateTestDataPayload;

export type GeneratedTestDataRecord = Wire.GeneratedTestDataRecord;

export type ImprovePromptPayloadConfig = Wire.ImprovePromptPayloadConfig;

export type ImprovePromptPayload = Wire.ImprovePromptPayload;

export type GeneratedInteractionPromptTemplate = Wire.GeneratedInteractionPromptTemplate;

export type GeneratedInteractionPromptSegment = Wire.GeneratedInteractionPromptSegment;

export type GeneratedInteractionDefinition = Wire.GeneratedInteractionDefinition;

export type PromptImprovementResponse = Wire.PromptImprovementResponse;

export type RateLimitRequestPayload = Wire.RateLimitRequestPayload;

export type RateLimitRequestResponse = Wire.RateLimitRequestResponse;

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
export type ResolvedEnvironmentInfo = Wire.ResolvedEnvironmentInfo;

/**
 * Resolved runtime configuration for an interaction
 */
export type ResolvedRuntimeConfig = Wire.ResolvedRuntimeConfig;

/**
 * Resolved execution info for an interaction.
 * Contains the interaction ID, basic metadata, and the resolved runtime configuration
 * (environment, model) that would be used at execution time.
 */
export type ResolvedInteractionExecutionInfo = Wire.ResolvedInteractionExecutionInfo;

export interface PopulatedInteraction extends Omit<Interaction, 'prompts'> {
    prompts: PopulatedPromptSegmentDef[];
}

export type UpdateExecutionRunPayload = Wire.UpdateExecutionRunPayload;
