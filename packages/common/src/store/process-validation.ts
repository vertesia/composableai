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
    if (node.type === "parallel" && node.node) {
        validateNodeDefinition(definition, `${nodeId}.node`, node.node, errors);
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
        || value === "human_task"
        || value === "parallel"
        || value === "condition"
        || value === "final";
}

function isTransitionTrigger(value: string): boolean {
    return value === "auto" || value === "agent" || value === "user";
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
