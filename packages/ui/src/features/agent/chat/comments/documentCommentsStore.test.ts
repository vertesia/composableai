import type { VertesiaClient } from '@vertesia/client';
import { DOCUMENT_COMMENTS_ARTIFACT_PATH } from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
import { loadDocumentComments } from './documentCommentsStore.js';

function clientWith(download: (runId: string, path: string) => Promise<ReadableStream>): VertesiaClient {
    return { agents: { downloadArtifact: vi.fn(download) } } as unknown as VertesiaClient;
}

/** A ReadableStream carrying `text`, matching what `client.agents.downloadArtifact` resolves to. */
function streamOf(text: string): ReadableStream {
    return new Response(text).body as ReadableStream;
}

describe('loadDocumentComments', () => {
    it('returns an empty artifact when the file does not exist (404 status on the error)', async () => {
        // The signed URL is granted without an existence check, so a missing artifact 404s at
        // the GCS fetch; downloadArtifact surfaces that as an error carrying `status: 404`.
        const client = clientWith(() =>
            Promise.reject(Object.assign(new Error('Failed to download artifact: 404'), { status: 404 })),
        );
        const result = await loadDocumentComments(client, 'run-1');
        expect(result.comments).toEqual([]);
        expect(result.batches).toEqual([]);
    });

    it('returns an empty artifact when only the message signals not-found (no status)', async () => {
        const client = clientWith(() => Promise.reject(new Error('The requested URL was not found')));
        const result = await loadDocumentComments(client, 'run-1');
        expect(result.comments).toEqual([]);
    });

    it('throws on a real failure so existing comments are never clobbered', async () => {
        const client = clientWith(() =>
            Promise.reject(Object.assign(new Error('Internal Server Error'), { status: 500 })),
        );
        await expect(loadDocumentComments(client, 'run-1')).rejects.toThrow();
    });

    it('parses an existing comments artifact', async () => {
        const artifact = {
            schema_version: 1,
            updated_at: '2026-07-20T00:00:00.000Z',
            comments: [
                {
                    id: 'c1',
                    document_path: 'files/plan.md',
                    anchor: { quote: 'x' },
                    body: 'hi',
                    author: 'user',
                    status: 'open',
                    created_at: '',
                    updated_at: '',
                },
            ],
            batches: [],
        };
        const download = vi.fn(() => Promise.resolve(streamOf(JSON.stringify(artifact))));
        const client = clientWith(download);
        const result = await loadDocumentComments(client, 'run-1');
        expect(result.comments).toHaveLength(1);
        expect(result.comments[0].id).toBe('c1');
        expect(download).toHaveBeenCalledWith('run-1', DOCUMENT_COMMENTS_ARTIFACT_PATH);
    });
});
