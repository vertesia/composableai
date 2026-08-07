import type { z } from 'zod';
import type {
    AdvanceProcessPayloadSchema,
    AnswerProcessTaskPayloadSchema,
    BranchDefinitionSchema,
    BranchJoinPolicySchema,
    HumanTaskDefinitionSchema,
    JsonLogicRuleSchema,
    ListProcessDefinitionsQuerySchema,
    NodeHistoryEntrySchema,
    ParallelCollectDefinitionSchema,
    ParallelCollectFieldSchema,
    ParallelCollectModeSchema,
    ParallelFailurePolicySchema,
    ProcessContextDefinitionSchema,
    ProcessContextResponseSchema,
    ProcessDefinitionFormatVersionSchema,
    ProcessDefinitionMetadataSchema,
    ProcessDefinitionRevisionInfoSchema,
    ProcessDefinitionStatusSchema,
    ProcessHistoryRefSchema,
    ProcessHistoryResponseSchema,
    ProcessNodeReturnsDefinitionSchema,
    ProcessNodeRunTypeSchema,
    ProcessNodeTypeSchema,
    ProcessResourcesDefinitionSchema,
    ProcessScriptInlineSourceSchema,
    ProcessScriptLanguageSchema,
    ProcessScriptResourceSchema,
    ProcessScriptSourceSchema,
    ProcessStateSchema,
    PublishProcessDefinitionPayloadSchema,
    RetryProcessNodePayloadSchema,
    RevertProcessDefinitionPayloadSchema,
    TransitionDefinitionSchema,
    TransitionTriggerSchema,
} from '../api-schemas/process.js';
import type { JSONSchema } from '../json-schema.js';

export type JsonLogicRule = z.infer<typeof JsonLogicRuleSchema>;

export type ProcessDefinitionStatus = z.infer<typeof ProcessDefinitionStatusSchema>;
export type ListProcessDefinitionsQuery = z.infer<typeof ListProcessDefinitionsQuerySchema>;
export const PROCESS_DEFINITION_FORMAT_VERSION = 1 as const;
export type ProcessDefinitionFormatVersion = z.infer<typeof ProcessDefinitionFormatVersionSchema>;

export type ProcessNodeType = z.infer<typeof ProcessNodeTypeSchema>;

export type TransitionTrigger = z.infer<typeof TransitionTriggerSchema>;
export type ParallelFailurePolicy = z.infer<typeof ParallelFailurePolicySchema>;
export type ProcessNodeRunType = z.infer<typeof ProcessNodeRunTypeSchema>;
export type ParallelCollectMode = z.infer<typeof ParallelCollectModeSchema>;
export type BranchJoinPolicy = z.infer<typeof BranchJoinPolicySchema>;
export type ProcessDefinitionMetadata = z.infer<typeof ProcessDefinitionMetadataSchema>;
export type ProcessScriptLanguage = z.infer<typeof ProcessScriptLanguageSchema>;

export type ProcessScriptInlineSource = z.infer<typeof ProcessScriptInlineSourceSchema>;

export type ProcessScriptSource = z.infer<typeof ProcessScriptSourceSchema>;

export type ProcessScriptResource = z.infer<typeof ProcessScriptResourceSchema>;

export type ProcessResourcesDefinition = z.infer<typeof ProcessResourcesDefinitionSchema>;
export type ParallelCollectField = z.infer<typeof ParallelCollectFieldSchema>;

export type TransitionDefinition = z.infer<typeof TransitionDefinitionSchema>;

export type BranchDefinition = z.infer<typeof BranchDefinitionSchema>;

export interface BranchNodeBranchDefinition {
    id: string;
    title?: string;
    description?: string;
    node: NodeDefinition;
    metadata?: ProcessDefinitionMetadata;
}

export type HumanTaskDefinition = z.infer<typeof HumanTaskDefinitionSchema>;

export type ProcessNodeReturnsDefinition = z.infer<typeof ProcessNodeReturnsDefinitionSchema>;

export type ParallelCollectDefinition = z.infer<typeof ParallelCollectDefinitionSchema>;

export interface NodeDefinition {
    type: ProcessNodeType;
    tool?: string;
    /** Named entry in process resources.scripts for script nodes. */
    script?: string;
    /** Script execution timeout in seconds. Defaults to 300 and is capped at 600. */
    timeout?: number;
    interaction?: string;
    process?: string;
    process_definition?: ProcessDefinitionBody;
    process_version?: number;
    run_type?: ProcessNodeRunType;
    returns?: ProcessNodeReturnsDefinition;
    /**
     * Optional JSON Schema for structured output produced by interaction and
     * agent nodes. When omitted, the process engine derives a schema from
     * `writes` and the process context schema.
     */
    result_schema?: JSONSchema;
    prompt?: string;
    input?: Record<string, unknown>;
    config?: Record<string, unknown>;
    title?: string;
    description?: string;
    /**
     * End-user-facing explanation of what this node does. Authored by the
     * process designer (often an LLM) in plain language — one or two
     * sentences — and rendered in run observability so a human reading the
     * run can understand why this node exists without reading the config.
     * Distinct from `description`, which is developer-facing.
     */
    human_description?: string;
    writes?: string[];
    skippable?: boolean;
    max_retries?: number;
    transitions?: TransitionDefinition[];
    tools?: string[];
    /**
     * Model id override for this node. If unset, falls back to the process
     * run's `config.model`, then to the project's default. Useful when a
     * specific node needs heavier reasoning (e.g. Opus for legal flagging)
     * while the rest of the process uses a cheaper default.
     */
    model?: string;
    task?: HumanTaskDefinition;
    foreach?: string;
    as?: string;
    item_id?: string;
    node?: NodeDefinition;
    max_concurrency?: number;
    collect?: string | ParallelCollectDefinition;
    failure_policy?: ParallelFailurePolicy;
    join?: BranchJoinPolicy;
    branches?: BranchDefinition[] | BranchNodeBranchDefinition[];
    metadata?: ProcessDefinitionMetadata;
}

export type ProcessContextDefinition = z.infer<typeof ProcessContextDefinitionSchema>;

export interface ProcessDefinitionBody {
    format_version: ProcessDefinitionFormatVersion;
    process: string;
    description?: string;
    initial: string;
    model?: string;
    resources?: ProcessResourcesDefinition;
    context: ProcessContextDefinition;
    nodes: Record<string, NodeDefinition>;
    metadata?: ProcessDefinitionMetadata;
}

export interface InCodeProcessDefinition {
    /**
     * Process identifier exposed by an app package. App-local ids are normalized
     * by Studio to `app:<app-name>:<id>` when returned to callers.
     */
    id: string;
    /** Human-readable or app-local process name. */
    name: string;
    title?: string;
    description?: string;
    tags?: string[];
    definition: ProcessDefinitionBody;
}

export type ProcessDefinitionRevisionInfo = z.infer<typeof ProcessDefinitionRevisionInfoSchema>;

export interface ProcessDefinition {
    id: string;
    account: string;
    project: string;
    name: string;
    description?: string;
    status: ProcessDefinitionStatus;
    version: number;
    revision?: ProcessDefinitionRevisionInfo;
    tags?: string[];
    definition: ProcessDefinitionBody;
    created_at: Date;
    updated_at: Date;
    created_by: string;
    updated_by: string;
}

export type NodeHistoryEntry = z.infer<typeof NodeHistoryEntrySchema>;

export type ProcessHistoryRef = z.infer<typeof ProcessHistoryRefSchema>;

export interface ProcessHistoryCheckpoint {
    sequence: number;
    current_node: string;
    written_at: Date | string;
    entries: NodeHistoryEntry[];
}

export type ProcessState = z.infer<typeof ProcessStateSchema>;

export interface CreateProcessDefinitionPayload {
    name: string;
    description?: string;
    /**
     * @deprecated Process definitions are created as drafts. Use the publish endpoint
     * to create immutable published versions.
     */
    status?: ProcessDefinitionStatus;
    /**
     * @deprecated Version is server-owned. Use the publish endpoint to create the next version.
     */
    version?: number;
    tags?: string[];
    definition: ProcessDefinitionBody;
}

export interface UpdateProcessDefinitionPayload {
    name?: string;
    description?: string;
    /**
     * @deprecated Status is server-owned. Use publish/archive endpoints instead of updating it directly.
     */
    status?: ProcessDefinitionStatus;
    /**
     * @deprecated Version is server-owned. Use the publish endpoint to create the next version.
     */
    version?: number;
    tags?: string[];
    definition?: ProcessDefinitionBody;
}

export type PublishProcessDefinitionPayload = z.infer<typeof PublishProcessDefinitionPayloadSchema>;

export type RevertProcessDefinitionPayload = z.infer<typeof RevertProcessDefinitionPayloadSchema>;

export type AdvanceProcessPayload = z.infer<typeof AdvanceProcessPayloadSchema>;

export type AnswerProcessTaskPayload = z.infer<typeof AnswerProcessTaskPayloadSchema>;

export type RetryProcessNodePayload = z.infer<typeof RetryProcessNodePayloadSchema>;

export type ProcessContextResponse = z.infer<typeof ProcessContextResponseSchema>;

export type ProcessHistoryResponse = z.infer<typeof ProcessHistoryResponseSchema>;
