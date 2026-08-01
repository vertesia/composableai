import type { z } from 'zod';
import type { ProjectRefSchema } from './api-schemas/apikey.js';
import type {
    CreateProjectPayloadFromSchema,
    ListProjectsQuerySchema,
    ProjectIntegrationListEntrySchema,
    ProjectIntegrationListResponseSchema,
    ProjectPluginsUpdatePayloadSchema,
    ProjectSchema,
    ProjectTagQuerySchema,
} from './api-schemas/project.js';
import type {
    BrowserUseProjectConfigurationSchema,
    BrowserUseRiskPolicySchema,
    BrowserUseScreenshotCaptureSchema,
    ElasticsearchBackendSchema,
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
import type { WorkflowRunStatus } from './store/workflow.js';
import type { AccountRef } from './user.js';
import { ELASTICSEARCH_FIELD_PATH_PATTERN } from './view-validation-helpers.js';

/**
 * `SystemRoles` lives in `./project-values.js` so the API schemas can read it without importing this
 * module back. Re-exported here so every existing import path keeps working.
 */
export * from './project-values.js';

import { SystemRoles } from './project-values.js';

export type ICreateProjectPayload = CreateProjectPayloadFromSchema;

export function isRoleIncludedIn(role: string, includingRole: string) {
    switch (includingRole) {
        case SystemRoles.owner:
            return true; // includes billing to?
        case SystemRoles.admin:
            return role !== SystemRoles.billing && role !== SystemRoles.owner;
        case SystemRoles.developer:
            return role === SystemRoles.developer;
        case SystemRoles.billing:
            return role === SystemRoles.billing;
        default:
            return false;
    }
}

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
    StudioAssistant: SystemInteractionCategory.agent,
};

/**
 * Get category for a system interaction endpoint.
 * Returns undefined if category is non-applicable or endpoint is not recognized.
 * Note: Caller is responsible for determining if the interaction is a system interaction.
 * @param endpoint - The interaction endpoint name
 */
export function getSystemInteractionCategory(endpoint: string): SystemInteractionCategory | undefined {
    if (endpoint.startsWith('sys:')) {
        // Strip sys: prefix
        endpoint = endpoint.substring(4);
    }
    const category = SYSTEM_INTERACTION_CATEGORIES[endpoint];
    if (category === SystemInteractionCategory.non_applicable) {
        return undefined;
    }
    return category || undefined;
}

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

export type ProjectSearchPropertyType = z.infer<typeof ProjectSearchPropertyTypeSchema>;

export type ProjectSearchPropertyMapping = z.infer<typeof ProjectSearchPropertyMappingSchema>;

export const PROJECT_SEARCH_PROPERTY_TYPES: readonly ProjectSearchPropertyType[] = [
    'keyword',
    'text',
    'boolean',
    'long',
    'double',
    'date',
];

const MAX_PROJECT_SEARCH_PROPERTY_MAPPINGS = 200;
const MAX_KEYWORD_IGNORE_ABOVE = 8191;

/**
 * Validate property mappings at API and index-creation boundaries.
 *
 * Returns user-facing issue strings instead of throwing so callers can map the
 * result to the error type appropriate for their boundary.
 */
export function validateProjectSearchPropertyMappings(value: unknown): string[] {
    if (value === undefined) return [];
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return ['indexing.property_mappings must be an object keyed by property path'];
    }

    const entries = Object.entries(value as Record<string, unknown>);
    const issues: string[] = [];
    if (entries.length > MAX_PROJECT_SEARCH_PROPERTY_MAPPINGS) {
        issues.push(`indexing.property_mappings must contain at most ${MAX_PROJECT_SEARCH_PROPERTY_MAPPINGS} fields`);
    }

    const supportedTypes = new Set<string>(PROJECT_SEARCH_PROPERTY_TYPES);
    for (const [path, rawMapping] of entries) {
        const field = `indexing.property_mappings.${path}`;
        if (!ELASTICSEARCH_FIELD_PATH_PATTERN.test(path)) {
            issues.push(`${field} must be a dot-separated path containing only letters, numbers, and underscores`);
        }
        if (!rawMapping || typeof rawMapping !== 'object' || Array.isArray(rawMapping)) {
            issues.push(`${field} must be an object`);
            continue;
        }
        const mapping = rawMapping as Record<string, unknown>;
        const extraKeys = Object.keys(mapping).filter(
            (key) => !['type', 'format', 'ignore_above', 'ignore_malformed'].includes(key),
        );
        if (extraKeys.length > 0) {
            issues.push(`${field} contains unsupported option(s): ${extraKeys.join(', ')}`);
        }
        if (typeof mapping.type !== 'string' || !supportedTypes.has(mapping.type)) {
            issues.push(`${field}.type must be one of: ${PROJECT_SEARCH_PROPERTY_TYPES.join(', ')}`);
        }
        if (mapping.format !== undefined && (mapping.type !== 'date' || typeof mapping.format !== 'string')) {
            issues.push(`${field}.format is supported only for date mappings`);
        }
        if (
            mapping.ignore_above !== undefined &&
            (mapping.type !== 'keyword' ||
                !Number.isInteger(mapping.ignore_above) ||
                (mapping.ignore_above as number) < 1 ||
                (mapping.ignore_above as number) > MAX_KEYWORD_IGNORE_ABOVE)
        ) {
            issues.push(
                `${field}.ignore_above is supported only for keyword mappings and must be an integer from 1 to ${MAX_KEYWORD_IGNORE_ABOVE}`,
            );
        }
        if (
            mapping.ignore_malformed !== undefined &&
            (!['long', 'double', 'date'].includes(String(mapping.type)) ||
                typeof mapping.ignore_malformed !== 'boolean')
        ) {
            issues.push(`${field}.ignore_malformed is supported only for long, double, and date mappings`);
        }
    }
    return issues;
}

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

export enum FullTextType {
    full_text = 'full_text',
}

export type SearchTypes = SupportedEmbeddingTypes | FullTextType;

export const SearchTypes = {
    ...SupportedEmbeddingTypes,
    ...FullTextType,
} as const;

export type ProjectConfigurationEmbedding = z.infer<typeof ProjectConfigurationEmbeddingSchema>;

export interface ProjectConfigurationEmbeddingEnablePayload {
    environment: string;
    max_tokens?: number;
    model?: string;
}

export type Project = z.infer<typeof ProjectSchema>;

export interface ProjectCreatePayload {
    name: string;
    description?: string;
}

export interface ProjectUpdatePayload extends Partial<Project> {}

export type ProjectPluginsUpdatePayload = z.infer<typeof ProjectPluginsUpdatePayloadSchema>;

export const ProjectRefPopulate = 'id name account';

export interface EmbeddingsStatusResponse {
    status: string;
    embeddingRunsInProgress?: number;
    totalIndexableObjects?: number;
    embeddingsModels?: string[];
    objectsWithEmbeddings?: number;
    vectorIndex: {
        status: 'READY' | 'PENDING' | 'DELETING' | 'ABSENT';
        name?: string;
        type?: string;
    };
}

/**
 * Response from indexing status endpoint
 */
export interface IndexingStatusResponse {
    /** Whether indexing infrastructure is available globally */
    infrastructure_enabled: boolean;
    /** Whether indexing is enabled for this project */
    indexing_enabled: boolean;
    /** @deprecated Now derived from indexing_enabled - queries automatically route to index when indexing is enabled */
    query_enabled: boolean;
    /** Resolved Elasticsearch backend serving this project */
    backend: ElasticsearchBackend;
    /** Resolved search tier for this project */
    search_tier: ProjectSearchTier;
    /** Index status */
    index: {
        /** Whether the index exists */
        exists: boolean;
        /** Alias name (used for queries) */
        alias_name: string;
        /** Actual index name (versioned) */
        index_name: string;
        /** Index version (timestamp when created) */
        version: number;
        /** When the current index was created */
        created_at: string | null;
        /** Number of documents in the index */
        document_count: number;
        /** Index size in bytes */
        size_bytes: number;
    };
    /** MongoDB document count for comparison */
    mongo_document_count: number;
    /** Whether a reindex is currently in progress */
    reindex_in_progress: boolean;
    /** Reindex progress (if reindex is in progress) */
    reindex_progress?: {
        /** Total shards to process */
        total_shards: number;
        /** Shards completed so far */
        completed_shards: number;
        /** Shards that failed */
        failed_shards: number;
        /** Current status (e.g., "computing_shards", "indexing", "completed") */
        status: string;
        /** Documents scanned from source */
        scanned: number;
        /** Documents written to target index */
        written: number;
        /** Documents that failed to index */
        errors: number;
        /** Embedding vectors written to target index */
        embeddings_written?: number;
        /** Embedding vectors skipped because they were invalid or dimension-mismatched */
        skipped_embeddings?: number;
        /** Text embedding vectors written to target index */
        embeddings_text_written?: number;
        /** Image embedding vectors written to target index */
        embeddings_image_written?: number;
        /** Properties embedding vectors written to target index */
        embeddings_properties_written?: number;
        /** Text embedding vectors skipped because they were invalid or dimension-mismatched */
        embeddings_text_skipped?: number;
        /** Image embedding vectors skipped because they were invalid or dimension-mismatched */
        embeddings_image_skipped?: number;
        /** Properties embedding vectors skipped because they were invalid or dimension-mismatched */
        embeddings_properties_skipped?: number;
        /** Oversized property string values dropped during transform (size-based pruning) */
        properties_values_trimmed?: number;
        /** Total bytes dropped from oversized property values */
        properties_bytes_dropped?: number;
        /** Total batcher flushes across all completed shards (cumulative) */
        batches_flushed?: number;
        /** Total ES bulk requests sent across all completed shards (cumulative) */
        bulk_chunks_written?: number;
        /** Total per-document ES bulk-item failures across all shards (cumulative). Counts docs ES rejected — they aren't in the indexed set. */
        bulk_errors?: number;
        /** Average documents per batch flush (written / batches_flushed) — useful to spot under/over-batching */
        avg_docs_per_batch?: number;
        /** Average chunks per batch (>1 means bulk_size_bytes cap is splitting batches frequently) */
        avg_chunks_per_batch?: number;
        /** Documents processed per second */
        docs_per_second: number;
        /** Elapsed time in seconds */
        elapsed_seconds: number;
        /** Estimated seconds remaining (null if unknown) */
        estimated_seconds_remaining: number | null;
        /** Percentage complete (0-100) */
        percent_complete: number;
        /** Source alias */
        alias: string;
        /** Target index name */
        target_index: string;
    };
}

export interface StartProjectReindexPayload {
    shard_size?: number;
    parallel_shard_count?: number;
    concurrency?: number;
    bulk_size_bytes?: number;
    bulk_concurrency?: number;
}

/**
 * Auto-tunes shard sizing based on project doc count.
 *
 * Returns:
 * - shard_size: target docs per shard (workflow path uses this; zeno-bulk
 *   computes shard count from total/shard_size).
 * - parallel_shard_count: max in-flight shard activities (workflow path only).
 * - max_shards: hard cap on shard count for the direct path. Direct path
 *   passes this as `shards` to zeno-bulk so all shards run as cursors in
 *   ONE process; without this cap, an under-estimated shard_size (e.g.
 *   from stale estimatedDocumentCount) can spawn 10+ in-flight cursors
 *   and exceed Cloud Run memory.
 *
 * Explicit overrides should bypass this function and use user-provided values.
 */
export function autoTuneReindexParams(docCount: number): {
    shard_size: number;
    parallel_shard_count: number;
    max_shards: number;
} {
    if (docCount < 50_000) {
        // Tiny/small project: aim for ~4 shards, with a 5k floor.
        return {
            shard_size: Math.max(Math.ceil(docCount / 4), 5_000),
            parallel_shard_count: Math.min(4, Math.max(1, Math.ceil(docCount / 5_000))),
            max_shards: 4,
        };
    }
    if (docCount < 500_000) {
        // Medium project: 50k shards → 1-10 shards
        return { shard_size: 50_000, parallel_shard_count: 8, max_shards: 10 };
    }
    if (docCount < 2_000_000) {
        // Large project: 100k shards → 5-20 shards
        return { shard_size: 100_000, parallel_shard_count: 8, max_shards: 20 };
    }
    // Huge project: stick to 250k shards to keep coordination overhead bounded.
    return { shard_size: 250_000, parallel_shard_count: 8, max_shards: 40 };
}

export interface ReindexAgentRunsPayload {
    /**
     * Drop any existing agent-runs index/alias family and recreate the stable concrete index before indexing.
     * Defaults to true.
     */
    recreate_index?: boolean;
    /** Number of MongoDB records to scan per batch. Defaults to 500. */
    batch_size?: number;
    /** Optional cap for partial/manual repair runs. Omit for all agent runs in the project. */
    limit?: number;
}

export interface ReindexAgentRunsResponse {
    status: string;
    backend: ElasticsearchBackend;
    index_name: string;
    recreated: boolean;
    total: number;
    scanned: number;
    indexed: number;
    failed: number;
    errors?: Array<{
        id: string;
        message: string;
    }>;
}

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
export interface EmbeddingTypeConfig {
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

export interface DriftAnalysisProgress {
    total: number;
    processed: number;
    missing: number;
    stale: number;
    status: string;
    current_batch: number;
    total_batches: number;
    percent_complete: number;
    docs_per_second: number;
    elapsed_seconds: number;
    estimated_seconds_remaining: number | null;
}

export interface DriftAnalysisResult {
    total: number;
    processed: number;
    missing: number;
    stale: number;
    sample_missing_ids: string[];
    sample_stale_ids: string[];
    completed_at: string;
}

export interface DriftAnalysisStatusResponse extends WorkflowRunStatus {
    progress?: DriftAnalysisProgress;
    result?: DriftAnalysisResult;
    error?: string;
}

export type ProjectIntegrationListEntry = z.infer<typeof ProjectIntegrationListEntrySchema>;

export type ProjectIntegrationListResponse = z.infer<typeof ProjectIntegrationListResponseSchema>;
