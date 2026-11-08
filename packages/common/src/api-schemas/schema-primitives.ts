import { z } from 'zod';

/** Nullable scalar encodings shared by schemas that preserve the compact OpenAPI 3.1 spelling. */
export const nullableStringSchema = z
    .string()
    .nullable()
    .meta({ anyOf: undefined, type: ['string', 'null'] });

export const nullableNumberSchema = z
    .number()
    .nullable()
    .meta({ anyOf: undefined, type: ['number', 'null'] });

/** A MongoDB ObjectId: 24 hexadecimal characters, the only spelling the server casts to an id. */
export const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

/** An ObjectId or the empty string, for a filter the server ignores when it is empty. */
export const OPTIONAL_OBJECT_ID_PATTERN = /^(?:[0-9a-fA-F]{24})?$/;

/**
 * A `limit` or `offset` query count: a whole number, zero or more. A fraction or a negative count used to
 * reach the database and fail there as a 500.
 *
 * Published as `type: number` with `multipleOf: 1` rather than `type: integer`, so the generated Java and Go
 * clients keep the parameter types they already expose while the contract enforcer answers 400.
 */
// Capped at the largest safe integer: a larger count loses precision, and Mongo rejects it in `$skip`/`$limit`.
export const PageCountSchema = z.number().multipleOf(1).min(0).max(Number.MAX_SAFE_INTEGER);

/**
 * A JSON Schema conditional, for a rule over several fields of one request: spread into a component's `.meta()`.
 *
 * Validators enforce `if`/`then`/`else`, and the Java, Go and Python generators ignore them, so each generated model
 * keeps its plain fields. A component-level `anyOf` or `oneOf` of required fragments would instead turn the model
 * into a wrapper class.
 */
export function conditional(
    condition: Record<string, unknown>,
    consequence: Record<string, unknown>,
    alternative?: Record<string, unknown>,
): Record<string, unknown> {
    return {
        if: condition,
        // biome-ignore lint/suspicious/noThenProperty: the JSON Schema `then` keyword, read by validators, never awaited.
        then: consequence,
        ...(alternative ? { else: alternative } : {}),
    };
}

/** The `if`/`then` fragment for a string field that is present and not empty. */
export function nonEmpty(field: string): Record<string, unknown> {
    return { required: [field], properties: { [field]: { minLength: 1 } } };
}

// A Mongo field name: non-empty, without `.` or NUL, not starting with `$`. A field path joins such names with `.`.
const MONGO_FIELD_NAME = '[^$.\\x00][^.\\x00]*';
export const MONGO_FIELD_PATH = `${MONGO_FIELD_NAME}(\\.${MONGO_FIELD_NAME})*`;

/**
 * The facets of a payload whose endpoint runs them as a Mongo `$facet`: each `name` becomes a field name, so it is a
 * Mongo field name other than `total`, which the response keeps for the match count, and each `field` is a field path.
 * Spread into the payload's `.meta()`. The Elasticsearch-backed facet payloads accept dotted names, so the shared
 * `FacetSpec` stays as it is.
 */
export const mongoFacetsRule = conditional(
    { required: ['facets'] },
    {
        properties: {
            facets: {
                items: {
                    properties: {
                        name: { pattern: `^${MONGO_FIELD_NAME}$`, not: { const: 'total' } },
                        field: { pattern: `^${MONGO_FIELD_PATH}$` },
                    },
                },
            },
        },
    },
);

export const MONGO_FACETS_DESCRIPTION =
    'Each facet `name` is a Mongo field name: non-empty, without `.` or NUL, not starting with `$`, and not ' +
    '`total`. Each `field` is a dotted path of such names.';

/**
 * The facets of a payload whose endpoint runs them as Elasticsearch aggregations: each `name` becomes an aggregation
 * name, which Elasticsearch refuses when empty or containing `[`, `]` or `>`, and is not `total`, which the response
 * keeps for the match count. Spread into the payload's `.meta()`, like {@link mongoFacetsRule}.
 */
export const searchFacetsRule = conditional(
    { required: ['facets'] },
    {
        properties: {
            facets: { items: { properties: { name: { pattern: '^[^\\[\\]>]+$', not: { const: 'total' } } } } },
        },
    },
);

export const SEARCH_FACETS_DESCRIPTION =
    'Each facet `name` is an Elasticsearch aggregation name: non-empty, without `[`, `]` or `>`, and not `total`.';

/**
 * A caller's Mongo filter in the payload's `field`: its top-level keys are field paths, or `$and`, `$or` and `$nor`.
 * Spread into the payload's `.meta()`. The server checks the rest of the grammar: the operators a condition may use,
 * the nesting depth and the number of clauses.
 *
 * Stated on the payload rather than on the filter: a description or `propertyNames` on the free-form map makes the
 * Java and Python generators drop its nullability and give it an empty default.
 */
export function mongoFilterKeysRule(field: string): Record<string, unknown> {
    return conditional(
        { required: [field] },
        { properties: { [field]: { propertyNames: { pattern: `^(\\$(and|or|nor)|${MONGO_FIELD_PATH})$` } } } },
    );
}

export function mongoFilterDescription(field: string): string {
    return (
        `\`${field}\` is a Mongo filter. Its keys are dotted field paths or \`$and\`, \`$or\` and \`$nor\`, and a ` +
        'condition is a literal or uses the comparison operators, `$in`, `$nin`, `$all`, `$exists`, `$type`, `$size`, ' +
        '`$regex`, `$not` and `$elemMatch`.'
    );
}

/** Monotonic token for optimistic concurrency on mutable, user-authored resources. */
export const EditRevisionSchema = z
    .number()
    .int()
    .min(1)
    .meta({ description: 'Monotonic edit revision used to detect concurrent updates.' });

/** Revision a caller last observed and expects to replace. */
export const ExpectedEditRevisionSchema = EditRevisionSchema.optional().meta({
    description:
        'Edit revision returned by the last read. Stale revisions are rejected with HTTP 409. Omit for legacy last-write-wins behavior.',
});
