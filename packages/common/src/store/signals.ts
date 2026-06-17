export interface UserInputSignal {
    message: string;
    /**
     * Client-generated id used to correlate a UserInput signal with the
     * persisted QUESTION message emitted by the workflow.
     */
    client_message_id?: string;
    metadata?: Record<string, unknown>;
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
