import type { ReasoningEffort } from '@llumiverse/common';

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

export interface StopSignal {
    message?: string;
    /**
     * Client-generated id used to correlate a Stop signal with the persisted
     * IDLE marker emitted by the workflow.
     */
    client_message_id?: string;
    metadata?: Record<string, unknown>;
    auth_token?: string;
}

/**
 * Changes the model used by subsequent turns of a running conversation.
 *
 * The workflow keeps the current execution environment/provider. This is intended for compatible
 * model switches within that environment (for example Opus/Sonnet or Terra/Sol). An omitted field
 * preserves its current value; `effort: null` returns to the provider/model default.
 */
export interface ModelConfigChangedSignal {
    model?: string;
    effort?: ReasoningEffort | null;
}

/** Name of the signal that carries an {@link AllocateBudgetSignal}. */
export const ALLOCATE_BUDGET_SIGNAL = 'AllocateBudget';

/**
 * Adds token budget to a run that is paused because its budget ran out. Only interactive runs pause;
 * others end with `token_budget_exhausted`. The allocation adds to the limit the run was granted, so
 * usage past that limit is paid out of it: a run granted 1,000,000 that used 1,050,000 has 450,000
 * left after an allocation of 500,000.
 */
export interface AllocateBudgetSignal {
    /** Weighted tokens to add. Must be positive. */
    additional_tokens: number;
    /** Principal that granted the allocation. */
    requested_by?: string;
    /** Epoch milliseconds when the allocation was granted. */
    requested_at?: number;
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
