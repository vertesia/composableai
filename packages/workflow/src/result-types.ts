


/**
 * The result of a text extraction operation.
 */
export interface TextExtractionResult {
    objectId?: string;
    source_url?: string;
    status: TextExtractionStatus;
    hasText: boolean;
    message?: string;
    tokens?: {
        count: number;
        encoding: string;
        etag: string;
    };
    len?: number;
    error?: string;
}

export enum TextExtractionStatus {
    skipped = "skipped",
    success = "success",
    error = "error",
}