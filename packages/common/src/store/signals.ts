export interface UserInputSignal {
    message: string;
    metadata?: Record<string, any>;
    auth_token?: string;
    /**
     * Attachments to be processed as store objects.
     * These will be downloaded, uploaded to store, and processed for text extraction
     * before the conversation continues.
     */
    attachments?: Attachment[];
}

/**
 * Attachment metadata for processing in conversation workflows.
 */
export interface Attachment {
    /** Original filename */
    filename: string;
    /** MIME content type */
    content_type: string;
    /** Size in bytes */
    size: number;
    /** Download URL (temporary, may expire) */
    download_url: string;
}
