import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { RichTextMarkdownEditor } from '@vertesia/ui/widgets';
import { AlertCircleIcon, CheckIcon, Loader2Icon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

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
 * back to the artifact (debounced, flushed on unmount). The editor's own safe-sync
 * contract prevents an in-flight refetch from clobbering unsaved edits.
 */
export function ArtifactDocumentEditor({
    runId,
    artifactPath,
    editable = true,
    refreshKey = 0,
}: ArtifactDocumentEditorProps) {
    const { client } = useUserSession();
    const { t } = useUITranslation();
    const [content, setContent] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

    const pendingRef = useRef<string | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        // refreshKey is only a trigger to re-fetch (e.g. after the agent edits the artifact).
        void refreshKey;
        let cancelled = false;
        setIsLoading(true);
        setError(null);
        void (async () => {
            try {
                const stream = await client.agents.downloadArtifact(runId, artifactPath);
                const text = await new Response(stream).text();
                if (!cancelled) {
                    setContent(text);
                }
            } catch (err: unknown) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : t('agent.failedToLoadDocument'));
                    setContent(null);
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [client, runId, artifactPath, refreshKey, t]);

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

    // Flush any pending edit when unmounting (panel closed / doc switched).
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
            <div className="flex-1 overflow-y-auto">
                <RichTextMarkdownEditor value={content} editable={editable} onChange={handleChange} />
            </div>
            <SaveIndicator status={saveStatus} editable={editable} />
        </div>
    );
}

function SaveIndicator({ status, editable }: { status: SaveStatus; editable: boolean }) {
    const { t } = useUITranslation();
    if (!editable) {
        return <div className="shrink-0 pt-2 text-xs text-muted">{t('agent.documentReadOnlyWhileAgentWorks')}</div>;
    }
    if (status === 'idle') {
        return null;
    }
    return (
        <div className="shrink-0 pt-2 text-xs flex items-center gap-1">
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
