import { JSONSchema } from "../json-schema.js";
import { TaskField } from "./task.js";

export type JsonLogicRule = Record<string, unknown>;

export type ProcessDefinitionStatus = 'draft' | 'published' | 'archived';

export type ProcessNodeType =
    | 'tool'
    | 'interaction'
    | 'agent'
    | 'human_task'
    | 'parallel'
    | 'condition'
    | 'final';

export type TransitionTrigger = 'auto' | 'agent' | 'user';
export type ParallelFailurePolicy = 'fail_fast' | 'collect_errors';

export interface TransitionDefinition {
    to: string;
    guard?: JsonLogicRule;
    trigger?: TransitionTrigger;
    label?: string;
}

export interface BranchDefinition {
    to: string;
    when?: JsonLogicRule;
    default?: boolean;
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

export interface NodeDefinition {
    type: ProcessNodeType;
    tool?: string;
    interaction?: string;
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
    node?: NodeDefinition;
    collect?: string;
    failure_policy?: ParallelFailurePolicy;
    branches?: BranchDefinition[];
}

export interface ProcessContextDefinition {
    schema: JSONSchema;
    initial: Record<string, any>;
}

export interface ProcessDefinitionBody {
    process: string;
    description?: string;
    initial: string;
    model?: string;
    context: ProcessContextDefinition;
    nodes: Record<string, NodeDefinition>;
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
    status: 'running' | 'completed' | 'skipped' | 'failed';
    context_diff: Record<string, any>;
    data_ref?: string;
    sequence?: number;
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
    xstate_snapshot?: any;
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
