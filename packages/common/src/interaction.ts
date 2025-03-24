import type { ExecutionOptions, JSONObject, Modalities, ModelOptions, ToolUse } from "@llumiverse/core";
import { JSONSchema4 } from 'json-schema';

import { ExecutionTokenUsage } from '@llumiverse/core';

import { ExecutionEnvironmentRef } from './environment.js';
import { ProjectRef } from './project.js';
import { PopulatedPromptSegmentDef, PromptSegmentDef, PromptTemplateRef, PromptTemplateRefWithSchema } from './prompt.js';
import { AccountRef } from './user.js';

export interface InteractionExecutionError {
    code: string;
    message: string;
    data?: any;
}

export interface InteractionRef {
    id: string;
    name: string;
    parent?: string;
    description?: string;
    status: InteractionStatus;
    visibility?: InteractionVisibility;
    version: number;
    tags: string[];
    prompts?: PromptSegmentDef<PromptTemplateRef>[];
    updated_at: Date;
}
export const InteractionRefPopulate = "id name parent description status version visibility tags updated_at prompts";

export interface InteractionRefWithSchema
    extends Omit<InteractionRef, "prompts"> {
    result_schema?: JSONSchema4;
    prompts?: PromptSegmentDef<PromptTemplateRefWithSchema>[];
}

export interface InteractionsExportPayload {
    /**
     * The name of the interaction. If not spcified all the interactions in the current project will be exported
     */
    name?: string;
    /*
     * tags to filter the exported interactions
     */
    tags?: string[];
    /*
     * if not specified, all versions will be exported
     */
    versions?: (number | 'draft' | 'latest')[];
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
    DEBUG = "DEBUG"
}

export enum RunDataStorageDescription {
    STANDARD = "Run data is stored for both the model inputs and output.",
    RESTRICTED = "No run data is stored for the model inputs — only the model output.",
    DEBUG = "Run data is stored for the model inputs and output, schema, and final prompt."
}

export const RunDataStorageOptions: Record<RunDataStorageLevel, RunDataStorageDescription> = {
    [RunDataStorageLevel.STANDARD]: RunDataStorageDescription.STANDARD,
    [RunDataStorageLevel.RESTRICTED]: RunDataStorageDescription.RESTRICTED,
    [RunDataStorageLevel.DEBUG]: RunDataStorageDescription.DEBUG,
}

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
export type InteractionVisibility = 'public' | 'private';
export interface Interaction {
    readonly id: string;
    name: string;
    endpoint: string;
    description?: string;
    status: InteractionStatus;
    parent?: string;
    // only used for versions (status === "published")
    visibility: InteractionVisibility;
    version: number;
    tags: string[];
    test_data?: JSONObject;
    interaction_schema?: JSONSchema4 | SchemaRef;
    result_schema?: JSONSchema4 | SchemaRef;
    cache_policy?: CachePolicy;
    model: string;
    model_options?: ModelOptions;
    prompts: PromptSegmentDef[];
    output_modality?: Modalities;
    environment: string | ExecutionEnvironmentRef;
    restriction?: RunDataStorageLevel;
    project: string | ProjectRef;
    // only for drafts - when it was last published
    last_published_at?: Date;
    created_by: string,
    updated_by: string,
    created_at: Date;
    updated_at: Date;
}

export interface PopulatedInteraction
    extends Omit<Interaction, "prompts"> {
    prompts: PopulatedPromptSegmentDef[];
}

export interface InteractionCreatePayload
    extends Omit<
        Interaction,
        "id" | "created_at" | "updated_at" | "created_by" | "updated_by" | "project" | "formatter" | "tags" | "parent" | "version" | "visibility" | "endpoint"
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


/**
 * The payload for the interaction execution workflow to execute async interactions
 * @see async oparameter of InteractionExecutionPayload
 */
export interface ExecuteInteractionWorkflowParams {
    interactionName: string, // usefull for logging
    runId: string,
    requestorAccountId: string,
    requestorProjectId: string,
}

export interface InteractionExecutionPayload {
    /**
     * If a `@memory` property exists on the input data then the value will be used as the value of a memory pack location.
     * and the other proerties of the data will contain the memory pack mapping.
     */
    data?: Record<string, any> | `memory:${string}`;
    config?: InteractionExecutionConfiguration;
    result_schema?: JSONSchema4;
    stream?: boolean;
    /**
     * Either use async or stream. You cannot use both at the same time.
     * If async is true then the run will be created and
     * the wexecution will be started in a temporalio workflow.
     * If async is falkse then the execution will block until the processing
     * is completed and the result is returned.
     */
    async?: boolean;
    do_validate?: boolean;
    tags?: string | string[]; // tags to be added to the execution run
    /**
     * If true then the conversation will be included in the result
     */
    conversation?: boolean;
}

export interface NamedInteractionExecutionPayload extends InteractionExecutionPayload {
    /**
     * The interaction name and suffixed by an optional tag or version separated from the name using a @ character
     * If no version/tag part is specified then the latest version is used.
     * Example: ReviewContract, ReviewContract@draft, ReviewContract@1, ReviewContract@some-tag
     */
    interaction: string;
}

/**
 * The payload to sent the tool responses back to the target LLM
 */
export interface ToolResultsPayload {
    environment: string; // the environment ID
    options: ExecutionOptions; // the options used on the first execution
    results: {
        tool_use_id: string;
        content: string;
    }[];
}

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
    principal_type: 'user' | 'apikey';
    principal_id: string;
    client_ip: string;
}

export interface ExecutionRun<P = any, R = any> {
    readonly id: string;
    /**
     * Only used by runs that were created by a virtual run to point toward the virtual run parent
     */
    parent?: string | ExecutionRun;
    evaluation?: {
        score?: number,
        selected?: boolean,
        scores?: Record<string, number>
    }
    result: R;
    /**
     * The parameters used to create the interaction.
     * If the parameters contains the special property "@memory" it will be used
     * to locate a meory pack and the other properties will be used as the memory pack mapping.
     */
    parameters: P; //params used to create the interaction, only in varies on?
    tags?: string[];
    //TODO a string is returned when executing not the interaction object
    interaction: Interaction;
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
    execution_time?: number; //s
    created_at: Date;
    updated_at: Date;
    account: AccountRef;
    project: ProjectRef;
    config: InteractionExecutionConfiguration;
    error?: InteractionExecutionError;
    source: RunSource;
    output_modality: Modalities;
    created_by: string,
    updated_by: string,
}

export interface InteractionExecutionResult<P = any, R = any> extends ExecutionRun<P, R> {
    tool_use?: ToolUse[];
    conversation?: unknown;
    options?: ExecutionOptions;
}

export interface ExecutionRunRef
    extends Omit<ExecutionRun, "result" | "parameters" | "interaction"> {
    interaction: InteractionRef;
}

export const ExecutionRunRefSelect = "-result -parameters -result_schema -prompt";

export enum ConfigModes {
    RUN_AND_INTERACTION_CONFIG = "RUN_AND_INTERACTION_CONFIG",
    RUN_CONFIG_ONLY = "RUN_CONFIG_ONLY",
    INTERACTION_CONFIG_ONLY = "INTERACTION_CONFIG_ONLY"
};

export enum ConfigModesDescription {
    RUN_AND_INTERACTION_CONFIG = "This run configuration is used. Undefined options are filled with interaction configuration.",
    RUN_CONFIG_ONLY = "Only this run configuration is used. Undefined options remain undefined.",
    INTERACTION_CONFIG_ONLY = "Only interaction configuration is used."
}

export const ConfigModesOptions: Record<ConfigModes, ConfigModesDescription> = {
    [ConfigModes.RUN_AND_INTERACTION_CONFIG]: ConfigModesDescription.RUN_AND_INTERACTION_CONFIG,
    [ConfigModes.RUN_CONFIG_ONLY]: ConfigModesDescription.RUN_CONFIG_ONLY,
    [ConfigModes.INTERACTION_CONFIG_ONLY]: ConfigModesDescription.INTERACTION_CONFIG_ONLY,
}

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

export interface ImprovePromptPayload {
    config: InteractionExecutionConfiguration;
}