/**
 * Transform registry spec — the closed set of named ops both the Node and
 * Go runners must implement.
 *
 * This file is the *spec*, not the implementation. Node's impl lives at
 * packages/server-common/src/migration/transform/registry.ts; Go's at
 * apps/vertesia-migrate/internal/transform/registry.go. Both load the
 * same transform-fixtures.json and must produce identical output — CI
 * fails on drift.
 *
 * The agent that drafts a plan picks `transform` / `op` names from
 * TRANSFORM_NAMES below. Anything outside this list fails plan validation.
 *
 * See plugins/vertesia-migrate/.agents/skills/vertesia-migrate-transforms
 * for the operator-facing catalogue with examples.
 */

/** Type-coercion ops — one source value in, one target value out. */
export const COERCION_TRANSFORMS = [
    'to_string',
    'to_int',
    'to_float',
    'to_bool',
    'to_iso_date',
    'to_unix_ms',
] as const;

/** String-shaping ops — one source value in, one target value out. */
export const STRING_TRANSFORMS = [
    'uppercase',
    'lowercase',
    'trim',
    'prefix',
    'suffix',
    'regex_extract',
    'regex_replace',
] as const;

/** Array ops — array in, single value out (or another array). */
export const ARRAY_TRANSFORMS = ['array_first', 'array_join'] as const;

/** Multi-source ops — for ComputedField.op. Take an array of resolved
 *  source values plus args. Property-mapping ops above can also appear
 *  here when they happen to take a single value. */
export const COMPUTED_OPS = [
    'concat',
    'format',
    'coalesce',
    'if_else',
    'lookup',
] as const;

/** All named transforms / ops. Used for validation. */
export const TRANSFORM_NAMES = [
    ...COERCION_TRANSFORMS,
    ...STRING_TRANSFORMS,
    ...ARRAY_TRANSFORMS,
    ...COMPUTED_OPS,
] as const;

export type TransformName = (typeof TRANSFORM_NAMES)[number];

export function isTransformName(value: string): value is TransformName {
    return (TRANSFORM_NAMES as readonly string[]).includes(value);
}

/**
 * Per-transform arg schemas — purely descriptive (no runtime validation
 * here; the registry impls validate). The planner UI and the agent skill
 * doc consume this so neither has to hard-code the catalogue.
 */
export const TRANSFORM_ARGS: Record<TransformName, TransformArgSpec> = {
    to_string: { args: {} },
    to_int: { args: {} },
    to_float: { args: {} },
    to_bool: {
        args: {
            truthy: {
                type: 'string[]',
                optional: true,
                desc: 'List of strings to treat as true. Defaults: "true","yes","y","1","on".',
            },
        },
    },
    to_iso_date: {
        args: {
            layouts: {
                type: 'string[]',
                optional: true,
                desc: 'Custom Go-style time layouts to try in order. Defaults cover RFC3339, ISO-8601, and common US/EU forms.',
            },
        },
    },
    to_unix_ms: {
        args: {
            layouts: {
                type: 'string[]',
                optional: true,
                desc: 'Same as to_iso_date.',
            },
        },
    },

    uppercase: { args: {} },
    lowercase: { args: {} },
    trim: {
        args: {
            chars: {
                type: 'string',
                optional: true,
                desc: 'Custom cut set. Defaults to whitespace.',
            },
        },
    },
    prefix: {
        args: {
            value: { type: 'string', desc: 'String prepended to the input.' },
        },
    },
    suffix: {
        args: {
            value: { type: 'string', desc: 'String appended to the input.' },
        },
    },
    regex_extract: {
        args: {
            pattern: { type: 'string', desc: 'Regex. First capture group wins; full match if no group.' },
        },
    },
    regex_replace: {
        args: {
            pattern: { type: 'string', desc: 'Regex.' },
            replace: { type: 'string', desc: 'Replacement; supports $1, $2.' },
        },
    },

    array_first: { args: {} },
    array_join: {
        args: {
            sep: {
                type: 'string',
                optional: true,
                desc: 'Separator. Defaults to ",".',
            },
        },
    },

    concat: {
        args: {
            sep: { type: 'string', optional: true, desc: 'Separator. Default empty.' },
            keep_nulls: { type: 'boolean', optional: true, desc: 'Include empty slots for nil sources.' },
        },
    },
    format: {
        args: {
            template: {
                type: 'string',
                desc: 'Template with {0}, {1}, … placeholders by source index.',
            },
        },
    },
    coalesce: { args: {} },
    if_else: {
        args: {
            then: { type: 'any', desc: 'Value when the first source is truthy.' },
            else: { type: 'any', optional: true, desc: 'Value when falsy. Defaults to null.' },
        },
    },
    lookup: {
        args: {
            table: { type: 'record<string,any>', desc: 'Lookup table keyed by stringified source value.' },
            default: { type: 'any', optional: true, desc: 'Value when no match.' },
        },
    },
};

export interface TransformArgSpec {
    args: Record<string, TransformArgField>;
}

export interface TransformArgField {
    type: string;
    optional?: boolean;
    desc?: string;
}
