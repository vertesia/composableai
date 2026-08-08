import type { PropertyConditions } from '@vertesia/common';
import { getStudioUtilsLogger } from '../logger.js';

/**
 * Resolve a property path against a context object.
 *
 * Supports:
 *   - `clearance` → obj.clearance
 *   - `email` → obj.email
 *   - `properties.department` → obj.properties.department (one nested level under `properties`)
 *
 * Returns `undefined` if any segment is missing or non-traversable.
 */
export function resolvePath(obj: Record<string, unknown>, path: string): unknown {
    if (path.startsWith('properties.')) {
        const properties = obj.properties;
        return properties && typeof properties === 'object'
            ? (properties as Record<string, unknown>)[path.slice(11)]
            : undefined;
    }
    return obj[path];
}

/**
 * Match a wildcard pattern against a string value.
 *
 * Supports `*` as wildcard:
 *   - `"*@domain.com"` — ends with
 *   - `"bogdan.*"` — starts with
 *   - `"bogdan+*@vertesia.com"` — contains
 *   - `"*"` — match all
 *
 * Case-insensitive. Non-string `value` always returns `false`.
 */
export function matchLike(value: unknown, pattern: string): boolean {
    if (typeof value !== 'string') return false;
    // Convert wildcard pattern to regex: escape regex chars except *, then replace * with .*
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`, 'i').test(value);
}

function compareOrdered(value: unknown, expected: unknown, op: '$gt' | '$gte' | '$lt' | '$lte'): boolean {
    if (typeof value !== 'number' && typeof value !== 'string') return false;
    if (typeof value !== typeof expected) return false;
    const left = value;
    const right = expected as typeof left;
    switch (op) {
        case '$gt':
            return left > right;
        case '$gte':
            return left >= right;
        case '$lt':
            return left < right;
        case '$lte':
            return left <= right;
    }
}

function matchesEquality(value: unknown, expected: unknown): boolean {
    if (Array.isArray(value) && !Array.isArray(expected)) {
        return value.includes(expected);
    }
    if (Array.isArray(value) && Array.isArray(expected)) {
        return value.length === expected.length && value.every((entry, index) => entry === expected[index]);
    }
    return value === expected;
}

function matchesAny(value: unknown, expected: unknown[]): boolean {
    return Array.isArray(value) ? value.some((entry) => expected.includes(entry)) : expected.includes(value);
}

/**
 * Evaluate a PropertyConditions object against a set of properties (JS-side, in-memory).
 *
 * Supports the MongoDB query syntax subset shared across token-server (principal property
 * matching at JWT-mint time) and zeno-server (write-path ABAC permission checks against an
 * in-memory document):
 *
 *   - Direct value match (`{ field: literal }`)
 *   - `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`
 *   - `$in`, `$nin` (against array `expected`)
 *   - `$exists` (boolean)
 *   - `$empty` (boolean) — true for undefined/null/empty-string/empty-array
 *   - `$like` (wildcard string, see {@link matchLike})
 *
 * All field-level conditions are AND'd (every field must match). Within a single field, all
 * operators are AND'd.
 *
 * Mirrors the Mongo-side filter built by `conditionsToMongoFilter` (zeno-server utils.ts) and
 * the ES-side filter built by `conditionsToEsQuery`. Use this when conditions need to be
 * evaluated against a single hydrated document instead of pushed down as a query.
 *
 * Unknown operators emit a warning via the studio-utils logger and return false — surfacing
 * misconfiguration loudly without breaking the surrounding token mint or permission check.
 *
 * `$principal.X` substitutions in conditions are expected to have already been resolved by
 * {@link resolveConditions}; values reaching this function are concrete.
 */
export function matchConditions(conditions: PropertyConditions, properties: Record<string, unknown>): boolean {
    for (const [key, condition] of Object.entries(conditions)) {
        const value = resolvePath(properties, key);

        if (condition === null || condition === undefined || typeof condition !== 'object') {
            // Direct value match
            if (!matchesEquality(value, condition)) return false;
        } else {
            // Operator object
            const ops = condition as Record<string, unknown>;
            for (const [op, expected] of Object.entries(ops)) {
                switch (op) {
                    case '$eq':
                        if (!matchesEquality(value, expected)) return false;
                        break;
                    case '$ne':
                        if (matchesEquality(value, expected)) return false;
                        break;
                    case '$gt':
                        if (!compareOrdered(value, expected, '$gt')) return false;
                        break;
                    case '$gte':
                        if (!compareOrdered(value, expected, '$gte')) return false;
                        break;
                    case '$lt':
                        if (!compareOrdered(value, expected, '$lt')) return false;
                        break;
                    case '$lte':
                        if (!compareOrdered(value, expected, '$lte')) return false;
                        break;
                    case '$in':
                        if (!Array.isArray(expected) || !matchesAny(value, expected)) return false;
                        break;
                    case '$nin':
                        if (Array.isArray(expected) && matchesAny(value, expected)) return false;
                        break;
                    case '$exists':
                        if (typeof expected !== 'boolean' || (value !== undefined) !== expected) return false;
                        break;
                    case '$empty': {
                        const isEmpty =
                            value === undefined ||
                            value === null ||
                            value === '' ||
                            (Array.isArray(value) && value.length === 0);
                        if (typeof expected !== 'boolean' || isEmpty !== expected) return false;
                        break;
                    }
                    case '$like':
                        if (typeof expected !== 'string' || !matchLike(value, expected)) return false;
                        break;
                    default:
                        getStudioUtilsLogger().warn({ op, key }, 'Unknown operator in PropertyConditions');
                        return false;
                }
            }
        }
    }
    return true;
}

const PRINCIPAL_REF_PREFIX = '$principal.';
const NUMERIC_OPS = new Set(['$gt', '$gte', '$lt', '$lte']);

/**
 * Resolve `$principal.X` references in resource conditions to concrete values.
 *
 * Missing properties use the same non-matching defaults as token generation:
 * numeric comparisons receive `0`, `$in`/`$nin` receive `[]`, `$exists`
 * receives `false`, and other contexts receive an empty string.
 */
export function resolveConditions(
    conditions: PropertyConditions,
    principalProps: Record<string, unknown>,
): PropertyConditions {
    const resolved: PropertyConditions = {};

    for (const [key, condition] of Object.entries(conditions)) {
        if (typeof condition === 'string' && condition.startsWith(PRINCIPAL_REF_PREFIX)) {
            resolved[key] = resolvePrincipalRef(condition, principalProps);
        } else if (condition !== null && typeof condition === 'object' && !Array.isArray(condition)) {
            resolved[key] = resolveOperatorObject(condition as Record<string, unknown>, principalProps);
        } else {
            resolved[key] = condition;
        }
    }

    return resolved;
}

function resolvePrincipalRef(ref: string, principalProps: Record<string, unknown>): unknown {
    const value = resolvePath(principalProps, ref.slice(PRINCIPAL_REF_PREFIX.length));
    return value === undefined ? '' : value;
}

function resolveOperatorObject(
    operators: Record<string, unknown>,
    principalProps: Record<string, unknown>,
): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    for (const [operator, value] of Object.entries(operators)) {
        if (typeof value === 'string' && value.startsWith(PRINCIPAL_REF_PREFIX)) {
            const principalValue = resolvePath(principalProps, value.slice(PRINCIPAL_REF_PREFIX.length));
            resolved[operator] =
                principalValue === undefined
                    ? operator === '$in' || operator === '$nin'
                        ? []
                        : defaultForOperator(operator)
                    : principalValue;
        } else {
            resolved[operator] = value;
        }
    }

    return resolved;
}

function defaultForOperator(operator: string): string | number | boolean {
    if (NUMERIC_OPS.has(operator)) return 0;
    if (operator === '$exists') return false;
    return '';
}
