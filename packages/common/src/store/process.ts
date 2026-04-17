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
    writes?: string[];
    skippable?: boolean;
    max_retries?: number;
    transitions?: TransitionDefinition[];
    tools?: string[];
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
    node: string;
    entered_at: Date;
    exited_at?: Date;
    status: 'running' | 'completed' | 'skipped' | 'failed';
    context_diff: Record<string, any>;
}

export interface ProcessState {
    xstate_snapshot?: any;
    context: Record<string, any>;
    current_node: string;
    node_history: NodeHistoryEntry[];
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
