/**
 * Post-extraction checks of model output against a content type's JSON schema.
 *
 * One off-schema value (an enum spelled `nonreimbursable` instead of `non_reimbursable`) drops a document
 * from every filter and count on that field, so nothing the schema rejects is stored silently:
 *
 * - {@link normalizeExtractedProperties} rewrites near-misses deterministically (enum case/separators/accents,
 *   numbers and booleans given as strings, dates in other spellings, the one identifier matching a `pattern`
 *   inside a longer phrase) and reports what it could not fix. Empty values (`null`, `""`, whitespace, `[]`,
 *   `{}`, placeholders such as `"N/A"`) are always omitted, so "no value" has a single stored representation:
 *   an absent property.
 * - {@link findDerivationGaps} finds properties left empty although their schema says how to derive them from
 *   properties that were filled (`x-derived-from`, or a description naming filled properties with a derivation
 *   cue such as "if not stated" or "plus").
 *
 * Both are pure and cheap: the caller makes one extra model call only when either reports something.
 */
import { type ExtractionReport, isExtractableSchemaNode, X_DERIVED_FROM } from '@vertesia/common';

type SchemaNode = Record<string, unknown>;

export interface ExtractionNormalizationEntry {
    path: string;
    rule: 'enum' | 'type' | 'format' | 'pattern' | 'wrap' | 'unknown_property';
}

export interface ExtractionInvalidValue {
    path: string;
    /** Top-level property holding the value: the unit a repair call re-extracts. */
    field: string;
    error: string;
    value: unknown;
}

export interface NormalizeExtractionResult {
    /** Conforming properties: normalized values kept, empty and invalid values omitted. */
    value: Record<string, unknown>;
    normalized: ExtractionNormalizationEntry[];
    invalid: ExtractionInvalidValue[];
}

export interface DerivationGap {
    field: string;
    /** Filled sibling properties the field can be derived from. */
    sources: string[];
}

interface WalkContext {
    root: unknown;
    normalized: ExtractionNormalizationEntry[];
    invalid: ExtractionInvalidValue[];
}

type WalkResult = { ok: true; value: unknown } | { ok: false; error: string };

const MAX_REF_DEPTH = 32;
const PLACEHOLDERS = new Set(['null', 'undefined', 'n/a']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function resolveRef(node: unknown, root: unknown): unknown {
    let current = node;
    for (let depth = 0; depth < MAX_REF_DEPTH && isPlainObject(current) && typeof current.$ref === 'string'; depth++) {
        const ref = current.$ref;
        if (!ref.startsWith('#/')) return current;
        let target: unknown = root;
        for (const raw of ref.slice(2).split('/')) {
            const segment = raw.replace(/~1/g, '/').replace(/~0/g, '~');
            target = isPlainObject(target) ? target[segment] : undefined;
        }
        if (target === undefined) return current;
        current = target;
    }
    return current;
}

function childPath(parent: string, key: string): string {
    return parent ? `${parent}.${key}` : key;
}

function topLevelField(path: string): string {
    const match = /^[^.[]+/.exec(path);
    return match ? match[0] : path;
}

/** Lowercase, accents removed, everything but letters and digits dropped: `Non-Reimbursable` → `nonreimbursable`. */
export function canonicalToken(value: string): string {
    return value
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]/gu, '');
}

function describeValue(value: unknown): string {
    const text = typeof value === 'string' ? JSON.stringify(value) : JSON.stringify(value ?? null);
    return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

function schemaTypes(node: SchemaNode): string[] {
    const declared = node.type;
    const types = Array.isArray(declared)
        ? declared.filter((t): t is string => typeof t === 'string')
        : typeof declared === 'string'
          ? [declared]
          : [];
    const nonNull = types.filter((t) => t !== 'null');
    if (nonNull.length > 0) return nonNull;
    if (types.length > 0) return types;
    if (isPlainObject(node.properties) || isPlainObject(node.additionalProperties)) return ['object'];
    if (node.items !== undefined) return ['array'];
    return [];
}

function matchesEnumMember(
    value: unknown,
    members: unknown[],
): { ok: true; value: unknown; rewritten: boolean } | null {
    for (const member of members) {
        if (member === value) return { ok: true, value: member, rewritten: false };
    }
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return null;
    const token = canonicalToken(String(value));
    if (!token) return null;
    const candidates = members.filter(
        (member) =>
            (typeof member === 'string' || typeof member === 'number' || typeof member === 'boolean') &&
            canonicalToken(String(member)) === token,
    );
    return candidates.length === 1 ? { ok: true, value: candidates[0], rewritten: true } : null;
}

// ---------------------------------------------------------------- dates

const MONTHS: Record<string, number> = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12,
};

function monthNumber(name: string): number | undefined {
    const lower = name.toLowerCase();
    if (lower.length < 3) return undefined;
    const month = MONTHS[lower.slice(0, 3)];
    // Reject words that merely start like a month ("marketing"): accept the abbreviation, "sept", or the full name.
    if (!month) return undefined;
    const full = [
        'january',
        'february',
        'march',
        'april',
        'may',
        'june',
        'july',
        'august',
        'september',
        'october',
        'november',
        'december',
    ][month - 1];
    return lower.length === 3 || lower === 'sept' || full === lower ? month : undefined;
}

function isoDate(year: number, month: number, day: number): string | undefined {
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1000 || year > 9999) return undefined;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        return undefined;
    }
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

type DateParse = { ok: true; value: string } | { ok: false; error: string };

/** Unambiguous date spellings to `YYYY-MM-DD`. A numeric day/month order that cannot be told apart is an error. */
export function normalizeDate(input: string): DateParse {
    const text = input.trim().replace(/\s+/g, ' ');
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(text);
    if (m) {
        const date = isoDate(Number(m[1]), Number(m[2]), Number(m[3]));
        return date ? { ok: true, value: date } : { ok: false, error: `${describeValue(input)} is not a valid date` };
    }
    m = /^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/.exec(text);
    if (m) {
        const date = isoDate(Number(m[1]), Number(m[2]), Number(m[3]));
        if (date) return { ok: true, value: date };
    }
    m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
    if (m) {
        const a = Number(m[1]);
        const b = Number(m[2]);
        const year = Number(m[3]);
        let date: string | undefined;
        if (a === b || (a > 12 && b <= 12)) date = isoDate(year, b, a);
        else if (b > 12 && a <= 12) date = isoDate(year, a, b);
        else {
            return {
                ok: false,
                error: `${describeValue(input)} is ambiguous (day and month order unknown): write it as YYYY-MM-DD`,
            };
        }
        if (date) return { ok: true, value: date };
    }
    // "September 10, 2025", "Wednesday, Sept. 10th 2025"
    m = /^(?:[A-Za-z]+,? )?([A-Za-z]+)\.? (\d{1,2})(?:st|nd|rd|th)?,? (\d{4})$/.exec(text);
    if (m) {
        const month = monthNumber(m[1]);
        const date = month ? isoDate(Number(m[3]), month, Number(m[2])) : undefined;
        if (date) return { ok: true, value: date };
    }
    // "10 September 2025", "10th of Sept. 2025"
    m = /^(\d{1,2})(?:st|nd|rd|th)? (?:of )?([A-Za-z]+)\.?,? (\d{4})$/.exec(text);
    if (m) {
        const month = monthNumber(m[2]);
        const date = month ? isoDate(Number(m[3]), month, Number(m[1])) : undefined;
        if (date) return { ok: true, value: date };
    }
    return { ok: false, error: `${describeValue(input)} is not a date in the form YYYY-MM-DD` };
}

/** RFC 3339 date-time; a missing offset becomes `Z` and missing seconds `:00`, as the extraction prompt asks. */
export function normalizeDateTime(input: string): DateParse {
    const text = input.trim();
    const m = /^(\d{4}-\d{2}-\d{2})[Tt ](\d{2}:\d{2})(:\d{2}(?:\.\d+)?)?\s*([Zz]|[+-]\d{2}:?\d{2})?$/.exec(text);
    if (m) {
        const offset = (m[4] ?? 'Z').toUpperCase();
        const normalizedOffset = /^[+-]\d{4}$/.test(offset) ? `${offset.slice(0, 3)}:${offset.slice(3)}` : offset;
        const value = `${m[1]}T${m[2]}${m[3] ?? ':00'}${normalizedOffset}`;
        if (isoDate(...(m[1].split('-').map(Number) as [number, number, number])) && !Number.isNaN(Date.parse(value))) {
            return { ok: true, value };
        }
        return { ok: false, error: `${describeValue(input)} is not a valid date-time` };
    }
    const date = normalizeDate(text);
    if (date.ok && !/[T ]\d/.test(text)) return { ok: true, value: `${date.value}T00:00:00Z` };
    return { ok: false, error: `${describeValue(input)} is not an RFC 3339 date-time` };
}

// ---------------------------------------------------------------- scalars

function compilePattern(pattern: string): RegExp | undefined {
    try {
        return new RegExp(pattern, 'u');
    } catch {
        try {
            return new RegExp(pattern);
        } catch {
            return undefined;
        }
    }
}

/**
 * When a value fails its `pattern`, keep the one substring that matches it: `"Agreement No. 37779, dated 9/10/2025"`
 * with `pattern: "^\\d{5}$"` becomes `"37779"`. Zero or several distinct matches leave the value invalid.
 */
function extractPatternMatch(value: string, pattern: string, full: RegExp): string | undefined {
    const core = pattern.replace(/^\^/, '').replace(/(?<!\\)\$$/, '');
    let search: RegExp;
    try {
        search = new RegExp(`(?<![\\p{L}\\p{N}])(?:${core})(?![\\p{L}\\p{N}])`, 'gu');
    } catch {
        try {
            search = new RegExp(`(?<![A-Za-z0-9])(?:${core})(?![A-Za-z0-9])`, 'g');
        } catch {
            return undefined;
        }
    }
    const matches = new Set<string>();
    for (const match of value.matchAll(search)) {
        if (match[0] && full.test(match[0])) matches.add(match[0]);
    }
    return matches.size === 1 ? [...matches][0] : undefined;
}

function walkString(value: string, node: SchemaNode, path: string, ctx: WalkContext): WalkResult {
    let text = value.trim();
    const format = typeof node.format === 'string' ? node.format : undefined;
    if (format === 'date' || format === 'date-time') {
        const parsed = format === 'date' ? normalizeDate(text) : normalizeDateTime(text);
        if (!parsed.ok) return parsed;
        if (parsed.value !== text) ctx.normalized.push({ path, rule: 'format' });
        text = parsed.value;
    }
    if (typeof node.pattern === 'string') {
        const regex = compilePattern(node.pattern);
        if (regex && !regex.test(text)) {
            const extracted = extractPatternMatch(text, node.pattern, regex);
            if (extracted === undefined) {
                return { ok: false, error: `${describeValue(value)} does not match the pattern ${node.pattern}` };
            }
            ctx.normalized.push({ path, rule: 'pattern' });
            text = extracted;
        }
    }
    return { ok: true, value: text };
}

function parseNumber(value: string): number | undefined {
    const text = value
        .trim()
        .replace(/^(?:USD|EUR|GBP|CAD|AUD)\s*/i, '')
        .replace(/\s*(?:USD|EUR|GBP|CAD|AUD)$/i, '')
        .replace(/^[$€£¥]\s*/, '')
        .replace(/^([+-])[$€£¥]\s*/, '$1');
    if (!/^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$|^[+-]?\.\d+$/.test(text)) return undefined;
    const parsed = Number(text.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : undefined;
}

function walkTyped(value: unknown, type: string, node: SchemaNode, path: string, ctx: WalkContext): WalkResult {
    switch (type) {
        case 'string':
            if (typeof value === 'string') return walkString(value, node, path, ctx);
            if (typeof value === 'number' || typeof value === 'boolean') {
                ctx.normalized.push({ path, rule: 'type' });
                return walkString(String(value), node, path, ctx);
            }
            return { ok: false, error: `${describeValue(value)} is not a string` };
        case 'number':
        case 'integer': {
            let number: number | undefined;
            if (typeof value === 'number' && Number.isFinite(value)) number = value;
            else if (typeof value === 'string') {
                number = parseNumber(value);
                if (number !== undefined) ctx.normalized.push({ path, rule: 'type' });
            }
            if (number === undefined) return { ok: false, error: `${describeValue(value)} is not a number` };
            if (type === 'integer' && !Number.isInteger(number)) {
                return { ok: false, error: `${describeValue(value)} is not an integer` };
            }
            return { ok: true, value: number };
        }
        case 'boolean': {
            if (typeof value === 'boolean') return { ok: true, value };
            const token = typeof value === 'string' ? value.trim().toLowerCase() : undefined;
            if (token === 'true' || token === 'yes') {
                ctx.normalized.push({ path, rule: 'type' });
                return { ok: true, value: true };
            }
            if (token === 'false' || token === 'no') {
                ctx.normalized.push({ path, rule: 'type' });
                return { ok: true, value: false };
            }
            return { ok: false, error: `${describeValue(value)} is not a boolean` };
        }
        case 'array':
            return walkArray(value, node, path, ctx);
        case 'object':
            return walkObject(value, node, path, ctx);
        default:
            return { ok: true, value };
    }
}

function jsonType(value: unknown): string {
    if (Array.isArray(value)) return 'array';
    if (value === null) return 'null';
    if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
    return typeof value;
}

// ---------------------------------------------------------------- structure

function isEmptyScalar(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed === '' || PLACEHOLDERS.has(trimmed.toLowerCase());
    }
    return false;
}

/** Values with no schema: kept as they are, minus empty strings, nulls and empty containers. */
function cleanUntyped(value: unknown): unknown {
    if (isEmptyScalar(value)) return undefined;
    if (typeof value === 'string') return value.trim();
    if (Array.isArray(value)) {
        const items = value.map(cleanUntyped).filter((item) => item !== undefined);
        return items.length > 0 ? items : undefined;
    }
    if (isPlainObject(value)) {
        const entries = Object.entries(value)
            .map(([key, item]) => [key, cleanUntyped(item)] as const)
            .filter(([, item]) => item !== undefined);
        return entries.length > 0 ? Object.fromEntries(entries) : undefined;
    }
    return value;
}

function walkArray(value: unknown, node: SchemaNode, path: string, ctx: WalkContext): WalkResult {
    let items: unknown[];
    if (Array.isArray(value)) items = value;
    else {
        ctx.normalized.push({ path, rule: 'wrap' });
        items = [value];
    }
    const itemSchema = isPlainObject(node.items) ? node.items : undefined;
    const result: unknown[] = [];
    items.forEach((item, index) => {
        const itemPath = `${path}[${index}]`;
        const walked = itemSchema
            ? walk(item, itemSchema, itemPath, ctx)
            : { ok: true as const, value: cleanUntyped(item) };
        if (!walked.ok) {
            ctx.invalid.push({ path: itemPath, field: topLevelField(itemPath), error: walked.error, value: item });
        } else if (walked.value !== undefined) {
            result.push(walked.value);
        }
    });
    return { ok: true, value: result.length > 0 ? result : undefined };
}

function walkObject(value: unknown, node: SchemaNode, path: string, ctx: WalkContext): WalkResult {
    if (!isPlainObject(value)) return { ok: false, error: `${describeValue(value)} is not an object` };
    const properties = isPlainObject(node.properties) ? node.properties : {};
    const additional = node.additionalProperties;
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
        const propPath = childPath(path, key);
        let walked: WalkResult;
        if (key in properties) {
            walked = walk(item, properties[key], propPath, ctx);
        } else if (additional === false) {
            if (!isEmptyScalar(item)) ctx.normalized.push({ path: propPath, rule: 'unknown_property' });
            continue;
        } else if (isPlainObject(additional)) {
            walked = walk(item, additional, propPath, ctx);
        } else {
            walked = { ok: true, value: cleanUntyped(item) };
        }
        if (!walked.ok) {
            ctx.invalid.push({ path: propPath, field: topLevelField(propPath), error: walked.error, value: item });
        } else if (walked.value !== undefined) {
            result[key] = walked.value;
        }
    }
    return { ok: true, value: Object.keys(result).length > 0 ? result : undefined };
}

function walkUnion(value: unknown, branches: unknown[], path: string, ctx: WalkContext): WalkResult {
    let best: { result: WalkResult; trial: WalkContext } | undefined;
    let firstError: string | undefined;
    for (const branch of branches) {
        const resolved = resolveRef(branch, ctx.root);
        if (isPlainObject(resolved) && resolved.type === 'null' && Object.keys(resolved).length === 1) continue;
        const trial: WalkContext = { ...ctx, normalized: [], invalid: [] };
        const result = walk(value, branch, path, trial);
        if (!result.ok) {
            firstError ??= result.error;
            continue;
        }
        const score = trial.invalid.length * 1000 + trial.normalized.length;
        const bestScore = best ? best.trial.invalid.length * 1000 + best.trial.normalized.length : Infinity;
        if (score < bestScore) best = { result, trial };
        if (score === 0) break;
    }
    if (!best) return { ok: false, error: firstError ?? `${describeValue(value)} matches none of the allowed shapes` };
    ctx.normalized.push(...best.trial.normalized);
    ctx.invalid.push(...best.trial.invalid);
    return best.result;
}

function walk(value: unknown, schema: unknown, path: string, ctx: WalkContext): WalkResult {
    const node = resolveRef(schema, ctx.root);
    if (!isPlainObject(node)) return { ok: true, value: cleanUntyped(value) };

    const members = Array.isArray(node.enum) ? node.enum : 'const' in node ? [node.const] : undefined;
    if (members) {
        const exact = value === null ? null : matchesEnumMember(value, members);
        if (exact) {
            if (exact.rewritten) ctx.normalized.push({ path, rule: 'enum' });
            return { ok: true, value: exact.value };
        }
        if (isEmptyScalar(value)) return { ok: true, value: undefined };
        const allowed = members.map((member) => describeValue(member)).join(', ');
        return { ok: false, error: `${describeValue(value)} is not one of the allowed values: ${allowed}` };
    }

    if (isEmptyScalar(value)) return { ok: true, value: undefined };

    const union = Array.isArray(node.anyOf) ? node.anyOf : Array.isArray(node.oneOf) ? node.oneOf : undefined;
    if (union) return walkUnion(value, union, path, ctx);

    const types = schemaTypes(node);
    if (types.length === 0) {
        if (isPlainObject(value) && isPlainObject(node.properties)) return walkObject(value, node, path, ctx);
        return { ok: true, value: cleanUntyped(value) };
    }
    // Prefer the declared type the value already has; coerce only when none matches.
    const actual = jsonType(value);
    const direct = types.find((type) => type === actual || (type === 'number' && actual === 'integer'));
    const order = direct ? [direct, ...types.filter((type) => type !== direct)] : types;
    let firstError: string | undefined;
    for (const type of order) {
        const trial: WalkContext = { ...ctx, normalized: [], invalid: [] };
        const result = walkTyped(value, type, node, path, trial);
        if (result.ok) {
            ctx.normalized.push(...trial.normalized);
            ctx.invalid.push(...trial.invalid);
            return result;
        }
        firstError ??= result.error;
    }
    return { ok: false, error: firstError ?? `${describeValue(value)} does not match the schema` };
}

/**
 * Checks extracted properties against the object schema. Values that conform, or that a deterministic rewrite
 * makes conform, are kept; empty values are omitted; the rest are omitted and returned in `invalid`.
 *
 * Checked: `type`, `enum`, `const`, `format` (`date`, `date-time`), `pattern`, `additionalProperties: false`,
 * `anyOf`/`oneOf` and local `$ref`s. Other keywords (`minimum`, `maxLength`, ...) are not checked here.
 */
export function normalizeExtractedProperties(extracted: unknown, schema: unknown): NormalizeExtractionResult {
    const ctx: WalkContext = { root: schema, normalized: [], invalid: [] };
    const root = resolveRef(schema, schema);
    const value = isPlainObject(extracted)
        ? isPlainObject(root)
            ? walkObject(extracted, root, '', ctx)
            : { ok: true as const, value: cleanUntyped(extracted) }
        : { ok: true as const, value: undefined };
    return {
        value: value.ok && isPlainObject(value.value) ? value.value : {},
        normalized: ctx.normalized,
        invalid: ctx.invalid,
    };
}

// ---------------------------------------------------------------- derivations

const DERIVATION_CUE =
    /\b(?:deriv\w*|calculat\w*|comput\w*|infer\w*|otherwise|unless|defaults? to|falls? back|plus|minus|add(?:ed|ing)?|subtract\w*|equals?|same as|based on|if (?:not|no|absent|missing|unspecified|unstated|omitted)|when (?:not|no|absent|missing))\b|[=+]/i;

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function propertyPhrases(key: string, node: unknown): string[] {
    const phrases = new Set<string>();
    const spaced = key
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_\-.]+/g, ' ')
        .trim()
        .toLowerCase();
    if (spaced.length >= 3) phrases.add(spaced);
    if (key.length >= 3) phrases.add(key.toLowerCase());
    if (isPlainObject(node) && typeof node.title === 'string' && node.title.trim().length >= 3) {
        phrases.add(node.title.trim().toLowerCase());
    }
    return [...phrases];
}

function mentions(text: string, phrase: string): boolean {
    return new RegExp(`(?:^|[^\\p{L}\\p{N}_])${escapeRegExp(phrase)}(?:$|[^\\p{L}\\p{N}_])`, 'u').test(text);
}

/**
 * Top-level properties left empty although the schema says how to derive them from properties that were filled:
 * listed in `x-derived-from`, or named in the property's description next to a derivation cue
 * ("if not stated", "plus", "derived from", ...). Properties marked `x-extract: false` are never reported.
 */
export function findDerivationGaps(properties: Record<string, unknown>, schema: unknown): DerivationGap[] {
    const root = resolveRef(schema, schema);
    if (!isPlainObject(root) || !isPlainObject(root.properties)) return [];
    const propSchemas = root.properties;
    const filled = (key: string) => properties[key] !== undefined;
    const gaps: DerivationGap[] = [];
    for (const [key, raw] of Object.entries(propSchemas)) {
        if (filled(key) || !isExtractableSchemaNode(raw, schema)) continue;
        const node = resolveRef(raw, schema);
        if (!isPlainObject(node)) continue;
        const declared = node[X_DERIVED_FROM];
        if (Array.isArray(declared)) {
            const sources = declared.filter(
                (source): source is string => typeof source === 'string' && source !== key && filled(source),
            );
            if (sources.length > 0) gaps.push({ field: key, sources });
            continue;
        }
        const description = typeof node.description === 'string' ? node.description.toLowerCase() : '';
        if (!description || !DERIVATION_CUE.test(description)) continue;
        const sources = Object.entries(propSchemas)
            .filter(([sibling]) => sibling !== key && filled(sibling))
            .filter(([sibling, siblingSchema]) =>
                propertyPhrases(sibling, resolveRef(siblingSchema, schema)).some((phrase) =>
                    mentions(description, phrase),
                ),
            )
            .map(([sibling]) => sibling);
        if (sources.length > 0) gaps.push({ field: key, sources });
    }
    return gaps;
}

/** The object schema reduced to the given top-level properties, for a repair call that extracts only them. */
export function schemaForFields<T>(schema: T, fields: string[]): T {
    if (!isPlainObject(schema) || !isPlainObject(schema.properties)) return schema;
    const properties = schema.properties;
    const keep = fields.filter((field) => field in properties);
    const reduced: SchemaNode = {
        ...schema,
        properties: Object.fromEntries(keep.map((field) => [field, properties[field]])),
    };
    if (Array.isArray(schema.required)) {
        const required = schema.required.filter((field) => typeof field === 'string' && keep.includes(field));
        if (required.length > 0) reduced.required = required;
        else delete reduced.required;
    }
    return reduced as T;
}

// ---------------------------------------------------------------- validate + repair

export interface ValidateAndRepairResult {
    properties: Record<string, unknown>;
    /** Undefined when the first extraction conformed and needed no rewrite. */
    report?: ExtractionReport;
}

export interface ValidateAndRepairOptions {
    /** The schema the model was asked to fill (`schemaForExtraction` of the object schema). */
    extractionSchema: unknown;
    /** The full object schema: carries `x-derived-from`, which the extraction copy drops. */
    objectSchema: unknown;
    /** Type-specific instructions of the first call, kept in front of the repair instructions. */
    instructions?: string;
    /**
     * Runs the one repair call: extract only the properties of `schema` with these instructions. A thrown error keeps
     * the first extraction (invalid values stay omitted) and is reported as `repair.failed`.
     */
    repair: (schema: unknown, instructions: string) => Promise<unknown>;
    onRepairError?: (error: unknown) => void;
}

const MAX_REPORT_ENTRIES = 50;
const MAX_CONTEXT_CHARS = 4000;

function cap<T>(entries: T[]): T[] | undefined {
    return entries.length > 0 ? entries.slice(0, MAX_REPORT_ENTRIES) : undefined;
}

function unique(values: string[]): string[] {
    return [...new Set(values)];
}

/** The instructions of the repair call: what was wrong, and the values already extracted, for derivations. */
export function buildRepairInstructions(
    invalid: ExtractionInvalidValue[],
    gaps: DerivationGap[],
    known: Record<string, unknown>,
    instructions?: string,
): string {
    const lines: string[] = [];
    if (instructions?.trim()) lines.push(instructions.trim(), '');
    lines.push(
        'Correction pass: a first extraction of this document returned the properties below empty or in a form the',
        'output schema does not allow. Extract only these properties, exactly as the output schema declares them',
        '(allowed values, formats and patterns). Use null when the document still does not support a value.',
    );
    for (const entry of invalid) {
        lines.push(`- \`${entry.path}\`: ${entry.error}.`);
    }
    for (const gap of gaps) {
        lines.push(
            `- \`${gap.field}\`: left empty, although its schema description says how to determine it from other ` +
                `properties (${gap.sources.map((source) => `\`${source}\``).join(', ')}). When the document gives ` +
                'the values it needs, apply that rule instead of leaving it empty; check the whole document, a ' +
                'clause may continue across a page break.',
        );
    }
    let context = JSON.stringify(known);
    if (context.length > MAX_CONTEXT_CHARS) context = `${context.slice(0, MAX_CONTEXT_CHARS)}...`;
    lines.push('', 'Properties already extracted from this document, for reference:', context);
    return lines.join('\n');
}

/**
 * Checks the first extraction against the schema and, only when a value is invalid or a derivable property was left
 * empty, makes one repair call restricted to those properties. Never stores an off-schema value: whatever still does
 * not conform after the repair is omitted and listed in `report.cleared`.
 */
export async function validateAndRepairExtraction(
    extracted: unknown,
    options: ValidateAndRepairOptions,
): Promise<ValidateAndRepairResult> {
    const first = normalizeExtractedProperties(extracted, options.extractionSchema);
    const gaps = findDerivationGaps(first.value, options.objectSchema).filter(
        (gap) => !first.invalid.some((entry) => entry.field === gap.field),
    );
    const fields = unique([...first.invalid.map((entry) => entry.field), ...gaps.map((gap) => gap.field)]);
    const properties = { ...first.value };

    if (fields.length === 0) {
        const normalized = cap(first.normalized);
        return { properties, report: normalized ? { normalized } : undefined };
    }

    const repairSchema = schemaForFields(options.extractionSchema, fields);
    let second: NormalizeExtractionResult | undefined;
    try {
        const output = await options.repair(
            repairSchema,
            buildRepairInstructions(first.invalid, gaps, first.value, options.instructions),
        );
        second = normalizeExtractedProperties(output, repairSchema);
    } catch (error: unknown) {
        options.onRepairError?.(error);
    }

    const filled = second ? fields.filter((field) => second.value[field] !== undefined) : [];
    for (const field of filled) {
        properties[field] = second?.value[field];
    }
    const normalized = [
        ...first.normalized.filter((entry) => !filled.includes(topLevelField(entry.path))),
        ...(second?.normalized ?? []).filter((entry) => filled.includes(topLevelField(entry.path))),
    ];
    // The repair's verdict on a path replaces the first one.
    const clearedByPath = new Map<string, { path: string; error: string }>();
    for (const entry of [...first.invalid, ...(second?.invalid ?? [])]) {
        if (!filled.includes(entry.field)) clearedByPath.set(entry.path, { path: entry.path, error: entry.error });
    }
    const cleared = [...clearedByPath.values()];

    return {
        properties,
        report: {
            normalized: cap(normalized),
            cleared: cap(cleared),
            repair: { fields, filled, ...(second ? {} : { failed: true }) },
        },
    };
}
