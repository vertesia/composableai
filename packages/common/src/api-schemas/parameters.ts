/**
 * Query and header normalization, driven by the same component the spec publishes.
 *
 * Bodies arrive as JSON, so a body validates against its component directly and coercion is
 * forbidden — the server must not accept a payload its own schema calls invalid. Parameters have no
 * such luxury: a query string carries only text, so `?limit=25` is the string `'25'` where the
 * published parameter says `type: integer`. Something has to map one to the other, and the only
 * honest source for that mapping is the schema being published.
 *
 * So this module reads the component, decides what each declared parameter should become, and builds
 * a NEW object. Two properties follow from that and both matter:
 *
 * - The request is never mutated. Koa memoizes `ctx.query` per query string and hands every later
 *   reader the same object, so coercing in place would silently retype values for middleware and
 *   handlers that never opted in — and `ctx.headers` is Node's own object.
 * - Coercion is explicit rather than AJV's `coerceTypes`. The registry compiles one AJV
 *   configuration for bodies and parameters alike, so turning coercion on for parameters would have
 *   changed body policy too; and `coerceTypes` has its own rules (`''` becomes 0, `[]` becomes
 *   `null`) that are neither published nor easy to predict. Everything below is a stated rule with a
 *   test.
 *
 * What is NOT done here is validation. This produces a value; the caller validates it against the
 * same component with the same validator a body uses, so a value that cannot be coerced is reported
 * by the component's own schema rather than by a second error message that could disagree with it.
 */

import { type JsonObject, resolveSchemaRef } from './adapter.js';

/** Where a parameter arrives. Decides name matching, and nothing else. */
export type ApiParameterLocation = 'query' | 'header';

/**
 * Parameters as the transport presents them: text, possibly repeated, possibly absent.
 *
 * Matches both `ctx.query` (Koa parses with `URLSearchParams`, so a repeated key is an array and a
 * single one is a string) and `ctx.headers` (Node lowercases names, joins most duplicates with
 * `, `, and arrays only `set-cookie`).
 */
export interface RawApiParameters {
    readonly [name: string]: string | string[] | undefined;
}

export interface NormalizedApiParameters {
    /**
     * The copy to validate: declared parameters only, coerced towards their published types, with
     * absent ones omitted so the component's own `required` decides whether that is allowed.
     */
    value: Record<string, unknown>;
    /**
     * Query keys the component does not declare, in arrival order.
     *
     * Always empty for headers, structurally rather than by convention: every request carries headers
     * no endpoint declares — `accept`, `user-agent`, tracing — so "undeclared" describes nothing
     * there, and a caller that rejected on this list could never reject a standard header by mistake.
     */
    undeclared: string[];
}

/** What a declared parameter's published schema says its wire text should become. */
type ParameterTarget =
    | { kind: 'string' | 'number' | 'integer' | 'boolean' | 'opaque' }
    | {
          kind: 'array';
          items: ParameterTarget;
          /**
           * Whether one occurrence carrying commas is read as several values.
           *
           * True only for an array of a string `enum` none of whose members contains a comma — see
           * {@link commaSafeEnum} for why that is the whole condition.
           */
          commaDelimited: boolean;
      };

/**
 * Depth cap for target resolution.
 *
 * `resolveSchemaRef` detects a cycle within one chain, but `items` starts a fresh chain each time, so
 * a component whose array items reference it back would recurse forever. Parameters are flat text;
 * anything approaching this depth is a declaration mistake, and stopping at `opaque` leaves the value
 * untouched for the component to reject.
 */
const MAX_TARGET_DEPTH = 8;

/**
 * Text this module maps to a JSON number.
 *
 * Deliberately narrower than `Number()`, which accepts several strings that are not numbers in any
 * useful sense: `''` becomes 0, `' 1'` and `'\n1'` become 1, `'0x10'` becomes 16, `'Infinity'`
 * becomes a value no JSON Schema `number` can hold. Each of those would let the server read a
 * parameter as a value the published schema never describes.
 *
 * Deliberately WIDER than JSON's own number grammar, which rejects `'01'`, `'+1'`, `'1.'` and
 * `'.5'`. Those denote one number unambiguously and match the handlers' existing `parseInt`/`Number`
 * behavior; the remaining strictness applies only where the text is genuinely not a number.
 *
 * Anything rejected here is left as the original string, which the component then reports as a type
 * error naming the parameter.
 */
const NUMERIC_TEXT = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

function isPlainObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The declared type of a schema node, ignoring `null`.
 *
 * `type` may be a list — zod emits `['string', 'null']` for some nullable shapes — and nullability is
 * not a coercion target: what a nullable string parameter needs is the string mapping, with the
 * component deciding whether `null` is also allowed.
 */
function declaredType(schema: JsonObject): string | undefined {
    const type = schema.type;
    if (typeof type === 'string') return type;
    if (Array.isArray(type)) {
        return type.find((entry): entry is string => typeof entry === 'string' && entry !== 'null');
    }
    return undefined;
}

function unionVariants(schema: JsonObject): JsonObject[] | undefined {
    for (const keyword of ['anyOf', 'oneOf'] as const) {
        const variants = schema[keyword];
        if (Array.isArray(variants)) {
            const objects = variants.filter(isPlainObject);
            if (objects.length > 0) return objects;
        }
    }
    return undefined;
}

/**
 * What one declared parameter's text should be coerced to.
 *
 * The union rule is the one worth explaining. A `string | string[]` parameter — which this API has 29
 * of — is published by the scanner as a single `type: array` parameter with `explode: true`, because
 * that is the only serialization OpenAPI has for repeated values. Preferring the array variant here
 * makes the runtime agree with that published shape: one occurrence normalizes to a one-element
 * array, exactly as `explode: true` describes. Reading the scalar variant instead would mean the spec
 * promised an array and the handler received a bare string.
 */
function parameterTarget(
    schema: unknown,
    components: Readonly<Record<string, JsonObject>>,
    depth = 0,
): ParameterTarget {
    if (!isPlainObject(schema) || depth >= MAX_TARGET_DEPTH) return { kind: 'opaque' };
    const resolved = resolveSchemaRef(schema, components) ?? schema;

    const variants = unionVariants(resolved);
    if (variants) {
        const arrayVariant = variants.find((variant) => {
            const target = parameterTarget(variant, components, depth + 1);
            return target.kind === 'array';
        });
        if (arrayVariant) return parameterTarget(arrayVariant, components, depth + 1);
        // No array variant, so the parameter carries a single value. `null` is not a coercion target,
        // so the first variant that names a real type decides — a nullable enum coerces as its enum.
        for (const variant of variants) {
            const target = parameterTarget(variant, components, depth + 1);
            if (target.kind !== 'opaque') return target;
        }
        return { kind: 'opaque' };
    }

    const type = declaredType(resolved);
    if (type === 'array') {
        return {
            kind: 'array',
            items: parameterTarget(resolved.items, components, depth + 1),
            commaDelimited: commaSafeEnum(resolved.items, components),
        };
    }
    if (type === 'number' || type === 'integer' || type === 'boolean' || type === 'string') {
        return { kind: type };
    }
    // An enum with no `type`, a bare `{}`, an unresolvable `$ref`: nothing to coerce towards, so the
    // text passes through and the component decides.
    return { kind: 'opaque' };
}

/**
 * Whether an array parameter's items are an enum whose members can never contain a comma.
 *
 * This is the entire condition under which `?status=pending,completed` is read as two values, and the
 * narrowness is the point. `explode: true` — which is what the document publishes for every one of
 * these parameters — describes repeated keys and says nothing about commas, so splitting is strictly
 * something the server accepts beyond what it promises. Doing that for arrays in general would be
 * wrong: a `?name=` or `?q=` filter can legitimately carry a comma inside one value, and splitting it
 * would silently turn one filter into two with no way for the caller to escape it.
 *
 * An enum has no such ambiguity. Its members are a closed published set, so if none of them contains a
 * comma then text that does contain one cannot be a member — the request fails today. Splitting can
 * therefore only turn a request that was rejected into one that is either accepted or rejected by the
 * same enum; no request that validated before changes meaning.
 *
 * The compatibility this exists for is not hypothetical. `TaskApi.list` builds its `status` parameter
 * as `query.status.join(',')`, so every SDK in the field sends the comma form, and enforcing the
 * published component without this would 400 our own client's multi-status listing.
 */
function commaSafeEnum(items: unknown, components: Readonly<Record<string, JsonObject>>): boolean {
    if (!isPlainObject(items)) return false;
    const resolved = resolveSchemaRef(items, components) ?? items;
    if (declaredType(resolved) !== 'string') return false;
    const values = resolved.enum;
    return (
        Array.isArray(values) &&
        values.length > 0 &&
        values.every((value) => typeof value === 'string' && !value.includes(','))
    );
}

function coerceScalar(text: string, target: ParameterTarget): unknown {
    switch (target.kind) {
        case 'number':
        case 'integer': {
            // `integer` coerces to a number and stops. AJV then reports a non-integral value against
            // the published `type: integer`, so `?limit=1.5` is rejected by the schema rather than
            // silently truncated to 1 the way `parseInt` would.
            if (!NUMERIC_TEXT.test(text)) return text;
            const value = Number(text);
            return Number.isFinite(value) ? value : text;
        }
        case 'boolean':
            // The two spellings a JSON Schema `boolean` can hold, plus the numeric pair. `'1'` is not
            // an invention: the client SDK emits it (`getArtifactUrl` sends `url=1`) and the endpoint
            // descriptions document it, so rejecting it would reject our own published usage. `'yes'`
            // and a bare `?flag=` stay text and are rejected by the component — those really would be
            // guesses about what the caller meant.
            if (text === 'true' || text === '1') return true;
            if (text === 'false' || text === '0') return false;
            return text;
        default:
            return text;
    }
}

/**
 * Maps one parameter's raw text to the value its published schema describes.
 *
 * The scalar-with-repeats case is a deliberate rejection rather than a pick. `?level=account&level=project`
 * on a parameter published as a single string arrives as an array, and it is handed on as an array so
 * the component reports a type error. Choosing last-wins — what several ad-hoc handlers do today —
 * would make the server accept a request its own contract does not describe, and nothing published
 * says which occurrence wins.
 */
function coerceParameter(raw: string | string[], target: ParameterTarget): unknown {
    if (target.kind === 'array') {
        // `explode: true`: one occurrence is a one-element array.
        const occurrences = Array.isArray(raw) ? raw : [raw];
        // Splitting per occurrence rather than after joining, so the two spellings compose:
        // `?status=pending,completed&status=cancelled` is the same three values as three keys.
        const items = target.commaDelimited ? occurrences.flatMap((item) => item.split(',')) : occurrences;
        return items.map((item) => coerceScalar(item, target.items));
    }
    if (Array.isArray(raw)) return raw;
    return coerceScalar(raw, target);
}

/**
 * The object schema a parameter component must be, resolved through any reference chain.
 *
 * A component that is not an object cannot be expanded into named parameters — the scanner would not
 * publish one either — so this is a declaration bug, and it throws rather than degrading to "validate
 * nothing". Reaching the handler with an unchecked query while the spec advertised a checked one is
 * the failure the whole arrangement exists to prevent.
 */
function parameterObjectSchema(
    component: string,
    schema: JsonObject | undefined,
    components: Readonly<Record<string, JsonObject>>,
): { properties: JsonObject; required: ReadonlySet<string> } {
    const resolved = schema ? resolveSchemaRef(schema, components) : undefined;
    const properties = resolved?.properties;
    if (!resolved || declaredType(resolved) !== 'object' || !isPlainObject(properties)) {
        throw new Error(
            `Component '${component}' is declared as a query or header contract, but it is not an object ` +
                'schema with properties, so it cannot be expanded into named parameters. Declare it as an ' +
                'object whose properties are the parameters.',
        );
    }
    const required = new Set(
        Array.isArray(resolved.required)
            ? resolved.required.filter((name): name is string => typeof name === 'string')
            : [],
    );
    return { properties, required };
}

/**
 * Builds the value to validate for one parameter slot.
 *
 * Header names match case-insensitively, which is not a nicety: HTTP field names are
 * case-insensitive by RFC 9110 and Node has already lowercased everything on the way in, so a
 * component declaring `X-Request-Id` would never match a real request without this. The output is
 * keyed by the DECLARED spelling, because that is the name the component validates and the spec
 * publishes.
 */
export function normalizeParameters(
    component: string,
    raw: RawApiParameters,
    location: ApiParameterLocation,
    schema: JsonObject | undefined,
    components: Readonly<Record<string, JsonObject>>,
): NormalizedApiParameters {
    const { properties } = parameterObjectSchema(component, schema, components);
    const caseInsensitive = location === 'header';

    const entries: Array<[string, unknown]> = [];
    const matched = new Set<string>();
    for (const [name, propertySchema] of Object.entries(properties)) {
        const key = caseInsensitive ? name.toLowerCase() : name;
        // `hasOwn` rather than a truthiness check: an inherited member would otherwise be read as a
        // parameter, so a component declaring `constructor` or `toString` would receive a function.
        if (!Object.hasOwn(raw, key)) continue;
        const value = raw[key];
        matched.add(key);
        // An explicitly `undefined` value is the transport saying the parameter never arrived. Omitting
        // it leaves requiredness to the component instead of validating `undefined` against a type.
        if (value === undefined) continue;
        entries.push([name, coerceParameter(value, parameterTarget(propertySchema, components))]);
    }

    return {
        // `fromEntries` rather than assignment, so a component that declares `__proto__` gets an own
        // property instead of reassigning the copy's prototype.
        value: Object.fromEntries(entries),
        undeclared: caseInsensitive ? [] : Object.keys(raw).filter((key) => !matched.has(key)),
    };
}
