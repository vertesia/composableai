import type { EmbeddingsResult, EmbeddingTaskType } from '@llumiverse/common';
import type { SupportedEmbeddingTypes } from './project.js';
import type { ComplexSearchQuery } from './query.js';
import type { Embedding, RevisionInfo } from './store/store.js';

/**
 * Wire-format inputs accepted by the studio-server embeddings endpoint.
 * Mirror of @llumiverse/common's EmbeddingInput, but binary modalities
 * carry a JSON-friendly source (URL or base64) instead of a DataSource.
 *
 * The server wraps each source in a Base64DataSource or URLDataSource
 * before passing the request to the llumiverse driver.
 */
export type EmbeddingsApiInput =
    | EmbeddingsApiTextInput
    | EmbeddingsApiImageInput
    | EmbeddingsApiVideoInput
    | EmbeddingsApiAudioInput;

export interface EmbeddingsApiSource {
    /** Display name for the source (defaults to "embedding-input"). */
    name?: string;
    /** MIME type of the binary content. Required for most providers. */
    mime_type?: string;
    /**
     * Provider-native URL the driver may pass through directly:
     * - gs:// or https://storage.googleapis.com/ for Vertex AI
     * - s3:// or https://*.amazonaws.com for Bedrock
     * - https:// for fetch fallback
     * Mutually exclusive with base64.
     */
    url?: string;
    /** Base64-encoded bytes. Mutually exclusive with url. */
    base64?: string;
}

export interface EmbeddingsApiTextInput {
    type: 'text';
    text: string;
    task_type?: EmbeddingTaskType;
    title?: string;
}

export interface EmbeddingsApiImageInput {
    type: 'image';
    source: EmbeddingsApiSource;
}

export interface EmbeddingsApiVideoInput {
    type: 'video';
    source: EmbeddingsApiSource;
    start_sec?: number;
    length_sec?: number;
    interval_sec?: number;
    use_fixed_length_sec?: boolean;
    min_clip_sec?: number;
    embedding_option?: ('visual-text' | 'visual-image' | 'audio')[];
}

export interface EmbeddingsApiAudioInput {
    type: 'audio';
    source: EmbeddingsApiSource;
    start_sec?: number;
    length_sec?: number;
}

export interface EmbeddingsApiRequest {
    inputs: EmbeddingsApiInput[];
    model?: string;
    task_type?: EmbeddingTaskType;
    dimensions?: number;
}

/**
 * Wire-format result. Identical to @llumiverse/common's EmbeddingsResult
 * (vectors and metadata are JSON-friendly), re-exported here for callers
 * that prefer to consume types from @vertesia/common.
 */
export type EmbeddingsApiResult = EmbeddingsResult;

/**
 * Optional object context to include alongside exported embedding vectors.
 */
export interface ExportEmbeddingsIncludeOptions {
    /**
     * Include object properties. Disabled by default because properties may be large or sensitive.
     */
    properties?: boolean;
    /**
     * Include technical object metadata. Disabled by default because metadata may be large.
     */
    metadata?: boolean;
    /**
     * Include object revision details. Enabled by default.
     */
    revision?: boolean;
}

/**
 * Request one page of project embeddings for export.
 */
export interface ExportEmbeddingsPageRequest {
    /**
     * Embedding types to export. Defaults to all supported embedding types.
     */
    embedding_types?: SupportedEmbeddingTypes[];
    /**
     * Maximum records to return in this page. Server applies a bounded maximum.
     */
    limit?: number;
    /**
     * Opaque cursor returned by the previous page.
     */
    cursor?: string;
    /**
     * Optional content object filters. Full-text and vector ranking options are ignored for export paging.
     */
    query?: ComplexSearchQuery;
    /**
     * Include all revisions. Defaults to false, exporting only head revisions.
     */
    all_revisions?: boolean;
    /**
     * Optional object context selectors.
     */
    include?: ExportEmbeddingsIncludeOptions;
}

/**
 * Exported object identity and context for a single embedding row.
 */
export interface ExportedEmbeddingObject {
    id: string;
    name: string;
    external_id?: string;
    type?: {
        id?: string;
        code?: string;
        name?: string;
    };
    location: string;
    content?: {
        source?: string;
        type?: string;
        name?: string;
        etag?: string;
    };
    created_at: string;
    updated_at: string;
    revision?: RevisionInfo;
    properties?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}

/**
 * One exported content object with all requested embeddings present on that object.
 */
export interface ExportedEmbeddingRecord {
    object: ExportedEmbeddingObject;
    embeddings: Partial<Record<SupportedEmbeddingTypes, Embedding>>;
}

/**
 * One cursor page of exported embeddings.
 */
export interface ExportEmbeddingsPageResponse {
    schema_version: 1;
    items: ExportedEmbeddingRecord[];
    has_more: boolean;
    next_cursor?: string;
    exported_count: number;
}
