import { z } from 'zod';

/**
 * Runtime API schemas for the API key endpoints.
 *
 * Currently only the list query, which exists to exercise the query-parameter path: the scanner
 * expands an object schema into individual `in: query` parameters rather than referencing it, so a
 * canonical component has to survive that expansion with its enum and optionality intact.
 */

export const ApiKeyListQuerySchema = z
    .object({
        /** Restricts the listing to keys scoped at the account or the project level. */
        level: z.enum(['account', 'project']).optional(),
    })
    .meta({ id: 'ApiKeyListQuery' });

export type ApiKeyListQueryFromSchema = z.infer<typeof ApiKeyListQuerySchema>;
