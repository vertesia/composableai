import type { VertesiaClient } from '@vertesia/client';
import {
    DOCUMENT_COMMENTS_ARTIFACT_PATH,
    type DocumentCommentsArtifact,
    emptyDocumentCommentsArtifact,
} from '@vertesia/common';

/** True only when the artifact genuinely does not exist yet (vs. a transient/auth error). */
function isArtifactNotFound(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const status = (err as { status?: number }).status;
    if (status === 404) return true;
    const message = (err as { message?: string }).message;
    return typeof message === 'string' && /\b404\b|not found/i.test(message);
}

/**
 * Load a run's document comments artifact.
 *
 * Returns an empty artifact ONLY when the file does not exist yet (the first comment).
 * Any other failure — transient download error, auth error, or malformed JSON — is thrown,
 * so callers can block mutations rather than overwriting existing comments with an empty
 * base.
 */
export async function loadDocumentComments(client: VertesiaClient, runId: string): Promise<DocumentCommentsArtifact> {
    let text: string;
    try {
        const stream = await client.agents.downloadArtifact(runId, DOCUMENT_COMMENTS_ARTIFACT_PATH);
        text = await new Response(stream).text();
    } catch (err) {
        if (isArtifactNotFound(err)) {
            return emptyDocumentCommentsArtifact('');
        }
        throw err;
    }
    // A present-but-unparseable file is a real error (do NOT treat as "no comments").
    const parsed = JSON.parse(text) as Partial<DocumentCommentsArtifact>;
    return {
        schema_version: typeof parsed.schema_version === 'number' ? parsed.schema_version : 1,
        updated_at: parsed.updated_at ?? '',
        comments: Array.isArray(parsed.comments) ? parsed.comments : [],
        batches: Array.isArray(parsed.batches) ? parsed.batches : [],
        active_batch_id: parsed.active_batch_id,
    };
}

/** Persist the comments artifact, stamping `updated_at`. */
export async function saveDocumentComments(
    client: VertesiaClient,
    runId: string,
    artifact: DocumentCommentsArtifact,
    now: string,
): Promise<void> {
    const payload: DocumentCommentsArtifact = { ...artifact, updated_at: now };
    await client.agents.uploadArtifact(
        runId,
        DOCUMENT_COMMENTS_ARTIFACT_PATH,
        JSON.stringify(payload, null, 2),
        'application/json',
    );
}
