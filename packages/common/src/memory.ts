import type { z } from 'zod';
import type {
    DeleteMemoryBrainQuerySchema,
    DeleteMemoryBrainResponseSchema,
    MemoryBrainDeletionErrorSchema,
    MemoryBrainRecordDeletionCountsSchema,
} from './api-schemas/memory.js';

/**
 * Default content-type names of the platform memory ontology.
 *
 * These are only defaults: a Brain namespace is keyed by `properties.brain_id`, so a project whose
 * ontology is named differently overrides them per request instead of being locked out.
 */
export const DEFAULT_MEMORY_TYPE_NAMES = {
    brain: 'AI Market Brain',
    relationship: 'AI Market Relationship',
    memory_entry: 'AI Market Memory Entry',
} as const;

export type DeleteMemoryBrainQuery = z.infer<typeof DeleteMemoryBrainQuerySchema>;
export type MemoryBrainRecordDeletionCounts = z.infer<typeof MemoryBrainRecordDeletionCountsSchema>;
export type MemoryBrainDeletionError = z.infer<typeof MemoryBrainDeletionErrorSchema>;
export type DeleteMemoryBrainResponse = z.infer<typeof DeleteMemoryBrainResponseSchema>;
