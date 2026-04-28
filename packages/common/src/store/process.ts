import { JSONSchema } from "../json-schema.js";
import { TaskField } from "./task.js";

export type JsonLogicRule = Record<string, unknown>;

export type ProcessDefinitionStatus = 'draft' | 'published' | 'archived';
export const PROCESS_DEFINITION_FORMAT_VERSION = 1 as const;
export type ProcessDefinitionFormatVersion = typeof PROCESS_DEFINITION_FORMAT_VERSION;

export type ProcessNodeType =
    | 'tool'
    | 'interaction'
    | 'agent'
    | 'process'
    | 'human_task'
    | 'foreach'
    | 'branch'
    | 'condition'
    | 'final';

export type TransitionTrigger = 'auto' | 'agent' | 'user';
export type ParallelFailurePolicy = 'fail_fast' | 'collect_errors';
export type ProcessNodeRunType = 'supervised' | 'programmatic';
export type ParallelCollectMode = 'array';
export type BranchJoinPolicy = 'all';
export type ProcessDefinitionMetadata = Record<string, unknown>;
export type ParallelCollectField =
    | 'status'
    | 'index'
    | 'item'
    | 'item_id'
    | 'branch_id'
    | 'branch_title'
    | 'output'
    | 'context_update'
    | 'error'
    | 'child_run_id'
    | 'child_workflow_id'
    | 'child_workflow_run_id';

export interface TransitionDefinition {
    to: string;
    guard?: JsonLogicRule;
    trigger?: TransitionTrigger;
    label?: string;
    metadata?: ProcessDefinitionMetadata;
}

export interface BranchDefinition {
    to: string;
    when?: JsonLogicRule;
    default?: boolean;
    metadata?: ProcessDefinitionMetadata;
}

export interface BranchNodeBranchDefinition {
    id: string;
    title?: string;
    description?: string;
    node: NodeDefinition;
    metadata?: ProcessDefinitionMetadata;
}

export interface HumanTaskDefinition {
    title: string;
    description?: string;
    /**
     * Who owns the task. Either a group reference (`group:<name>`) or a
     * concrete user id. Leave unset to make the task available to anyone
     * who can see the inbox. `role:<name>` is not supported — use
     * `group:<name>` instead.
     */
    assignee?: string;
    fields: TaskField[];
}

export interface ProcessNodeReturnsDefinition {
    /**
     * Path to read from the completed child process state. Use `context.foo`
     * for child context values or `state.sequence` for process-state fields.
     * If omitted, the child context is used as the node output.
     */
    from?: string;
    /**
     * Select specific fields from the completed child process context.
     * Ignored when `from` is set.
     */
    context?: string[];
}

export interface ParallelCollectDefinition {
    /**
     * Context key that receives the collected results.
     */
    into: string;
    mode?: ParallelCollectMode;
    /**
     * Fields to include in each collected item. Defaults to the operational
     * envelope: status, index, item_id, output, error, and child_run_id.
     */
    include?: ParallelCollectField[];
}

export interface NodeDefinition {
    type: ProcessNodeType;
    tool?: string;
    interaction?: string;
    process?: string;
    process_definition?: ProcessDefinitionBody;
    process_version?: number;
    run_type?: ProcessNodeRunType;
    returns?: ProcessNodeReturnsDefinition;
    prompt?: string;
    input?: Record<string, any>;
    config?: Record<string, any>;
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

export interface ProcessContextDefinition {
    schema: JSONSchema;
    initial: Record<string, any>;
}

export interface ProcessDefinitionBody {
    format_version: ProcessDefinitionFormatVersion;
    process: string;
    description?: string;
    initial: string;
    model?: string;
    context: ProcessContextDefinition;
    nodes: Record<string, NodeDefinition>;
    metadata?: ProcessDefinitionMetadata;
}

export interface ProcessDefinition {
    id: string;
    account: string;
    project: string;
    name: string;
    description?: string;
    status: ProcessDefinitionStatus;
    version: number;
    tags?: string[];
    definition: ProcessDefinitionBody;
    created_at: Date;
    updated_at: Date;
    created_by: string;
    updated_by: string;
}

export interface NodeHistoryEntry {
    id?: string;
    node: string;
    attempt?: number;
    entered_at: Date | string;
    exited_at?: Date | string;
    status: 'running' | 'completed' | 'skipped' | 'failed' | 'cancelled';
    context_diff: Record<string, any>;
    data_ref?: string;
    sequence?: number;
    child_run_id?: string;
    child_workflow_id?: string;
    child_workflow_run_id?: string;
}

export interface ProcessHistoryRef {
    path: string;
    latest_sequence: number;
    count: number;
}

export interface ProcessHistoryCheckpoint {
    sequence: number;
    current_node: string;
    written_at: Date | string;
    entries: NodeHistoryEntry[];
}

export interface ProcessState {
    context: Record<string, any>;
    current_node: string;
    node_history: NodeHistoryEntry[];
    node_history_ref?: ProcessHistoryRef;
    sequence: number;
    _current_node?: string;
    _previous_node?: string;
    _transition_count?: number;
    _node_entries?: Record<string, number>;
    _node_tool_calls?: Record<string, number>;
}

export interface CreateProcessDefinitionPayload {
    name: string;
    description?: string;
    status?: ProcessDefinitionStatus;
    version?: number;
    tags?: string[];
    definition: ProcessDefinitionBody;
}

export interface UpdateProcessDefinitionPayload {
    name?: string;
    description?: string;
    status?: ProcessDefinitionStatus;
    version?: number;
    tags?: string[];
    definition?: ProcessDefinitionBody;
}
