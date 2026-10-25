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

/**
 * A `limit` or `offset` query count: a whole number, zero or more. A fraction or a negative count used to
 * reach the database and fail there as a 500.
 *
 * Published as `type: number` with `multipleOf: 1` rather than `type: integer`, so the generated Java and Go
 * clients keep the parameter types they already expose while the contract enforcer answers 400.
 */
export const PageCountSchema = z.number().multipleOf(1).min(0);

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
