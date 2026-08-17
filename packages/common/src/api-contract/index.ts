/**
 * The API contract at RUNTIME: the published JSON Schema components, and everything that validates
 * against them.
 *
 * This module is deliberately **Zod-free**, and that is the whole point of it existing separately
 * from `../api-schemas/registry.ts`.
 *
 * Zod is the AUTHORING authority — the schemas in `../api-schemas/*.ts` are what a human edits, and
 * what `z.infer` derives every wire type from. But constructing that object graph costs ~85 MB of
 * heap, paid at module load by every process that touches the subpath. AJV does not need it: it
 * validates from JSON Schema, and `z.toJSONSchema()` is a build-time step. So the graph is emitted
 * once into `components.generated.json` (~0.65 MB over 1187 components) and the serving processes
 * read the artifact instead of rebuilding it. Loading this module plus AJV plus a compiled validator
 * costs ~9 MB against ~94 MB for the Zod path. That difference decides whether a small API process
 * fits in its memory limit at all, so contract enforcement must not require the authoring graph.
 *
 * The rule that keeps this true: **nothing reachable from here may import `zod`, directly or
 * transitively.** `../api-schemas/adapter.js` and `../api-schemas/parameters.js` are Zod-free and may
 * be imported; `./registry.js` may be imported for TYPES ONLY (`import type` is erased, so it costs
 * nothing at runtime). `bundle-isolation.test.ts` fails the build if zod reaches the built output.
 *
 * The artifact is generated output, not a second source of truth: `scripts/gen-api-components.ts`
 * writes it from the Zod registry through the SAME adapter that emits the OpenAPI components, and
 * `components.contract.test.ts` fails if it drifts. Edit the Zod schema, then run
 * `pnpm run gen:schemas`.
 */
import type { ErrorObject, ValidateFunction } from 'ajv/dist/2020.js';
import { Ajv2020 } from 'ajv/dist/2020.js';
import ajvFormats from 'ajv-formats';
import { findUnprunablePaths, isPlainObject, type JsonObject, pruneToSchema } from '../api-schemas/adapter.js';
import {
    type ApiParameterLocation,
    type NormalizedApiParameters,
    normalizeParameters,
    type RawApiParameters,
} from '../api-schemas/parameters.js';
// TYPE-ONLY, and it must stay that way: `ApiComponentName` and `ApiComponentType` are derived from
// the Zod registry (`z.infer<ApiSchemaMap[N]>`), which is exactly the graph this module exists to
// avoid loading. `import type` is fully elided by tsc, so no zod reaches the emitted JavaScript.
import type { ApiComponentName, ApiComponentType } from '../api-schemas/registry.js';
import API_SCHEMA_COMPONENTS from './components.generated.json' with { type: 'json' };

// ajv-formats is CommonJS with an ESM-style declaration file. Node's interop makes the default
// import the whole `module.exports` (itself callable), while TypeScript sees the namespace — and
// `.default` is the plugin function in both shapes.
const addFormats = ajvFormats.default;

/**
 * The canonical `components.schemas` for all documented endpoints.
 *
 * This exact object is what the OpenAPI spec publishes AND what AJV compiles, so the published
 * contract and the enforced contract cannot diverge. It is the prebuilt emission of the Zod
 * registry rather than a live conversion of it — see the module comment.
 *
 * Widened on import on purpose: `resolveJsonModule` would otherwise infer the literal type of a
 * 1187-key document and bake it into this package's `.d.ts`.
 */
export const ApiSchemaComponents: Readonly<Record<string, JsonObject>> = API_SCHEMA_COMPONENTS as Readonly<
    Record<string, JsonObject>
>;

// Re-exported so a server can get the whole contract surface — values and the types that describe
// them — from this one subpath, with no reason to reach for `../api-schemas` and pull zod back in.
// `export type` emits nothing, so the registry stays out of the runtime graph.
export type { ApiComponentName, ApiComponentType, ApiParameterLocation, NormalizedApiParameters, RawApiParameters };

/**
 * A canonical component as a SELF-CONTAINED JSON Schema, for consumers that compile it directly.
 *
 * `components` defaults to the generated artifact, which is what a server wants. A GENERATOR must
 * pass `buildApiSchemaComponents()` instead: the artifact on disk is the previous run's output, so
 * bundling from it would emit an artifact derived from the last contract rather than the current Zod
 * schemas — and, run in the wrong order, would leave the two generated files describing different
 * shapes. Passing the fresh emission makes each generator independent of the others' ordering.
 *
 * The published component `$ref`s its neighbours through `#/components/schemas/...`, which resolves
 * only inside the OpenAPI document. AJV and the Monaco editor need a document they can compile on
 * its own, so the transitive closure is inlined under `$defs` and the pointers rewritten. Nothing
 * about the shapes changes — this is a re-rooting of the same objects, plus the removal of the
 * OpenAPI-only discriminator keywords described below, which is what lets a generated artifact be
 * compared with the component it came from.
 */
export function bundleCanonicalComponent(
    name: ApiComponentName,
    components: Readonly<Record<string, JsonObject>> = ApiSchemaComponents,
): JsonObject {
    const seen = new Set<string>();
    const queue: string[] = [name];
    while (queue.length > 0) {
        const current = queue.shift() as string;
        if (seen.has(current)) continue;
        seen.add(current);
        for (const referenced of collectComponentRefs(components[current])) {
            if (!seen.has(referenced)) queue.push(referenced);
        }
    }
    seen.delete(name);
    const defs: JsonObject = {};
    for (const dependency of [...seen].sort()) {
        defs[dependency] = toPlainJsonSchema(components[dependency]) as JsonObject;
    }
    const root = toPlainJsonSchema(components[name]) as JsonObject;
    return seen.size > 0 ? { ...root, $defs: defs } : root;
}

const COMPONENT_REF_PREFIX = '#/components/schemas/';

/**
 * Re-roots the component pointers AND drops the discriminator keywords, which are OpenAPI's, not
 * JSON Schema's.
 *
 * `synthesizeDiscriminator` in the adapter gives a discriminated union a `discriminator` plus a
 * restated `type: 'object'` and `required: [propertyName]` ON THE UNION NODE, so a generated
 * Java/Go client can pick a subtype from the union rather than the branches. That restatement is a
 * codegen hint: the node carries no `properties`, so it says "an object that must have
 * `_option_id`" while declaring nothing that could be one.
 *
 * A JSON Schema validator does not mind — `required` needs no matching `properties`, and each
 * branch requires the same key anyway, so removing all three is validation-neutral. Gemini's
 * function-declaration validator does mind, and rejects the whole tool:
 *
 *     schema at properties.intake.properties.extraction.properties.config.properties.model_options
 *     requires unspecified property '_option_id'
 *
 * That was a 400 on every agent turn offering `create_or_update_type`, because the intake-policy
 * artifact reaches Vertex inside that tool's input schema. Stripping here rather than at the tool
 * keeps the next component someone bundles from reintroducing it. The OpenAPI document is untouched
 * — `ApiSchemaComponents` still carries the hint, and the generated clients still read it.
 */
function toPlainJsonSchema(value: unknown): unknown {
    const rerooted = rerootComponentRefs(value);
    return stripDiscriminators(rerooted);
}

function stripDiscriminators(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(stripDiscriminators);
    if (!value || typeof value !== 'object') return value;
    const node = value as JsonObject;
    // `properties` present means the node describes an object in its own right, so its `type` and
    // `required` are the schema's own rather than the restatement — only the OpenAPI keyword goes.
    const restated = node.discriminator !== undefined && node.properties === undefined;
    const out: JsonObject = {};
    for (const [key, item] of Object.entries(node)) {
        if (key === 'discriminator') continue;
        if (restated && (key === 'type' || key === 'required')) continue;
        out[key] = stripDiscriminators(item) as never;
    }
    return out;
}

function collectComponentRefs(value: unknown, out = new Set<string>()): Set<string> {
    if (Array.isArray(value)) {
        for (const item of value) collectComponentRefs(item, out);
        return out;
    }
    if (!value || typeof value !== 'object') return out;
    for (const [key, item] of Object.entries(value)) {
        if (key === '$ref' && typeof item === 'string' && item.startsWith(COMPONENT_REF_PREFIX)) {
            out.add(item.slice(COMPONENT_REF_PREFIX.length));
        } else {
            collectComponentRefs(item, out);
        }
    }
    return out;
}

function rerootComponentRefs(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(rerootComponentRefs);
    if (!value || typeof value !== 'object') return value;
    const out: JsonObject = {};
    for (const [key, item] of Object.entries(value)) {
        out[key] =
            key === '$ref' && typeof item === 'string' && item.startsWith(COMPONENT_REF_PREFIX)
                ? `#/$defs/${item.slice(COMPONENT_REF_PREFIX.length)}`
                : (rerootComponentRefs(item) as never);
    }
    return out;
}

/** The `$ref` pointer for a component, in the same spelling the spec publishes. */
export function apiComponentRef(name: ApiComponentName): string {
    return `#/components/schemas/${name}`;
}

/**
 * Validators compiled against the published components, through an envelope so the pointer AJV
 * resolves is the exact pointer the spec publishes. `strictSchema: false` tolerates the
 * `components` wrapper while leaving type and tuple checks active.
 *
 * Compiled lazily and cached: AJV compilation is the expensive step, and most components are
 * never validated in a given process.
 */
const validators = new Map<string, ValidateFunction>();

/**
 * One instance for the process, built on first validation.
 *
 * Per-component instances meant re-registering the whole thousand-component envelope for every
 * component ever validated, and AJV walks a schema when it is added. Sharing one instance also lets
 * it reuse the compiled form of a component that two others reference.
 */
let ajvInstance: Ajv2020 | undefined;

/**
 * The published components as AJV can consume them: the same schemas, with the two adjustments
 * AJV's discriminator support requires and the OpenAPI document must not have.
 *
 * `discriminator: true` below is what makes AJV validate a discriminated union through the branch
 * its tag names, instead of trying every branch and reporting all of their failures at once. The
 * difference is not cosmetic — a legacy MCP tool collection missing `id` used to report the real
 * error alongside two impossible ones from the branch it was never meant to match:
 *
 *     / must have required property 'id'                        <- the real one
 *     / must NOT have additional properties: oauth_app          <- vertesia_sdk branch
 *     /type must be equal to constant                           <- vertesia_sdk branch
 *     / must match exactly one schema in oneOf
 *
 * AJV rejects `mapping` outright ("discriminator: mapping is not supported"), because it derives
 * the tag-to-branch map from each branch's own `const`/`enum` instead. The OpenAPI document still
 * needs the mapping — a generated Java or Go client reads it to pick a concrete subtype — so both
 * fixups here apply to AJV's copy only, and `ApiSchemaComponents` is published exactly as built.
 *
 * AJV's remaining requirements — the tag required in every branch, carrying `const` or a
 * single-valued `enum`, with the union node typed as an object — are what `synthesizeDiscriminator`
 * in the adapter already checks before it emits a discriminator at all, and what the hand-written
 * `.meta({ discriminator })` declarations restate. `api-discriminators.test.ts` compiles every
 * registered component so a union satisfying neither fails the build rather than the request.
 */
function toAjvComponents(): Record<string, JsonObject> {
    const schemas = structuredClone(ApiSchemaComponents) as Record<string, JsonObject>;
    const resolve = (value: unknown): JsonObject | undefined => {
        if (!isPlainObject(value)) return undefined;
        const ref = value.$ref;
        if (typeof ref !== 'string' || !ref.startsWith(COMPONENT_REF_PREFIX)) return value;
        return schemas[ref.slice(COMPONENT_REF_PREFIX.length)];
    };

    visitSchemaNodes(schemas, (node) => {
        const discriminator = node.discriminator;
        if (!isPlainObject(discriminator) || !Array.isArray(node.oneOf)) return;
        // AJV derives the tag-to-branch map from each branch's own literal, so `mapping` is both
        // redundant and rejected.
        delete discriminator.mapping;

        const tag = discriminator.propertyName;
        if (typeof tag !== 'string') return;
        for (const member of node.oneOf) {
            const branch = resolve(member);
            const properties = branch && isPlainObject(branch.properties) ? branch.properties : undefined;
            const tagSchema = properties?.[tag];
            if (!isPlainObject(tagSchema) || tagSchema.const !== undefined || tagSchema.enum !== undefined) continue;
            // The tag is a `$ref` to a named literal component — `TaskType_ACTIVITY`,
            // `SupportedIntegrations_gladia` — because the literal carries its own `.meta({ id })`.
            // AJV reads `properties/<tag>` looking for `const` or `enum` and does not follow a
            // `$ref` to find one, so it refuses to compile the union at all. Restating the resolved
            // literal ALONGSIDE the `$ref` is validation-neutral: `$ref` has no special precedence
            // in 2020-12, both keywords apply, and they carry the same value by construction.
            const target = resolve(tagSchema);
            if (!target) continue;
            if (target.const !== undefined) tagSchema.const = target.const;
            else if (Array.isArray(target.enum)) tagSchema.enum = target.enum;
        }
    });
    return schemas;
}

/** Every object node in the component graph, parents before children. */
function visitSchemaNodes(value: unknown, visit: (node: JsonObject) => void): void {
    if (Array.isArray(value)) {
        for (const item of value) visitSchemaNodes(item, visit);
        return;
    }
    if (!isPlainObject(value)) return;
    visit(value);
    for (const item of Object.values(value)) visitSchemaNodes(item, visit);
}

/** The `$id` the whole component envelope is registered under, and the base of every `$ref` to it. */
const AJV_SCHEMA_ID = 'vertesia://openapi';

function getAjv(): Ajv2020 {
    if (ajvInstance) return ajvInstance;
    // `verbose` carries two things {@link collectIssues} needs and nothing else supplies: the schema
    // object that raised each error, which is the only unambiguous way to tell one union candidate
    // from another, and the value under evaluation, which is what a failed union is re-checked
    // against. Both are populated only when validation fails, and both are references rather than
    // copies.
    // `allowUnionTypes` because a few published components declare `type: [...]` on purpose:
    // `DurationValue` is `['string', 'number']` specifically so the generated Java client gets one
    // writable property instead of the unusable `AnyOfnumber` an `anyOf` produces. AJV's
    // `strictTypes` default of "log" reported that deliberate choice to its logger on every startup.
    // The default logger is `console`, so the notice left on stderr, where log collectors routinely
    // classify it as an error — turning a healthy design decision into recurring server error noise.
    const ajv = new Ajv2020({
        strictSchema: false,
        allErrors: true,
        discriminator: true,
        verbose: true,
        allowUnionTypes: true,
    });
    // Without this, AJV treats `format` as an annotation and ignores it, so a `date-time` property
    // would document a constraint nothing checks — the exact spec/enforcement gap this design is
    // meant to close.
    addFormats(ajv);
    ajv.addSchema({ $id: AJV_SCHEMA_ID, components: { schemas: toAjvComponents() } });
    ajvInstance = ajv;
    return ajv;
}

function getValidator(name: ApiComponentName): ValidateFunction {
    const cached = validators.get(name);
    if (cached) return cached;
    const validate = getAjv().compile({ $ref: `${AJV_SCHEMA_ID}${apiComponentRef(name)}` });
    validators.set(name, validate);
    return validate;
}

function additionalProperty(error: { params?: unknown }): string | undefined {
    // AJV writes "must NOT have additional properties" and puts the offending key in `params`,
    // so the message alone says a body is wrong without saying which property made it wrong.
    // Every other keyword names its subject already — `required` quotes the missing property,
    // `enum` and `type` describe the value in place — and this is the one a caller most often
    // trips, so it is the one worth spelling out rather than reformatting all of them.
    return (error.params as { additionalProperty?: string } | undefined)?.additionalProperty;
}

/**
 * One validation failure, with the undeclared property names kept AS NAMES.
 *
 * The structure exists because the rendered line cannot be taken apart again. Property names are
 * arbitrary JSON strings: `{"customer secret token": 1}` and `{"a, b": 1}` are both valid, so
 * neither a space nor a comma is a reliable separator once the names have been joined. Any consumer
 * that needs to shorten the list — the HTTP boundary does, the log does not — has to do it here,
 * on the array, where a name can be dropped whole.
 */
export interface ApiValidationIssue {
    /**
     * AJV's `instancePath` for the failing value, with `'/'` substituted for the root.
     *
     * Not quite a JSON Pointer: the pointer for a document root is the empty string, which reads as
     * a missing path in a message. `'/'` is a display sentinel, so treat this as human-facing rather
     * than as something to resolve against the payload.
     */
    path: string;
    /** AJV's own message, e.g. `must NOT have additional properties`. */
    message: string;
    /** Undeclared property names at {@link path}, in the order AJV reported them. */
    undeclared?: string[];
    /**
     * The union candidate this issue is a claim ABOUT, when it is not a fact about the value.
     *
     * Set on every issue produced by expanding a failed untagged `oneOf`/`anyOf` — see
     * {@link collectIssues}. Under such a union each candidate rejects the value for its own
     * reasons, most of which are irrelevant to the shape the value actually meant, so an issue
     * carrying a component must be read as "as a `<component>`, this is wrong" and never as
     * "this is wrong".
     *
     * Absent means the opposite and stronger thing: the issue holds against the component the
     * payload is being validated as, whatever candidate it turns out to be.
     */
    component?: string;
}

/**
 * The failures, with the undeclared properties a SINGLE schema reported at a given path gathered
 * into one issue, and each failed untagged union expanded per candidate.
 *
 * AJV reports `additionalProperties` per property, so a value carrying a whole foreign object — a
 * Mongoose document that reached the response mapper unmapped, say — produces one error per own key
 * and buries every other failure in the payload. Gathering is lossless: every name is kept, in the
 * order AJV found it. It is keyed by the schema that raised the error as well as the path, so two
 * candidates complaining at one path never merge into a single line. `schemaPath` will not do: a
 * `$ref`'d candidate resets it to `#/additionalProperties`, identical for every candidate. The
 * schema object itself is unambiguous, and `verbose: true` supplies it.
 *
 * `discriminator: true` narrows a TAGGED union to the one branch its tag names, so nothing below
 * applies to those. What is left is the unions with no tag: AJV runs the value against every
 * candidate and reports all of their failures, flat and unattributed. Read as facts they are
 * nonsense — for a condition branch `{ to, when }` with a malformed `when`, raw AJV says
 *
 *     /nodes/a/branches/0/when must be object                              <- BranchDefinition
 *     /nodes/a/branches/0 must have required property 'id'                 <- BranchNodeBranchDefinition
 *     /nodes/a/branches/0 must NOT have additional properties: to, when    <- BranchNodeBranchDefinition
 *     /nodes/a/branches/0 must match exactly one schema in oneOf
 *
 * where `to` and `when` are declared on `BranchDefinition` and only wrong for a candidate the value
 * never meant. Nothing in the error list says which claim belongs to which candidate, and the
 * candidates fail at DIFFERENT paths, so no rule based on the path can recover it.
 *
 * So the union is re-validated candidate by candidate, and each candidate's own failures are
 * attributed to it by name. That is exact rather than inferred, at the cost of one extra validation
 * per candidate — paid only on a response that is already failing:
 *
 *     /nodes/a/branches/0 must match exactly one schema in oneOf
 *     /nodes/a/branches/0/when as BranchDefinition: must be object
 *     /nodes/a/branches/0 as BranchNodeBranchDefinition: must have required property 'id'
 *     /nodes/a/branches/0 as BranchNodeBranchDefinition: must NOT have additional properties: to, when
 *
 * Expansion goes ONE level deep: a candidate's own errors are collected without expanding any union
 * nested inside it, which bounds the work and keeps the output readable.
 */
function collectIssues(validate: ValidateFunction): ApiValidationIssue[] {
    return toIssues(validate.errors ?? [], true);
}

function toIssues(errors: readonly ErrorObject[], expandUnions: boolean): ApiValidationIssue[] {
    const expansions = new Map<string, ApiValidationIssue[]>();
    if (expandUnions) {
        for (const error of errors) {
            if (error.keyword !== 'oneOf' && error.keyword !== 'anyOf') continue;
            const expanded = expandUnion(error);
            if (expanded) expansions.set(error.instancePath, expanded);
        }
    }
    /** Whether an expanded union already accounts for this error, making the raw form redundant. */
    const superseded = (error: ErrorObject): boolean => {
        for (const base of expansions.keys()) {
            if (error.instancePath === base || error.instancePath.startsWith(`${base}/`)) return true;
        }
        return false;
    };

    const issues: ApiValidationIssue[] = [];
    // Keyed by the raising schema, then by path: two candidates at one path stay separate, and one
    // schema's repeats at one path merge.
    const gathered = new Map<unknown, Map<string, { issue: ApiValidationIssue; names: Set<string> }>>();

    for (const error of errors) {
        const path = error.instancePath || '/';
        const message = error.message ?? 'is invalid';
        const expanded = expansions.get(error.instancePath);
        if (expanded && (error.keyword === 'oneOf' || error.keyword === 'anyOf')) {
            // The union's own line frames the candidates that follow it.
            issues.push({ path, message });
            issues.push(...expanded);
            continue;
        }
        if (superseded(error)) continue;

        const additional = additionalProperty(error);
        if (additional === undefined) {
            issues.push({ path, message });
            continue;
        }

        let byPath = gathered.get(error.parentSchema);
        if (!byPath) {
            byPath = new Map();
            gathered.set(error.parentSchema, byPath);
        }
        const existing = byPath.get(path);
        if (existing) {
            // One schema reporting the same name twice is not a second fact.
            if (!existing.names.has(additional)) {
                existing.names.add(additional);
                existing.issue.undeclared?.push(additional);
            }
            continue;
        }
        const issue: ApiValidationIssue = { path, message, undeclared: [additional] };
        byPath.set(path, { issue, names: new Set([additional]) });
        issues.push(issue);
    }
    return issues;
}

/**
 * One failed union, re-stated as what each candidate objected to.
 *
 * `undefined` when the union cannot be attributed exactly — a candidate that is not a `$ref` to a
 * registered component has no name to report it under, and a partly-named expansion would read as
 * though the unnamed candidate had no objection. The raw errors are kept in that case, which is what
 * AJV would have produced anyway.
 */
function expandUnion(error: ErrorObject): ApiValidationIssue[] | undefined {
    const parent = error.parentSchema;
    if (!isPlainObject(parent)) return undefined;
    const members = Array.isArray(parent.oneOf) ? parent.oneOf : Array.isArray(parent.anyOf) ? parent.anyOf : undefined;
    if (!members?.length) return undefined;

    const issues: ApiValidationIssue[] = [];
    for (const member of members) {
        const ref = isPlainObject(member) && typeof member.$ref === 'string' ? member.$ref : undefined;
        if (!ref?.startsWith(COMPONENT_REF_PREFIX)) return undefined;
        const validateMember = getAjv().getSchema(`${AJV_SCHEMA_ID}${ref}`);
        if (!validateMember) return undefined;
        // `verbose: true` puts the value under evaluation on the error, so the candidates are run
        // against exactly what the union saw.
        if (validateMember(error.data)) continue;
        const component = ref.slice(COMPONENT_REF_PREFIX.length);
        for (const issue of toIssues(validateMember.errors ?? [], false)) {
            issues.push({ ...issue, path: joinInstancePath(error.instancePath, issue.path), component });
        }
    }
    return issues.length > 0 ? issues : undefined;
}

/** Re-roots a candidate-relative path under the union's own path. */
function joinInstancePath(base: string, relative: string): string {
    if (relative === '/') return base || '/';
    return `${base}${relative}`;
}

/**
 * The complete rendering of one issue — every name, no budget.
 *
 * This is what gets logged. A caller-facing message renders from {@link ApiValidationIssue} itself
 * with a length limit rather than shortening this string; see `reportableErrors` in the enforcer.
 */
export function renderApiValidationIssue(issue: ApiValidationIssue): string {
    const head = renderApiValidationIssueHead(issue);
    return issue.undeclared?.length ? `${head}: ${issue.undeclared.join(', ')}` : head;
}

/**
 * Everything in a rendered issue except the property names: `<path> [as <component>]: <message>`.
 *
 * Exported because it is not the only renderer. A caller that has to bound the length of a message
 * cannot use {@link renderApiValidationIssue} — it emits every name — and has to rebuild the line
 * from {@link ApiValidationIssue} with its own budget for the names. Rebuilding the HEAD too is what
 * lets the two drift: when `component` was added, the bounded renderer at the HTTP boundary went on
 * concatenating path and message and silently dropped it, so callers were told
 * `must NOT have additional properties: to, when` with no sign it was one candidate's claim. There is
 * one definition of the head so that cannot happen again.
 */
export function renderApiValidationIssueHead(issue: ApiValidationIssue): string {
    return issue.component ? `${issue.path} as ${issue.component}: ${issue.message}` : `${issue.path} ${issue.message}`;
}

/** The failed branch of every validator here, so the two views cannot be built inconsistently. */
function invalidResult(validate: ValidateFunction): { valid: false; errors: string[]; issues: ApiValidationIssue[] } {
    const issues = collectIssues(validate);
    return { valid: false, errors: issues.map(renderApiValidationIssue), issues };
}

export type ValidateApiPayloadResult<T> =
    | { valid: true; data: T }
    /**
     * `errors` is the rendered form, complete and ready to log; `issues` is the same failures with
     * the property names still separable. Shorten from `issues`, never from `errors`.
     */
    | { valid: false; errors: string[]; issues: ApiValidationIssue[] };

/**
 * Validates an untyped request body against the component the endpoint publishes.
 *
 * Non-mutating by design. AJV's removal modes are never used here: the server would then accept a
 * body the published schema declares invalid, silently disagreeing with its own spec — and
 * `removeAdditional: 'all'` additionally empties freeform maps. An undeclared property is reported,
 * not deleted.
 *
 * The component type is handed back only on the `valid` branch, so a body missing required fields
 * cannot be typed as complete. What the caller does with a failure — reject, or log and continue —
 * is the endpoint's policy, not this function's.
 */
export function validateApiRequest<N extends ApiComponentName>(
    name: N,
    value: unknown,
): ValidateApiPayloadResult<ApiComponentType<N>> {
    const validate = getValidator(name);
    if (validate(value)) {
        return { valid: true, data: value as ApiComponentType<N> };
    }
    return invalidResult(validate);
}

/**
 * Validates an already-mapped response against the component it is published as.
 *
 * Separate from {@link pruneAndValidateApiResponse} because a resource mapper has already produced
 * the wire shape: there is nothing to prune, and pruning would only mask a mapper bug. Use this at
 * the response boundary to detect drift between what the mapper builds and what the spec promises.
 */
export function validateApiResponse<N extends ApiComponentName>(
    name: N,
    value: unknown,
): ValidateApiPayloadResult<ApiComponentType<N>> {
    const validate = getValidator(name);
    if (validate(value)) {
        return { valid: true, data: value as ApiComponentType<N> };
    }
    return invalidResult(validate);
}

/**
 * Best-effort normalization of a response payload towards the fields its published component
 * declares. Use this on the response path INSTEAD of an AJV removal mode, which would empty
 * freeform maps such as `Account.feature_flags`.
 *
 * NOT a secret-removal boundary. Ambiguous schema shapes pass values through untouched — see
 * {@link pruneToSchema} and check a component with {@link findUnprunablePaths} before treating its
 * output as closed. Fields that must never ship still need an explicit response mapper.
 *
 * Never throws and never rejects: an undocumented field is server-side drift, and failing the
 * response would punish the caller for it.
 *
 * Takes a value the caller has already typed as the component. Pruning only REMOVES undeclared
 * extras, so a conforming input yields a conforming output and the return type is honest. It does
 * NOT validate, which is why it cannot accept `unknown` — narrowing a payload that is missing
 * required fields would hand TypeScript a complete `Account` that does not exist at runtime. Use
 * {@link pruneAndValidateApiResponse} when the payload's shape is not already established.
 *
 * Request validation stays separate and non-mutating — pruning a request would make the server
 * silently disagree with the permissive schema it publishes.
 */
export function pruneApiResponse<N extends ApiComponentName>(name: N, value: ApiComponentType<N>): ApiComponentType<N> {
    return pruneToSchema(value, { $ref: apiComponentRef(name) }, ApiSchemaComponents) as ApiComponentType<N>;
}

export type PruneAndValidateResult<T> =
    | { valid: true; data: T }
    | { valid: false; data: unknown; errors: string[]; issues: ApiValidationIssue[] };

/**
 * Prunes an untyped payload and validates the result against the published component.
 *
 * The only sound entry point for a payload of unknown shape: the component type is handed back
 * exclusively on the `valid` branch, so a document missing required fields cannot be typed as
 * complete. On failure the pruned value is still returned — the caller decides whether to ship it
 * and log, or fail — which keeps the "never turn drift into a 500" property a policy choice rather
 * than something baked in here.
 *
 */
export function pruneAndValidateApiResponse<N extends ApiComponentName>(
    name: N,
    value: unknown,
): PruneAndValidateResult<ApiComponentType<N>> {
    const pruned = pruneToSchema(value, { $ref: apiComponentRef(name) }, ApiSchemaComponents);
    const validate = getValidator(name);
    if (validate(pruned)) {
        return { valid: true, data: pruned as ApiComponentType<N> };
    }
    return { ...invalidResult(validate), data: pruned };
}

/**
 * Paths inside a component where pruning cannot narrow. Empty means no STRUCTURAL gaps for
 * schema-conforming input — see {@link findUnprunablePaths} for why that is weaker than "nothing
 * can escape". Anything listed needs an explicit response mapper.
 */
export function findUnprunableApiPaths(name: ApiComponentName): string[] {
    return findUnprunablePaths({ $ref: apiComponentRef(name) }, ApiSchemaComponents);
}

/**
 * Normalizes raw query or header text into the value a component describes.
 *
 * Binds {@link normalizeParameters} to {@link ApiSchemaComponents} — the same objects the OpenAPI
 * document publishes and {@link validateApiRequest} compiles. That is what keeps the published
 * parameter and the enforced one the same declaration: the scanner expands this component's
 * properties into `in: query` parameters, and the coercion below is decided by those same property
 * schemas, so neither can be changed without changing the other.
 *
 * Validate the result with {@link validateApiRequest}, which is non-coercing: everything type-related
 * has already happened here, so a value this could not coerce is reported against the published
 * schema rather than by a second rule.
 */
export function normalizeApiParameters(
    name: ApiComponentName,
    raw: RawApiParameters,
    location: ApiParameterLocation,
): NormalizedApiParameters {
    return normalizeParameters(name, raw, location, ApiSchemaComponents[name], ApiSchemaComponents);
}
