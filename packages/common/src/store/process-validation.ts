import type { NodeDefinition, ProcessDefinitionBody } from "./process.js";

export interface ProcessDefinitionValidationResult {
    valid: boolean;
    errors: string[];
}

export const MAX_PROCESS_DEFINITION_BYTES = 1024 * 1024;
export const MAX_PROCESS_GUARD_DEPTH = 64;
export const MAX_PROCESS_GUARD_NODES = 4096;

export function validateProcessDefinitionBody(definition: ProcessDefinitionBody): void {
    const result = getProcessDefinitionValidationResult(definition);
    if (!result.valid) {
        throw new Error(result.errors.join("; "));
    }
}

export function getProcessDefinitionValidationResult(definition: ProcessDefinitionBody): ProcessDefinitionValidationResult {
    const errors: string[] = [];
    const size = new TextEncoder().encode(JSON.stringify(definition)).length;
    if (size > MAX_PROCESS_DEFINITION_BYTES) {
        errors.push(`process definition exceeds ${MAX_PROCESS_DEFINITION_BYTES} bytes`);
    }

    if (!definition.process) {
        errors.push("process is missing");
    }
    if (!definition.initial) {
        errors.push("initial node is missing");
    }
    if (!definition.nodes || Object.keys(definition.nodes).length === 0) {
        errors.push("nodes are missing");
    } else if (definition.initial && !definition.nodes[definition.initial]) {
        errors.push(`initial node "${definition.initial}" does not exist`);
    }
    if (!definition.context?.schema) {
        errors.push("context.schema is missing");
    }
    if (!definition.context?.initial) {
        errors.push("context.initial is missing");
    }

    for (const [nodeId, node] of Object.entries(definition.nodes ?? {})) {
        validateNodeDefinition(definition, nodeId, node, errors);
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

function validateNodeDefinition(
    definition: ProcessDefinitionBody,
    nodeId: string,
    node: NodeDefinition,
    errors: string[],
) {
    if (!isProcessNodeType(node.type)) {
        errors.push(`node "${nodeId}" has invalid type "${String(node.type)}"`);
    }
    if (node.type === "human_task") {
        if (!node.task) {
            errors.push(`human_task node "${nodeId}" is missing task`);
        } else if (!node.task.title) {
            errors.push(`human_task node "${nodeId}" task title is missing`);
        } else if (!Array.isArray(node.task.fields)) {
            errors.push(`human_task node "${nodeId}" task fields must be an array`);
        }
    }
    if (node.type === "process") {
        if (!node.process && !node.process_definition) {
            errors.push(`process node "${nodeId}" is missing process or process_definition`);
        }
        if (node.run_type && !isProcessNodeRunType(node.run_type)) {
            errors.push(`process node "${nodeId}" has invalid run_type "${String(node.run_type)}"`);
        }
        if (node.returns?.from !== undefined && typeof node.returns.from !== "string") {
            errors.push(`process node "${nodeId}" returns.from must be a string`);
        }
        if (node.returns?.context !== undefined && !isStringArray(node.returns.context)) {
            errors.push(`process node "${nodeId}" returns.context must be an array of strings`);
        }
        if (node.process_definition) {
            const childResult = getProcessDefinitionValidationResult(node.process_definition);
            for (const error of childResult.errors) {
                errors.push(`process node "${nodeId}" process_definition: ${error}`);
            }
        }
    }
    if (node.type === "parallel") {
        if (node.max_concurrency !== undefined && (!Number.isInteger(node.max_concurrency) || node.max_concurrency < 1)) {
            errors.push(`parallel node "${nodeId}" max_concurrency must be a positive integer`);
        }
        if (node.item_id !== undefined && typeof node.item_id !== "string") {
            errors.push(`parallel node "${nodeId}" item_id must be a string`);
        }
        validateParallelCollectDefinition(nodeId, node.collect, errors);
        if (node.node) {
            if (!isParallelChildNodeType(node.node.type)) {
                errors.push(`parallel node "${nodeId}" has unsupported child node type "${String(node.node.type)}"`);
            }
            validateNodeDefinition(definition, `${nodeId}.node`, node.node, errors);
        }
    }
    if (node.failure_policy && !isParallelFailurePolicy(node.failure_policy)) {
        errors.push(`node "${nodeId}" has invalid failure_policy "${String(node.failure_policy)}"`);
    }
    for (const transition of node.transitions ?? []) {
        if (!definition.nodes[transition.to]) {
            errors.push(`node "${nodeId}" has transition to "${transition.to}" which does not exist`);
        }
        if (transition.trigger && !isTransitionTrigger(transition.trigger)) {
            errors.push(`node "${nodeId}" has invalid transition trigger "${transition.trigger}"`);
        }
        if (transition.guard) {
            validateGuardRule(`node "${nodeId}" transition to "${transition.to}" guard`, transition.guard, errors);
        }
    }

    for (const branch of node.branches ?? []) {
        if (!definition.nodes[branch.to]) {
            errors.push(`node "${nodeId}" has branch to "${branch.to}" which does not exist`);
        }
        if (branch.when) {
            validateGuardRule(`node "${nodeId}" branch to "${branch.to}" guard`, branch.when, errors);
        }
    }
}

function isProcessNodeType(value: string): boolean {
    return value === "tool"
        || value === "interaction"
        || value === "agent"
        || value === "process"
        || value === "human_task"
        || value === "parallel"
        || value === "condition"
        || value === "final";
}

function isProcessNodeRunType(value: string): boolean {
    return value === "supervised" || value === "programmatic";
}

function isTransitionTrigger(value: string): boolean {
    return value === "auto" || value === "agent" || value === "user";
}

function isParallelFailurePolicy(value: string): boolean {
    return value === "fail_fast" || value === "collect_errors";
}

function isParallelChildNodeType(value: string): boolean {
    return value === "tool"
        || value === "interaction"
        || value === "agent"
        || value === "process"
        || value === "condition";
}

function validateParallelCollectDefinition(nodeId: string, collect: NodeDefinition["collect"], errors: string[]) {
    if (collect === undefined) {
        return;
    }
    if (typeof collect === "string") {
        if (!collect) {
            errors.push(`parallel node "${nodeId}" collect must not be empty`);
        }
        return;
    }
    if (!isRecord(collect)) {
        errors.push(`parallel node "${nodeId}" collect must be a string or object`);
        return;
    }
    if (typeof collect.into !== "string" || !collect.into) {
        errors.push(`parallel node "${nodeId}" collect.into is required`);
    }
    if (collect.mode !== undefined && collect.mode !== "array") {
        errors.push(`parallel node "${nodeId}" collect.mode must be "array"`);
    }
    if (collect.include !== undefined) {
        if (!Array.isArray(collect.include)) {
            errors.push(`parallel node "${nodeId}" collect.include must be an array`);
            return;
        }
        for (const field of collect.include) {
            if (typeof field !== "string" || !isParallelCollectField(field)) {
                errors.push(`parallel node "${nodeId}" collect.include has invalid field "${String(field)}"`);
            }
        }
    }
}

function isParallelCollectField(value: string): boolean {
    return value === "status"
        || value === "index"
        || value === "item"
        || value === "item_id"
        || value === "output"
        || value === "context_update"
        || value === "error"
        || value === "child_run_id"
        || value === "child_workflow_id"
        || value === "child_workflow_run_id";
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every(item => typeof item === "string");
}

function validateGuardRule(label: string, rule: unknown, errors: string[]) {
    const result = inspectGuardRule(rule);
    if (result.depth > MAX_PROCESS_GUARD_DEPTH) {
        errors.push(`${label} exceeds maximum depth ${MAX_PROCESS_GUARD_DEPTH}`);
    }
    if (result.nodes > MAX_PROCESS_GUARD_NODES) {
        errors.push(`${label} exceeds maximum node count ${MAX_PROCESS_GUARD_NODES}`);
    }
}

function inspectGuardRule(rule: unknown): { depth: number; nodes: number } {
    let maxDepth = 0;
    let nodes = 0;
    const stack: { value: unknown; depth: number }[] = [{ value: rule, depth: 1 }];
    while (stack.length > 0) {
        const next = stack.pop();
        if (!next) {
            continue;
        }
        nodes += 1;
        maxDepth = Math.max(maxDepth, next.depth);
        if (nodes > MAX_PROCESS_GUARD_NODES || maxDepth > MAX_PROCESS_GUARD_DEPTH) {
            break;
        }
        if (Array.isArray(next.value)) {
            for (const item of next.value) {
                stack.push({ value: item, depth: next.depth + 1 });
            }
        } else if (isRecord(next.value)) {
            for (const value of Object.values(next.value)) {
                stack.push({ value, depth: next.depth + 1 });
            }
        }
    }
    return { depth: maxDepth, nodes };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
