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
