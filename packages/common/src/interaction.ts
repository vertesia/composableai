import type {
    CompletionResult,
    JSONObject,
    JSONSchema,
    Modalities,
    ModelOptions,
    PromptRole,
    StatelessExecutionOptions,
    ToolDefinition,
    ToolUse,
} from "@llumiverse/common";

import { ExecutionTokenUsage } from "@llumiverse/common";

import { ExecutionEnvironmentRef } from "./environment.js";
import { ProjectRef } from "./project.js";
import {
    ExecutablePromptSegmentDef,
    PopulatedPromptSegmentDef,
    PromptSegmentDef,
    PromptTemplateRef,
    PromptTemplateRefWithSchema,
    TemplateType,
} from "./prompt.js";
import { ExecutionRunDocRef } from "./runs.js";
import { ConversationState } from "./store/conversation-state.js";
import { AccountRef } from "./user.js";
import { LlmCallType } from "./workflow-analytics.js";

export interface InteractionExecutionError {
    code: string;
    message: string;
    data?: any;
    retryable?: boolean;
}

/**
 * Configuration for stripping large data from conversation history
 * to prevent JSON serialization issues and reduce storage bloat.
 */
export interface ConversationStripOptions {
    /**
     * Number of turns to keep images before stripping them.
     * - 0: Strip images immediately after each turn
     * - N > 0: Keep images for N turns before stripping (default: 5)
     * - Infinity: Never strip images
     */
    images_after_turns?: number;

    /**
     * Maximum tokens for text content before truncation.
     * Text content exceeding this limit will be truncated with a marker.
     * Uses ~4 characters per token estimate.
     */
    text_max_tokens?: number;

    /**
     * Number of turns to keep heartbeat messages before stripping them.
     * Heartbeat messages are periodic workstream status updates wrapped in
     * `<heartbeat>...</heartbeat>` tags that clutter conversation history.
     * - 0: Strip heartbeats immediately after each turn
     * - 1 (default): Keep only the most recent heartbeat
     * - N > 0: Keep heartbeats for N turns before stripping
     * - Infinity: Never strip heartbeats
     */
    heartbeats_after_turns?: number;
}


// ------------------ in code interactions -----------------
/**
 * Reference to an interaction in the catalog.
 * Used in catalog listing. The id is composed of the namespace and the interaction name.
 * Stored interactions can use `oid:` prefix.
 * If no prefix is used it fallback on `oid:`.
 */
export interface CatalogInteractionRef {
    /**
     * The type of interaction
     */
    type: "sys" | "app" | "stored" | "draft";

    /**
     * the interaction id that can be used to execute the interaction.
     */
    id: string;

    /**
     * The interaction name which identify the interaction in the provider interaction list.
     * For the stored interactions this is the same as the endpoint property.
     * For other types of interactions this is the local name of the interaction.
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
     * The tags associated with the interaction.
     */
    tags: string[];

    /**
     * Agent Runner configuration options.
     */
    agent_runner_options?: AgentRunnerOptions;

    /**
     * The name of the interaction. For display purposes only.
     */
    title: string;

    /**
     * Optional description of the interaction.
     */
    description?: string;
}

export interface InCodePrompt {
    role: PromptRole,
    content: string,
    content_type: TemplateType;
    schema?: JSONSchema;
    /**
     * optional name of the prompt segment. Use kebab case for prompt names
     */
    name?: string;
    /**
     * optional reference to an external resource if any.
     * Used internally by the system to synchronize stored prompts with in-code prompts.
     */
    externalId?: string;
}
export interface InCodeInteraction {
    /**
     * The interaction type.
     */
    type: "sys" | "app" | "stored" | "draft";

    /**
     * The id of the interaction. Required.
     * The id is a unique identifier for the interaction.
     * It is recommended to use a URL safe string and not include spaces. 
     * The id composaed  by some namespace or prefix and the interaction name.
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
    output_modality?: Modalities,

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
    prompts: InCodePrompt[]

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
    }
}
export interface InteractionSpec extends Omit<InCodeInteraction, 'id' | 'runtime' | 'type' | 'published' | 'version'> {
}
// ---------------------------------------------------------

/**
 * The payload to query the interaction endpoints
 */
export interface InteractionEndpointQuery {
    limit?: number;
    offset?: number;

    status?: InteractionStatus;
    visibility?: InteractionVisibility;
    version?: number;
    tags?: string[];

    /**
     * Filter by interaction endpoint name to include only the specified endpoints
     * * If both includes and excludes are specified then only the includes filter will be used.
     */
    includes?: string[];

    /**
     * Filter by interaction endpoint name to excludes the specified endpoints.
     * If both includes and excludes are specified then only the includes filter will be used.
     */
    excludes?: string[];

    /**
     * Whether or not to return the parameters schema.
     * The parameters schema is an array of JSON schemas.
     * Each schema is a JSON schema that describes the parameters of an interaction prompt.
     */
    include_params_schema?: boolean;

    /**
     * Whether or not to return the result schema
     */
    include_result_schema?: boolean;
}

/**
 * A description of an interaction endpoint.
 */
export interface InteractionEndpoint {
    id: string;
    name: string;
    endpoint: string;
    description?: string;
    status: InteractionStatus;
    visibility?: InteractionVisibility;
    version: number;
    tags: string[];
    agent_runner_options?: AgentRunnerOptions;
    /**
     * @deprecated This is deprecated. Use CompletionResult.type information instead.
     */
    output_modality?: Modalities;
    result_schema?: JSONSchema;
    params_schema?: JSONSchema;
}

export interface InteractionTags {
    tag: string;
    count: number;
    interactions: InteractionRef[];
}

export interface InteractionRef {
    id: string;
    name: string;
    endpoint: string;
    parent?: string;
    model?: string;
    description?: string;
    status: InteractionStatus;
    visibility?: InteractionVisibility;
    version: number;
    tags: string[];
    agent_runner_options?: AgentRunnerOptions;
    prompts?: PromptSegmentDef<PromptTemplateRef>[];
    updated_at: Date;
}
export const InteractionRefPopulate =
    "id name endpoint parent description status version visibility tags agent_runner_options updated_at prompts";

export const InteractionRefWithSchemaPopulate =
    `${InteractionRefPopulate} result_schema`;

export interface InteractionRefWithSchema extends Omit<InteractionRef, "prompts"> {
    result_schema?: JSONSchema;
    prompts?: PromptSegmentDef<PromptTemplateRefWithSchema>[];
}

export interface InteractionsExportPayload {
    /**
     * The name of the interaction. If not specified all the interactions in the current project will be exported
     */
    name?: string;
    /*
     * tags to filter the exported interactions
     */
    tags?: string[];
    /*
     * if not specified, all versions will be exported
     */
    versions?: (number | "draft" | "latest")[];
}

export enum InteractionStatus {
    draft = "draft",
    published = "published",
    archived = "archived",
}

export enum ExecutionRunStatus {
    created = "created",
    processing = "processing",
    completed = "completed",
    failed = "failed",
}

export enum RunDataStorageLevel {
    STANDARD = "STANDARD",
    RESTRICTED = "RESTRICTED",
    DEBUG = "DEBUG",
}

export enum RunDataStorageDescription {
    STANDARD = "Run data is stored for both the model inputs and output.",
    RESTRICTED = "No run data is stored for the model inputs — only the model output.",
    DEBUG = "Run data is stored for the model inputs and output, schema, and final prompt.",
}

export const RunDataStorageOptions: Record<RunDataStorageLevel, RunDataStorageDescription> = {
    [RunDataStorageLevel.STANDARD]: RunDataStorageDescription.STANDARD,
    [RunDataStorageLevel.RESTRICTED]: RunDataStorageDescription.RESTRICTED,
    [RunDataStorageLevel.DEBUG]: RunDataStorageDescription.DEBUG,
};

/**
 * Schema can be stored or specified as a reference to an external schema.
 * We only support "store:" references for now
 */
export interface SchemaRef {
    $uri: string;
}
export interface CachePolicy {
    type: "cache" | "no_cache" | "cache_and_refresh";
    refresh_probability: number;
    varies_on: string[];
    ttl: number;
}
export type InteractionVisibility = "public" | "private";

export interface InteractionData {
    readonly id: string;
    name: string;
    endpoint: string;
    description?: string;
    project: string | ProjectRef;
    tags: string[];
    agent_runner_options?: AgentRunnerOptions;
    result_schema?: JSONSchema | SchemaRef;
    environment?: string | ExecutionEnvironmentRef;
    model?: string;
    model_options?: ModelOptions;
    restriction?: RunDataStorageLevel;
    /**
     * @deprecated This is deprecated. Use CompletionResult.type information instead.
     */
    output_modality?: Modalities;
}
export interface Interaction extends InteractionData {
    status: InteractionStatus;
    parent?: string;
    // only used for versions (status === "published")
    visibility: InteractionVisibility;
    version: number;
    test_data?: JSONObject;
    interaction_schema?: JSONSchema | SchemaRef;
    cache_policy?: CachePolicy;
    prompts: PromptSegmentDef[];
    // only for drafts - when it was last published
    last_published_at?: Date;
    created_by: string;
    updated_by: string;
    created_at: Date;
    updated_at: Date;
}

export interface PopulatedInteraction extends Omit<Interaction, "prompts"> {
    prompts: PopulatedPromptSegmentDef[];
}

/**
 * Used to describe an interaction that can be executed. Contains only the interaction data useful
 * to execute the interaction plus the prompt templates
 */
export interface ExecutableInteraction extends InteractionData {
    prompts: ExecutablePromptSegmentDef[];
}

export interface InteractionCreatePayload
    extends Omit<
        Interaction,
        | "id"
        | "created_at"
        | "updated_at"
        | "created_by"
        | "updated_by"
        | "project"
        | "formatter"
        | "tags"
        | "parent"
        | "version"
        | "visibility"
        | "endpoint"
    > {
    visibility?: InteractionVisibility;
    tags?: string[];
}

export interface InteractionUpdatePayload
    extends Partial<
        Omit<
            Interaction,
            "result_schema" | "id" | "created_at" | "updated_at" | "created_by" | "updated_by" | "project"
        >
    > {
    result_schema?: JSONSchema | null;
}

export interface InteractionPublishPayload {
    visibility?: InteractionVisibility;
    tags?: string[];
}

export interface InteractionForkPayload {
    keepTags?: boolean;
    forkPrompts?: boolean;
    targetProject?: string;
}

export interface InteractionExecutionPayload {
    /**
     * If a `@memory` property exists on the input data then the value will be used as the value of a memory pack location.
     * and the other properties of the data will contain the memory pack mapping.
     */
    data?: Record<string, any> | `memory:${string}`;
    config?: InteractionExecutionConfiguration;
    //Use null to explicitly state no schema, will not fallback to interaction schema
    result_schema?: JSONSchema | null;
    stream?: boolean;
    do_validate?: boolean;
    tags?: string | string[]; // tags to be added to the execution run

    /**
     * The conversation state to be used in the execution if any.
     * If the `true` is passed then the conversation will be returned in the result.
     * The true value must be used for the first execution that starts the conversation.
     * If conversation is falsy then no conversation is returned back.
     * For regular executions the conversation is not returned back to save memory.
     */
    conversation?: true | unknown;

    /**
     * The tools to be used in the execution
     */
    tool_definitions?: ToolDefinition[];

    /**
     * The workflow related to this Interaction Run.
     */
    workflow?: ExecutionRunWorkflow;

    /**
     * Only used by ad-hoc interactions which defines the prompt in the execution payload itself
     * These are temporary interactions using "tmp:" suffix.
     */
    prompts?: InCodePrompt[];

    /**
     * Options for async completion and/or streaming LLM response chunks to Redis.
     * Used by agent workflows for async activity completion and real-time streaming.
     */
    asyncCompletion?: AsyncCompletionOptions;
}

export interface NamedInteractionExecutionPayload extends InteractionExecutionPayload {
    /**
     * The interaction name and suffixed by an optional tag or version separated from the name using a @ character
     * If no version/tag part is specified then the latest version is used.
     * Example: ReviewContract, ReviewContract@draft, ReviewContract@1, ReviewContract@some-tag
     */
    interaction: string;
}

// ================= async execution payloads ====================
export type ToolRef = string | { name: string; description: string };

interface AsyncExecutionPayloadBase extends Omit<NamedInteractionExecutionPayload, "toolDefinitions" | "stream"> {
    type: "conversation" | "interaction";

    /**
     * An array of endpoint URLs to be notified upon execution
     */
    notify_endpoints?: string[];

    task_queue?: string;
}

export type ConversationVisibility = 'private' | 'project';

/**
 * Defines the scope for agent search operations.
 */
export enum AgentSearchScope {
    /**
     * Search is scoped to a specific collection.
     */
    Collection = 'collection'
}

/**
 * Context triggers for auto-injection of skills.
 * When these conditions match, the skill is automatically injected into the agent context.
 */
export interface SkillContextTriggers {
    /**
     * Keywords in user input that should trigger this skill
     */
    keywords?: string[];

    /**
     * If these tools are being used, suggest this skill
     */
    tool_names?: string[];

    /**
     * Regex patterns to match against input data
     */
    data_patterns?: string[];
}

/**
 * Configuration options for Agent Runner functionality.
 * These options control how interactions are exposed and executed in the Agent Runner.
 */
export interface AgentRunnerOptions {
    /**
     * Whether this interaction is an agent (executable in Agent Runner).
     */
    is_agent?: boolean;

    /**
     * Whether this interaction is available as a tool (sub-agent).
     */
    is_tool?: boolean;

    /**
     * Whether this interaction is a skill (provides instructions without execution).
     * Skills are injected into the agent's context based on context_triggers.
     */
    is_skill?: boolean;

    /**
     * Context triggers for auto-injection of this skill.
     * Only used when is_skill is true.
     */
    context_triggers?: SkillContextTriggers;

    /**
     * Injection priority for skills (higher = more likely to be selected when multiple match).
     * Only used when is_skill is true.
     */
    skill_priority?: number;

    /**
     * Array of default tool names available to this agent.
     * For interactions: defines default tools.
     * For execution payloads: you can use + and - to add or remove from default,
     * if no sign, then list replaces default.
     */
    tool_names?: string[];

    /**
     * On which scope should the search be applied by the search_tool.
     * Only supports 'collection' scope or undefined for now.
     */
    search_scope?: AgentSearchScope;

    /**
     * The ID of the collection to restrict agent operations to.
     * When specified, the agent's search and retrieval operations are limited to documents
     * within this collection'.
     */
    collection_id?: string;
}

// ================= User Communication Channels ====================
// Import for local use
import type { UserChannel } from "./email.js";
// Re-exported from email.ts for backwards compatibility
export type {
    EmailChannel,
    InteractiveChannel,
    UserChannel,
    EmailRouteData,
} from "./email.js";
export {
    isEmailChannel,
    isInteractiveChannel,
} from "./email.js";
// ================= end user communication channels ====================

export interface AsyncConversationExecutionPayload extends AsyncExecutionPayloadBase {
    type: "conversation";

    /**
    * Visibility determine if the conversation should be seen by the user only or by anyone with access to the project
    * If not specified, the default is project
    **/
    visibility?: ConversationVisibility;

    /**
     * The tools to use, list of tool or function names.
     * You can use + and - to add or remove from default, if no sign, then list replaces default
     */
    tool_names?: string[];

    /**
     * The maximum number of iterations in case of a conversation. If <=0 the default of 20 will be used.
     */
    max_iterations?: number;

    /**
     * Whether the conversation should be interactive or not
     */
    interactive?: boolean;

    /**
     * Array of channels to use for user communication.
     * Multiple channels can be active simultaneously (e.g., both email and interactive).
     * Each channel contains its own configuration and state (e.g., email threading info).
     */
    user_channels?: UserChannel[];

    /**
     * Whether to disable the generation of interaction tools or not.
     */
    disable_interaction_tools?: boolean;

    /**
     * On which scope should the searched by applied, by the search_tool.
     * Only supports collection scope or null for now.
     */
    search_scope?: AgentSearchScope.Collection;

    /**
     * The collection in which this workflow is executing
     */
    collection_id?: string;

    /**
     * The token threshold in thousands (K) for creating checkpoints.
     * If total tokens exceed this value, a checkpoint will be created.
     * If not specified, the default is computed from the selected model context window (75%).
     */
    checkpoint_tokens?: number;

    /**
     * Configuration for stripping large data (images, text) from conversation history
     * to prevent JSON serialization issues and reduce storage bloat.
     */
    strip_options?: ConversationStripOptions;

    /** In child execution workflow, this is the curent task_id */
    task_id?: string;

    /** Parent-assigned launch ID for non-blocking workstreams.
     *  The child uses this when signaling progress/completion back to the parent. */
    launch_id?: string;

    /** Whether to enable debug mode */
    debug_mode?: boolean;

    /** Maximum depth for nested conversations to prevent infinite recursion (default: 5) */
    max_nested_conversation_depth?: number;

    /**
     * Metadata inherited from parent workflow.
     * Used to propagate context (e.g., apiKey, session info) to child workflows/workstreams.
     * When a workstream is spawned, the parent's `data` is preserved here so that
     * child tools can access it via metadata.parent_metadata.
     */
    parent_metadata?: Record<string, any>;

    /**
     * When true, subagent/workstream tool calls use fire-and-forget `startChild()`
     * instead of blocking `executeChild()`. The parent continues reasoning while
     * children run, receiving progress/completion via Temporal signals.
     */
    non_blocking_subagents?: boolean;

    /**
     * Temporal runId of a previous workflow to restart/fork from.
     * When set, conversation history is loaded from the old run's GCS storage
     * instead of calling startConversation fresh.
     */
    restart_from_workflow_run_id?: string;

}

export interface AsyncInteractionExecutionPayload extends AsyncExecutionPayloadBase {
    type: "interaction";

    /**
     * Only used for non conversation workflows to include the error on next retry.
     * If tools is defined this is not used
     */
    include_previous_error?: boolean;
}

export type AsyncExecutionPayload = AsyncConversationExecutionPayload | AsyncInteractionExecutionPayload;

/**
 * Telemetry context for streaming mode.
 * Contains info not available in current_state needed to send LlmCallEvent.
 */
export interface StreamingTelemetryContext {
    /** Workflow ID for ingestEvents API call */
    workflowId: string;
    /** Type of LLM call: start, resume after user message, or resume after tool results */
    callType: LlmCallType;
    /** Activity retry attempt number */
    attemptNumber?: number;
    /** Timestamp when inference started (for duration calculation) */
    inferenceStartTime: number;
}

/**
 * Options for storing inference results to cloud storage
 */
export interface ResultStorageOptions {
    /** Full storage path for the result (e.g., "pages/doc123/page-1.md") */
    path: string;
    // Note: content_type is inferred from execution context:
    // - If result_schema → application/json
    // - Otherwise → text/markdown or text/plain
}

/**
 * Streaming-specific options (only needed when stream=true)
 */
export interface StreamingOptions {
    /** Redis channel to publish streaming chunks to */
    redis_channel: string;
    /** Optional workstream ID for multi-workstream agents */
    workstream_id?: string;
}

/**
 * Options for async completion and/or streaming LLM responses
 */
export interface AsyncCompletionOptions {
    /** Workflow run ID for message context */
    run_id: string;
    /** Whether to stream chunks to Redis */
    stream?: boolean;
    /** Streaming-specific options (required if stream=true) */
    streaming?: StreamingOptions;
    /**
     * Temporal task token for async activity completion (base64url encoded).
     * When provided, Studio will complete the activity after execution finishes,
     * allowing the worker to release the activity slot immediately.
     */
    task_token?: string;
    /**
     * Activity ID for idempotency metadata when storing conversation.
     * Required when task_token is provided.
     */
    activity_id?: string;
    /**
     * Current conversation state to merge with execution result.
     * Studio will store the conversation and complete the activity with merged state.
     * Required when task_token is provided.
     */
    current_state?: ConversationState;
    /**
     * Interval in milliseconds for sending heartbeats to Temporal during streaming.
     * When provided, Studio will send periodic heartbeats to keep the activity alive.
     * Recommended: 10000 (10 seconds). Activity heartbeat timeout should be ~3x this value.
     */
    heartbeat_interval_ms?: number;
    /**
     * Telemetry context for sending LlmCallEvent after streaming completes.
     * Studio will use this to send token usage telemetry since the activity
     * exits before the response is available in async completion mode.
     */
    telemetry?: StreamingTelemetryContext;
    /**
     * Storage options for inference result.
     * When provided, Studio will store the result to the specified path
     * after inference completes (before completing the Temporal activity).
     */
    result_storage?: ResultStorageOptions;
}

interface ResumeConversationPayload {
    run: ExecutionRunDocRef; // the run created by the first execution.
    environment: string; // the environment ID
    options: StatelessExecutionOptions; // the options used on the first execution
    conversation: unknown; // the conversation state
    tools: ToolDefinition[]; // the tools to be used
    /** Configuration for stripping large data from conversation history */
    strip_options?: ConversationStripOptions;
    /** Options for async completion and/or streaming LLM response chunks to Redis */
    asyncCompletion?: AsyncCompletionOptions;
}


export interface ToolResultContent {
    content: string;
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
    meta?: Record<string, any>;
}

export interface ToolResult extends ToolResultContent {
    tool_use_id: string;
    /**
     * Gemini thinking models require thought_signature to be passed back with tool results.
     * Copy this from the ToolUse.thought_signature that requested this tool call.
     */
    thought_signature?: string;
}

/**
 * The payload to sent the tool responses back to the target LLM
 */
export interface ToolResultsPayload extends ResumeConversationPayload {
    results: ToolResult[];
}

export interface UserMessagePayload extends ResumeConversationPayload {
    message: string;
}

export type CheckpointConversationPayload = Omit<ToolResultsPayload, "results" | "tools">

// ================= end async execution payloads ====================

export enum RunSourceTypes {
    api = "api",
    cli = "cli",
    ui = "ui",
    webhook = "webhook",
    test = "test-data",
    system = "system",
}

export interface RunSource {
    type: RunSourceTypes;
    label: string;
    principal_type: "user" | "apikey";
    principal_id: string;
    client_ip: string;
}

export interface BaseExecutionRun<P = any> {
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
    result: CompletionResult[] // Any new result will actually be CompletionResult[], the old typing is R, and R used to default to any.
    /**
     * The parameters used to create the interaction.
     * If the parameters contains the special property "@memory" it will be used
     * to locate a memory pack and the other properties will be used as the memory pack mapping.
     */
    parameters: P; //params used to create the interaction, only in varies on?
    tags?: string[];
    // only set when the target interaction is a stored interaction
    //TODO check the code where Interaction type is used (should be in run details)
    // TODO when execution string is passed as the type of interaction
    interaction?: string | Interaction;
    // only set when the target interaction is an in-code interaction
    interaction_code?: string; // Interaction code name in case of in-code interaction (not stored in the DB as an Interaction document)
    /** Environment reference - populated with full object in API responses */
    environment: ExecutionEnvironmentRef;
    modelId?: string; //Can be undefined for virtual environments. In most cases should be defined.
    result_schema: JSONSchema;
    ttl: number;
    status: ExecutionRunStatus;
    finish_reason?: string;
    prompt: any;
    token_use?: ExecutionTokenUsage;
    chunks?: number;
    execution_time?: number; // ms
    created_at: Date;
    updated_at: Date;
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

export interface ExecutionRun<P = any> extends BaseExecutionRun<P> {
    interaction?: Interaction;
}

export interface PopulatedExecutionRun<P = any> extends BaseExecutionRun<P> {
    interaction?: Interaction;
}

export interface ExecutionRunWorkflow {
    /**
     * The Temporal Workflow Run ID related to this Interaction Run.
     *
     * A Run ID is a globally unique, platform-level identifier for a Workflow Execution.
     *
     * @example 01970d37-a890-70c0-9f44-1256d063e69a
     * @see https://docs.temporal.io/workflow-execution/workflowid-runid
     */
    run_id: string;
    /**
     * The Temporal Workflow ID related to this Interaction Run.
     *
     * @example Standard Document Intake:6834841e4f828d4e36192796
     * @see https://docs.temporal.io/workflow-execution/workflowid-runid
     */
    workflow_id: string;
    /**
     * The Temporal Activity Type used for executing this Interaction. Undefined if the interaction
     * was not executed as part of a workflow (such as Agent Runner).
     *
     * @example generateDocumentProperties
     */
    activity_type?: string;
}

export interface PromptModalities {
    hasVideo: boolean;
    hasImage: boolean;
}

export interface InteractionExecutionResult<P = any> extends ExecutionRun<P> {
    tool_use?: ToolUse[];
    conversation?: unknown;
    options?: StatelessExecutionOptions;
}

export interface ExecutionRunRef extends Omit<ExecutionRun, "result" | "parameters" | "interaction"> {
    interaction?: InteractionRef;
    interaction_code?: string;
}

export const ExecutionRunRefSelect = "-result -parameters -result_schema -prompt";

export enum ConfigModes {
    RUN_AND_INTERACTION_CONFIG = "RUN_AND_INTERACTION_CONFIG",
    RUN_CONFIG_ONLY = "RUN_CONFIG_ONLY",
    INTERACTION_CONFIG_ONLY = "INTERACTION_CONFIG_ONLY",
}

export enum ConfigModesDescription {
    RUN_AND_INTERACTION_CONFIG = "This run configuration is used. Undefined options are filled with interaction configuration.",
    RUN_CONFIG_ONLY = "Only this run configuration is used. Undefined options remain undefined.",
    INTERACTION_CONFIG_ONLY = "Only interaction configuration is used.",
}

export const ConfigModesOptions: Record<ConfigModes, ConfigModesDescription> = {
    [ConfigModes.RUN_AND_INTERACTION_CONFIG]: ConfigModesDescription.RUN_AND_INTERACTION_CONFIG,
    [ConfigModes.RUN_CONFIG_ONLY]: ConfigModesDescription.RUN_CONFIG_ONLY,
    [ConfigModes.INTERACTION_CONFIG_ONLY]: ConfigModesDescription.INTERACTION_CONFIG_ONLY,
};

export interface InteractionExecutionConfiguration {
    environment?: string;
    model?: string;
    do_validate?: boolean;
    run_data?: RunDataStorageLevel;
    configMode?: ConfigModes;
    model_options?: ModelOptions;
}

export interface GenerateInteractionPayload {
    description: string;
    config: InteractionExecutionConfiguration;
}

export interface GenerateTestDataPayload {
    message?: string;
    count?: number;
    config: InteractionExecutionConfiguration;
}

export interface ImprovePromptPayloadConfig {
    config: InteractionExecutionConfiguration;
}

export interface ImprovePromptPayload extends ImprovePromptPayloadConfig {
    interaction_name: string; // name of the interaction to improve
    context?: string,
    prompt: { name: string, content: string }[]; // prompt array
    result_schema?: JSONSchema, // optional interactionr result schema
}

export interface RateLimitRequestPayload {
    interaction: string,
    environment_id?: string,
    model_id?: string,
    workflow_run_id?: string,
    modalities?: PromptModalities;
}

export interface RateLimitRequestResponse {
    delay_ms: number;
}

/**
 * Source of the resolved model configuration
 */
export enum ModelSource {
    /** Model was explicitly provided in the execution config */
    config = "config",
    /** Model comes from the interaction definition */
    interaction = "interaction",
    /** Model comes from environment's default_model */
    environmentDefault = "environmentDefault",
    /** Model comes from project system interaction defaults */
    projectSystemDefault = "projectSystemDefault",
    /** Model comes from project base defaults */
    projectBaseDefault = "projectBaseDefault",
    /** Model comes from project modality-specific defaults */
    projectModalityDefault = "projectModalityDefault",
    /** Model comes from legacy project defaults */
    projectLegacyDefault = "projectLegacyDefault",
}

/**
 * Resolved environment information
 */
export interface ResolvedEnvironmentInfo {
    id: string;
    name: string;
    provider: string;
}

/**
 * Resolved runtime configuration for an interaction
 */
export interface ResolvedRuntimeConfig {
    environment: ResolvedEnvironmentInfo;
    model?: string;
    model_source: ModelSource;
}

/**
 * Resolved execution info for an interaction.
 * Contains the interaction ID, basic metadata, and the resolved runtime configuration
 * (environment, model) that would be used at execution time.
 */
export interface ResolvedInteractionExecutionInfo {
    /**
     * The resolved interaction ID
     */
    id: string;

    /**
     * The interaction endpoint name
     */
    name: string;

    /**
     * The interaction version number
     */
    version: number;

    /**
     * The interaction status (draft or published)
     */
    status: InteractionStatus;

    /**
     * The interaction tags (can include version tags like "production", "staging")
     */
    tags: string[];

    /**
     * The resolved runtime configuration
     */
    resolved: ResolvedRuntimeConfig;
}

/**
 * A builtin tool definition from the tools catalog
 */
export interface BuiltinToolDefinition {
    /**
     * The unique tool name
     */
    name: string;

    /**
     * Human-readable description of what the tool does
     */
    description: string;

    /**
     * JSON schema for the tool's parameters
     */
    params: JSONSchema;
}

/**
 * Response from the builtin tools catalog endpoint
 */
export interface BuiltinToolsCatalogResponse {
    /**
     * List of available builtin tools
     */
    tools: BuiltinToolDefinition[];

    /**
     * When the catalog was generated
     */
    generated_at: string;

    /**
     * Total number of tools in the catalog
     */
    total_tools: number;
}
