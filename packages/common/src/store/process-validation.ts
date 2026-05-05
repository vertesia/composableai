import {
    PROCESS_DEFINITION_FORMAT_VERSION,
    type BranchDefinition,
    type BranchNodeBranchDefinition,
    type NodeDefinition,
    type ProcessDefinitionBody,
} from "./process.js";
import type { CatalogInteractionRef } from "../interaction.js";

export interface ProcessDefinitionValidationResult {
    valid: boolean;
    errors: string[];
}

export interface ProcessDefinitionValidationOptions {
    knownTools?: Iterable<string>;
    knownInteractions?: Iterable<string>;
}

export function getProcessInteractionValidationSelectors(interactions: Iterable<CatalogInteractionRef>): string[] {
    const selectors = new Set<string>();
    for (const interaction of interactions) {
        selectors.add(interaction.id);
        selectors.add(interaction.name);
        if (interaction.type === "sys") {
            selectors.add(`sys:${interaction.name}`);
        }
        if (interaction.type === "app" && !interaction.id.startsWith("app:")) {
            selectors.add(`app:${interaction.id}`);
        }
        if (interaction.type === "stored" || interaction.type === "draft") {
            selectors.add(`${interaction.name}@draft`);
            selectors.add(`${interaction.id}@draft`);
            if (typeof interaction.version === "number") {
                selectors.add(`${interaction.name}@${interaction.version}`);
                selectors.add(`${interaction.id}@${interaction.version}`);
            }
        }
    }
    return [...selectors];
}

export const MAX_PROCESS_DEFINITION_BYTES = 1024 * 1024;
export const MAX_PROCESS_GUARD_DEPTH = 64;
export const MAX_PROCESS_GUARD_NODES = 4096;

export function validateProcessDefinitionBody(definition: ProcessDefinitionBody, options: ProcessDefinitionValidationOptions = {}): void {
    const result = getProcessDefinitionValidationResult(definition, options);
    if (!result.valid) {
        throw new Error(result.errors.join("; "));
    }
}

export function getProcessDefinitionValidationResult(
    definition: ProcessDefinitionBody,
    options: ProcessDefinitionValidationOptions = {},
): ProcessDefinitionValidationResult {
    const errors: string[] = [];
    const context = createValidationContext(options);
    const size = new TextEncoder().encode(JSON.stringify(definition)).length;
    if (size > MAX_PROCESS_DEFINITION_BYTES) {
        errors.push(`process definition exceeds ${MAX_PROCESS_DEFINITION_BYTES} bytes`);
    }

    if (!definition.process) {
        errors.push("process is missing");
    }
    if (definition.format_version !== PROCESS_DEFINITION_FORMAT_VERSION) {
        errors.push(`format_version must be ${PROCESS_DEFINITION_FORMAT_VERSION}`);
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
        validateNodeDefinition(definition, nodeId, node, errors, context);
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
    context: ProcessDefinitionValidationContext,
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
    if (node.type === "tool") {
        validateToolNodeDefinition(nodeId, node, errors, context);
    }
    if ((node.type === "interaction" || node.type === "agent") && node.interaction && context.knownInteractions) {
        if (!isKnownSelector(node.interaction, context.knownInteractions)) {
            errors.push(`${node.type} node "${nodeId}" references unknown interaction "${node.interaction}"`);
        }
    }
    if ((node.type === "interaction" || node.type === "agent") && node.result_schema !== undefined && !isRecord(node.result_schema)) {
        errors.push(`${node.type} node "${nodeId}" result_schema must be a JSON Schema object`);
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
            const childResult = getProcessDefinitionValidationResult(node.process_definition, context.options);
            for (const error of childResult.errors) {
                errors.push(`process node "${nodeId}" process_definition: ${error}`);
            }
        }
    }
    if (node.type === "foreach") {
        if (!node.foreach) {
            errors.push(`foreach node "${nodeId}" is missing foreach`);
        }
        if (!node.node) {
            errors.push(`foreach node "${nodeId}" is missing node`);
        }
        if (node.max_concurrency !== undefined && (!Number.isInteger(node.max_concurrency) || node.max_concurrency < 1)) {
            errors.push(`foreach node "${nodeId}" max_concurrency must be a positive integer`);
        }
        if (node.item_id !== undefined && typeof node.item_id !== "string") {
            errors.push(`foreach node "${nodeId}" item_id must be a string`);
        }
        validateCollectDefinition("foreach", nodeId, node.collect, errors);
        if (node.node) {
            validateFanoutChildNodeDefinition(definition, {
                ownerLabel: `foreach node "${nodeId}"`,
                childPath: `${nodeId}.node`,
                childLabel: `foreach node "${nodeId}" child node`,
                child: node.node,
            }, errors, context);
        }
    }
    if (node.type === "branch") {
        if (!Array.isArray(node.branches) || node.branches.length === 0) {
            errors.push(`branch node "${nodeId}" must define at least one branch`);
        }
        if (node.join !== undefined && node.join !== "all") {
            errors.push(`branch node "${nodeId}" join must be "all"`);
        }
        validateCollectDefinition("branch", nodeId, node.collect, errors);
        const branches = getBranchNodeBranches(node);
        const seenIds = new Set<string>();
        for (const [index, branch] of branches.entries()) {
            if (!branch.id) {
                errors.push(`branch node "${nodeId}" branch at index ${index} is missing id`);
            } else if (seenIds.has(branch.id)) {
                errors.push(`branch node "${nodeId}" has duplicate branch id "${branch.id}"`);
            } else {
                seenIds.add(branch.id);
            }
            if (!branch.node) {
                errors.push(`branch node "${nodeId}" branch "${branch.id || index}" is missing node`);
                continue;
            }
            validateFanoutChildNodeDefinition(definition, {
                ownerLabel: `branch node "${nodeId}" branch "${branch.id || index}"`,
                childPath: `${nodeId}.branches.${index}.node`,
                childLabel: `branch node "${nodeId}" branch "${branch.id || index}" child node`,
                child: branch.node,
            }, errors, context);
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
        if (typeof transition.guard === "string") {
            errors.push(`node "${nodeId}" transition to "${transition.to}" guard must be a JSON Logic object`);
        } else if (transition.guard) {
            validateGuardRule(`node "${nodeId}" transition to "${transition.to}" guard`, transition.guard, errors);
        }
    }

    for (const [index, branch] of getConditionBranches(node).entries()) {
        if (hasStringConditionProperty(branch, "condition")) {
            errors.push(`node "${nodeId}" branch at index ${index} uses string condition; use JSON Logic in "when" instead`);
        }
        if (hasStringConditionProperty(branch, "guard")) {
            errors.push(`node "${nodeId}" branch at index ${index} uses string guard; use JSON Logic in "when" instead`);
        }
        if (!definition.nodes[branch.to]) {
            errors.push(`node "${nodeId}" has branch to "${branch.to}" which does not exist`);
        }
        if (typeof branch.when === "string") {
            errors.push(`node "${nodeId}" branch to "${branch.to}" when must be a JSON Logic object`);
        } else if (branch.when) {
            validateGuardRule(`node "${nodeId}" branch to "${branch.to}" guard`, branch.when, errors);
        }
    }
}

interface ProcessDefinitionValidationContext {
    options: ProcessDefinitionValidationOptions;
    knownTools?: ReadonlySet<string>;
    knownInteractions?: ReadonlySet<string>;
}

function createValidationContext(options: ProcessDefinitionValidationOptions): ProcessDefinitionValidationContext {
    return {
        options,
        knownTools: options.knownTools ? new Set(options.knownTools) : undefined,
        knownInteractions: options.knownInteractions ? new Set(options.knownInteractions) : undefined,
    };
}

function validateToolNodeDefinition(
    nodeId: string,
    node: NodeDefinition,
    errors: string[],
    context: ProcessDefinitionValidationContext,
) {
    if (!node.tool) {
        errors.push(`tool node "${nodeId}" is missing tool`);
        return;
    }
    if (context.knownTools && !context.knownTools.has(node.tool)) {
        errors.push(`tool node "${nodeId}" references unknown tool "${node.tool}"`);
    }

    if (node.tool === "set_context") {
        validateSetContextNode(nodeId, node, errors);
    }
}

function validateSetContextNode(nodeId: string, node: NodeDefinition, errors: string[]) {
    const input = node.input;
    if (!isRecord(input)) {
        errors.push(`tool node "${nodeId}" set_context input must be an object`);
        return;
    }

    for (const key of Object.keys(input)) {
        if (key !== "updates" && key !== "reason" && key !== "event_id") {
            errors.push(`tool node "${nodeId}" set_context input has unsupported property "${key}"`);
        }
    }

    if (!isRecord(input.updates)) {
        errors.push(`tool node "${nodeId}" set_context input.updates must be an object`);
        return;
    }
    if (input.reason !== undefined && typeof input.reason !== "string") {
        errors.push(`tool node "${nodeId}" set_context input.reason must be a string`);
    }
    if (input.event_id !== undefined && typeof input.event_id !== "string") {
        errors.push(`tool node "${nodeId}" set_context input.event_id must be a string`);
    }
    validateSetContextWrites(nodeId, node, input.updates, errors);
}

function validateSetContextWrites(
    nodeId: string,
    node: NodeDefinition,
    updates: Record<string, unknown>,
    errors: string[],
) {
    const updateKeys = Object.keys(updates);
    if (updateKeys.length === 0) {
        return;
    }
    if (!Array.isArray(node.writes) || node.writes.length === 0) {
        errors.push(`tool node "${nodeId}" set_context updates require declared writes`);
        return;
    }
    for (const key of updateKeys) {
        if (key.startsWith("_")) {
            errors.push(`tool node "${nodeId}" set_context cannot write reserved context field "${key}"`);
        }
        if (!isWriteAllowed(key, node.writes)) {
            errors.push(`tool node "${nodeId}" set_context updates "${key}" but writes does not allow it`);
        }
    }
}

function isWriteAllowed(key: string, writes: string[]): boolean {
    return writes.some(write => key === write || key.startsWith(`${write}.`));
}

function isKnownSelector(selector: string, knownSelectors: ReadonlySet<string>): boolean {
    if (knownSelectors.has(selector)) {
        return true;
    }
    if (!selector.includes("@")) {
        return false;
    }
    return knownSelectors.has(selector.slice(0, selector.lastIndexOf("@")));
}

function hasStringConditionProperty(value: unknown, key: string): boolean {
    return isRecord(value) && typeof value[key] === "string";
}

function isProcessNodeType(value: string): boolean {
    return value === "tool"
        || value === "interaction"
        || value === "agent"
        || value === "process"
        || value === "human_task"
        || value === "foreach"
        || value === "branch"
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

function isFanoutChildNodeType(value: string): boolean {
    return value === "tool"
        || value === "interaction"
        || value === "agent"
        || value === "process";
}

function validateFanoutChildNodeDefinition(
    definition: ProcessDefinitionBody,
    input: {
        ownerLabel: string;
        childPath: string;
        childLabel: string;
        child: NodeDefinition;
    },
    errors: string[],
    context: ProcessDefinitionValidationContext,
) {
    const { ownerLabel, childPath, childLabel, child } = input;
    if (!isFanoutChildNodeType(child.type)) {
        errors.push(`${ownerLabel} has unsupported child node type "${String(child.type)}"`);
        return;
    }

    if ((child.transitions ?? []).length > 0) {
        errors.push(`${childLabel} must not define transitions`);
    }
    if ((child.branches ?? []).length > 0) {
        errors.push(`${childLabel} must not define branches`);
    }

    validateNodeDefinition(
        definition,
        childPath,
        {
            ...child,
            transitions: undefined,
            branches: undefined,
        },
        errors,
        context,
    );
}

function validateCollectDefinition(
    nodeKind: "foreach" | "branch",
    nodeId: string,
    collect: NodeDefinition["collect"],
    errors: string[],
) {
    if (collect === undefined) {
        return;
    }
    if (typeof collect === "string") {
        if (!collect) {
            errors.push(`${nodeKind} node "${nodeId}" collect must not be empty`);
        }
        return;
    }
    if (!isRecord(collect)) {
        errors.push(`${nodeKind} node "${nodeId}" collect must be a string or object`);
        return;
    }
    if (typeof collect.into !== "string" || !collect.into) {
        errors.push(`${nodeKind} node "${nodeId}" collect.into is required`);
    }
    if (collect.mode !== undefined && collect.mode !== "array") {
        errors.push(`${nodeKind} node "${nodeId}" collect.mode must be "array"`);
    }
    if (collect.include !== undefined) {
        if (!Array.isArray(collect.include)) {
            errors.push(`${nodeKind} node "${nodeId}" collect.include must be an array`);
            return;
        }
        for (const field of collect.include) {
            if (typeof field !== "string" || !isParallelCollectField(field)) {
                errors.push(`${nodeKind} node "${nodeId}" collect.include has invalid field "${String(field)}"`);
            }
        }
    }
}

function isParallelCollectField(value: string): boolean {
    return value === "status"
        || value === "index"
        || value === "item"
        || value === "item_id"
        || value === "branch_id"
        || value === "branch_title"
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

function getConditionBranches(node: NodeDefinition): BranchDefinition[] {
    return node.type === "condition" && Array.isArray(node.branches)
        ? node.branches.filter(isConditionBranchDefinition)
        : [];
}

function getBranchNodeBranches(node: NodeDefinition): BranchNodeBranchDefinition[] {
    return node.type === "branch" && Array.isArray(node.branches)
        ? node.branches.filter(isBranchNodeBranchDefinition)
        : [];
}

function isConditionBranchDefinition(branch: BranchDefinition | BranchNodeBranchDefinition): branch is BranchDefinition {
    return "to" in branch;
}

function isBranchNodeBranchDefinition(branch: BranchDefinition | BranchNodeBranchDefinition): branch is BranchNodeBranchDefinition {
    return "node" in branch;
}
