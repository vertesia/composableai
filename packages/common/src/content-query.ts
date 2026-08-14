import type { z } from 'zod';
import type { ContentQueryPayloadSchema, ContentQueryResultSchema } from './api-schemas/content-query.js';

export type ContentQueryPayload = z.infer<typeof ContentQueryPayloadSchema>;
export type ContentQueryResult = z.infer<typeof ContentQueryResultSchema>;
