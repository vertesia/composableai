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
import type { JSONSchema4 } from "json-schema";

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
import { AccountRef } from "./user.js";

export interface InteractionExecutionError {
    code: string;
    message: string;
    data?: any;
}


// ------------------ in code interactions -----------------
/**
 * Reference to an interaction in the catalog.
 * Used in catalog listing. The id is composed of the namespace and the interaction name.
 * Stored interactions can use `oid:` prefix.
 * If no prefix is used it fallback on `oid:`.
 */
export interface CatalogInteractionRef {
    id: string;
    title: string;
    description?: string;
}
export interface InCodePrompt {
    role: PromptRole,
    content: string,
    content_type: TemplateType;
    schema?: JSONSchema;
    /**
     * optional name of the prompt segment. For UI display purposes only
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
export interface InteractionSpec extends Omit<InCodeInteraction, 'id' | 'runtime'> {
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
    output_modality?: Modalities;
    result_schema?: JSONSchema;
    params_schema?: JSONSchema;
}

export interface InteractionRef {
    id: string;
    name: string;
    endpoint: string;
    parent?: string;
    description?: string;
    status: InteractionStatus;
    visibility?: InteractionVisibility;
    version: number;
    tags: string[];
    prompts?: PromptSegmentDef<PromptTemplateRef>[];
    updated_at: Date;
}
export const InteractionRefPopulate =
    "id name endpoint parent description status version visibility tags updated_at prompts";

export const InteractionRefWithSchemaPopulate =
    `${InteractionRefPopulate} result_schema`;

export interface InteractionRefWithSchema extends Omit<InteractionRef, "prompts"> {
    result_schema?: JSONSchema4;
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
    result_schema?: JSONSchema4 | SchemaRef;
    environment?: string | ExecutionEnvironmentRef;
    model?: string;
    model_options?: ModelOptions;
    restriction?: RunDataStorageLevel;
    output_modality?: Modalities;
}
export interface Interaction extends InteractionData {
    status: InteractionStatus;
    parent?: string;
    // only used for versions (status === "published")
    visibility: InteractionVisibility;
    version: number;
    test_data?: JSONObject;
    interaction_schema?: JSONSchema4 | SchemaRef;
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
}

export interface InteractionUpdatePayload
    extends Partial<
        Omit<
            Interaction,
            "result_schema" | "id" | "created_at" | "updated_at" | "created_by" | "updated_by" | "project"
        >
    > {
    result_schema?: JSONSchema4 | null;
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
    result_schema?: JSONSchema4;
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
     * Whether to disable the generation of interaction tools or not.
     */
    disable_interaction_tools?: boolean;

    /**
     * On which scope should the searched by applied, by the search_tool.
     * Only supports collection scope or null for now.
     */
    search_scope?: string;

    /**
     * The collection in which this workflow is executing
     */
    collection_id?: string;

    /**
     * The token threshold in thousands (K) for creating checkpoints.
     * If total tokens exceed this value, a checkpoint will be created.
     * If not specified, default value of 150K tokens will be used.
     */
    checkpoint_tokens?: number;

    /** In child execution workflow, this is the curent task_id */
    task_id?: string;

    /** Whether to enable debug mode */
    debug_mode?: boolean;

    /** Maximum depth for nested conversations to prevent infinite recursion (default: 5) */
    max_nested_conversation_depth?: number;

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

interface ResumeConversationPayload {
    run: ExecutionRunDocRef; // the run created by the first execution.
    environment: string; // the environment ID
    options: StatelessExecutionOptions; // the options used on the first execution
    conversation: unknown; // the conversation state
    tools: ToolDefinition[]; // the tools to be used
}


export interface ToolResultContent {
    content: string;
    is_error: boolean;
    files?: string[];
    /**
     * Can contain metadata returned by the tool executor.
     */
    meta?: Record<string, any>;
}

export interface ToolResult extends ToolResultContent {
    tool_use_id: string;
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
    //TODO a string is returned when execution not the env object
    environment: ExecutionEnvironmentRef;
    modelId: string;
    result_schema: JSONSchema4;
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
    output_modality: Modalities;
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
    workflow_run_id?: string
}

export interface RateLimitRequestResponse {
    delay_ms: number;
}