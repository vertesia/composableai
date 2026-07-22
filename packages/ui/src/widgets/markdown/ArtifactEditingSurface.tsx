import { Button, Center, cn, errorMessage, MessageBox, Spinner, useToast, VTooltip } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { Check, GitCommitHorizontal } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    applyMarkdownEditingChange,
    CollaborativeMarkdownRenderer,
    type MarkdownEditingAction,
} from './CollaborativeMarkdownRenderer.js';
import { getTextLineChangeRegions, rebaseTextChanges } from './textDiff.js';

const HYDRATION_RETRY_DELAY_MS = 500;
const HYDRATION_RETRY_LIMIT = 60;
const DOCUMENT_SAVE_DEBOUNCE_MS = 400;

const MarkdownDocumentEditor = lazy(() =>
    import('@vertesia/ui/rich-text').then((module) => ({ default: module.VertesiaMarkdownDocumentEditor })),
);

export function isArtifactRefreshEvent(details: Record<string, unknown> | undefined, path: string): boolean {
    if (details?.path !== path) return false;
    if (details.event_class === 'artifact_updated') return true;

    // Compatibility for runs handled by workers that predate the dedicated
    // artifact_updated event. Their path-bearing completion is still reliable.
    return (
        details.event_class === 'activity' &&
        details.tool_status === 'completed' &&
        (details.tool === 'edit_artifact' || details.tool === 'write_artifact')
    );
}

export function applyArtifactRefreshChanges(
    content: string,
    details: Record<string, unknown> | undefined,
): string | undefined {
    if (!Array.isArray(details?.changes) || details.changes.length === 0) return undefined;

    let updated = content;
    for (const value of details.changes) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
        const change = value as Record<string, unknown>;
        if (change.operation !== 'replace' || typeof change.before !== 'string' || typeof change.after !== 'string') {
            return undefined;
        }

        if (!updated.includes(change.before)) return undefined;
        if (change.replace_all === true) {
            updated = updated.split(change.before).join(change.after);
        } else {
            if (updated.indexOf(change.before) !== updated.lastIndexOf(change.before)) return undefined;
            updated = updated.replace(change.before, change.after);
        }
    }

    return updated;
}

function getErrorStatus(error: unknown): number | undefined {
    if (!error || typeof error !== 'object' || !('status' in error)) return undefined;
    return typeof error.status === 'number' ? error.status : undefined;
}

function MarkdownChangeRuler({
    regions,
    totalLines,
    onNavigate,
}: {
    regions: MarkdownChangeRegion[];
    totalLines: number;
    onNavigate: (line: number) => void;
}) {
    const { t } = useUITranslation();
    if (regions.length === 0) return null;

    return (
        <nav
            className="absolute inset-y-12 end-1 z-10 w-3 rounded-full border border-mixer-muted/25 bg-muted/20"
            aria-label={t('agent.changeRuler')}
        >
            {regions.map((region) => {
                const top = (region.startLine / Math.max(1, totalLines)) * 100;
                const height = Math.max(1.5, ((region.endLine - region.startLine + 1) / Math.max(1, totalLines)) * 100);
                return (
                    <VTooltip
                        key={`${region.startLine}:${region.endLine}`}
                        description={t('agent.changedRegion', { line: region.startLine + 1 })}
                        asChild
                    >
                        <button
                            type="button"
                            className="absolute inset-x-0 rounded-full bg-attention transition-colors hover:bg-info focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
                            style={{ top: `${Math.min(98.5, top)}%`, height: `${Math.min(100 - top, height)}%` }}
                            onClick={() => onNavigate(region.startLine)}
                            aria-label={t('agent.changedRegion', { line: region.startLine + 1 })}
                        />
                    </VTooltip>
                );
            })}
        </nav>
    );
}

export interface ArtifactEditingSurfaceDocumentEdit {
    /** Working-copy content the agent last knew (hydration, its own edits, or the last hand-off). */
    previous: string;
    /** Persisted working-copy content after the user's direct edits. */
    current: string;
}

interface ArtifactDocumentConflict {
    baseContent: string;
    localContent: string;
    remoteContent?: string;
    remoteGeneration?: string;
    pendingAction?: MarkdownEditingAction;
}

interface MarkdownDocumentEditorHandle {
    getMarkdown(): string;
    commands: {
        setContent(content: string, options: { contentType: 'markdown'; emitUpdate: boolean }): boolean;
    };
}

/** Working-copy save state of the document editor. `idle` means nothing to show. */
export type ArtifactSaveStatus = 'idle' | 'saving' | 'saved';

export interface ArtifactEditingSurfaceProps {
    runId?: string;
    path: string;
    initialContent?: string;
    refreshKey?: number;
    refreshDetails?: Record<string, unknown>;
    readOnly?: boolean;
    /** Keep comment controls enabled when content mutations are read-only. */
    allowComments?: boolean;
    viewMode?: 'components' | 'document';
    /** Canonical Markdown used by the full editor's change ruler. */
    baselineContent?: string;
    className?: string;
    onAction?: (action: MarkdownEditingAction) => void | Promise<void>;
    /** Send a composed batch of span comments to the agent as one conversation message. */
    onSendMessage?: (message: string) => void | Promise<void>;
    /** Hand persisted full-document edits to the active agent. */
    onSendChangesToAgent?: () => void | Promise<void>;
    hasUnsentChanges?: boolean;
    isSendingChanges?: boolean;
    sendChangesDisabled?: boolean;
    onContentChange?: (content: string, generation?: string) => void;
    onDocumentEdit?: () => void;
    /**
     * Reports document-editor save state so a parent can render its own indicator
     * (e.g. next to the file name). When provided, the built-in floating badge is
     * suppressed and the parent owns the display.
     */
    onSaveStatusChange?: (status: ArtifactSaveStatus) => void;
    /**
     * Imperative flush used before handing direct full-document edits to the agent.
     * Resolves false when the flush failed; otherwise returns the delta since the
     * agent's last known state and advances that baseline to the flushed content.
     */
    flushChangesRef?: React.MutableRefObject<(() => Promise<false | ArtifactEditingSurfaceDocumentEdit>) | null>;
}

export interface MarkdownChangeRegion {
    startLine: number;
    endLine: number;
}

/** Maps structured diff hunks onto current-document line numbers. */
export function getMarkdownChangeRegions(before: string, after: string): MarkdownChangeRegion[] {
    return getTextLineChangeRegions(before, after);
}

/**
 * Shared artifact-backed Markdown editor used by both agent workspaces and
 * document editing sessions. The artifact is updated conditionally using its
 * backend-neutral blob generation; the previously rendered content stays in
 * place while a newer generation is loading.
 */
export function ArtifactEditingSurface({
    runId,
    path,
    initialContent = '',
    refreshKey = 0,
    refreshDetails,
    readOnly = false,
    allowComments = false,
    viewMode = 'components',
    baselineContent,
    className,
    onAction,
    onSendMessage,
    onSendChangesToAgent,
    hasUnsentChanges = false,
    isSendingChanges = false,
    sendChangesDisabled = false,
    onContentChange,
    onDocumentEdit,
    onSaveStatusChange,
    flushChangesRef,
}: ArtifactEditingSurfaceProps) {
    const { client } = useUserSession();
    const { t } = useUITranslation();
    const toast = useToast();
    const [content, setContent] = useState(initialContent);
    const [generation, setGeneration] = useState<string | undefined>();
    const [highlightChangesFrom, setHighlightChangesFrom] = useState<string | undefined>();
    const [highlightVersion, setHighlightVersion] = useState(0);
    const [isLoading, setIsLoading] = useState(Boolean(runId));
    const [isSavingDocument, setIsSavingDocument] = useState(false);
    const [isDocumentSavePending, setIsDocumentSavePending] = useState(false);
    const [loadError, setLoadError] = useState<string | undefined>();
    const [documentConflict, setDocumentConflict] = useState<ArtifactDocumentConflict>();
    const [isResolvingConflict, setIsResolvingConflict] = useState(false);
    const commentsEnabled = !readOnly || allowComments;

    // Working-copy save state for the document editor, shared with the built-in badge and
    // optionally reported to a parent that renders its own indicator.
    const saveStatus: ArtifactSaveStatus =
        viewMode !== 'document' || documentConflict
            ? 'idle'
            : isSavingDocument || isDocumentSavePending
              ? 'saving'
              : generation
                ? 'saved'
                : 'idle';
    useEffect(() => {
        onSaveStatusChange?.(saveStatus);
    }, [saveStatus, onSaveStatusChange]);

    const contentRef = useRef(content);
    const generationRef = useRef(generation);
    const loadRequestRef = useRef(0);
    const documentSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const pendingDocumentContentRef = useRef<string | undefined>(undefined);
    const documentSaveInFlightRef = useRef(false);
    const documentSavePromiseRef = useRef<Promise<boolean> | undefined>(undefined);
    const persistPendingDocumentContentRef = useRef<() => Promise<boolean>>(() => Promise.resolve(false));
    const documentEditorFocusedRef = useRef(false);
    // Latches true once the user focuses the editor. The editor re-serializes (normalizes) the
    // loaded Markdown when it mounts — e.g. after switching into edit mode — which fires an onChange
    // that is NOT a user edit. We ignore those pre-interaction changes so they don't autosave the
    // artifact or post a spurious "working copy updated" message to the chat.
    const documentEditorInteractedRef = useRef(false);
    const documentEditorRef = useRef<MarkdownDocumentEditorHandle | null>(null);
    const documentBaseGenerationRef = useRef<string | undefined>(generation);
    const documentBaseContentRef = useRef(initialContent);
    const documentConflictRef = useRef<ArtifactDocumentConflict | undefined>(undefined);
    // Working-copy content the agent is known to have seen: hydration and its own
    // edits (loadContent) plus explicit hand-offs (flushDocumentChanges). Direct user
    // edits are diffed against this baseline when they are sent to the agent.
    const agentKnownContentRef = useRef(initialContent);
    const documentEditorContainerRef = useRef<HTMLDivElement | null>(null);
    const changeRegions = useMemo(
        () => getMarkdownChangeRegions(baselineContent ?? content, content),
        [baselineContent, content],
    );
    const documentLineCount = useMemo(() => content.split('\n').length, [content]);

    const updateDocumentConflict = useCallback((conflict: ArtifactDocumentConflict | undefined) => {
        documentConflictRef.current = conflict;
        setDocumentConflict(conflict);
    }, []);

    useEffect(() => {
        contentRef.current = content;
    }, [content]);

    useEffect(() => {
        generationRef.current = generation;
    }, [generation]);

    // Entering edit mode mounts a fresh editor that re-serializes the loaded content. Require a new
    // user focus before those serialization changes count as edits. Keyed on viewMode (a stable
    // trigger) — not the per-render onEditor callback, which would reset the latch mid-typing.
    useEffect(() => {
        if (viewMode !== 'document') return;
        documentEditorInteractedRef.current = false;
        documentEditorFocusedRef.current = false;
    }, [viewMode]);

    const loadContent = useCallback(
        async (allowHydrationRetry: boolean) => {
            if (!runId) return;
            const requestId = ++loadRequestRef.current;
            setIsLoading(true);
            setLoadError(undefined);

            for (let attempt = 0; attempt <= HYDRATION_RETRY_LIMIT; attempt++) {
                try {
                    const response = await client.agents.getArtifactContent(runId, path);
                    if (loadRequestRef.current !== requestId) return;
                    const previousContent = contentRef.current;
                    if (previousContent && previousContent !== response.content) {
                        setHighlightChangesFrom(previousContent);
                        setHighlightVersion((value) => value + 1);
                    }
                    contentRef.current = response.content;
                    generationRef.current = response.generation;
                    // Server states reached outside the user's typing pipeline come from
                    // hydration or the agent's own tools, so the agent knows them.
                    agentKnownContentRef.current = response.content;
                    if (
                        !documentEditorFocusedRef.current &&
                        pendingDocumentContentRef.current === undefined &&
                        !documentSaveInFlightRef.current
                    ) {
                        documentBaseGenerationRef.current = response.generation;
                        documentBaseContentRef.current = response.content;
                    }
                    setContent(response.content);
                    setGeneration(response.generation);
                    setLoadError(undefined);
                    setIsLoading(false);
                    onContentChange?.(response.content, response.generation);
                    return;
                } catch (error: unknown) {
                    if (
                        loadRequestRef.current !== requestId ||
                        !allowHydrationRetry ||
                        getErrorStatus(error) !== 404 ||
                        attempt === HYDRATION_RETRY_LIMIT
                    ) {
                        if (loadRequestRef.current !== requestId) return;
                        setLoadError(errorMessage(error, t('agent.failedToLoadArtifact')));
                        setIsLoading(false);
                        return;
                    }
                    await new Promise((resolve) => setTimeout(resolve, HYDRATION_RETRY_DELAY_MS));
                }
            }
        },
        [client, onContentChange, path, runId, t],
    );

    useEffect(() => {
        loadRequestRef.current++;
        contentRef.current = initialContent;
        generationRef.current = undefined;
        agentKnownContentRef.current = initialContent;
        documentBaseGenerationRef.current = undefined;
        documentBaseContentRef.current = initialContent;
        documentConflictRef.current = undefined;
        documentEditorFocusedRef.current = false;
        documentEditorInteractedRef.current = false;
        setContent(initialContent);
        setGeneration(undefined);
        setHighlightChangesFrom(undefined);
        setLoadError(undefined);
        setDocumentConflict(undefined);
        setIsResolvingConflict(false);
        setIsDocumentSavePending(false);
        setIsLoading(Boolean(runId));
        if (runId) void loadContent(true);
        return () => {
            loadRequestRef.current++;
        };
    }, [initialContent, loadContent, runId]);

    useEffect(() => {
        if (!runId || refreshKey <= 0) return;
        if (documentConflictRef.current) return;

        const previousContent = contentRef.current;
        const changedContent = applyArtifactRefreshChanges(previousContent, refreshDetails);
        if (changedContent !== undefined && changedContent !== previousContent) {
            contentRef.current = changedContent;
            generationRef.current = undefined;
            setHighlightChangesFrom(previousContent);
            setHighlightVersion((value) => value + 1);
            setContent(changedContent);
            setGeneration(undefined);
            onContentChange?.(changedContent);
        }

        void loadContent(false);
    }, [loadContent, onContentChange, refreshDetails, refreshKey, runId]);

    const applyResolvedDocumentContent = useCallback(
        (nextContent: string, nextGeneration: string) => {
            const previousContent = contentRef.current;
            contentRef.current = nextContent;
            generationRef.current = nextGeneration;
            documentBaseContentRef.current = nextContent;
            documentBaseGenerationRef.current = nextGeneration;
            pendingDocumentContentRef.current = undefined;
            updateDocumentConflict(undefined);
            if (documentEditorRef.current?.getMarkdown() !== nextContent) {
                documentEditorRef.current?.commands.setContent(nextContent, {
                    contentType: 'markdown',
                    emitUpdate: false,
                });
            }
            if (previousContent !== nextContent) {
                setHighlightChangesFrom(previousContent);
                setHighlightVersion((value) => value + 1);
            }
            setContent(nextContent);
            setGeneration(nextGeneration);
            setIsDocumentSavePending(false);
            onContentChange?.(nextContent, nextGeneration);
        },
        [onContentChange, updateDocumentConflict],
    );

    const reconcileDocumentConflict = useCallback(
        async (
            baseContent: string,
            localContent: string,
            pendingAction?: MarkdownEditingAction,
        ): Promise<false | { content: string; generation: string }> => {
            if (!runId) return false;

            // Preserve the unsaved side immediately. No reload path may replace it
            // until a merge succeeds or the user explicitly leaves the editor.
            contentRef.current = localContent;
            pendingDocumentContentRef.current = undefined;
            setContent(localContent);
            setIsDocumentSavePending(false);
            setIsResolvingConflict(true);

            let remoteContent: string | undefined;
            let remoteGeneration: string | undefined;
            try {
                const remote = await client.agents.getArtifactContent(runId, path);
                remoteContent = remote.content;
                remoteGeneration = remote.generation;
                agentKnownContentRef.current = remote.content;

                const rebased = rebaseTextChanges(baseContent, localContent, remote.content);
                if (rebased.status === 'conflict') {
                    updateDocumentConflict({
                        baseContent,
                        localContent,
                        remoteContent: remote.content,
                        remoteGeneration: remote.generation,
                        pendingAction,
                    });
                    return false;
                }

                let nextGeneration = remote.generation;
                if (rebased.content !== remote.content) {
                    try {
                        const response = await client.agents.updateArtifactContent(runId, path, {
                            content: rebased.content,
                            generation: remote.generation,
                        });
                        nextGeneration = response.generation;
                    } catch (error: unknown) {
                        if (getErrorStatus(error) === 412) {
                            updateDocumentConflict({
                                baseContent: remote.content,
                                localContent: rebased.content,
                                remoteContent: remote.content,
                                remoteGeneration: remote.generation,
                                pendingAction,
                            });
                            return false;
                        }
                        throw error;
                    }
                }

                applyResolvedDocumentContent(rebased.content, nextGeneration);
                toast({ status: 'success', title: t('agent.artifactConflictRebased'), duration: 3000 });
                return { content: rebased.content, generation: nextGeneration };
            } catch (error: unknown) {
                updateDocumentConflict({
                    baseContent,
                    localContent,
                    remoteContent,
                    remoteGeneration,
                    pendingAction,
                });
                toast({
                    status: 'error',
                    title: t('agent.artifactConflictTitle'),
                    description: errorMessage(error, t('agent.failedToLoadArtifact')),
                    duration: 5000,
                });
                return false;
            } finally {
                setIsResolvingConflict(false);
            }
        },
        [applyResolvedDocumentContent, client.agents, path, runId, t, toast, updateDocumentConflict],
    );

    const handleAction = useCallback(
        async (action: MarkdownEditingAction) => {
            if (action.action === 'comment') {
                await onAction?.(action);
                return;
            }

            if (documentConflictRef.current) {
                toast({ status: 'warning', title: t('agent.artifactConflictTitle'), duration: 3000 });
                return;
            }

            if (!runId || !generationRef.current) {
                toast({ status: 'warning', title: t('agent.artifactEditingUnavailable'), duration: 3000 });
                return;
            }

            const previousContent = contentRef.current;
            const nextContent = applyMarkdownEditingChange(previousContent, action);
            if (nextContent === undefined) {
                toast({
                    status: 'error',
                    title: t('agent.documentEditApplyFailed'),
                    description: t('agent.documentEditApplyFailedDescription'),
                    duration: 5000,
                });
                return;
            }

            try {
                const response = await client.agents.updateArtifactContent(runId, path, {
                    content: nextContent,
                    generation: generationRef.current,
                });
                contentRef.current = nextContent;
                generationRef.current = response.generation;
                documentBaseContentRef.current = nextContent;
                documentBaseGenerationRef.current = response.generation;
                setHighlightChangesFrom(previousContent);
                setHighlightVersion((value) => value + 1);
                setContent(nextContent);
                setGeneration(response.generation);
                onContentChange?.(nextContent, response.generation);
                await onAction?.({ ...action, applied: true, base_version: response.generation });
                agentKnownContentRef.current = nextContent;
            } catch (error: unknown) {
                const isConflict = getErrorStatus(error) === 412;
                if (isConflict) {
                    const resolved = await reconcileDocumentConflict(previousContent, nextContent, action);
                    if (resolved) {
                        await onAction?.({ ...action, applied: true, base_version: resolved.generation });
                        agentKnownContentRef.current = resolved.content;
                    }
                    return;
                }
                toast({
                    status: 'error',
                    title: t('agent.documentEditApplyFailed'),
                    description: errorMessage(error, t('store.errorSavingTextDefault')),
                    duration: 5000,
                });
            }
        },
        [client, onAction, onContentChange, path, reconcileDocumentConflict, runId, t, toast],
    );

    const persistPendingDocumentContent = useCallback((): Promise<boolean> => {
        if (!runId) return Promise.resolve(false);
        if (documentSavePromiseRef.current) return documentSavePromiseRef.current;

        const savePromise = (async () => {
            documentSaveInFlightRef.current = true;
            setIsSavingDocument(true);
            try {
                while (pendingDocumentContentRef.current !== undefined) {
                    const nextContent = pendingDocumentContentRef.current;
                    pendingDocumentContentRef.current = undefined;
                    const expectedGeneration = documentBaseGenerationRef.current;
                    if (!expectedGeneration) {
                        throw new Error(t('agent.artifactEditingUnavailable'));
                    }

                    const response = await client.agents.updateArtifactContent(runId, path, {
                        content: nextContent,
                        generation: expectedGeneration,
                    });
                    generationRef.current = response.generation;
                    documentBaseGenerationRef.current = response.generation;
                    documentBaseContentRef.current = nextContent;
                    setGeneration(response.generation);
                    onContentChange?.(contentRef.current, response.generation);
                }
                setIsDocumentSavePending(false);
                return true;
            } catch (error: unknown) {
                const isConflict = getErrorStatus(error) === 412;
                if (isConflict) {
                    const resolved = await reconcileDocumentConflict(
                        documentBaseContentRef.current,
                        contentRef.current,
                    );
                    return Boolean(resolved);
                }
                toast({
                    status: 'error',
                    title: t('agent.documentEditApplyFailed'),
                    description: errorMessage(error, t('store.errorSavingTextDefault')),
                    duration: 5000,
                });
                return false;
            } finally {
                documentSaveInFlightRef.current = false;
                setIsSavingDocument(false);
            }
        })();

        documentSavePromiseRef.current = savePromise;
        void savePromise.finally(() => {
            if (documentSavePromiseRef.current === savePromise) documentSavePromiseRef.current = undefined;
        });
        return savePromise;
    }, [client.agents, onContentChange, path, reconcileDocumentConflict, runId, t, toast]);
    persistPendingDocumentContentRef.current = persistPendingDocumentContent;

    const flushDocumentChanges = useCallback(async (): Promise<false | ArtifactEditingSurfaceDocumentEdit> => {
        if (documentSaveTimeoutRef.current !== undefined) {
            clearTimeout(documentSaveTimeoutRef.current);
            documentSaveTimeoutRef.current = undefined;
        }

        const latestEditorContent = documentEditorRef.current?.getMarkdown();
        if (latestEditorContent !== undefined && latestEditorContent !== contentRef.current) {
            contentRef.current = latestEditorContent;
            setContent(latestEditorContent);
            onContentChange?.(latestEditorContent, generationRef.current);
            pendingDocumentContentRef.current = latestEditorContent;
        }

        const activeConflict = documentConflictRef.current;
        if (activeConflict) {
            const resolved = await reconcileDocumentConflict(activeConflict.baseContent, contentRef.current);
            if (!resolved) return false;
        }

        while (pendingDocumentContentRef.current !== undefined || documentSavePromiseRef.current) {
            const saved = await persistPendingDocumentContent();
            if (!saved) return false;
        }
        if (!runId || !generationRef.current) return false;

        const previous = agentKnownContentRef.current;
        agentKnownContentRef.current = contentRef.current;
        return { previous, current: contentRef.current };
    }, [onContentChange, persistPendingDocumentContent, reconcileDocumentConflict, runId]);

    useEffect(() => {
        if (!flushChangesRef) return;
        flushChangesRef.current = flushDocumentChanges;
        return () => {
            if (flushChangesRef.current === flushDocumentChanges) flushChangesRef.current = null;
        };
    }, [flushChangesRef, flushDocumentChanges]);

    const handleDocumentChange = useCallback(
        (nextContent: string) => {
            if (nextContent === contentRef.current) return;
            // The editor normalizes loaded Markdown on mount, firing onChange before the user has
            // touched it. Adopt that serialization as the baseline silently — no save, no message.
            if (!documentEditorInteractedRef.current) {
                contentRef.current = nextContent;
                setContent(nextContent);
                return;
            }
            contentRef.current = nextContent;
            setContent(nextContent);
            onDocumentEdit?.();
            onContentChange?.(nextContent, generationRef.current);

            const activeConflict = documentConflictRef.current;
            if (activeConflict) {
                updateDocumentConflict({ ...activeConflict, localContent: nextContent });
                setIsDocumentSavePending(false);
                return;
            }

            setIsDocumentSavePending(true);
            pendingDocumentContentRef.current = nextContent;
            if (documentSaveTimeoutRef.current !== undefined) clearTimeout(documentSaveTimeoutRef.current);
            documentSaveTimeoutRef.current = setTimeout(() => {
                documentSaveTimeoutRef.current = undefined;
                void persistPendingDocumentContent();
            }, DOCUMENT_SAVE_DEBOUNCE_MS);
        },
        [onContentChange, onDocumentEdit, persistPendingDocumentContent, updateDocumentConflict],
    );

    const handleDocumentFocusChange = useCallback((focused: boolean) => {
        documentEditorFocusedRef.current = focused;
        if (focused) documentEditorInteractedRef.current = true;
        if (focused) {
            documentBaseGenerationRef.current = generationRef.current;
            documentBaseContentRef.current = contentRef.current;
        } else if (pendingDocumentContentRef.current === undefined && !documentSaveInFlightRef.current) {
            documentBaseGenerationRef.current = generationRef.current;
            documentBaseContentRef.current = contentRef.current;
        }
    }, []);

    const retryDocumentConflict = useCallback(async () => {
        const activeConflict = documentConflictRef.current;
        if (!activeConflict || isResolvingConflict) return;
        const resolved = await reconcileDocumentConflict(
            activeConflict.baseContent,
            contentRef.current,
            activeConflict.pendingAction,
        );
        if (resolved && activeConflict.pendingAction) {
            await onAction?.({
                ...activeConflict.pendingAction,
                applied: true,
                base_version: resolved.generation,
            });
            agentKnownContentRef.current = resolved.content;
        }
    }, [isResolvingConflict, onAction, reconcileDocumentConflict]);

    const navigateToChangedLine = useCallback(
        (line: number) => {
            const scrollContainer = documentEditorContainerRef.current?.querySelector<HTMLElement>(
                '.vertesia-markdown-document-editor-content',
            );
            if (!scrollContainer) return;
            const ratio = Math.min(1, line / Math.max(1, documentLineCount - 1));
            scrollContainer.scrollTo({
                top: ratio * Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight),
                behavior: 'smooth',
            });
        },
        [documentLineCount],
    );

    useEffect(
        () => () => {
            if (documentSaveTimeoutRef.current !== undefined) clearTimeout(documentSaveTimeoutRef.current);
            const latestEditorContent = documentEditorRef.current?.getMarkdown();
            if (latestEditorContent !== undefined && latestEditorContent !== contentRef.current) {
                contentRef.current = latestEditorContent;
                pendingDocumentContentRef.current = latestEditorContent;
            }
            if (pendingDocumentContentRef.current !== undefined) {
                void persistPendingDocumentContentRef.current();
            }
        },
        [],
    );

    return (
        <div className={className ?? 'relative h-full min-h-0 overflow-y-auto px-4 py-3'}>
            {documentConflict ? (
                <div className="absolute inset-x-4 top-3 z-30" role="alert">
                    <MessageBox status="warning" title={t('agent.artifactConflictTitle')} className="shadow-lg">
                        <div className="space-y-3">
                            <p>{t('agent.artifactConflictDescription')}</p>
                            <div className="flex justify-end">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={isResolvingConflict}
                                    onClick={() => void retryDocumentConflict()}
                                >
                                    {isResolvingConflict ? <Spinner size="sm" /> : null}
                                    {t('agent.artifactConflictRetry')}
                                </Button>
                            </div>
                        </div>
                    </MessageBox>
                </div>
            ) : null}
            {isLoading && !content ? (
                <Center className="h-full min-h-[200px]">
                    <Spinner size="lg" />
                </Center>
            ) : loadError && !content ? (
                <Center className="h-full min-h-[200px] flex-col gap-3 text-center text-muted">
                    <span>{loadError}</span>
                    <Button variant="outline" size="sm" onClick={() => void loadContent(false)}>
                        {t('agent.retry')}
                    </Button>
                </Center>
            ) : viewMode === 'document' ? (
                <Suspense
                    fallback={
                        <Center className="h-full min-h-[200px]">
                            <Spinner size="lg" />
                        </Center>
                    }
                >
                    <div className="flex h-full min-h-0 flex-col">
                        <div ref={documentEditorContainerRef} className="relative min-h-0 flex-1">
                            <MarkdownDocumentEditor
                                value={content}
                                onChange={handleDocumentChange}
                                artifactRunId={runId}
                                editable={!readOnly && Boolean(runId)}
                                externalValueSync="when-blurred"
                                onFocusChange={handleDocumentFocusChange}
                                onEditor={(editor) => {
                                    documentEditorRef.current =
                                        editor as unknown as MarkdownDocumentEditorHandle | null;
                                }}
                                onSendComment={
                                    onSendMessage && runId && !documentConflict && commentsEnabled
                                        ? onSendMessage
                                        : undefined
                                }
                                onSendChangesToAgent={onSendChangesToAgent}
                                hasUnsentChanges={hasUnsentChanges}
                                isSendingChanges={isSendingChanges}
                                sendChangesDisabled={sendChangesDisabled || !runId || Boolean(documentConflict)}
                                contentClassName="pe-5"
                            />
                            <MarkdownChangeRuler
                                regions={changeRegions}
                                totalLines={documentLineCount}
                                onNavigate={navigateToChangedLine}
                            />
                            {!onSaveStatusChange && saveStatus !== 'idle' ? (
                                <div
                                    className={cn(
                                        'pointer-events-none absolute bottom-3 end-6 flex items-center gap-1.5 rounded-full',
                                        'border border-mixer-muted/25 bg-background/90 px-2.5 py-1 text-[11px] shadow-sm',
                                        isSavingDocument || isDocumentSavePending ? 'text-muted' : 'text-success',
                                    )}
                                >
                                    {isSavingDocument || isDocumentSavePending ? (
                                        <Spinner size="sm" />
                                    ) : (
                                        <Check className="size-3" />
                                    )}
                                    {isSavingDocument || isDocumentSavePending
                                        ? t('agent.savingWorkingCopy')
                                        : t('agent.savedToWorkingCopy')}
                                </div>
                            ) : null}
                        </div>
                    </div>
                </Suspense>
            ) : (
                <div className="vprose prose-sm mx-auto max-w-5xl">
                    <CollaborativeMarkdownRenderer
                        artifactRunId={runId}
                        resource={{ kind: 'agent_artifact', run_id: runId ?? 'pending', path }}
                        baseVersion={generation}
                        readOnly={readOnly || !runId || Boolean(documentConflict)}
                        allowComments={commentsEnabled && Boolean(runId) && !documentConflict}
                        highlightChangesFrom={highlightChangesFrom}
                        highlightVersion={highlightVersion}
                        onAction={handleAction}
                    >
                        {content}
                    </CollaborativeMarkdownRenderer>
                </div>
            )}
            {isLoading && content ? (
                <div className="absolute end-3 top-3 rounded-full bg-background/80 p-2 shadow-sm">
                    <GitCommitHorizontal className="size-4 animate-pulse text-muted" />
                </div>
            ) : null}
        </div>
    );
}
