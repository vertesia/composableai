import type { JSONSchemaType } from 'ajv';
import type { SupportedIntegrations } from './integrations.js';
import type { ContentTypeIntakePolicy, IntakeVisionDetail, IntakeVisionProfileSettings } from './store/store.js';
import type { WorkflowRunStatus } from './store/workflow.js';
import type { AccountRef } from './user.js';

export interface ICreateProjectPayload {
    name: string;
    namespace: string;
    description?: string;
    auto_config?: boolean;
}
export enum SystemRoles {
    owner = 'owner', // all permissions
    admin = 'admin', // all permissions
    manager = 'manager', // all permissions but manage_account, manage_billing
    developer = 'developer', // all permissions but manage_account, manage_billing, manage_roles, delete
    application = 'application', // executor + request_pk
    automation = 'automation', // event-triggered automation runner
    content_processor = 'content_processor', // trusted system content processing
    consumer = 'consumer', // required permissions for users of micro apps
    executor = 'executor', // can only read and execute interactions
    reader = 'reader', // can only read (browse)
    auditor = 'auditor', // can read all non-admin resources without mutation permissions
    support = 'support', // Vertesia support read-only role
    billing = 'billing', // can only manage billings
    member = 'member', // can only access, but no specific permissions
    app_member = 'app_member', // used to mark an user have access to an application. does not provide any permission on its own
    content_superadmin = 'content_superadmin', // can see all content objects and collections
}

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
export interface ProjectRef {
    id: string;
    name: string;
    account: string;
    /**
     * Only set when fetching the list of projects visible to an user which is an org admin or owner.
     * If present and true, it means that the project is not accessible to the user.(even if it visible in listing)
     * If not present or false then the project is accessible to the user.
     */
    restricted?: boolean;
}

export interface ProjectTagQuery {
    tag?: string;
}

export interface ListProjectsQuery {
    account?: string;
}

export enum ResourceVisibility {
    public = 'public',
    account = 'account',
    project = 'project',
}

// ==========================================
// Project Model Defaults Types
// ==========================================

/**
 * Environment and model pair for a default configuration.
 */
export interface ModelDefault {
    environment: string;
    model: string;
}

/**
 * Modality-specific default model overrides.
 * These override the base default when specific input modalities are detected.
 */
export interface ModalityDefaults {
    /** Override for inputs containing images */
    image?: ModelDefault;
    /** Override for inputs containing video (requires video-capable model) */
    video?: ModelDefault;
}

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

export type SystemDefaults = {
    [K in SystemInteractionCategory]?: ModelDefault;
};

/**
 * Extensible project defaults using map/dictionary pattern.
 */
export interface ProjectModelDefaults {
    /** Base default model - used when no other default applies */
    base?: ModelDefault;
    /** Modality-based overrides (image, video) - override base when specific input modalities detected */
    modality?: ModalityDefaults;
    /** System interaction category defaults */
    system?: SystemDefaults;
}

export type BrowserUseRiskPolicy = 'read_only' | 'low_write' | 'requires_approval' | 'unrestricted';

export type BrowserUseScreenshotCapture = 'off' | 'on_action' | 'each_turn';

export interface BrowserUseProjectConfiguration {
    /**
     * Enable the browser_use workflow-level tool for this project.
     * Defaults to true when omitted.
     */
    enabled?: boolean;
    /**
     * Risk policy used when the tool call does not specify one.
     * Defaults to low_write.
     */
    default_policy?: BrowserUseRiskPolicy;
    /**
     * Maximum policy a tool call may request. Requested policies above this
     * are clamped down to the project maximum. Defaults to unrestricted.
     */
    max_policy?: BrowserUseRiskPolicy;
    /**
     * Optional project-wide host allowlist. When present, browser_use calls
     * can only request hosts contained by this list.
     */
    allowed_hosts?: string[];
    /**
     * Allow saved Playwright scripts to hydrate artifacts/documents as files
     * inside the browser sandbox for upload flows. Defaults to true.
     */
    allow_file_uploads?: boolean;
    /**
     * Allow the browser_playwright_script tool in browser workstreams.
     * Defaults to true.
     */
    allow_playwright_scripts?: boolean;
    /**
     * Persist browser screenshots for UI progress. Defaults to on_action.
     */
    capture_screenshots?: BrowserUseScreenshotCapture;
    /**
     * Prefer unannotated screenshots in the browser-use UI widget when both
     * raw and annotated captures are available. Defaults to true.
     */
    prefer_raw_screenshots?: boolean;
}

export const BrowserUseProjectConfigurationSchema: JSONSchemaType<BrowserUseProjectConfiguration> = {
    type: 'object',
    properties: {
        enabled: {
            type: 'boolean',
            nullable: true,
            description: 'Enable the browser_use workflow-level tool for this project. Defaults to true.',
        },
        default_policy: {
            type: 'string',
            nullable: true,
            enum: ['read_only', 'low_write', 'requires_approval', 'unrestricted'],
            description: 'Risk policy used when a browser_use call does not specify one. Defaults to low_write.',
        },
        max_policy: {
            type: 'string',
            nullable: true,
            enum: ['read_only', 'low_write', 'requires_approval', 'unrestricted'],
            description: 'Maximum risk policy a browser_use call may request. Defaults to unrestricted.',
        },
        allowed_hosts: {
            type: 'array',
            nullable: true,
            items: { type: 'string' },
            description:
                'Optional project-wide host allowlist. When present, browser_use calls can only request hosts contained by this list.',
        },
        allow_file_uploads: {
            type: 'boolean',
            nullable: true,
            description:
                'Allow replay scripts to hydrate artifacts/documents as files in the browser sandbox. Defaults to true.',
        },
        allow_playwright_scripts: {
            type: 'boolean',
            nullable: true,
            description: 'Allow browser_playwright_script in browser workstreams. Defaults to true.',
        },
        capture_screenshots: {
            type: 'string',
            nullable: true,
            enum: ['off', 'on_action', 'each_turn'],
            description: 'Persist browser screenshots for UI progress. Defaults to on_action.',
        },
        prefer_raw_screenshots: {
            type: 'boolean',
            nullable: true,
            description: 'Prefer unannotated screenshots in the browser-use UI widget. Defaults to true.',
        },
    },
    required: [],
    additionalProperties: false,
};

// ==========================================
// Project Configuration
// ==========================================

export type ProjectSearchTier = 'standard' | 'performance';
export type ElasticsearchBackend = 'serverless' | 'hosted';

/**
 * Fast pre-conversion type identification (the "sniff") for untyped documents.
 * The sniff classifies a document from cheap local evidence (first/last page text,
 * a low-res first-page image, office docProps) BEFORE any conversion, so a
 * high-confidence match can apply the type's intake policy — including skipping
 * conversion — without paying for it first.
 */
export interface ProjectIntakeSniffConfiguration {
    /**
     * Enable the pre-conversion sniff for untyped documents. Defaults to true.
     * Can be overridden per run with the `sniffEnabled` workflow var.
     */
    enabled?: boolean;

    /**
     * Confidence at or above which the sniffed type is committed and its full policy applied
     * (including conversion-skip). 0..1, defaults to 0.85.
     */
    high_confidence?: number;

    /**
     * Confidence at or above which the sniffed type is treated as provisional: the document
     * still converts and the post-conversion selector confirms on neutral evidence.
     * 0..1, defaults to 0.6. Below this the sniff result is advisory provenance only.
     */
    medium_confidence?: number;

    /**
     * Minimum page count for the sniff LLM call. Below this, conversion is cheap and full
     * converted text is better selection evidence, so intake uses the standard
     * convert-then-select path. Documents with unknown page counts are sniffed.
     * Defaults to 5; 0 means always sniff.
     */
    min_pages?: number;
}

export interface ProjectIntakeConfiguration {
    /**
     * Master switch for the standard intake pipeline. When false, StandardIntake exits as a
     * no-op WITHOUT touching object status (objects stay in `created`, identifiable as
     * unprocessed). Defaults to true.
     */
    enabled?: boolean;

    /**
     * Fast pre-conversion type identification for untyped documents. Absent means enabled
     * with platform default thresholds.
     */
    sniff?: ProjectIntakeSniffConfiguration;

    /**
     * Project-level intake policy defaults. Same shape as the per-content-type policy; a
     * type's `intake` block wins field-by-field over these defaults, which in turn win over
     * the legacy flat fields below. `identification` is type-specific and ignored here.
     */
    default_policy?: ContentTypeIntakePolicy;

    /**
     * Project overrides for the platform vision detail profiles used by intake visual
     * extraction (`low`/`standard`/`high`). Partial: omitted profiles or fields inherit the
     * platform defaults. Types reference detail NAMES only; the profile settings live here.
     */
    vision_profiles?: Partial<Record<IntakeVisionDetail, Partial<IntakeVisionProfileSettings>>>;

    /**
     * Generate table-of-content sections during standard document intake.
     * Defaults to false.
     */
    generate_toc?: boolean;

    /**
     * Skip table-of-content generation when the document text exceeds this many characters.
     * Avoids sending very large documents through the TOC interactions. Unset means no limit.
     */
    generate_toc_max_size?: number;

    /**
     * Select or assign a content type during standard intake.
     * Defaults to true.
     */
    generate_content_type?: boolean;

    /**
     * Extract document properties after content type assignment.
     * Defaults to true.
     */
    generate_properties?: boolean;

    /**
     * Default content type assigned during intake when type selection finds no matching type.
     * A type id resolvable in this project (a stored `oid:` type, an `app:` type, or a `sys:` type).
     * Defaults to the platform `sys:GenericDocument` when unset.
     */
    default_content_type?: string;
}

export interface ProjectConfiguration {
    human_context?: string;

    defaults?: ProjectModelDefaults;

    default_visibility?: ResourceVisibility;

    sync_content_properties?: boolean;

    embeddings: {
        text?: ProjectConfigurationEmbedding;
        image?: ProjectConfigurationEmbedding;
        properties?: ProjectConfigurationEmbedding;
    };

    datacenter?: string;
    storage_bucket?: string;

    /**
     * Enable real-time streaming of agent LLM responses to clients.
     * When enabled, LLM responses are streamed chunk-by-chunk via Redis pub/sub.
     * Defaults to true if not specified.
     */
    agent_streaming_enabled?: boolean;

    /**
     * Indexing configuration for this project.
     * Controls whether indexing and querying are enabled at the project level.
     */
    indexing?: ProjectIndexingConfiguration;

    /**
     * Standard content intake behavior.
     */
    intake?: ProjectIntakeConfiguration;

    /**
     * Primary language for full-text search analysis.
     * ISO 639-1 code (e.g., 'en', 'fr', 'ja', 'de').
     * Determines which Elasticsearch analyzer is used for the text field.
     * Defaults to 'en' (English/standard analyzer).
     *
     * Changing this value requires a full reindex to take effect.
     */
    main_language?: string;

    /**
     * Project defaults and caps for browser_use agent workstreams.
     */
    browser_use?: BrowserUseProjectConfiguration;

    /**
     * Object ID of a content object containing a custom LaTeX template (.latex file)
     * to use as the branded PDF template. When set, "Export as Branded PDF" uses this
     * template instead of the built-in Vertesia default template.
     */
    pdf_template_object_id?: string;
}

/**
 * Elasticsearch field types that may be explicitly assigned to content-object
 * properties. Paths are relative to the object's `properties` field.
 */
export type ProjectSearchPropertyType = 'keyword' | 'text' | 'boolean' | 'long' | 'double' | 'date';

/**
 * Explicit search mapping for one content-object property.
 *
 * Changing a mapping requires a full reindex. Existing Elasticsearch fields
 * cannot change type in place.
 */
export interface ProjectSearchPropertyMapping {
    type: ProjectSearchPropertyType;

    /** Elasticsearch date format. Valid only when type is `date`. */
    format?: string;

    /** Maximum indexed string length. Valid only when type is `keyword`. */
    ignore_above?: number;

    /**
     * Skip malformed values instead of rejecting the whole document. Valid only
     * for long, double, and date mappings.
     */
    ignore_malformed?: boolean;
}

export const PROJECT_SEARCH_PROPERTY_TYPES: readonly ProjectSearchPropertyType[] = [
    'keyword',
    'text',
    'boolean',
    'long',
    'double',
    'date',
];

const PROJECT_SEARCH_PROPERTY_PATH_PATTERN = /^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*$/;
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
        if (!PROJECT_SEARCH_PROPERTY_PATH_PATTERN.test(path)) {
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

export interface ProjectIndexingConfiguration {
    /**
     * Enable indexing for content objects in this project.
     * When enabled, content changes trigger indexing workflows.
     * Defaults to true - indexing is always on when ES infrastructure is available.
     */
    enabled?: boolean;

    /**
     * Search tier for this project.
     * standard uses the regional hosted Elasticsearch deployment.
     * performance uses the regional serverless Elasticsearch project.
     * Defaults to standard when omitted.
     */
    search_tier?: ProjectSearchTier;

    /**
     * Elasticsearch backend override for this project.
     * Prefer search_tier for project configuration unless an explicit backend override is needed.
     */
    backend?: ElasticsearchBackend;

    /**
     * Explicit mappings for selected content-object property paths.
     *
     * Keys are dot-separated paths relative to `properties`, for example
     * `order_total` or `customer.account_number`. Unlisted fields are mapped
     * dynamically from their JSON values. Changing this value requires a full
     * reindex.
     */
    property_mappings?: Record<string, ProjectSearchPropertyMapping>;
}

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

export interface ProjectConfigurationEmbedding {
    environment?: string;
    enabled: boolean;
    dimensions?: number;
    max_tokens?: number;
    model?: string;
}

export interface ProjectConfigurationEmbeddingEnablePayload {
    environment: string;
    max_tokens?: number;
    model?: string;
}

export interface Project {
    id: string;
    name: string;
    namespace: string;
    description?: string;
    account: string;
    configuration: ProjectConfiguration;
    integrations?: Map<string, unknown>;
    plugins: string[];
    created_by: string;
    updated_by: string;
    created_at: Date;
    updated_at: Date;
}

export interface ProjectCreatePayload {
    name: string;
    description?: string;
}

export interface ProjectUpdatePayload extends Partial<Project> {}

export interface ProjectPluginsUpdatePayload {
    plugins: string[];
}

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

export interface ProjectIntegrationListEntry {
    id: SupportedIntegrations;
    enabled: boolean;
}

export interface ProjectIntegrationListResponse {
    integrations: ProjectIntegrationListEntry[];
}
