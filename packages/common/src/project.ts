import { SupportedIntegrations } from "./integrations.js";
import { ContentObjectTypeRef } from "./store/store.js";
import { AccountRef } from "./user.js";

export interface ICreateProjectPayload {
    name: string;
    namespace: string;
    description?: string;
    auto_config?: boolean;
}
export enum ProjectRoles {
    owner = "owner", // all permissions
    admin = "admin", // all permissions
    manager = "manager", // all permissions but manage_account, manage_billing
    developer = "developer", // all permissions but manage_account, manage_billing, manage_roles, delete
    application = "application", // executor + request_pk
    consumer = "consumer", // required permissions for users of micro apps
    executor = "executor", // can only read and execute interactions
    reader = "reader", // can only read (browse)
    billing = "billing", // can only manage billings
    member = "member", // can only access, but no specific permissions
    app_member = "app_member", // used to mark an user have access to an application. does not provide any permission on its own
    content_superadmin = "content_superadmin", // can see all content objects and collections
}

export function isRoleIncludedIn(role: string, includingRole: string) {
    switch (includingRole) {
        case ProjectRoles.owner:
            return true; // includes billing to?
        case ProjectRoles.admin:
            return role !== ProjectRoles.billing && role !== ProjectRoles.owner;
        case ProjectRoles.developer:
            return role === ProjectRoles.developer;
        case ProjectRoles.billing:
            return role === ProjectRoles.billing;
        default:
            return false;
    }
}


export interface PopulatedProjectRef {
    id: string;
    name: string;
    account: AccountRef
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

export enum ResourceVisibility {
    public = "public",
    account = "account",
    project = "project"
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
    content_type = "content_type",
    intake = "intake",
    analysis = "analysis",
    non_applicable = "non_applicable"
}

/**
 * Map system interaction endpoints to categories.
 */
export const SYSTEM_INTERACTION_CATEGORIES: Record<string, SystemInteractionCategory> = {
    "ExtractInformation": SystemInteractionCategory.intake,
    "SelectDocumentType": SystemInteractionCategory.intake,
    "GenerateMetadataModel": SystemInteractionCategory.content_type,
    "ChunkDocument": SystemInteractionCategory.intake,
    "IdentifyTextSections": SystemInteractionCategory.intake,
    "AnalyzeDocument": SystemInteractionCategory.analysis,
    "ReduceTextSections": SystemInteractionCategory.analysis,
    "GenericAgent": SystemInteractionCategory.non_applicable,
    "AdhocTaskAgent": SystemInteractionCategory.non_applicable,
    "Mediator": SystemInteractionCategory.non_applicable,
    "AnalyzeConversation": SystemInteractionCategory.analysis,
    "GetAgentConversationTopic": SystemInteractionCategory.analysis,
};

/**
 * Get category for a system interaction endpoint.
 * Returns undefined if category is non-applicable or endpoint is not recognized.
 * Note: Caller is responsible for determining if the interaction is a system interaction.
 * @param endpoint - The interaction endpoint name
 */
export function getSystemInteractionCategory(endpoint: string): SystemInteractionCategory | undefined {
    if (endpoint.startsWith("sys:")) {
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

// ==========================================
// Project Configuration
// ==========================================

export interface ProjectConfiguration {

    human_context: string;

    /** @deprecated Use defaults.base - kept for backward compatibility */
    default_environment?: string;
    /** @deprecated Use defaults.base - kept for backward compatibility */
    default_model?: string;

    defaults?: ProjectModelDefaults;

    default_visibility?: ResourceVisibility;

    sync_content_properties?: boolean;

    embeddings: {
        text?: ProjectConfigurationEmbeddings;
        image?: ProjectConfigurationEmbeddings;
        properties?: ProjectConfigurationEmbeddings
    }

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
    indexing?: {
        /**
         * Enable indexing for content objects in this project.
         * When enabled, content changes trigger indexing workflows.
         * Defaults to true - indexing is always on when ES infrastructure is available.
         */
        enabled?: boolean;
    };

    /**
     * Primary language for full-text search analysis.
     * ISO 639-1 code (e.g., 'en', 'fr', 'ja', 'de').
     * Determines which Elasticsearch analyzer is used for the text field.
     * Defaults to 'en' (English/standard analyzer).
     *
     * Changing this value requires a full reindex to take effect.
     */
    main_language?: string;

}

// export interface ProjectConfigurationEmbeddings {
//     environment: string;
//     max_tokens: number;
//     dimensions: number;
//     model?: string;
// }

export enum SupportedEmbeddingTypes {
    text = "text",
    image = "image",
    properties = "properties"
}

export enum FullTextType {
    full_text = "full_text"
}

export type SearchTypes = SupportedEmbeddingTypes | FullTextType;

export const SearchTypes = {
    ...SupportedEmbeddingTypes,
    ...FullTextType
} as const;

export interface ProjectConfigurationEmbeddings {
    environment: string;
    enabled: boolean;
    dimensions: number;
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
    integrations: Map<string, any>;
    plugins: string[];
    created_by: string,
    updated_by: string,
    created_at: Date;
    updated_at: Date;
}

export interface ProjectCreatePayload {
    name: string;
    description?: string;
}

export interface ProjectUpdatePayload extends Partial<Project> { }


export const ProjectRefPopulate = "id name account";


export interface EmbeddingsStatusResponse {
    status: string;
    embeddingRunsInProgress?: number;
    totalIndexableObjects?: number;
    embeddingsModels?: string[];
    objectsWithEmbeddings?: number;
    vectorIndex: {
        status: "READY" | "PENDING" | "DELETING" | "ABSENT",
        name?: string,
        type?: string
    }
}

/**
 * Response from indexing status endpoint
 */
export interface IndexingStatusResponse {
    /** Whether indexing infrastructure is available globally */
    infrastructureEnabled: boolean;
    /** Whether indexing is enabled for this project */
    indexingEnabled: boolean;
    /** @deprecated Now derived from indexingEnabled - queries automatically route to index when indexing is enabled */
    query_enabled: boolean;
    /** Index status */
    index: {
        /** Whether the index exists */
        exists: boolean;
        /** Alias name (used for queries) */
        aliasName: string;
        /** Actual index name (versioned) */
        indexName: string;
        /** Index version (timestamp when created) */
        version: number;
        /** When the current index was created */
        createdAt: string | null;
        /** Number of documents in the index */
        documentCount: number;
        /** Index size in bytes */
        sizeBytes: number;
    };
    /** MongoDB document count for comparison */
    mongoDocumentCount: number;
    /** Whether a reindex is currently in progress */
    reindexInProgress: boolean;
    /** Reindex progress (if reindex is in progress) */
    reindexProgress?: {
        /** Total documents to reindex */
        total: number;
        /** Documents processed so far */
        processed: number;
        /** Successfully indexed documents */
        successful: number;
        /** Failed documents */
        failed: number;
        /** Current status (e.g., "indexing", "complete") */
        status: string;
        /** Current batch number */
        currentBatch: number;
        /** Total number of batches */
        totalBatches: number;
        /** Percentage complete (0-100) */
        percentComplete: number;
        /** Batches processed per second */
        batchesPerSecond: number;
        /** Documents processed per second */
        docsPerSecond: number;
        /** Elapsed time in seconds */
        elapsedSeconds: number;
        /** Estimated seconds remaining (null if unknown) */
        estimatedSecondsRemaining: number | null;
    };
}

// ============================================================================
// Internal indexing types (used by Temporal workflows)
// ============================================================================

/**
 * Document data structure for Elasticsearch indexing
 */
export interface ElasticsearchDocumentData {
    name?: string;
    text?: string;
    properties?: Record<string, unknown>;
    status?: string;
    type?: ContentObjectTypeRef;
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
    indexName: string;
    aliasName: string;
    version: number;
}

/**
 * Result from getting reindex range
 */
export interface ReindexRangeResult {
    first: string | null;
    last: string | null;
    count: number;
}

/**
 * Result from fetching a batch
 */
export interface FetchBatchResult {
    documents: Array<{
        id: string;
        document: ElasticsearchDocumentData;
    }>;
    nextCursor: string | null;
    done: boolean;
}

/**
 * Result from indexing a batch
 */
export interface IndexBatchResult {
    successful: number;
    failed: number;
    processed: number;
    nextCursor: string | null;
    done: boolean;
}

/**
 * Result from triggering a reindex
 */
export interface TriggerReindexResult {
    status: string;
    workflow?: string;
    workflowId?: string;
    runId?: string;
    objectCount?: number;
    reason?: string;
    enabled?: boolean;
}

/**
 * Elasticsearch index statistics
 */
export interface ElasticsearchIndexStats {
    enabled: boolean;
    exists?: boolean;
    documentCount?: number;
    sizeInBytes?: number;
    indexName?: string;
    aliasName?: string;
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
    indexName?: string;
    aliasName?: string;
    version?: number;
    documentCount?: number;
    sizeInBytes?: number;
    embeddingDimensions?: {
        text?: number;
        image?: number;
        properties?: number;
    };
    /** ISO 639-1 language code for text analysis */
    language?: string;
    fieldMappings?: Record<string, unknown>;
    projectEmbeddingsConfig?: {
        text?: EmbeddingTypeConfig;
        image?: EmbeddingTypeConfig;
        properties?: EmbeddingTypeConfig;
    };
    createdAt?: Date | null;
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
    notFound: string[];
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

/**
 * Result from swap alias operation
 */
export interface SwapAliasResult {
    swapped: boolean;
    aliasName?: string;
    newIndexName?: string;
    reason?: string;
}

export interface ProjectIntegrationListEntry {
    id: SupportedIntegrations;
    enabled: boolean;
}