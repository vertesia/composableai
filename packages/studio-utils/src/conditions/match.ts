import type { PropertyConditions } from '@vertesia/common';

// studio-utils' tsconfig deliberately excludes DOM/Node lib globals so
// browser and Node consumers stay symmetric. Declare the minimal console
// surface we use for misconfiguration warnings.
declare const console: { warn(...args: unknown[]): void };

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
 * Unknown operators emit a `console.warn` and return false — surfacing misconfiguration
 * loudly without breaking the surrounding token mint or permission check.
 *
 * `$principal.X` substitutions in conditions are expected to have already been resolved at
 * JWT-mint time by `resolveConditions` in token-server; values reaching this function are
 * concrete.
 */
export function matchConditions(conditions: PropertyConditions, properties: Record<string, unknown>): boolean {
    for (const [key, condition] of Object.entries(conditions)) {
        const value = resolvePath(properties, key);

        if (condition === null || condition === undefined || typeof condition !== 'object') {
            // Direct value match
            if (value !== condition) return false;
        } else {
            // Operator object
            const ops = condition as Record<string, unknown>;
            for (const [op, expected] of Object.entries(ops)) {
                switch (op) {
                    case '$eq':
                        if (value !== expected) return false;
                        break;
                    case '$ne':
                        if (value === expected) return false;
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
                        if (!Array.isArray(expected) || !expected.includes(value)) return false;
                        break;
                    case '$nin':
                        if (Array.isArray(expected) && expected.includes(value)) return false;
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
                        console.warn(`[matchConditions] Unknown operator "${op}" on key "${key}"`);
                        return false;
                }
            }
        }
    }
    return true;
}
