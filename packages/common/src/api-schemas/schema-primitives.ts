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
