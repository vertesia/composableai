import {
    type DocumentComment,
    type DocumentCommentAnchor,
    type DocumentCommentStatus,
    type DocumentCommentsArtifact,
    emptyDocumentCommentsArtifact,
} from '@vertesia/common';
import { useUserSession } from '@vertesia/ui/session';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadDocumentComments, saveDocumentComments } from './documentCommentsStore.js';

export interface UseDocumentCommentsResult {
    /** Comments anchored to the given document, newest last. */
    comments: DocumentComment[];
    isLoading: boolean;
    addComment: (anchor: DocumentCommentAnchor, body: string) => Promise<void>;
    setCommentStatus: (id: string, status: DocumentCommentStatus) => Promise<void>;
    deleteComment: (id: string) => Promise<void>;
    /** Identifier used as the author of comments created in this session. */
    currentAuthor: string;
}

/**
 * Loads and mutates the run-scoped document comments artifact, scoped to a single document.
 * Writes are optimistic (local state updates immediately) and persisted to the artifact.
 */
export function useDocumentComments(runId: string | undefined, documentPath: string): UseDocumentCommentsResult {
    const { client, authToken } = useUserSession();
    const currentAuthor = authToken?.sub ?? 'user';
    const [artifact, setArtifact] = useState<DocumentCommentsArtifact>(() => emptyDocumentCommentsArtifact(''));
    const [isLoading, setIsLoading] = useState<boolean>(Boolean(runId));

    // Mirror the latest artifact in a ref so mutations don't need it as a dependency.
    const artifactRef = useRef(artifact);
    artifactRef.current = artifact;

    useEffect(() => {
        if (!runId) {
            setArtifact(emptyDocumentCommentsArtifact(''));
            setIsLoading(false);
            return;
        }
        let cancelled = false;
        setIsLoading(true);
        void loadDocumentComments(client, runId).then((loaded) => {
            if (!cancelled) {
                setArtifact(loaded);
                setIsLoading(false);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [client, runId]);

    const persist = useCallback(
        async (next: DocumentCommentsArtifact) => {
            setArtifact(next);
            artifactRef.current = next;
            if (runId) {
                await saveDocumentComments(client, runId, next, new Date().toISOString());
            }
        },
        [client, runId],
    );

    const addComment = useCallback(
        async (anchor: DocumentCommentAnchor, body: string) => {
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
            await persist({ ...artifactRef.current, comments: [...artifactRef.current.comments, comment] });
        },
        [documentPath, currentAuthor, persist],
    );

    const setCommentStatus = useCallback(
        async (id: string, status: DocumentCommentStatus) => {
            const now = new Date().toISOString();
            await persist({
                ...artifactRef.current,
                comments: artifactRef.current.comments.map((c) =>
                    c.id === id ? { ...c, status, updated_at: now } : c,
                ),
            });
        },
        [persist],
    );

    const deleteComment = useCallback(
        async (id: string) => {
            await persist({
                ...artifactRef.current,
                comments: artifactRef.current.comments.filter((c) => c.id !== id),
            });
        },
        [persist],
    );

    const comments = useMemo(
        () => artifact.comments.filter((c) => c.document_path === documentPath),
        [artifact, documentPath],
    );

    return { comments, isLoading, addComment, setCommentStatus, deleteComment, currentAuthor };
}
