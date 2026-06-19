import type { VertesiaClient } from '@vertesia/client';
import {
    DOCUMENT_COMMENTS_ARTIFACT_PATH,
    type DocumentCommentsArtifact,
    emptyDocumentCommentsArtifact,
} from '@vertesia/common';

/**
 * Load a run's document comments artifact. Returns an empty artifact when the file does
 * not exist yet (the first comment) or cannot be parsed.
 */
export async function loadDocumentComments(client: VertesiaClient, runId: string): Promise<DocumentCommentsArtifact> {
    try {
        const stream = await client.agents.downloadArtifact(runId, DOCUMENT_COMMENTS_ARTIFACT_PATH);
        const text = await new Response(stream).text();
        const parsed = JSON.parse(text) as Partial<DocumentCommentsArtifact>;
        return {
            schema_version: typeof parsed.schema_version === 'number' ? parsed.schema_version : 1,
            updated_at: parsed.updated_at ?? '',
            comments: Array.isArray(parsed.comments) ? parsed.comments : [],
            batches: Array.isArray(parsed.batches) ? parsed.batches : [],
            active_batch_id: parsed.active_batch_id,
        };
    } catch {
        return emptyDocumentCommentsArtifact('');
    }
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
