export interface OpenDocument {
    id: string;
    title: string;
    /** Revision chain key used to dedupe multiple revisions of the same document. */
    revisionRootId?: string;
}
