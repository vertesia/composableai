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
    /**
     * True when the runtime strips a leading `+` or `-` before resolving the name — the selection
     * prefixes that add to, or remove from, the default toolset. Without this the documented
     * `+learn_web_search` form reads as an unregistered tool.
     */
    stripsSelectionPrefix?: boolean;
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
 * A schema node together with the resource roots a local `$ref` inside it resolves against.
 *
 * Roots are innermost-first. A `$defs` block belongs to the schema that declares it, and these
 * schemas embed whole resources — `create_view.configuration` carries its own `$id` and `$defs` —
 * so `#/$defs/layout` inside it means *its* definitions, not the tool's.
 */
interface SchemaCursor {
    node: Record<string, unknown>;
    roots: readonly Record<string, unknown>[];
}

/** `~1` and `~0` are the JSON Pointer escapes for `/` and `~`. */
function unescapePointer(segment: string): string {
    return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

function isSchemaObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

/** Enter a node, making it a resolution root when it declares definitions or its own identity. */
function descend(node: Record<string, unknown>, roots: readonly Record<string, unknown>[]): SchemaCursor {
    const isResource = node.$defs !== undefined || node.definitions !== undefined || node.$id !== undefined;
    return { node, roots: isResource ? [node, ...roots] : roots };
}

/**
 * Follow a local `$ref` to the node it names.
 *
 * Only same-document pointers are resolved. An external or remote reference is *not* guessed at:
 * the caller reports it, because silently treating an unresolved reference as "field absent" would
 * blame the author for the schema's shape.
 */
function followRef(ref: string, roots: readonly Record<string, unknown>[]): Record<string, unknown> | undefined {
    if (ref === '#') {
        return roots[0];
    }
    if (!ref.startsWith('#/')) {
        return undefined;
    }
    const segments = ref.slice(2).split('/').map(unescapePointer);
    for (const root of roots) {
        let node: unknown = root;
        for (const segment of segments) {
            node = isSchemaObject(node) ? node[segment] : undefined;
        }
        if (isSchemaObject(node)) {
            return node;
        }
    }
    return undefined;
}

/**
 * The branches a schema node offers: itself, its composition branches, and whatever its `$ref`
 * points at, all flattened.
 *
 * A walk that stopped at a composed or referenced node would report a field that plainly exists as
 * missing, which for a fail-closed check is worse than not checking. Unresolvable references are
 * collected rather than ignored, so the caller can say so instead of blaming the field.
 */
function branchesOf(cursor: SchemaCursor, unresolved: string[], seen = new Set<unknown>()): SchemaCursor[] {
    if (seen.has(cursor.node)) {
        // A recursive `$ref` (a tree node whose children are the same type) would loop forever.
        return [];
    }
    seen.add(cursor.node);

    const here = descend(cursor.node, cursor.roots);
    const out: SchemaCursor[] = [here];

    const ref = here.node.$ref;
    if (typeof ref === 'string') {
        const target = followRef(ref, here.roots);
        if (target) {
            out.push(...branchesOf({ node: target, roots: here.roots }, unresolved, seen));
        } else {
            unresolved.push(ref);
        }
    }

    for (const group of [here.node.anyOf, here.node.oneOf, here.node.allOf]) {
        for (const branch of Array.isArray(group) ? group : []) {
            if (isSchemaObject(branch)) {
                out.push(...branchesOf({ node: branch, roots: here.roots }, unresolved, seen));
            }
        }
    }
    return out;
}

/** One step of a dotted/`[]` path, across composition branches and local references. */
function stepInto(cursors: readonly SchemaCursor[], segment: string, unresolved: string[]): SchemaCursor[] {
    const isArray = segment.endsWith('[]');
    const key = isArray ? segment.slice(0, -2) : segment;
    const found: SchemaCursor[] = [];
    for (const branch of cursors.flatMap((cursor) => branchesOf(cursor, unresolved))) {
        const properties = branch.node.properties as Record<string, unknown> | undefined;
        const child = properties?.[key];
        if (!isSchemaObject(child)) {
            continue;
        }
        const target = isArray ? child.items : child;
        if (isSchemaObject(target)) {
            found.push({ node: target, roots: branch.roots });
        }
    }
    return found;
}

/** Property names declared at a node, across branches and references, for a "did you mean" list. */
function propertyNamesOf(cursors: readonly SchemaCursor[]): string[] {
    const names = new Set<string>();
    for (const branch of cursors.flatMap((cursor) => branchesOf(cursor, []))) {
        for (const name of Object.keys((branch.node.properties as Record<string, unknown>) ?? {})) {
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
 * Every path that cannot be judged is reported rather than passed: a tool absent from these
 * entries, a tool with no visible schema, a reference that does not resolve. A construct that
 * looks checked while checking nothing is the failure mode a `tool=` tag on an unvalidatable tool
 * is already rejected for, and it is worse here — `{@param …}` exists only to be checked.
 */
export function createSchemaFieldValidator(
    tools: readonly ToolSchemaEntry[],
): (ref: { tool: string; path: string }) => string[] {
    const byName = new Map(tools.map((t) => [t.name, t]));

    return ({ tool: toolName, path }) => {
        const tool = byName.get(toolName);
        if (!tool) {
            // The preprocessor resolves the name against the catalog before calling this, so
            // reaching here means the catalog's names and its schema entries disagree.
            return [`cannot be checked: '${toolName}' is absent from this build's schema entries`];
        }
        if (!tool.params) {
            return [`cannot be checked: '${toolName}' exposes no schema to this build`];
        }

        let cursors: SchemaCursor[] = [{ node: tool.params as Record<string, unknown>, roots: [] }];
        const walked: string[] = [];
        for (const segment of path.split('.')) {
            const unresolved: string[] = [];
            const next = stepInto(cursors, segment, unresolved);
            if (next.length === 0) {
                const where = walked.length > 0 ? `'${walked.join('.')}' of ` : '';
                if (unresolved.length > 0) {
                    // Reporting "does not declare" here would blame the author for the schema's
                    // shape — the field may well exist behind the reference.
                    return [
                        `cannot be checked: reaching '${segment}' crosses ${where}'${toolName}' at ` +
                            `an unresolvable reference ('${unresolved[0]}')`,
                    ];
                }
                const available = propertyNamesOf(cursors);
                return [
                    `names '${segment}', which ${where}'${toolName}' does not declare` +
                        (available.length > 0 ? ` (declared: ${available.join(', ')})` : ''),
                ];
            }
            walked.push(segment);
            cursors = next;
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
    return toolNamesAtPath(value, dispatch.field).map((written) => {
        const name =
            dispatch.stripsSelectionPrefix && (written.startsWith('+') || written.startsWith('-'))
                ? written.slice(1)
                : written;
        if (deny.has(name)) {
            return { name, problem: `names '${written}', which this dispatcher refuses at runtime` };
        }
        const target = lookup(name);
        return target
            ? { name, tool: target }
            : { name, problem: `names '${written}', which is not a registered tool` };
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
/**
 * Sanity-check that a tagged payload plausibly belongs to the tool it names.
 *
 * A tag is a claim that the payload below is *this tool's* payload, but schema validation only
 * enforces that claim for schemas that close over their properties. Against a permissive one, a
 * payload meant for some other tool sails through: a `batch_execute` call tagged `list_artifacts`
 * passed for months, and with it a dispatched tool name that does not exist — the tag had moved
 * the example out of reach of the very check that would have caught it.
 *
 * Sharing not one field with the tool's schema is the signal, and it detects only gross mismatch.
 * Generic names — `id`, `name`, `query` — are declared by many tools, so a wrongly tagged payload
 * built from those still passes. This is a floor, not proof of correct binding; heading agreement
 * (see `preprocessSkillMarkdown`) covers the cases where the author stated the tool in prose.
 *
 * Deliberately weak in the other direction too: any overlap at all is accepted, so a payload using
 * an optional subset stays quiet, and a schema that declares nothing is skipped rather than guessed.
 */
function checkBinding(toolName: string, tool: ToolSchemaEntry, value: unknown): string[] {
    if (!isSchemaObject(tool.params) || Array.isArray(value) || !isSchemaObject(value)) {
        return [];
    }
    const declared = new Set(propertyNamesOf([descend(tool.params, [tool.params])]));
    const keys = Object.keys(value);
    if (declared.size === 0 || keys.length === 0 || keys.some((key) => declared.has(key))) {
        return [];
    }
    return [
        `is tagged for '${toolName}', which declares none of the payload's fields ` +
            `(${keys.join(', ')}); check that the tag names the intended tool`,
    ];
}

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
        errors.push(...checkBinding(toolName, tool, value));

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
