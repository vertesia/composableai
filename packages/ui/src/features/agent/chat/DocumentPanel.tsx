import { Button, VTooltip } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { NavLink } from '@vertesia/ui/router';
import { useUserSession } from '@vertesia/ui/session';
import { MarkdownRenderer } from '@vertesia/ui/widgets';
import { ArrowLeftIcon, ExternalLinkIcon, FileTextIcon, Loader2Icon } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

interface DocumentPanelProps {
    /** Document currently displayed. */
    documentId: string;
    /** Title known by the list, shown until the document itself is loaded. */
    title?: string;
    /** Return to the document list. */
    onBack: () => void;
    onUpdateDocumentTitle?: (id: string, title: string) => void;
    refreshKey: number;
    runId?: string;
}

function DocumentPanelComponent({
    documentId,
    title,
    onBack,
    onUpdateDocumentTitle,
    refreshKey,
    runId,
}: DocumentPanelProps) {
    const { client } = useUserSession();
    const { t } = useUITranslation();
    const [content, setContent] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [docName, setDocName] = useState<string | null>(null);

    const fetchContent = useCallback(
        async (docId: string) => {
            setIsLoading(true);
            setError(null);
            try {
                const [textResult, obj] = await Promise.all([
                    client.store.objects.getObjectText(docId),
                    client.store.objects.retrieve(docId),
                ]);
                setContent(textResult.text ?? null);
                const name = obj.name;
                setDocName(name);
                if (name) onUpdateDocumentTitle?.(docId, name);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : t('agent.failedToLoadDocument');
                setError(message);
                setContent(null);
            } finally {
                setIsLoading(false);
            }
        },
        [client, onUpdateDocumentTitle, t],
    );

    // Fetch content when the displayed document changes or refreshKey bumps
    useEffect(() => {
        void refreshKey;
        void fetchContent(documentId);
    }, [documentId, refreshKey, fetchContent]);

    return (
        <div className="h-full overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between gap-1 px-2 py-1 border-b border-border/60 shrink-0">
                <Button
                    variant="ghost"
                    size="sm"
                    className="size-8 shrink-0 rounded-md p-0"
                    onClick={onBack}
                    aria-label={t('agent.backToDocuments')}
                    title={t('agent.backToDocuments')}
                >
                    <ArrowLeftIcon className="size-4 cn-rtl-flip" />
                </Button>
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <FileTextIcon className="size-4 text-muted shrink-0" />
                    <span className="truncate text-sm font-medium" title={docName || title}>
                        {docName || title || t('agent.document')}
                    </span>
                </div>
                <NavLink
                    href={`/store/objects/${documentId}#overview`}
                    topLevelNav
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-muted/20 hover:text-foreground"
                >
                    <VTooltip description={t('agent.openDocument')} placement="top" size="xs" asChild>
                        <ExternalLinkIcon className="size-4" aria-hidden="true" />
                    </VTooltip>
                    <span className="sr-only">{t('agent.openDocument')}</span>
                </NavLink>
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2Icon className="size-5 animate-spin text-muted" />
                        <span className="ms-2 text-sm text-muted">{t('agent.loadingDocument')}</span>
                    </div>
                ) : error ? (
                    <div className="p-4 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>
                ) : content ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                        <MarkdownRenderer artifactRunId={runId}>{content}</MarkdownRenderer>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-muted">
                        <FileTextIcon className="size-8 mb-2" />
                        <span className="text-sm">{t('agent.noContentAvailable')}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

export const DocumentPanel = React.memo(DocumentPanelComponent);
