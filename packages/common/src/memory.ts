import type { z } from 'zod';
import type {
    CreateMemoryBrainPayloadSchema,
    DeleteMemoryBrainQuerySchema,
    DeleteMemoryBrainResponseSchema,
    MemoryAgentRunSourceSelectorSchema,
    MemoryBrainActionResponseSchema,
    MemoryBrainArraySchema,
    MemoryBrainDeletionErrorSchema,
    MemoryBrainLaneStateSchema,
    MemoryBrainRecipeSchema,
    MemoryBrainRecordDeletionCountsSchema,
    MemoryBrainSchema,
    MemoryBrainUpdatePolicySchema,
    MemoryContentSourceSelectorSchema,
    MemoryEvidenceEntrySchema,
    MemoryEvidenceLocatorSchema,
    MemoryEvidenceRefArraySchema,
    MemoryEvidenceRefSchema,
    MemoryFacetCountSchema,
    MemoryGenerationArraySchema,
    MemoryGenerationCountsSchema,
    MemoryGenerationSchema,
    MemoryGraphPatternSchema,
    MemoryGraphQueryResultSchema,
    MemoryGraphQuerySchema,
    MemoryNodeArraySchema,
    MemoryNodeEvidenceFacetsSchema,
    MemoryNodeEvidenceQuerySchema,
    MemoryNodeEvidenceResponseSchema,
    MemoryNodeEvidenceRowSchema,
    MemoryNodePatternSchema,
    MemoryNodeSchema,
    MemoryPathQuerySchema,
    MemoryPathSchema,
    MemoryRunCountsSchema,
    MemoryRunSummaryArraySchema,
    MemoryRunSummarySchema,
    MemorySourceSelectorSchema,
    MemoryStatementArraySchema,
    MemoryStatementLiteralObjectSchema,
    MemoryStatementNodeObjectSchema,
    MemoryStatementObjectSchema,
    MemoryStatementPatternBodySchema,
    MemoryStatementPatternObjectSchema,
    MemoryStatementPatternSchema,
    MemoryStatementSchema,
    MemorySupportSchema,
    MemoryValueFilterSchema,
    PromoteMemoryGenerationPayloadSchema,
    UpdateMemoryBrainPayloadSchema,
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

/** Server-clamped ceilings of the v1 graph query grammar (specification.md §17.1). */
export const MEMORY_QUERY_LIMITS = {
    max_patterns: 8,
    max_hops: 3,
    default_hops: 2,
    max_results: 200,
    default_results: 50,
} as const;

/** Per-run transaction caps of the incremental commit protocol (specification.md §8.1). */
export const MEMORY_COMMIT_CAPS = {
    nodes: 250,
    statements: 500,
    evidence_links: 2000,
} as const;

export type MemoryContentSourceSelector = z.infer<typeof MemoryContentSourceSelectorSchema>;
export type MemoryAgentRunSourceSelector = z.infer<typeof MemoryAgentRunSourceSelectorSchema>;
export type MemorySourceSelector = z.infer<typeof MemorySourceSelectorSchema>;
export type MemoryBrainRecipe = z.infer<typeof MemoryBrainRecipeSchema>;
export type MemoryBrainUpdatePolicy = z.infer<typeof MemoryBrainUpdatePolicySchema>;
export type MemoryBrainLaneState = z.infer<typeof MemoryBrainLaneStateSchema>;
export type MemoryBrain = z.infer<typeof MemoryBrainSchema>;
export type MemoryBrainArray = z.infer<typeof MemoryBrainArraySchema>;
export type CreateMemoryBrainPayload = z.infer<typeof CreateMemoryBrainPayloadSchema>;
export type UpdateMemoryBrainPayload = z.infer<typeof UpdateMemoryBrainPayloadSchema>;
export type PromoteMemoryGenerationPayload = z.infer<typeof PromoteMemoryGenerationPayloadSchema>;
export type MemoryBrainActionResponse = z.infer<typeof MemoryBrainActionResponseSchema>;
export type MemoryGenerationCounts = z.infer<typeof MemoryGenerationCountsSchema>;
export type MemoryGeneration = z.infer<typeof MemoryGenerationSchema>;
export type MemoryGenerationArray = z.infer<typeof MemoryGenerationArraySchema>;
export type MemoryRunCounts = z.infer<typeof MemoryRunCountsSchema>;
export type MemoryRunSummary = z.infer<typeof MemoryRunSummarySchema>;
export type MemoryRunSummaryArray = z.infer<typeof MemoryRunSummaryArraySchema>;
export type MemoryEvidenceLocator = z.infer<typeof MemoryEvidenceLocatorSchema>;
export type MemoryEvidenceRef = z.infer<typeof MemoryEvidenceRefSchema>;
export type MemoryEvidenceRefArray = z.infer<typeof MemoryEvidenceRefArraySchema>;
export type MemoryEvidenceEntry = z.infer<typeof MemoryEvidenceEntrySchema>;
export type MemoryFacetCount = z.infer<typeof MemoryFacetCountSchema>;
export type MemoryNodeEvidenceQuery = z.infer<typeof MemoryNodeEvidenceQuerySchema>;
export type MemoryNodeEvidenceRow = z.infer<typeof MemoryNodeEvidenceRowSchema>;
export type MemoryNodeEvidenceFacets = z.infer<typeof MemoryNodeEvidenceFacetsSchema>;
export type MemoryNodeEvidenceResponse = z.infer<typeof MemoryNodeEvidenceResponseSchema>;
export type MemorySupport = z.infer<typeof MemorySupportSchema>;
export type MemoryNode = z.infer<typeof MemoryNodeSchema>;
export type MemoryNodeArray = z.infer<typeof MemoryNodeArraySchema>;
export type MemoryStatementNodeObject = z.infer<typeof MemoryStatementNodeObjectSchema>;
export type MemoryStatementLiteralObject = z.infer<typeof MemoryStatementLiteralObjectSchema>;
export type MemoryStatementObject = z.infer<typeof MemoryStatementObjectSchema>;
export type MemoryStatement = z.infer<typeof MemoryStatementSchema>;
export type MemoryStatementArray = z.infer<typeof MemoryStatementArraySchema>;
export type MemoryNodePattern = z.infer<typeof MemoryNodePatternSchema>;
export type MemoryStatementPatternObject = z.infer<typeof MemoryStatementPatternObjectSchema>;
export type MemoryStatementPatternBody = z.infer<typeof MemoryStatementPatternBodySchema>;
export type MemoryStatementPattern = z.infer<typeof MemoryStatementPatternSchema>;
export type MemoryGraphPattern = z.infer<typeof MemoryGraphPatternSchema>;
export type MemoryValueFilter = z.infer<typeof MemoryValueFilterSchema>;
export type MemoryPathQuery = z.infer<typeof MemoryPathQuerySchema>;
export type MemoryGraphQuery = z.infer<typeof MemoryGraphQuerySchema>;
export type MemoryPath = z.infer<typeof MemoryPathSchema>;
export type MemoryGraphQueryResult = z.infer<typeof MemoryGraphQueryResultSchema>;
