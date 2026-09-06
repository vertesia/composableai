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
import type {
    CreateMemoryOntologyPayloadSchema,
    CreateMemoryRunPayloadSchema,
    MemoryAddStatementOpSchema,
    MemoryCommitTicketSchema,
    MemoryFindEntitiesPayloadSchema,
    MemoryFindEntitiesResultSchema,
    MemoryLinkEvidenceOpSchema,
    MemoryNodeHandleSchema,
    MemoryOntologyArraySchema,
    MemoryOntologyNodeTypeSchema,
    MemoryOntologyPredicateSchema,
    MemoryOntologySchema,
    MemoryPredicateLiteralObjectSchema,
    MemoryPredicateNodeObjectSchema,
    MemoryPredicateObjectSignatureSchema,
    MemoryPutNodeOpSchema,
    MemoryReadGraphPayloadSchema,
    MemoryRefusalSchema,
    MemoryRetractNodeOpSchema,
    MemoryRetractStatementOpSchema,
    MemoryRunCreatedSchema,
    MemoryRunOperationSchema,
    MemoryRunSourceRefSchema,
    MemoryStagedOpSchema,
    MemoryStageOpsPayloadSchema,
    MemoryStageOpsResultSchema,
    MemoryStatementHandleSchema,
    MemoryStatementObjectRefLiteralSchema,
    MemoryStatementObjectRefNodeSchema,
    MemoryStatementObjectRefSchema,
    MemoryWitnessRefSchema,
} from './api-schemas/memory-runs.js';

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

export type MemoryOntologyNodeType = z.infer<typeof MemoryOntologyNodeTypeSchema>;
export type MemoryPredicateNodeObject = z.infer<typeof MemoryPredicateNodeObjectSchema>;
export type MemoryPredicateLiteralObject = z.infer<typeof MemoryPredicateLiteralObjectSchema>;
export type MemoryPredicateObjectSignature = z.infer<typeof MemoryPredicateObjectSignatureSchema>;
export type MemoryOntologyPredicate = z.infer<typeof MemoryOntologyPredicateSchema>;
export type MemoryOntology = z.infer<typeof MemoryOntologySchema>;
export type MemoryOntologyArray = z.infer<typeof MemoryOntologyArraySchema>;
export type CreateMemoryOntologyPayload = z.infer<typeof CreateMemoryOntologyPayloadSchema>;
export type MemoryRunSourceRef = z.infer<typeof MemoryRunSourceRefSchema>;
export type CreateMemoryRunPayload = z.infer<typeof CreateMemoryRunPayloadSchema>;
export type MemoryRunCreated = z.infer<typeof MemoryRunCreatedSchema>;
export type MemoryNodeHandle = z.infer<typeof MemoryNodeHandleSchema>;
export type MemoryStatementHandle = z.infer<typeof MemoryStatementHandleSchema>;
export type MemoryWitnessRef = z.infer<typeof MemoryWitnessRefSchema>;
export type MemoryStatementObjectRefNode = z.infer<typeof MemoryStatementObjectRefNodeSchema>;
export type MemoryStatementObjectRefLiteral = z.infer<typeof MemoryStatementObjectRefLiteralSchema>;
export type MemoryStatementObjectRef = z.infer<typeof MemoryStatementObjectRefSchema>;
export type MemoryPutNodeOp = z.infer<typeof MemoryPutNodeOpSchema>;
export type MemoryAddStatementOp = z.infer<typeof MemoryAddStatementOpSchema>;
export type MemoryLinkEvidenceOp = z.infer<typeof MemoryLinkEvidenceOpSchema>;
export type MemoryRetractNodeOp = z.infer<typeof MemoryRetractNodeOpSchema>;
export type MemoryRetractStatementOp = z.infer<typeof MemoryRetractStatementOpSchema>;
export type MemoryRunOperation = z.infer<typeof MemoryRunOperationSchema>;
export type MemoryStageOpsPayload = z.infer<typeof MemoryStageOpsPayloadSchema>;
export type MemoryRefusal = z.infer<typeof MemoryRefusalSchema>;
export type MemoryRefusalCode = MemoryRefusal['code'];
export type MemoryStagedOp = z.infer<typeof MemoryStagedOpSchema>;
export type MemoryStageOpsResult = z.infer<typeof MemoryStageOpsResultSchema>;
export type MemoryCommitTicket = z.infer<typeof MemoryCommitTicketSchema>;
export type MemoryFindEntitiesPayload = z.infer<typeof MemoryFindEntitiesPayloadSchema>;
export type MemoryFindEntitiesResult = z.infer<typeof MemoryFindEntitiesResultSchema>;
export type MemoryReadGraphPayload = z.infer<typeof MemoryReadGraphPayloadSchema>;

/** The witness locator shape, named by the role it plays in a run's citations. */
export type MemoryWitnessLocator = MemoryEvidenceLocator;
