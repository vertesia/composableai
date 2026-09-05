import type { z } from 'zod';
import type { ProjectRefSchema } from './api-schemas/apikey.js';
import type {
    EmbeddingsStatusResponseSchema,
    ProjectConfigurationEmbeddingEnablePayloadSchema,
} from './api-schemas/embeddings.js';
import type {
    DriftAnalysisProgressSchema,
    DriftAnalysisResultSchema,
    DriftAnalysisStatusResponseSchema,
    IndexingStatusResponseSchema,
    ReindexAgentRunsPayloadSchema,
    ReindexAgentRunsResponseSchema,
    StartProjectReindexPayloadSchema,
} from './api-schemas/indexing.js';
import type {
    CreateProjectPayloadFromSchema,
    ListProjectsQuerySchema,
    ProjectIntegrationListEntrySchema,
    ProjectIntegrationListResponseSchema,
    ProjectPluginsUpdatePayloadSchema,
    ProjectSchema,
    ProjectTagQuerySchema,
    UpdateProjectConfigurationPayloadSchema,
    UpdateProjectPayloadSchema,
} from './api-schemas/project.js';
import type {
    AgentCheckpointConfigurationSchema,
    AgentProjectConfigurationSchema,
    BrowserUseProjectConfigurationSchema,
    BrowserUseRiskPolicySchema,
    BrowserUseScreenshotCaptureSchema,
    ElasticsearchBackendSchema,
    IntakeVisionProfileSettingsUpdateSchema,
    MemoryProjectConfigurationSchema,
    ModalityDefaultsSchema,
    ModelDefaultSchema,
    ProjectConfigurationEmbeddingSchema,
    ProjectConfigurationSchema,
    ProjectIndexingConfigurationSchema,
    ProjectIntakeConfigurationSchema,
    ProjectIntakeSniffConfigurationSchema,
    ProjectModelDefaultsSchema,
    ProjectSearchPropertyMappingSchema,
    ProjectSearchPropertyTypeSchema,
    ProjectSearchTierSchema,
    SystemDefaultsSchema,
} from './api-schemas/project-configuration.js';
import type { AccountRef } from './user.js';

/**
 * `SystemRoles` lives in `./project-values.js` so the API schemas can read it without importing this
 * module back. Re-exported here so every existing import path keeps working.
 */
export * from './project-values.js';

export type ICreateProjectPayload = CreateProjectPayloadFromSchema;

export interface PopulatedProjectRef {
    id: string;
    name: string;
    account: AccountRef;
}
// The compact project reference, derived from the schema in `./api-schemas/apikey.js` — the object
// OpenAPI publishes and AJV compiles, so there is one statement of the shape.
//
// It was the last hand-written twin in this package, and it stayed one for a concrete reason:
// `Interaction`, `PromptTemplate` and `ExecutionRunRef` embed it and are still derived from
// TypeScript, and the scanner used to resolve a `z.infer<>` alias to nothing — emptying six
// components that had nothing to do with the batch that introduced the schema. The scanner now
// short-circuits such an alias to the published component instead of trying to expand it, so a
// derived component may reference an inferred type and the rule that blocked this is gone.
//
// The `restricted` flag's explanation lives in the schema's `.meta()`, which is what the published
// component carries; it is no longer visible as TSDoc here, the same trade every other
// schema-derived type in this package already makes.
export type ProjectRef = z.infer<typeof ProjectRefSchema>;

export type ProjectTagQuery = z.infer<typeof ProjectTagQuerySchema>;

export type ListProjectsQuery = z.infer<typeof ListProjectsQuerySchema>;

// ==========================================
// Project Model Defaults Types
// ==========================================

export type ModelDefault = z.infer<typeof ModelDefaultSchema>;

export type ModalityDefaults = z.infer<typeof ModalityDefaultsSchema>;

/**
 * System interaction category enum.
 * Categories group one or more system interactions for default model assignment.
 */
export enum SystemInteractionCategory {
    content_type = 'content_type',
    intake = 'intake',
    analysis = 'analysis',
    agent = 'agent',
    non_applicable = 'non_applicable',
}

/**
 * Map system interaction endpoints to categories.
 */
export const SYSTEM_INTERACTION_CATEGORIES: Record<string, SystemInteractionCategory> = {
    ExtractInformation: SystemInteractionCategory.intake,
    SelectDocumentType: SystemInteractionCategory.intake,
    GenerateMetadataModel: SystemInteractionCategory.content_type,
    ChunkDocument: SystemInteractionCategory.intake,
    IdentifyTextSections: SystemInteractionCategory.intake,
    AnalyzeDocument: SystemInteractionCategory.analysis,
    ReduceTextSections: SystemInteractionCategory.analysis,
    GenericAgent: SystemInteractionCategory.non_applicable,
    AdhocTaskAgent: SystemInteractionCategory.non_applicable,
    Mediator: SystemInteractionCategory.non_applicable,
    AnalyzeConversation: SystemInteractionCategory.analysis,
    GetAgentConversationTopic: SystemInteractionCategory.analysis,
    ContentSearchAgent: SystemInteractionCategory.analysis,
    ContentSearchReranker: SystemInteractionCategory.analysis,
    StudioAssistant: SystemInteractionCategory.agent,
};

/**
 * One optional default per {@link SystemInteractionCategory}.
 *
 * The schema writes the categories out rather than mapping over the enum, so `project.contract.test`
 * asserts that its keys are exactly the category union — a new category has to be added in both
 * places, and fails to compile until it is.
 */
export type SystemDefaults = z.infer<typeof SystemDefaultsSchema>;

export type ProjectModelDefaults = z.infer<typeof ProjectModelDefaultsSchema>;

export type BrowserUseRiskPolicy = z.infer<typeof BrowserUseRiskPolicySchema>;

export type BrowserUseScreenshotCapture = z.infer<typeof BrowserUseScreenshotCaptureSchema>;

/**
 * Project defaults and caps for `browser_use` agent workstreams.
 *
 * A hand-written `JSONSchemaType<BrowserUseProjectConfiguration>` used to sit here beside the
 * interface. Nothing read it, and its descriptions had already drifted from the TSDoc the published
 * component was derived from — the schema module is now the only statement of the shape.
 */
export type BrowserUseProjectConfiguration = z.infer<typeof BrowserUseProjectConfigurationSchema>;

// ==========================================
// Project Configuration
// ==========================================

export type ProjectSearchTier = z.infer<typeof ProjectSearchTierSchema>;
export type ElasticsearchBackend = z.infer<typeof ElasticsearchBackendSchema>;

export type ProjectIntakeSniffConfiguration = z.infer<typeof ProjectIntakeSniffConfigurationSchema>;

export type ProjectIntakeConfiguration = z.infer<typeof ProjectIntakeConfigurationSchema>;

export type ProjectConfiguration = z.infer<typeof ProjectConfigurationSchema>;

export type AgentProjectConfiguration = z.infer<typeof AgentProjectConfigurationSchema>;

export type MemoryProjectConfiguration = z.infer<typeof MemoryProjectConfigurationSchema>;

export type AgentCheckpointConfiguration = z.infer<typeof AgentCheckpointConfigurationSchema>;

export type ProjectSearchPropertyType = z.infer<typeof ProjectSearchPropertyTypeSchema>;

export type ProjectSearchPropertyMapping = z.infer<typeof ProjectSearchPropertyMappingSchema>;

export type ProjectIndexingConfiguration = z.infer<typeof ProjectIndexingConfigurationSchema>;

// export interface ProjectConfigurationEmbeddings {
//     environment: string;
//     max_tokens: number;
//     dimensions: number;
//     model?: string;
// }

export enum SupportedEmbeddingTypes {
    text = 'text',
    image = 'image',
    properties = 'properties',
}

enum FullTextType {
    full_text = 'full_text',
}

export type SearchTypes = SupportedEmbeddingTypes | FullTextType;

export const SearchTypes = {
    ...SupportedEmbeddingTypes,
    ...FullTextType,
} as const;

export type ProjectConfigurationEmbedding = z.infer<typeof ProjectConfigurationEmbeddingSchema>;

export type ProjectConfigurationEmbeddingEnablePayload = z.infer<
    typeof ProjectConfigurationEmbeddingEnablePayloadSchema
>;

export type Project = z.infer<typeof ProjectSchema>;

export type ProjectPluginsUpdatePayload = z.infer<typeof ProjectPluginsUpdatePayloadSchema>;

export const ProjectRefPopulate = 'id name account';

export type EmbeddingsStatusResponse = z.infer<typeof EmbeddingsStatusResponseSchema>;

/**
 * Response from indexing status endpoint
 */
export type IndexingStatusResponse = z.infer<typeof IndexingStatusResponseSchema>;

export type StartProjectReindexPayload = z.infer<typeof StartProjectReindexPayloadSchema>;

export type ReindexAgentRunsPayload = z.infer<typeof ReindexAgentRunsPayloadSchema>;

export type ReindexAgentRunsResponse = z.infer<typeof ReindexAgentRunsResponseSchema>;

// ============================================================================
// Internal indexing types (used by Temporal workflows)
// ============================================================================

/**
 * Indexed (`_source`) shape of the content type ref. Unlike the public
 * ContentObjectTypeRef discriminated union, the index stores BOTH kinds under
 * `id` — the ObjectId hex for stored types, the namespaced code for in-code
 * types — so search filters and facets work on a single keyword field
 * regardless of the kind. `ref_type` is kept to rebuild the public union on
 * read. `code` only exists on documents written before the field was unified.
 */
export interface IndexedContentTypeRef {
    ref_type: 'stored' | 'incode';
    id: string;
    code?: string;
    name: string;
}

/**
 * Document data structure for Elasticsearch indexing
 */
export interface ElasticsearchDocumentData {
    name?: string;
    text?: string;
    properties?: Record<string, unknown>;
    status?: string;
    type?: IndexedContentTypeRef;
    security?: {
        'content:read'?: string[];
        'content:write'?: string[];
        'content:delete'?: string[];
    };
    revision?: {
        head?: boolean;
        root?: string;
    };
    embeddings_text?: number[];
    embeddings_image?: number[];
    embeddings_properties?: number[];
    created_at?: Date | string;
    updated_at?: Date | string;
}

/**
 * Result from bulk indexing
 */
export interface BulkIndexResult {
    successful: number;
    failed: number;
}

/**
 * Result from creating a reindex target
 */
export interface CreateReindexTargetResult {
    created: boolean;
    index_name: string;
    alias_name: string;
    version: number;
    backend?: ElasticsearchBackend;
    dimensions?: {
        text?: number;
        image?: number;
        properties?: number;
    };
    language?: string;
}

/**
 * Result from fetching a batch
 */
export interface FetchBatchResult {
    documents: Array<{
        id: string;
        document: ElasticsearchDocumentData;
    }>;
    next_cursor: string | null;
    done: boolean;
}

/**
 * Result from discovering the next cursor boundary for batch partitioning
 */
export interface NextIndexCursorResult {
    next_cursors: string[];
    count: number;
    done: boolean;
}

/**
 * Result from triggering a reindex
 */
export interface TriggerReindexResult {
    status: string;
    workflow?: string;
    workflow_id?: string;
    run_id?: string;
    object_count?: number;
    reason?: string;
    enabled?: boolean;
}

// ========================================================================
// Zeno Bulk (Go service) types
// ========================================================================

export interface ComputeShardsRequest {
    tenant_id: string;
    shard_size?: number;
    updated_since?: string;
    backend?: ElasticsearchBackend;
}

export interface ComputeShardsResult {
    shards: Array<{ min?: string; max?: string }>;
    count: number;
}

export interface IndexShardParams {
    tenant_id: string;
    target_index: string;
    shard_min: string;
    shard_max?: string;
    backend?: ElasticsearchBackend;
    embedding_dimensions?: {
        text?: number;
        image?: number;
        properties?: number;
    };
    dry_run?: boolean;
    concurrency?: number;
    batch_size?: number;
    bulk_size_bytes?: number;
    bulk_concurrency?: number;
    updated_since?: string;
}

export interface IndexShardRequest {
    force?: boolean;
    params: IndexShardParams;
}

export interface IndexShardResult {
    status: string;
    projects_done: number;
    projects_total: number;
    scanned: number;
    written: number;
    skipped: number;
    errors: number;
    /** Per-document ES bulk-item errors (e.g. mapping timeouts). Doc-level data-quality, not pipeline failure. */
    bulk_errors?: number;
    /** Sampled details of bulk-item failures (capped at 100 per shard). */
    bulk_error_sample?: Array<{
        tenant?: string;
        doc_id: string;
        type: string;
        reason: string;
    }>;
    embeddings_written?: number;
    skipped_embeddings?: number;
    embeddings_text_written?: number;
    embeddings_image_written?: number;
    embeddings_properties_written?: number;
    embeddings_text_skipped?: number;
    embeddings_image_skipped?: number;
    embeddings_properties_skipped?: number;
    properties_values_trimmed?: number;
    properties_bytes_dropped?: number;
    batches_flushed?: number;
    bulk_chunks_written?: number;
    avg_docs_per_batch?: number;
    avg_chunks_per_batch?: number;
    avg_bytes_per_doc?: number;
    avg_bytes_per_chunk?: number;
    read_docs_s: string;
    write_docs_s: string;
    read_mb: string;
    write_mb: string;
    mongo_read_mb?: string;
    gcs_read_mb?: string;
    es_bulk_mb?: string;
    read_mb_s: string;
    write_mb_s: string;
    mongo_read_mb_s?: string;
    gcs_read_mb_s?: string;
    es_bulk_mb_s?: string;
    duration_sec: number;
    failed_projects?: Array<{ tenant: string; error: string }>;
}

export interface SwapAliasRequest {
    tenant_id: string;
    target_index: string;
    backend?: ElasticsearchBackend;
    /** ES alias name. If not provided, the Go service derives it from the tenant ID. */
    alias?: string;
}

export interface SwapAliasResult {
    status: string;
    alias: string;
    old_index: string;
    new_index: string;
}

export interface ReindexViaBulkRequest {
    tenant_id: string;
    project_id?: string;
    backend?: ElasticsearchBackend;
    dry_run?: boolean;
    /** Approximate documents per shard; drives auto-shard count (total / shard_size). Default 250_000. */
    shard_size?: number;
    /** Explicit shard count. When set, overrides shard_size-based auto-sharding. Useful to cap in-process concurrency for the direct path. */
    shards?: number;
    /** Number of ES bulk-write workers per shard. Default 10. */
    bulk_concurrency?: number;
    /** Hard cap per ES bulk request body in bytes. Default 12 MB. */
    bulk_size_bytes?: number;
    /** Max documents per batcher flush (size cap still regulates ES bulk requests). Default 200. */
    bulk_max_docs?: number;
}

export interface ReindexViaBulkResult {
    status: string;
    error?: string;
    projects_done: number;
    projects_total: number;
    scanned: number;
    written: number;
    errors: number;
    embeddings_written?: number;
    skipped_embeddings?: number;
    embeddings_text_written?: number;
    embeddings_image_written?: number;
    embeddings_properties_written?: number;
    embeddings_text_skipped?: number;
    embeddings_image_skipped?: number;
    embeddings_properties_skipped?: number;
    properties_values_trimmed?: number;
    properties_bytes_dropped?: number;
    batches_flushed?: number;
    bulk_chunks_written?: number;
    avg_docs_per_batch?: number;
    avg_chunks_per_batch?: number;
    avg_bytes_per_doc?: number;
    avg_bytes_per_chunk?: number;
    read_docs_s: string;
    write_docs_s: string;
    read_mb: string;
    write_mb: string;
    mongo_read_mb?: string;
    gcs_read_mb?: string;
    es_bulk_mb?: string;
    read_mb_s?: string;
    write_mb_s?: string;
    mongo_read_mb_s?: string;
    gcs_read_mb_s?: string;
    es_bulk_mb_s?: string;
    duration_sec: number;
}

/**
 * Elasticsearch index statistics
 */
export interface ElasticsearchIndexStats {
    enabled: boolean;
    backend?: ElasticsearchBackend;
    exists?: boolean;
    document_count?: number;
    size_in_bytes?: number;
    index_name?: string;
    alias_name?: string;
}

/**
 * Embedding configuration for a single type
 */
interface EmbeddingTypeConfig {
    environment?: string;
    dimensions?: number;
    model?: string;
    provider?: string;
    enabled?: boolean;
}

/**
 * Detailed index configuration
 */
export interface IndexConfiguration {
    enabled: boolean;
    exists?: boolean;
    index_name?: string;
    alias_name?: string;
    version?: number;
    document_count?: number;
    size_in_bytes?: number;
    embedding_dimensions?: {
        text?: number;
        image?: number;
        properties?: number;
    };
    /** ISO 639-1 language code for text analysis */
    language?: string;
    /** Explicit mappings for selected content-object property paths. */
    property_mappings?: Record<string, ProjectSearchPropertyMapping>;
    field_mappings?: Record<string, unknown>;
    project_embeddings_config?: {
        text?: EmbeddingTypeConfig;
        image?: EmbeddingTypeConfig;
        properties?: EmbeddingTypeConfig;
    };
    created_at?: Date | null;
}

/**
 * Supported languages for full-text search with their display names.
 * Maps ISO 639-1 codes to human-readable language names.
 */
export const SUPPORTED_SEARCH_LANGUAGES: Record<string, string> = {
    en: 'English',
    zh: 'Chinese',
    es: 'Spanish',
    hi: 'Hindi',
    ar: 'Arabic',
    pt: 'Portuguese',
    bn: 'Bengali',
    ru: 'Russian',
    ja: 'Japanese',
    de: 'German',
    fr: 'French',
    ko: 'Korean',
    it: 'Italian',
    tr: 'Turkish',
    vi: 'Vietnamese',
    pl: 'Polish',
    uk: 'Ukrainian',
    nl: 'Dutch',
    th: 'Thai',
    el: 'Greek',
    cs: 'Czech',
    sv: 'Swedish',
    ro: 'Romanian',
    hu: 'Hungarian',
    da: 'Danish',
    fi: 'Finnish',
    no: 'Norwegian',
    he: 'Hebrew',
    id: 'Indonesian',
    fa: 'Persian',
};

/**
 * Result from fetching documents by IDs
 */
export interface FetchDocumentsByIdsResult {
    documents: Array<{
        id: string;
        document: ElasticsearchDocumentData;
    }>;
    not_found: string[];
}

/**
 * Result from bulk delete
 */
export interface BulkDeleteResult {
    successful: number;
    failed: number;
}

/**
 * Result from ensure index operation
 */
export interface EnsureIndexResult {
    created: boolean;
    recreated?: boolean;
    existed?: boolean;
    enabled?: boolean;
    status?: string;
    dimensions?: {
        text?: number;
        image?: number;
        properties?: number;
    };
    language?: string;
}

export interface AnalyzeDriftBatchResult {
    processed: number;
    missing: number;
    stale: number;
    next_cursor: string | null;
    done: boolean;
    sample_missing_ids: string[];
    sample_stale_ids: string[];
}

export type DriftAnalysisProgress = z.infer<typeof DriftAnalysisProgressSchema>;

export type DriftAnalysisResult = z.infer<typeof DriftAnalysisResultSchema>;

export type DriftAnalysisStatusResponse = z.infer<typeof DriftAnalysisStatusResponseSchema>;

export type ProjectIntegrationListEntry = z.infer<typeof ProjectIntegrationListEntrySchema>;

export type ProjectIntegrationListResponse = z.infer<typeof ProjectIntegrationListResponseSchema>;

export type UpdateProjectPayload = z.infer<typeof UpdateProjectPayloadSchema>;

export type UpdateProjectConfigurationPayload = z.infer<typeof UpdateProjectConfigurationPayloadSchema>;

export type IntakeVisionProfileSettingsUpdate = z.infer<typeof IntakeVisionProfileSettingsUpdateSchema>;
