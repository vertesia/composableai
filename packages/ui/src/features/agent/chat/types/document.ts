export type OpenDocumentKind = 'object' | 'artifact';

export interface OpenDocument {
    /**
     * Stable key for tab selection and dedupe. For persisted store objects this is the
     * object id; for run-scoped artifact drafts it is `artifact:<path>`.
     */
    id: string;
    /** Whether this is a persisted content object (read-only here) or an editable run artifact. */
    kind: OpenDocumentKind;
    title: string;
    /** Revision-chain key used to dedupe multiple revisions of the same object (object kind). */
    revisionRootId?: string;
    /** Artifact path within the run workspace (artifact kind), e.g. `files/plan.md`. */
    artifactPath?: string;
}
