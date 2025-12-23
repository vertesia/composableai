export interface UserInputSignal {
    message: string;
    metadata?: Record<string, any>;
    auth_token?: string;
    /**
     * Email attachments to be processed as store objects.
     * These will be downloaded, uploaded to store, and processed for text extraction
     * before the conversation continues.
     */
    attachments?: EmailAttachment[];
}

/**
 * Email attachment metadata for processing in conversation workflows.
 */
export interface EmailAttachment {
    /** Original filename */
    filename: string;
    /** MIME content type */
    content_type: string;
    /** Size in bytes */
    size: number;
    /** Resend download URL (temporary, expires) */
    download_url: string;
}
