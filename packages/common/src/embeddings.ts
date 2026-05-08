import type { EmbeddingsResult, EmbeddingTaskType } from "@llumiverse/common";

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
    type: "text";
    text: string;
    task_type?: EmbeddingTaskType;
    title?: string;
    truncate?: "NONE" | "START" | "END";
}

export interface EmbeddingsApiImageInput {
    type: "image";
    source: EmbeddingsApiSource;
}

export interface EmbeddingsApiVideoInput {
    type: "video";
    source: EmbeddingsApiSource;
    start_sec?: number;
    length_sec?: number;
    interval_sec?: number;
    use_fixed_length_sec?: boolean;
    min_clip_sec?: number;
    embedding_option?: ("visual-text" | "visual-image" | "audio")[];
}

export interface EmbeddingsApiAudioInput {
    type: "audio";
    source: EmbeddingsApiSource;
    start_sec?: number;
    length_sec?: number;
}

export interface EmbeddingsApiRequest {
    inputs: EmbeddingsApiInput[];
    model?: string;
    task_type?: EmbeddingTaskType;
    dimensions?: number;
    output_dtype?: "float" | "binary" | "int8";
    truncate?: "NONE" | "START" | "END";
}

/**
 * Wire-format result. Identical to @llumiverse/common's EmbeddingsResult
 * (vectors and metadata are JSON-friendly), re-exported here for callers
 * that prefer to consume types from @vertesia/common.
 */
export type EmbeddingsApiResult = EmbeddingsResult;
