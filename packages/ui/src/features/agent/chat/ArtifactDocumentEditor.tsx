import type { Editor } from '@tiptap/core';
import type { DocumentCommentAnchor } from '@vertesia/common';
import { Button, useToast } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { RichTextMarkdownEditor } from '@vertesia/ui/widgets';
import { AlertCircleIcon, CheckIcon, Loader2Icon, MessageSquareIcon, MessageSquarePlusIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { captureAnchor } from './comments/anchoring.js';
import { DocumentCommentsSidebar } from './comments/DocumentCommentsSidebar.js';
import { useDocumentComments } from './comments/useDocumentComments.js';

const AUTOSAVE_DELAY_MS = 800;

type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

interface ArtifactDocumentEditorProps {
    /** Agent run that owns the artifact workspace. */
    runId: string;
    /** Artifact path, e.g. `files/plan.md`. */
    artifactPath: string;
    /**
     * When false the editor is read-only — e.g. while an agent turn is revising the
     * document. Defaults to true.
     */
    editable?: boolean;
    /** Bumping this re-fetches the artifact (e.g. after the agent edits it). */
    refreshKey?: number;
}

/**
 * Editable view of a run-scoped markdown artifact. Markdown is the source of truth: the
 * artifact text is loaded into {@link RichTextMarkdownEditor} and changes are autosaved
 * back to the artifact (debounced, flushed on unmount). Users can attach comments to a
 * text selection; comments are anchored via a text-quote selector and persisted alongside
 * the document.
 */
export function ArtifactDocumentEditor({
    runId,
    artifactPath,
    editable = true,
    refreshKey = 0,
}: ArtifactDocumentEditorProps) {
    const { client } = useUserSession();
    const { t } = useUITranslation();
    const toast = useToast();
    const [content, setContent] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

    const pendingRef = useRef<string | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fetchGenRef = useRef(0);

    const {
        comments,
        isReady: commentsReady,
        isLoading: commentsLoading,
        addComment,
        setCommentStatus,
        deleteComment,
        currentAuthor,
    } = useDocumentComments(runId, artifactPath);

    const [editor, setEditor] = useState<Editor | null>(null);
    const lastSelectionRef = useRef<{ from: number; to: number } | null>(null);
    const [hasSelection, setHasSelection] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [pendingAnchor, setPendingAnchor] = useState<DocumentCommentAnchor | null>(null);

    const fetchContent = useCallback(async () => {
        const gen = ++fetchGenRef.current;
        setIsLoading(true);
        setError(null);
        try {
            const stream = await client.agents.downloadArtifact(runId, artifactPath);
            const text = await new Response(stream).text();
            if (gen === fetchGenRef.current) {
                setContent(text);
            }
        } catch (err: unknown) {
            if (gen === fetchGenRef.current) {
                setError(err instanceof Error ? err.message : t('agent.failedToLoadDocument'));
                setContent(null);
            }
        } finally {
            if (gen === fetchGenRef.current) {
                setIsLoading(false);
            }
        }
    }, [client, runId, artifactPath, t]);

    // Initial load + document switch (a stale in-flight fetch is ignored via the generation counter).
    useEffect(() => {
        void fetchContent();
    }, [fetchContent]);

    // Refresh (e.g. the agent edited the artifact): the remote copy is authoritative, so
    // discard any stale local pending save before reloading — otherwise the debounced flush
    // could upload the older user text back over the agent's edit. Guarding on the previous
    // refreshKey makes this react only to refresh bumps, not to fetchContent identity changes
    // from a document switch (which the load effect above already handles).
    const prevRefreshKey = useRef(refreshKey);
    useEffect(() => {
        if (prevRefreshKey.current === refreshKey) {
            return;
        }
        prevRefreshKey.current = refreshKey;
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        pendingRef.current = null;
        void fetchContent();
    }, [refreshKey, fetchContent]);

    const flush = useCallback(async () => {
        const md = pendingRef.current;
        if (md == null) {
            return;
        }
        pendingRef.current = null;
        setSaveStatus('saving');
        try {
            await client.agents.uploadArtifact(runId, artifactPath, md, 'text/markdown');
            setSaveStatus('saved');
        } catch (err: unknown) {
            console.error('Failed to save document artifact:', err);
            setSaveStatus('error');
        }
    }, [client, runId, artifactPath]);

    const handleChange = useCallback(
        (markdown: string) => {
            // Keep local content controlled so the editor's dirty state is acknowledged each
            // change, and a later external refetch can be distinguished from the user's edits.
            setContent(markdown);
            pendingRef.current = markdown;
            setSaveStatus('unsaved');
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            timerRef.current = setTimeout(() => void flush(), AUTOSAVE_DELAY_MS);
        },
        [flush],
    );

    // Flush any pending edit when unmounting or when the target document changes (flush runs
    // with the previous document's path because `flush` is in the dependency list).
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            if (pendingRef.current != null) {
                void flush();
            }
        };
    }, [flush]);

    // Track the active text selection — registered with cleanup so listeners aren't duplicated.
    useEffect(() => {
        if (!editor) {
            return;
        }
        const update = () => {
            const { from, to } = editor.state.selection;
            const selecting = from !== to;
            setHasSelection(selecting);
            if (selecting) {
                lastSelectionRef.current = { from, to };
            }
        };
        editor.on('selectionUpdate', update);
        return () => {
            editor.off('selectionUpdate', update);
        };
    }, [editor]);

    const startComment = useCallback(() => {
        const selection = lastSelectionRef.current;
        if (!editor || !selection || selection.from === selection.to) {
            return;
        }
        const anchor = captureAnchor(editor.state.doc, selection.from, selection.to);
        if (!anchor.quote.trim()) {
            return;
        }
        setPendingAnchor(anchor);
        setShowComments(true);
    }, [editor]);

    const notifyFailure = useCallback(
        (err: unknown) => {
            console.error('Document comment operation failed:', err);
            toast({ status: 'error', title: t('agent.documentSaveFailed') });
        },
        [toast, t],
    );

    const submitPending = useCallback(
        (body: string) => {
            if (!pendingAnchor) return;
            void addComment(pendingAnchor, body).catch(notifyFailure);
            setPendingAnchor(null);
        },
        [pendingAnchor, addComment, notifyFailure],
    );

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2Icon className="size-5 animate-spin text-muted" />
                <span className="ms-2 text-sm text-muted">{t('agent.loadingDocument')}</span>
            </div>
        );
    }
    if (error) {
        return <div className="p-4 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>;
    }
    if (content == null) {
        return null;
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-1 pb-2 mb-2 border-b border-muted/20 shrink-0">
                <Button
                    variant="ghost"
                    size="sm"
                    disabled={!hasSelection || !editable || !commentsReady}
                    onClick={startComment}
                >
                    <MessageSquarePlusIcon className="size-4 me-1" />
                    {t('agent.addComment')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowComments((s) => !s)}>
                    <MessageSquareIcon className="size-4 me-1" />
                    {t('agent.comments')}
                    {comments.length > 0 ? ` (${comments.length})` : ''}
                </Button>
                <div className="ms-auto">
                    <SaveIndicator status={saveStatus} editable={editable} />
                </div>
            </div>

            <div className="flex-1 flex min-h-0 gap-2">
                <div className="flex-1 overflow-y-auto">
                    <RichTextMarkdownEditor
                        value={content}
                        editable={editable}
                        onChange={handleChange}
                        onReady={setEditor}
                    />
                </div>
                {showComments && (
                    <div className="w-64 shrink-0 border-s border-muted/20 overflow-hidden">
                        <DocumentCommentsSidebar
                            comments={comments}
                            isLoading={commentsLoading}
                            currentAuthor={currentAuthor}
                            editable={editable && commentsReady}
                            pendingAnchor={pendingAnchor}
                            onSubmitPending={submitPending}
                            onCancelPending={() => setPendingAnchor(null)}
                            onSetStatus={(id, status) => void setCommentStatus(id, status).catch(notifyFailure)}
                            onDelete={(id) => void deleteComment(id).catch(notifyFailure)}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

function SaveIndicator({ status, editable }: { status: SaveStatus; editable: boolean }) {
    const { t } = useUITranslation();
    if (!editable) {
        return <div className="text-xs text-muted">{t('agent.documentReadOnlyWhileAgentWorks')}</div>;
    }
    if (status === 'idle') {
        return null;
    }
    return (
        <div className="text-xs flex items-center gap-1">
            {status === 'saving' && (
                <>
                    <Loader2Icon className="size-3 animate-spin text-muted" />
                    <span className="text-muted">{t('agent.documentSaving')}</span>
                </>
            )}
            {status === 'unsaved' && <span className="text-muted">{t('agent.documentUnsaved')}</span>}
            {status === 'saved' && (
                <>
                    <CheckIcon className="size-3 text-success" />
                    <span className="text-success">{t('agent.documentSaved')}</span>
                </>
            )}
            {status === 'error' && (
                <>
                    <AlertCircleIcon className="size-3 text-destructive" />
                    <span className="text-destructive">{t('agent.documentSaveFailed')}</span>
                </>
            )}
        </div>
    );
}
