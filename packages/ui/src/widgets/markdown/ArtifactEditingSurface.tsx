import { Button, Center, errorMessage, Spinner, useToast } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    applyMarkdownEditingChange,
    CollaborativeMarkdownRenderer,
    type MarkdownEditingAction,
} from './CollaborativeMarkdownRenderer.js';

const HYDRATION_RETRY_DELAY_MS = 500;
const HYDRATION_RETRY_LIMIT = 60;

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

export interface ArtifactEditingSurfaceProps {
    runId?: string;
    path: string;
    initialContent?: string;
    refreshKey?: number;
    refreshDetails?: Record<string, unknown>;
    readOnly?: boolean;
    className?: string;
    onAction?: (action: MarkdownEditingAction) => void | Promise<void>;
    onContentChange?: (content: string, generation?: string) => void;
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
    className,
    onAction,
    onContentChange,
}: ArtifactEditingSurfaceProps) {
    const { client } = useUserSession();
    const { t } = useUITranslation();
    const toast = useToast();
    const [content, setContent] = useState(initialContent);
    const [generation, setGeneration] = useState<string | undefined>();
    const [highlightChangesFrom, setHighlightChangesFrom] = useState<string | undefined>();
    const [highlightVersion, setHighlightVersion] = useState(0);
    const [isLoading, setIsLoading] = useState(Boolean(runId));
    const [loadError, setLoadError] = useState<string | undefined>();
    const contentRef = useRef(content);
    const generationRef = useRef(generation);
    const loadRequestRef = useRef(0);

    useEffect(() => {
        contentRef.current = content;
    }, [content]);

    useEffect(() => {
        generationRef.current = generation;
    }, [generation]);

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
        setContent(initialContent);
        setGeneration(undefined);
        setHighlightChangesFrom(undefined);
        setLoadError(undefined);
        setIsLoading(Boolean(runId));
        if (runId) void loadContent(true);
        return () => {
            loadRequestRef.current++;
        };
    }, [initialContent, loadContent, runId]);

    useEffect(() => {
        if (!runId || refreshKey <= 0) return;

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

    const handleAction = useCallback(
        async (action: MarkdownEditingAction) => {
            if (action.action === 'comment') {
                await onAction?.(action);
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
                setHighlightChangesFrom(previousContent);
                setHighlightVersion((value) => value + 1);
                setContent(nextContent);
                setGeneration(response.generation);
                onContentChange?.(nextContent, response.generation);
                await onAction?.({ ...action, applied: true, base_version: response.generation });
            } catch (error: unknown) {
                const isConflict = getErrorStatus(error) === 412;
                toast({
                    status: 'error',
                    title: t('agent.documentEditApplyFailed'),
                    description: isConflict
                        ? t('store.textConflict')
                        : errorMessage(error, t('store.errorSavingTextDefault')),
                    duration: 5000,
                });
                if (isConflict) await loadContent(false);
            }
        },
        [client, loadContent, onAction, onContentChange, path, runId, t, toast],
    );

    return (
        <div className={className ?? 'relative h-full min-h-0 overflow-y-auto px-4 py-3'}>
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
            ) : (
                <div className="vprose prose-sm mx-auto max-w-5xl">
                    <CollaborativeMarkdownRenderer
                        artifactRunId={runId}
                        resource={{ kind: 'agent_artifact', run_id: runId ?? 'pending', path }}
                        baseVersion={generation}
                        readOnly={readOnly || !runId}
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
                    <Spinner size="sm" />
                </div>
            ) : null}
        </div>
    );
}
