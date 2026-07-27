/**
 * A ready-made `validateExample` for `preprocessSkillMarkdown`.
 *
 * The preprocessor deliberately knows nothing about schemas — it hands each `tool=`-tagged
 * payload to a callback. This module is the callback most consumers want: JSON Schema validation
 * plus the one thing JSON Schema structurally cannot do.
 *
 * That gap is dispatchers. A tool like `batch_execute` declares `tool_name: { type: 'string' }`
 * and an opaque `input` object, so AJV accepts `{"tool_name": "web_search", "input": {...}}` even
 * when `web_search` does not exist and the input belongs to a different tool's schema. A
 * `dispatch` descriptor names the field carrying the tool name and the field carrying its
 * payload, which is enough to resolve one against the registry and validate the other against the
 * *dispatched* tool.
 *
 * Input is plain data — names, JSON Schemas, descriptors — so this stays independent of any
 * particular tool registry.
 */

import { Ajv, type ValidateFunction } from 'ajv';

export interface ToolDispatchDescriptor {
    /** Path to the field holding a dispatched tool name. Dots nest, `[]` walks an array. */
    field: string;
    /** Path to the payload forwarded to that tool, if any. */
    inputField?: string;
    /** Tool names the dispatcher refuses at runtime. */
    deny?: readonly string[];
}

export interface ToolSchemaEntry {
    name: string;
    /** JSON Schema for the tool's parameters. Absent when the provider exposes no schema. */
    params?: unknown;
    dispatch?: ToolDispatchDescriptor;
}

/**
 * Walk a dotted/`[]` path, returning every value found.
 *
 * `inputs[].input` over `{inputs: [{input: A}, {input: B}]}` yields `[A, B]`. Missing segments
 * yield nothing rather than `undefined`, so callers cannot mistake absence for a null payload.
 */
export function nodesAtPath(value: unknown, path: string): unknown[] {
    let current: unknown[] = [value];
    for (const segment of path.split('.')) {
        const isArray = segment.endsWith('[]');
        const key = isArray ? segment.slice(0, -2) : segment;
        const next: unknown[] = [];
        for (const node of current) {
            if (typeof node !== 'object' || node === null) {
                continue;
            }
            const child = (node as Record<string, unknown>)[key];
            if (child === undefined) {
                continue;
            }
            if (isArray) {
                if (Array.isArray(child)) {
                    next.push(...child);
                }
            } else {
                next.push(child);
            }
        }
        current = next;
    }
    return current;
}

/** Path values narrowed to strings — used for fields that carry a tool name. */
export function toolNamesAtPath(value: unknown, path: string): string[] {
    return nodesAtPath(value, path).filter((v): v is string => typeof v === 'string');
}

/** Walk the same dotted/`[]` path through a JSON Schema rather than through a value. */
export function schemaNodeAtPath(schema: unknown, path: string): Record<string, unknown> | undefined {
    let node = schema as Record<string, unknown> | undefined;
    for (const segment of path.split('.')) {
        const isArray = segment.endsWith('[]');
        const key = isArray ? segment.slice(0, -2) : segment;
        const properties = node?.properties as Record<string, unknown> | undefined;
        node = properties?.[key] as Record<string, unknown> | undefined;
        if (isArray) {
            node = node?.items as Record<string, unknown> | undefined;
        }
        if (!node) {
            return undefined;
        }
    }
    return node;
}

/**
 * The branches a schema node offers, for a walk that must not stop at a composed node.
 *
 * `query` may be declared as `anyOf: [{properties: {full_text: …}}, …]`, in which case the node
 * itself has no `properties` at all. Walking only the node would report a field that plainly
 * exists as missing, which for a fail-closed check is worse than not checking.
 */
function branchesOf(node: unknown): Record<string, unknown>[] {
    if (typeof node !== 'object' || node === null) {
        return [];
    }
    const record = node as Record<string, unknown>;
    const composed = [record.anyOf, record.oneOf, record.allOf].flatMap((group) =>
        Array.isArray(group) ? (group as Record<string, unknown>[]) : [],
    );
    return [record, ...composed.flatMap((branch) => branchesOf(branch))];
}

/** One step of a dotted/`[]` path through a schema, across composition branches. */
function stepInto(nodes: readonly Record<string, unknown>[], segment: string): Record<string, unknown>[] {
    const isArray = segment.endsWith('[]');
    const key = isArray ? segment.slice(0, -2) : segment;
    const found: Record<string, unknown>[] = [];
    for (const branch of nodes.flatMap((node) => branchesOf(node))) {
        const properties = branch.properties as Record<string, unknown> | undefined;
        const child = properties?.[key];
        if (child === undefined) {
            continue;
        }
        const target = isArray ? (child as Record<string, unknown>).items : child;
        if (target && typeof target === 'object') {
            found.push(target as Record<string, unknown>);
        }
    }
    return found;
}

/** Property names declared at a node, across composition branches, for a "did you mean" list. */
function propertyNamesOf(nodes: readonly Record<string, unknown>[]): string[] {
    const names = new Set<string>();
    for (const branch of nodes.flatMap((node) => branchesOf(node))) {
        for (const name of Object.keys((branch.properties as Record<string, unknown>) ?? {})) {
            names.add(name);
        }
    }
    return [...names].sort();
}

/**
 * Build a `validateField` callback over a set of tools.
 *
 * A skill that says a tool "takes `query` as an object" is making a claim about that tool's
 * schema, and it is exactly the claim that rots when a parameter is renamed. `{@param …}` states
 * the claim so this can check it.
 *
 * Fails closed on a tool with no visible schema: reporting nothing would make the construct look
 * checked while checking nothing, which is the failure mode a `tool=` tag on an unvalidatable tool
 * is already rejected for.
 */
export function createSchemaFieldValidator(
    tools: readonly ToolSchemaEntry[],
): (ref: { tool: string; path: string }) => string[] {
    const byName = new Map(tools.map((t) => [t.name, t]));

    return ({ tool: toolName, path }) => {
        const tool = byName.get(toolName);
        if (!tool) {
            // The preprocessor already reports an unknown tool name; nothing to add.
            return [];
        }
        if (!tool.params) {
            return [`cannot be checked: '${toolName}' exposes no schema to this build`];
        }

        let nodes = [tool.params as Record<string, unknown>];
        const walked: string[] = [];
        for (const segment of path.split('.')) {
            const next = stepInto(nodes, segment);
            if (next.length === 0) {
                const available = propertyNamesOf(nodes);
                const where = walked.length > 0 ? `'${walked.join('.')}' of ` : '';
                return [
                    `names '${segment}', which ${where}'${toolName}' does not declare` +
                        (available.length > 0 ? ` (declared: ${available.join(', ')})` : ''),
                ];
            }
            walked.push(segment);
            nodes = next;
        }
        return [];
    };
}

/** A string, or an array of strings. Anything else cannot carry a tool name. */
function carriesToolName(node: Record<string, unknown> | undefined): boolean {
    if (!node) {
        return false;
    }
    if (node.type === 'string') {
        return true;
    }
    const items = node.items as Record<string, unknown> | undefined;
    return node.type === 'array' && items?.type === 'string';
}

/**
 * Is the descriptor coherent with the tool's own schema?
 *
 * Returns the problems, empty when sound. Callers treat a problem as an error rather than
 * skipping the check: a descriptor pointing at a renamed field would otherwise disable dispatcher
 * validation for that tool silently, which is the worst possible failure for a safety net.
 */
export function checkDispatchDescriptor(tool: ToolSchemaEntry): string[] {
    const dispatch = tool.dispatch;
    if (!dispatch || !tool.params) {
        return [];
    }
    const fieldNode = schemaNodeAtPath(tool.params, dispatch.field);
    if (!fieldNode) {
        return [`dispatch.field '${dispatch.field}' does not exist in the params schema`];
    }
    if (!carriesToolName(fieldNode)) {
        return [
            `dispatch.field '${dispatch.field}' is not a string or array of strings, so it cannot carry a tool name`,
        ];
    }
    if (dispatch.inputField && !schemaNodeAtPath(tool.params, dispatch.inputField)) {
        return [`dispatch.inputField '${dispatch.inputField}' does not exist in the params schema`];
    }
    return [];
}

/** One dispatched name found in a payload, already judged against the registry. */
export interface DispatchResolution {
    name: string;
    /** Set when the name resolves to a usable tool. */
    tool?: ToolSchemaEntry;
    /** Set when it does not: the reason, ready to report. */
    problem?: string;
}

/**
 * Resolve every dispatched name a payload carries, honouring the descriptor's deny list.
 *
 * Shared so the build gate and the repository audit apply one rule. They differ only in how they
 * report: one throws a build error, the other builds a `Finding` with a file and a subject.
 */
export function resolveDispatchedNames(
    tool: ToolSchemaEntry,
    value: unknown,
    lookup: (name: string) => ToolSchemaEntry | undefined,
): DispatchResolution[] {
    const dispatch = tool.dispatch;
    if (!dispatch) {
        return [];
    }
    const deny = new Set(dispatch.deny ?? []);
    return toolNamesAtPath(value, dispatch.field).map((name) => {
        if (deny.has(name)) {
            return { name, problem: `names '${name}', which this dispatcher refuses at runtime` };
        }
        const target = lookup(name);
        return target ? { name, tool: target } : { name, problem: `names '${name}', which is not a registered tool` };
    });
}

/**
 * Pair each forwarded payload with the tool that will receive it.
 *
 * One dispatched name applies to every input; otherwise pair positionally. Any other shape is
 * ambiguous and yields no pairing — guessing there would manufacture exactly the false positives
 * this whole mechanism exists to avoid.
 */
export function pairDispatchedInputs(
    tool: ToolSchemaEntry,
    value: unknown,
    dispatched: readonly ToolSchemaEntry[],
): Array<{ target: ToolSchemaEntry; input: Record<string, unknown> }> {
    const inputField = tool.dispatch?.inputField;
    if (!inputField || dispatched.length === 0) {
        return [];
    }
    const inputs = nodesAtPath(value, inputField);
    const pairs: Array<{ target: ToolSchemaEntry; input: Record<string, unknown> }> = [];
    for (const [index, input] of inputs.entries()) {
        const target =
            dispatched.length === 1
                ? dispatched[0]
                : dispatched.length === inputs.length
                  ? dispatched[index]
                  : undefined;
        if (target && typeof input === 'object' && input !== null) {
            pairs.push({ target, input: input as Record<string, unknown> });
        }
    }
    return pairs;
}

/** Mirrors the agent runtime's AJV configuration, so the build judges what the runtime judges. */
function createAjv(): Ajv {
    return new Ajv({ allErrors: true, coerceTypes: true, strict: false });
}

function describeErrors(validate: ValidateFunction): string {
    return (validate.errors ?? [])
        .slice(0, 4)
        .map((e) => {
            // AJV omits the offending key from its `additionalProperties` text, and that key is
            // almost always the answer — a renamed or invented parameter.
            const offender = (e.params as { additionalProperty?: string } | undefined)?.additionalProperty;
            return `${e.instancePath || '/'} ${e.message}${offender ? ` ('${offender}')` : ''}`;
        })
        .join('; ');
}

/**
 * Build a `validateExample` callback over a set of tools.
 *
 * Returns human-readable problems; an empty array means the example is valid. Tools without a
 * schema are skipped rather than guessed at.
 */
export function createSchemaExampleValidator(
    tools: readonly ToolSchemaEntry[],
): (example: { tool: string; value: unknown }) => string[] {
    const ajv = createAjv();
    const byName = new Map(tools.map((t) => [t.name, t]));
    const validators = new Map<string, ValidateFunction>();
    const uncompilable = new Map<string, string>();

    for (const tool of tools) {
        if (!tool.params) {
            continue;
        }
        try {
            validators.set(tool.name, ajv.compile(tool.params as object));
        } catch (err) {
            uncompilable.set(tool.name, (err as Error).message);
        }
    }

    const validateAgainst = (name: string, value: unknown, describe: (detail: string) => string): string[] => {
        const validate = validators.get(name);
        if (!validate) {
            const reason = uncompilable.get(name);
            // A schema AJV cannot compile is a real problem, but not this example's problem.
            return reason ? [describe(`could not be checked: '${name}' has an uncompilable schema (${reason})`)] : [];
        }
        // AJV coerces in place; validate a copy so the caller's value is untouched.
        return validate(structuredClone(value)) ? [] : [describe(describeErrors(validate))];
    };

    return ({ tool: toolName, value }) => {
        const tool = byName.get(toolName);
        if (!tool) {
            // The preprocessor already reports an unknown tag; nothing to add.
            return [];
        }

        const errors = validateAgainst(
            toolName,
            value,
            (detail) => `does not satisfy the schema of '${toolName}': ${detail}`,
        );

        if (!tool.dispatch) {
            return errors;
        }

        // Fail closed on an incoherent descriptor: it would otherwise disable the checks below.
        const descriptorProblems = checkDispatchDescriptor(tool);
        if (descriptorProblems.length > 0) {
            return [...errors, ...descriptorProblems.map((p) => `cannot be checked: '${toolName}' ${p}`)];
        }

        const resolutions = resolveDispatchedNames(tool, value, (name) => byName.get(name));
        for (const resolution of resolutions) {
            if (resolution.problem) {
                errors.push(resolution.problem);
            }
        }

        const dispatched = resolutions.flatMap((r) => (r.tool ? [r.tool] : []));
        for (const { target, input } of pairDispatchedInputs(tool, value, dispatched)) {
            errors.push(
                ...validateAgainst(
                    target.name,
                    input,
                    (detail) => `forwards an input to '${target.name}' that does not satisfy its schema: ${detail}`,
                ),
            );
        }

        return errors;
    };
}
