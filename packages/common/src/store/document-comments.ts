/**
 * Data model for run-scoped document comments in the agent runner.
 *
 * The human leaves comments anchored to text while editing a markdown draft artifact.
 * Comments are persisted as a single JSON artifact ({@link DOCUMENT_COMMENTS_ARTIFACT_PATH})
 * which is the source of truth. To ask the agent to address them, the UI writes a batch
 * into this artifact and sends a pointer-only `UserInput` signal (no comment bodies in the
 * signal); the agent reads the artifact, applies the edits, and resolves the comments.
 *
 * Field names are snake_case because this model is serialized to a JSON artifact the agent
 * reads directly.
 */

/**
 * W3C Web Annotation-style text-quote anchor. Survives concurrent human/agent edits by
 * re-locating the quote (with surrounding context) rather than trusting absolute offsets.
 */
export interface DocumentCommentAnchor {
    /** Exact selected text the comment is attached to. */
    quote: string;
    /** Up to ~32 characters immediately before the quote (disambiguates repeated text). */
    prefix: string;
    /** Up to ~32 characters immediately after the quote. */
    suffix: string;
    /** ProseMirror positions at creation time — a render hint only, never trusted across edits. */
    pm_from?: number;
    pm_to?: number;
}

export type DocumentCommentStatus = 'open' | 'resolved' | 'wontfix';

export interface DocumentCommentReply {
    id: string;
    /** Author user id, or 'agent' for the assistant. */
    author: string;
    body: string;
    /** ISO timestamp. */
    created_at: string;
}

export interface DocumentComment {
    id: string;
    /** Artifact path of the document this comment anchors to, e.g. `files/plan.md`. */
    document_path: string;
    anchor: DocumentCommentAnchor;
    body: string;
    /** Author user id, or 'agent' for the assistant. */
    author: string;
    status: DocumentCommentStatus;
    /** ISO timestamp. */
    created_at: string;
    /** ISO timestamp. */
    updated_at: string;
    replies?: DocumentCommentReply[];
}

export type DocumentCommentBatchStatus = 'queued' | 'sent' | 'processing' | 'resolved' | 'failed';

/** A set of comments sent to the agent together for a single revision pass. */
export interface DocumentCommentBatch {
    id: string;
    /** Artifact path of the document the batch targets. */
    document_path: string;
    comment_ids: string[];
    /** Optional free-form instruction accompanying the batch. */
    instruction?: string;
    status: DocumentCommentBatchStatus;
    /** ISO timestamp. */
    created_at: string;
}

/** The whole comments artifact — the source of truth for a run's document comments. */
export interface DocumentCommentsArtifact {
    schema_version: number;
    /** ISO timestamp of the last write. */
    updated_at: string;
    comments: DocumentComment[];
    batches: DocumentCommentBatch[];
    /** The batch most recently sent to the agent, if any. */
    active_batch_id?: string;
}

/** Current schema version of {@link DocumentCommentsArtifact}. */
export const DOCUMENT_COMMENTS_SCHEMA_VERSION = 1;

/** Artifact path where a run's document comments are stored. */
export const DOCUMENT_COMMENTS_ARTIFACT_PATH = 'files/document-comments.json';

/** An empty comments artifact at the current schema version. */
export function emptyDocumentCommentsArtifact(now: string): DocumentCommentsArtifact {
    return {
        schema_version: DOCUMENT_COMMENTS_SCHEMA_VERSION,
        updated_at: now,
        comments: [],
        batches: [],
    };
}
