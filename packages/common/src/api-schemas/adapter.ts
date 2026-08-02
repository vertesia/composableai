/**
 * Library-neutral JSON Schema -> OpenAPI 3.1 `components.schemas` adapter.
 *
 * Input is plain JSON Schema, so this works for any authoring library. It normalizes the three
 * ways a schema library expresses a named reference into the one form OpenAPI needs:
 *
 * - zod       `$defs` + `{"$ref": "#/$defs/X"}`   (and `{"$ref": "#"}` for self-recursion)
 * - typebox   a nested subschema carrying `$id`   (hoisted here, per the same contract)
 * - either    a bare `{"$ref": "X"}` id pointer
 *
 * All three become `{"$ref": "#/components/schemas/X"}` with the target hoisted into components,
 * so the pointer that is published is byte-identical to the pointer AJV compiles. That identity
 * is the whole point: the spec cannot drift from the enforced contract because they are the same
 * object.
 *
 * The input is never mutated.
 */

export type JsonObject = Record<string, unknown>;

/** How a component treats properties it does not declare. */
export type AdditionalPropertiesPolicy = 'open' | 'closed';

export interface AdapterOptions {
    /**
     * Components that reject undeclared properties. Everything else is left open — omitting the
     * keyword entirely, so extras are accepted and RETAINED. Existing endpoints must stay open:
     * they currently cast the payload without validating, so rejecting extras would be a breaking
     * API change. Only new endpoints should opt in to 'closed'.
     */
    strictComponents?: ReadonlySet<string>;
}

export class SchemaAdapterError extends Error {}

const REF = '$ref';
const COMPONENT_PREFIX = '#/components/schemas/';

function isPlainObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Resolve any of the supported reference spellings to a component name. */
function refTargetName(ref: string, rootName: string): string {
    if (ref === '#') return rootName;
    if (ref.startsWith('#/$defs/')) return ref.slice('#/$defs/'.length);
    if (ref.startsWith('#/definitions/')) return ref.slice('#/definitions/'.length);
    if (ref.startsWith(COMPONENT_PREFIX)) return ref.slice(COMPONENT_PREFIX.length);
    if (ref.startsWith('#')) {
        throw new SchemaAdapterError(
            `Unsupported internal pointer '${ref}' in component '${rootName}'. Only '#', '#/$defs/*' ` +
                `and '#/components/schemas/*' can be hoisted to OpenAPI components.`,
        );
    }
    return ref;
}

function componentRef(name: string): JsonObject {
    return { [REF]: `${COMPONENT_PREFIX}${name}` };
}

/**
 * Adds `discriminator` to a union whose members are all component references and which share a
 * required single-valued property. Generated Java/Go clients need this to pick a concrete
 * subtype; without it they fall back to a loose map or fail to deserialize.
 *
 * The property must be REQUIRED in every branch — OpenAPI treats a discriminator as always
 * present, so promoting an optional property would publish a contract the schema does not
 * guarantee.
 */
function synthesizeDiscriminator(node: JsonObject, components: Record<string, JsonObject>): void {
    const members = node.oneOf ?? node.anyOf;
    if (!Array.isArray(members) || members.length < 2 || node.discriminator) return;

    const targets: { name: string; schema: JsonObject }[] = [];
    for (const member of members) {
        if (!isPlainObject(member) || typeof member[REF] !== 'string') return;
        const name = (member[REF] as string).slice(COMPONENT_PREFIX.length);
        const schema = components[name];
        if (!schema) return;
        targets.push({ name, schema });
    }

    const candidates = new Map<string, Record<string, string>>();
    const disqualified = new Set<string>();
    for (const { name, schema } of targets) {
        const properties = isPlainObject(schema.properties) ? schema.properties : undefined;
        if (!properties) return;
        const required = Array.isArray(schema.required) ? schema.required : [];
        for (const [key, value] of Object.entries(properties)) {
            if (!isPlainObject(value)) continue;
            if (!required.includes(key)) {
                disqualified.add(key);
                continue;
            }
            const literal =
                typeof value.const === 'string'
                    ? value.const
                    : Array.isArray(value.enum) && value.enum.length === 1 && typeof value.enum[0] === 'string'
                      ? value.enum[0]
                      : undefined;
            if (literal === undefined) continue;
            const mapping = candidates.get(key) ?? {};
            // Two members claiming the same literal means it does not discriminate.
            if (mapping[literal]) {
                disqualified.add(key);
                continue;
            }
            mapping[literal] = `${COMPONENT_PREFIX}${name}`;
            candidates.set(key, mapping);
        }
    }

    for (const [propertyName, mapping] of candidates) {
        if (disqualified.has(propertyName)) continue;
        if (Object.keys(mapping).length !== targets.length) continue;
        node.discriminator = { propertyName, mapping };
        // OpenAPI requires oneOf for a discriminated union; anyOf is not enough for codegen.
        if (node.anyOf && !node.oneOf) {
            node.oneOf = node.anyOf;
            delete node.anyOf;
        }
        // Restated on the union itself, matching what the OpenAPI scanner emits for the unions it
        // derives. Both are already true of every branch, so validation is unchanged — but a
        // generated Java/Go client reads the union node, not the branches, and needs to be told
        // the value is an object whose discriminator is always present.
        node.type = 'object';
        const required = Array.isArray(node.required)
            ? node.required.filter((item): item is string => typeof item === 'string')
            : [];
        node.required = [...new Set([...required, propertyName])];
        return;
    }
}

/**
 * Definition entries in an order that lets a discriminator be synthesized.
 *
 * A union's `discriminator` is read off its MEMBERS, so a union hoisted before them registers
 * without one. That is invisible until the same union is registered twice — once as a root, where
 * Zod happens to emit its members first, and once inside a component that references it, where it
 * does not — at which point the two shapes disagree and `register` reports a conflict on a
 * component nobody wrote twice.
 *
 * A discriminated union's branches are objects, never unions themselves, so hoisting non-unions
 * first is enough to make the result independent of the order Zod emitted `$defs` in.
 */
function inHoistOrder(block: JsonObject): [string, unknown][] {
    const entries = Object.entries(block);
    const isUnion = (schema: unknown) =>
        isPlainObject(schema) && (Array.isArray(schema.oneOf) || Array.isArray(schema.anyOf));
    return [...entries.filter(([, schema]) => !isUnion(schema)), ...entries.filter(([, schema]) => isUnion(schema))];
}

interface HoistContext {
    components: Record<string, JsonObject>;
    rootName: string;
    /** Component name -> serialized shape, for detecting conflicting definitions. */
    seen: Map<string, string>;
    /** Names reserved while their definition is still being walked (recursion guard). */
    pending: Set<string>;
}

function walk(value: unknown, ctx: HoistContext, isRoot: boolean): unknown {
    if (Array.isArray(value)) return value.map((item) => walk(item, ctx, false));
    if (!isPlainObject(value)) return value;

    const { $schema: _schema, $id, $defs, definitions, ...rest } = value;

    // A nested $id opens a new reference scope: `{"$ref": "#"}` inside it means *this* schema,
    // not the enclosing root.
    const scopeName = typeof $id === 'string' && !isRoot ? $id : ctx.rootName;
    const previousRoot = ctx.rootName;
    ctx.rootName = scopeName;
    try {
        // Hoist sibling definition blocks first so members can reference each other — and before the
        // `$ref` branch below, which returns without descending. A node that is ONLY a reference can
        // still carry the definitions that reference points at: that is exactly the shape Zod emits
        // for an alias schema adapted on its own, and skipping its `$defs` left the reference dangling.
        for (const block of [$defs, definitions]) {
            if (!isPlainObject(block)) continue;
            for (const [name, schema] of inHoistOrder(block)) {
                hoist(name, schema, ctx);
            }
        }

        if (typeof rest[REF] === 'string') {
            const rewritten = componentRef(refTargetName(rest[REF] as string, ctx.rootName));
            // In 2020-12 a reference may carry sibling keywords and annotations; keep them.
            const siblings = Object.entries(rest).filter(([key]) => key !== REF);
            if (siblings.length === 0) return rewritten;
            const out: JsonObject = {};
            for (const [key, child] of siblings) out[key] = walk(child, ctx, false);
            return { ...out, ...rewritten };
        }

        const out: JsonObject = {};
        for (const [key, child] of Object.entries(rest)) {
            // An empty `properties` map constrains nothing, and Zod emits one for the catchall-only
            // object that a `Record<string, T>` index signature has to be written as — `z.record`
            // additionally emits a `propertyNames`, which the TypeScript-derived generator never did.
            // Dropping it is what lets such a component be byte-identical to its derived counterpart.
            if (key === 'properties' && isPlainObject(child) && Object.keys(child).length === 0) continue;
            // `properties` keys are user data, not schema keywords — never treat them as refs.
            out[key] =
                key === 'properties' && isPlainObject(child)
                    ? Object.fromEntries(Object.entries(child).map(([p, s]) => [p, walk(s, ctx, false)]))
                    : walk(child, ctx, false);
        }

        synthesizeDiscriminator(out, ctx.components);

        // A nested schema carrying its own $id is a named component: hoist it and leave a reference.
        if (typeof $id === 'string' && !isRoot) {
            register($id, out, ctx);
            return componentRef($id);
        }
        return out;
    } finally {
        ctx.rootName = previousRoot;
    }
}

function register(name: string, schema: JsonObject, ctx: HoistContext): void {
    const fingerprint = JSON.stringify(schema);
    const previous = ctx.seen.get(name);
    if (previous !== undefined && previous !== fingerprint) {
        throw new SchemaAdapterError(
            `Component '${name}' is defined twice with different shapes (seen while adapting ` +
                `'${ctx.rootName}'). Component names must be globally unique.`,
        );
    }
    ctx.seen.set(name, fingerprint);
    ctx.components[name] = schema;
}

function hoist(name: string, schema: unknown, ctx: HoistContext): void {
    if (!isPlainObject(schema)) return;
    // Already being walked higher up the stack — the reference will resolve once it lands.
    if (ctx.pending.has(name)) return;
    ctx.pending.add(name);
    const previousRoot = ctx.rootName;
    // A `$defs` entry does NOT open a new reference scope — only an `$id` does. `{"$ref": "#"}`
    // inside one still points at the DOCUMENT root, so the enclosing root name has to stay in place.
    // Naming the entry here instead was invisible until the first recursive schema: Zod writes
    // `JSONSchemaProperties.additionalProperties` as a bare `#`, meaning the enclosing `JSONSchema`,
    // and rewriting it to `JSONSchemaProperties` turned a property map into a map of property maps.
    if (typeof schema.$id === 'string') ctx.rootName = schema.$id;
    try {
        // Note: no early return for an already-registered name. `register` compares shapes, so a
        // second definition that disagrees is reported rather than silently ignored.
        register(name, walk(schema, ctx, true) as JsonObject, ctx);
    } finally {
        ctx.rootName = previousRoot;
        ctx.pending.delete(name);
    }
}

/** Every `$ref` must land on a component that exists, or the spec ships a dangling pointer. */
function assertReferencesResolve(components: Readonly<Record<string, JsonObject>>): void {
    const visit = (node: unknown, owner: string): void => {
        if (Array.isArray(node)) {
            for (const item of node) visit(item, owner);
            return;
        }
        if (!isPlainObject(node)) return;
        const ref = node[REF];
        if (typeof ref === 'string') {
            const name = ref.startsWith(COMPONENT_PREFIX) ? ref.slice(COMPONENT_PREFIX.length) : undefined;
            if (name === undefined || !components[name]) {
                throw new SchemaAdapterError(
                    `Component '${owner}' references '${ref}', which is not a known component.`,
                );
            }
        }
        for (const child of Object.values(node)) visit(child, owner);
    };
    for (const [name, schema] of Object.entries(components)) visit(schema, name);
}

/**
 * Converts a map of named JSON Schemas into OpenAPI `components.schemas`.
 *
 * @param roots  component name -> plain JSON Schema
 */
export function toOpenApiComponents(
    roots: Readonly<Record<string, unknown>>,
    options: AdapterOptions = {},
): Record<string, JsonObject> {
    const ctx: HoistContext = { components: {}, rootName: '', seen: new Map(), pending: new Set() };
    for (const [name, schema] of Object.entries(roots)) {
        if (!isPlainObject(schema)) {
            throw new SchemaAdapterError(`Component '${name}' is not an object schema.`);
        }
        ctx.rootName = name;
        register(name, walk(structuredClone(schema), ctx, true) as JsonObject, ctx);
    }

    const strict = options.strictComponents;
    if (strict) {
        for (const name of strict) {
            const schema = ctx.components[name];
            if (!schema) {
                throw new SchemaAdapterError(`Cannot apply a strict policy to unknown component '${name}'.`);
            }
            closeObjects(schema);
        }
    }
    for (const [name, schema] of Object.entries(ctx.components)) {
        if (strict?.has(name)) continue;
        // Open the component by removing an inherited `false`. A `true` or a subschema is a
        // deliberate constraint on the extras (e.g. a Record<string, string> value type) and must
        // survive — deleting it would silently widen the contract to accept anything.
        if (schema.additionalProperties === false) delete schema.additionalProperties;
        // The one subschema that is NOT a constraint: `{}` accepts every extra, which is exactly what
        // an absent `additionalProperties` means. Zod emits it for `looseObject`, and the
        // TypeScript-derived generator emits nothing for the index signature that models the same
        // thing, so dropping it is what lets an intentionally-open component be byte-identical to its
        // derived counterpart. Unlike the `false` above, this changes no meaning at all.
        if (isPlainObject(schema.additionalProperties) && Object.keys(schema.additionalProperties).length === 0) {
            delete schema.additionalProperties;
        }
    }

    for (const schema of Object.values(ctx.components)) {
        moveDescriptionsLast(schema);
    }

    assertReferencesResolve(ctx.components);
    return ctx.components;
}

/**
 * Visits every SUBSCHEMA of a node, and nothing else.
 *
 * The distinction is load-bearing rather than pedantic: `properties` is a map from property NAME to
 * subschema, so its keys are user data. A generic "walk every object" pass would treat a property
 * literally named `description` — which `Project`, `ICreateProjectPayload` and three other published
 * components have — as the `description` keyword, and reordering it would change the published
 * property order. Enumerating the structural keywords is what makes that impossible.
 */
function eachSubschema(node: JsonObject, visit: (child: JsonObject) => void): void {
    for (const keyword of ['items', 'additionalProperties', 'propertyNames', 'contains', 'not', 'if', 'then', 'else']) {
        const child = node[keyword];
        if (isPlainObject(child)) visit(child);
    }
    for (const keyword of ['properties', 'patternProperties', '$defs', 'definitions', 'dependentSchemas']) {
        const map = node[keyword];
        if (!isPlainObject(map)) continue;
        for (const child of Object.values(map)) {
            if (isPlainObject(child)) visit(child);
        }
    }
    for (const keyword of ['anyOf', 'oneOf', 'allOf', 'prefixItems']) {
        const list = node[keyword];
        if (!Array.isArray(list)) continue;
        for (const child of list) {
            if (isPlainObject(child)) visit(child);
        }
    }
}

/**
 * Closes a strict component and every anonymous object inside it.
 *
 * Strictness is declared per component, but an object nested inline in one is not a component — it has
 * no name to list — so without this it stayed open while its parent closed. The TypeScript-derived
 * generator closed every object it emitted, so the document already publishes those inline objects
 * closed (`QuotaStandingResponse.admission` and `.llm` are the first two converted), and leaving them
 * open would have loosened a published contract on the way to reproducing it.
 *
 * An existing `additionalProperties` is never overwritten: `true` or a subschema is a deliberate
 * statement about the extras — a `Record<string, string>` value type, say — and replacing it with
 * `false` would reject data the schema explicitly allows. A nested `$ref` is left alone too; it points
 * at another component, which is governed by its own listing.
 */
function closeObjects(node: JsonObject): void {
    if (typeof node[REF] !== 'string' && node.type === 'object' && node.additionalProperties === undefined) {
        node.additionalProperties = false;
    }
    eachSubschema(node, closeObjects);
}

/**
 * Puts `description` last on every subschema, which is where the published document has it.
 *
 * Key order carries no meaning to any consumer, but it decides byte-identity — and byte-identity is
 * how a conversion proves it reproduced the published contract rather than renegotiating it. The
 * scanner's TypeScript-derived output puts `description` last in 2140 of 2143 places, so matching that
 * is what lets a converted component diff clean. Zod emits it wherever `.meta()` happened to land, and
 * the strict policy above appends `additionalProperties` after that, so without this pass a described
 * `$ref` property emitted `{description, $ref}` against the document's `{$ref, description}` and every
 * closed component with a description emitted `{description, additionalProperties}`.
 */
function moveDescriptionsLast(node: JsonObject): void {
    eachSubschema(node, moveDescriptionsLast);
    if (!('description' in node)) return;
    const keys = Object.keys(node);
    if (keys[keys.length - 1] === 'description') return;
    const { description } = node;
    delete node.description;
    node.description = description;
}

/**
 * Sibling keywords next to a `$ref` that compose conjunctively in a way pruning can honour: both
 * schemas' declared properties count as declared, and required is the union.
 */
const COMPOSABLE_SIBLINGS = new Set(['properties', 'required']);

/** Siblings that annotate rather than constrain, so they cannot affect which fields survive. */
const ANNOTATION_SIBLINGS = new Set([
    'title',
    'description',
    'deprecated',
    'examples',
    'example',
    'default',
    'readOnly',
    'writeOnly',
    'format',
    '$comment',
]);

/**
 * Applicator keywords whose interaction with pruning is not sound to guess.
 *
 * `patternProperties` and `dependentSchemas` declare fields that are absent from `properties`, so
 * pruning would delete legitimate data. `prefixItems` gives array positions their own schemas,
 * which the single-`items` path would apply wrongly. `not`/`if` are conditional, and `allOf`
 * needs the union of every branch's properties.
 */
const UNSUPPORTED_APPLICATORS = [
    'allOf',
    'patternProperties',
    'prefixItems',
    'dependentSchemas',
    'unevaluatedProperties',
    'not',
    'if',
];

/** Sibling keywords beside a `$ref` that cannot be composed safely. */
function unsupportedSiblings(schema: JsonObject): string[] {
    return Object.keys(schema).filter(
        (key) => key !== REF && !COMPOSABLE_SIBLINGS.has(key) && !ANNOTATION_SIBLINGS.has(key),
    );
}

type Resolution = { schema: JsonObject } | { reason: string };

/**
 * Fully resolves a reference chain, composing the sibling keywords that can be composed.
 *
 * Follows references until a non-reference schema is reached. A component whose body is itself a
 * `$ref` — or one carrying `properties` beside a `$ref` — is an alias, and stopping after one hop
 * would hand the caller a node that still has a `$ref`. Pruning would then read that node's own
 * `properties` as the whole shape and drop everything the target declares, while
 * {@link findUnprunablePaths} kept recursing and reported nothing wrong. Both paths call this, so
 * they always see the same terminal schema.
 *
 * In JSON Schema 2020-12 a `$ref` and its siblings apply CONJUNCTIVELY — both must hold. Merging
 * by overwriting would be wrong in the widening direction: a sibling `additionalProperties: true`
 * beside a closed target does not open it. Rather than reimplement intersection semantics (whose
 * `additionalProperties` interaction is famously counterintuitive), anything beyond a union of
 * `properties`/`required` and pure annotations is declined — the caller then passes the value
 * through untouched.
 *
 * Returns a reason instead of a schema when a target is unknown, a link carries siblings that
 * cannot be composed, or the chain cycles.
 */
function resolveChain(schema: JsonObject, components: Readonly<Record<string, JsonObject>>): Resolution {
    let current = schema;
    const visited = new Set<string>();
    // Sibling contributions accumulated along the chain, applied to the terminal schema.
    const extraProperties: JsonObject = {};
    const extraRequired: string[] = [];

    while (typeof current[REF] === 'string') {
        const unsupported = unsupportedSiblings(current);
        if (unsupported.length > 0) {
            return { reason: `$ref with unsupported sibling: ${unsupported.sort().join(', ')}` };
        }
        const name = (current[REF] as string).slice(COMPONENT_PREFIX.length);
        // An alias cycle has no terminal schema to prune against.
        if (visited.has(name)) return { reason: 'circular $ref' };
        visited.add(name);

        const properties = current.properties;
        if (isPlainObject(properties)) Object.assign(extraProperties, properties);
        if (Array.isArray(current.required)) extraRequired.push(...(current.required as string[]));

        const target = components[name];
        if (!target) return { reason: 'unresolved $ref' };
        current = target;
    }

    if (Object.keys(extraProperties).length === 0 && extraRequired.length === 0) return { schema: current };

    const merged: JsonObject = { ...current };
    merged.properties = { ...(isPlainObject(current.properties) ? current.properties : {}), ...extraProperties };
    if (extraRequired.length > 0) {
        const existing = Array.isArray(current.required) ? (current.required as string[]) : [];
        merged.required = [...new Set([...existing, ...extraRequired])];
    }
    return { schema: merged };
}

/**
 * {@link resolveChain} for callers that only need to know whether resolution succeeded.
 *
 * Exported so parameter normalization follows the same reference semantics as pruning rather than
 * carrying a second, subtly different resolver. A query parameter typed by a hoisted enum is reached
 * through exactly the chain walked here, so what the normalizer coerces towards and what the spec
 * publishes are read off the same node.
 */
export function resolveSchemaRef(
    schema: JsonObject,
    components: Readonly<Record<string, JsonObject>>,
): JsonObject | undefined {
    const resolution = resolveChain(schema, components);
    return 'schema' in resolution ? resolution.schema : undefined;
}

function resolve(schema: JsonObject, components: Readonly<Record<string, JsonObject>>): JsonObject | undefined {
    return resolveSchemaRef(schema, components);
}

/**
 * Whether a subschema could describe an object, i.e. whether pruning it would do anything.
 * References are resolved first — a `$ref` to a scalar enum is not object-bearing, and treating
 * every reference as one makes scalar unions look ambiguous when they are not.
 */
function couldHoldProperties(node: unknown, components: Readonly<Record<string, JsonObject>>): boolean {
    if (!isPlainObject(node)) return false;
    const resolved = typeof node[REF] === 'string' ? resolve(node, components) : node;
    // An unresolvable reference is opaque, so assume the worst.
    if (!resolved) return true;
    return (
        resolved.type === 'object' ||
        isPlainObject(resolved.properties) ||
        resolved.additionalProperties !== undefined ||
        resolved.patternProperties !== undefined ||
        resolved.allOf !== undefined ||
        resolved.oneOf !== undefined ||
        resolved.anyOf !== undefined
    );
}

/**
 * Why this node cannot be narrowed, or undefined if it can.
 *
 * Shared by {@link pruneToSchema} and {@link findUnprunablePaths} so the pruner and the report of
 * its own limitations cannot drift apart.
 */
function unprunableReason(node: JsonObject, components: Readonly<Record<string, JsonObject>>): string | undefined {
    for (const keyword of UNSUPPORTED_APPLICATORS) {
        if (node[keyword] !== undefined) return keyword;
    }
    const branches = node.oneOf ?? node.anyOf;
    if (Array.isArray(branches)) {
        // A union of scalars (a nullable enum, say) has no properties to narrow, so an absent
        // discriminator costs nothing.
        if (!branches.some((branch) => couldHoldProperties(branch, components))) return undefined;
        if (!isPlainObject(node.discriminator)) return 'union without discriminator';
    }
    return undefined;
}

/**
 * Reports the paths within a component where {@link pruneToSchema} cannot narrow. Values at those
 * paths pass through untouched, extras included.
 *
 * An empty report means every path is structurally prunable FOR SCHEMA-CONFORMING INPUT. It is not
 * a guarantee about arbitrary payloads: a discriminated union whose discriminator carries a value
 * with no mapping entry still passes through, because no branch describes it. Treat an empty
 * report as "no structural gaps", not as "nothing can escape".
 */
export function findUnprunablePaths(schema: JsonObject, components: Readonly<Record<string, JsonObject>>): string[] {
    const found: string[] = [];
    const visiting = new Set<string>();

    const visit = (node: JsonObject, path: string): void => {
        const ref = node[REF];
        if (typeof ref === 'string') {
            const name = ref.slice(COMPONENT_PREFIX.length);
            if (visiting.has(name)) return; // cycle — already accounted for
            // The same resolution the pruner performs, chain included, so a defect in an alias
            // hop is reported here rather than discovered when a response comes back malformed.
            const resolution = resolveChain(node, components);
            if ('reason' in resolution) {
                found.push(`${path} (${resolution.reason})`);
                return;
            }
            visiting.add(name);
            visit(resolution.schema, path);
            visiting.delete(name);
            return;
        }

        const reason = unprunableReason(node, components);
        if (reason) {
            found.push(`${path} (${reason})`);
            return;
        }

        const branches = node.oneOf ?? node.anyOf;
        if (Array.isArray(branches)) {
            if (!branches.some((branch) => couldHoldProperties(branch, components))) return;
            for (const [index, branch] of branches.entries()) {
                if (isPlainObject(branch)) visit(branch, `${path}/${index}`);
            }
            return;
        }

        if (isPlainObject(node.properties)) {
            for (const [key, child] of Object.entries(node.properties)) {
                if (isPlainObject(child)) visit(child, `${path}/${key}`);
            }
        }
        // A map's values are pruned through this subschema, so its limitations count too.
        if (isPlainObject(node.additionalProperties) && Object.keys(node.additionalProperties).length > 0) {
            visit(node.additionalProperties, `${path}{}`);
        }
        if (isPlainObject(node.items)) visit(node.items, `${path}[]`);
    };

    visit(schema, '');
    return found;
}

/**
 * Whether an object schema describes a fixed shape (prunable) or a freeform map (must be left
 * alone).
 *
 * The distinction is what makes this safe. AJV's `removeAdditional: 'all'` strips keys from
 * freeform objects too — that is how `launch_workstream`'s `data` was silently emptied and
 * `sys:AppDeveloper` lost `user_prompt` (see `packages/workflows/src/tools/validation.ts`).
 * `Account.feature_flags` is exactly such a map: `{additionalProperties: {}}` with no
 * `properties`. Pruning it would delete every operator flag.
 */
function declaresFixedShape(schema: JsonObject): boolean {
    const additional = schema.additionalProperties;
    if (additional === false) return true;
    // Explicitly extensible (`true` or a subschema) — the extras are part of the contract.
    if (additional !== undefined) return false;
    return isPlainObject(schema.properties);
}

/**
 * Best-effort narrowing of a response payload to the properties its published schema declares.
 *
 * NOT A SECURITY BOUNDARY. Where the schema is ambiguous — an `allOf` intersection, a union with
 * no discriminator, a discriminator value with no mapping entry, or an unresolvable `$ref` — the
 * value passes through UNTOUCHED, extras included. Losing data is worse than guessing, so the
 * pruner declines rather than improvises. Anything that must never reach a client (secrets,
 * internal identifiers) still needs an explicit response mapper or a request/response type split;
 * this must not be relied on to remove it. {@link findUnprunablePaths} reports where a given
 * component falls into those gaps.
 *
 * Responses are pruned rather than rejected: a document carrying an undocumented field is the
 * server's problem, not the caller's, and failing would turn drift into a 500.
 *
 * The input is never mutated.
 */
export function pruneToSchema(
    value: unknown,
    schema: JsonObject,
    components: Readonly<Record<string, JsonObject>>,
): unknown {
    const resolved = resolve(schema, components);
    if (!resolved) return value;
    // Declines on any shape whose narrowing would be a guess. Shared with findUnprunablePaths so
    // the report always describes what the pruner actually does.
    if (unprunableReason(resolved, components)) return value;

    const branches = resolved.oneOf ?? resolved.anyOf;
    if (Array.isArray(branches)) {
        const discriminator = resolved.discriminator;
        if (!isPlainObject(discriminator) || !isPlainObject(value)) return value;
        const key = discriminator.propertyName;
        const mapping = discriminator.mapping;
        if (typeof key !== 'string' || !isPlainObject(mapping)) return value;
        const target = mapping[String(value[key])];
        if (typeof target !== 'string') return value;
        return pruneToSchema(value, { [REF]: target }, components);
    }

    if (Array.isArray(value)) {
        const items = resolved.items;
        if (!isPlainObject(items)) return value;
        return value.map((item) => pruneToSchema(item, items, components));
    }

    if (!isPlainObject(value)) return value;

    const properties = isPlainObject(resolved.properties) ? resolved.properties : undefined;
    const additional = resolved.additionalProperties;
    const fixed = declaresFixedShape(resolved);

    const out: JsonObject = {};
    for (const [key, child] of Object.entries(value)) {
        const propertySchema = properties?.[key];
        if (isPlainObject(propertySchema)) {
            out[key] = pruneToSchema(child, propertySchema, components);
            continue;
        }
        if (fixed) continue; // undeclared on a fixed shape — drop it
        // Freeform: keep the value, narrowing it only if a subschema describes the extras.
        out[key] =
            isPlainObject(additional) && Object.keys(additional).length > 0
                ? pruneToSchema(child, additional, components)
                : child;
    }
    return out;
}
