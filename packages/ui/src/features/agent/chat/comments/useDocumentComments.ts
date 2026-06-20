import {
    type DocumentComment,
    type DocumentCommentAnchor,
    type DocumentCommentBatch,
    type DocumentCommentStatus,
    type DocumentCommentsArtifact,
    emptyDocumentCommentsArtifact,
} from '@vertesia/common';
import { useUserSession } from '@vertesia/ui/session';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadDocumentComments, saveDocumentComments } from './documentCommentsStore.js';

type LoadStatus = 'loading' | 'ready' | 'error';

export interface UseDocumentCommentsResult {
    /** Comments anchored to the given document, in document order. */
    comments: DocumentComment[];
    isLoading: boolean;
    /** True once the artifact has loaded successfully and mutations are safe. */
    isReady: boolean;
    addComment: (anchor: DocumentCommentAnchor, body: string) => Promise<void>;
    setCommentStatus: (id: string, status: DocumentCommentStatus) => Promise<void>;
    deleteComment: (id: string) => Promise<void>;
    /** Record a batch of comments as sent to the agent and return it (sets active_batch_id). */
    createBatch: (commentIds: string[], instruction?: string) => Promise<DocumentCommentBatch>;
    /** Identifier used as the author of comments created in this session. */
    currentAuthor: string;
}

/**
 * Loads and mutates the run-scoped document comments artifact, scoped to one document.
 *
 * Safety properties (the comments artifact may be written concurrently by the UI and, in
 * Phase 3, the agent):
 *  - Mutations are blocked until the initial load succeeds (`isReady`). A failed load does
 *    not silently become an empty base that could overwrite existing comments.
 *  - Each mutation re-loads the latest artifact, applies a targeted change, then saves —
 *    so a concurrent writer's additions/statuses are merged rather than clobbered.
 *  - Mutations are serialized so two quick UI actions can't race their own reads/writes.
 */
export function useDocumentComments(runId: string | undefined, documentPath: string): UseDocumentCommentsResult {
    const { client, authToken } = useUserSession();
    const currentAuthor = authToken?.sub ?? 'user';
    const [artifact, setArtifact] = useState<DocumentCommentsArtifact>(() => emptyDocumentCommentsArtifact(''));
    const [status, setStatus] = useState<LoadStatus>(runId ? 'loading' : 'ready');

    const statusRef = useRef(status);
    statusRef.current = status;
    // Serializes mutations so each reads the result of the previous one.
    const chainRef = useRef<Promise<void>>(Promise.resolve());

    useEffect(() => {
        if (!runId) {
            setArtifact(emptyDocumentCommentsArtifact(''));
            setStatus('ready');
            return;
        }
        let cancelled = false;
        setStatus('loading');
        loadDocumentComments(client, runId)
            .then((loaded) => {
                if (!cancelled) {
                    setArtifact(loaded);
                    setStatus('ready');
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    console.error('Failed to load document comments:', err);
                    setStatus('error');
                }
            });
        return () => {
            cancelled = true;
        };
    }, [client, runId]);

    const mutate = useCallback(
        (apply: (artifact: DocumentCommentsArtifact) => DocumentCommentsArtifact): Promise<void> => {
            const run = async () => {
                if (statusRef.current !== 'ready' || !runId) {
                    throw new Error('Document comments are not ready');
                }
                // Merge-on-save: reload the latest artifact so a concurrent agent/UI write is
                // merged with this change rather than overwritten by a stale local snapshot.
                const latest = await loadDocumentComments(client, runId);
                const merged = apply(latest);
                await saveDocumentComments(client, runId, merged, new Date().toISOString());
                setArtifact(merged);
            };
            const next = chainRef.current.then(run, run);
            chainRef.current = next.catch(() => {});
            return next;
        },
        [client, runId],
    );

    const addComment = useCallback(
        (anchor: DocumentCommentAnchor, body: string) => {
            const now = new Date().toISOString();
            const comment: DocumentComment = {
                id: crypto.randomUUID(),
                document_path: documentPath,
                anchor,
                body,
                author: currentAuthor,
                status: 'open',
                created_at: now,
                updated_at: now,
            };
            return mutate((a) => ({ ...a, comments: [...a.comments, comment] }));
        },
        [documentPath, currentAuthor, mutate],
    );

    const setCommentStatus = useCallback(
        (id: string, nextStatus: DocumentCommentStatus) => {
            const now = new Date().toISOString();
            return mutate((a) => ({
                ...a,
                comments: a.comments.map((c) => (c.id === id ? { ...c, status: nextStatus, updated_at: now } : c)),
            }));
        },
        [mutate],
    );

    const deleteComment = useCallback(
        (id: string) => mutate((a) => ({ ...a, comments: a.comments.filter((c) => c.id !== id) })),
        [mutate],
    );

    const createBatch = useCallback(
        async (commentIds: string[], instruction?: string): Promise<DocumentCommentBatch> => {
            const batch: DocumentCommentBatch = {
                id: crypto.randomUUID(),
                document_path: documentPath,
                comment_ids: commentIds,
                instruction,
                status: 'sent',
                created_at: new Date().toISOString(),
            };
            await mutate((a) => ({ ...a, batches: [...a.batches, batch], active_batch_id: batch.id }));
            return batch;
        },
        [documentPath, mutate],
    );

    const comments = useMemo(
        () => artifact.comments.filter((c) => c.document_path === documentPath),
        [artifact, documentPath],
    );

    return {
        comments,
        isLoading: status === 'loading',
        isReady: status === 'ready',
        addComment,
        setCommentStatus,
        deleteComment,
        createBatch,
        currentAuthor,
    };
}
