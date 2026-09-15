import { Button, Input, VTooltip } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { NavLink } from '@vertesia/ui/router';
import { ExternalLinkIcon, FileTextIcon } from 'lucide-react';
import React, { useCallback, useId, useMemo, useState } from 'react';
import { DocumentPanel } from './DocumentPanel.js';
import type { OpenDocument } from './types/document.js';

/** Below this many documents the list is short enough that a filter box is just noise. */
const FILTER_VISIBILITY_THRESHOLD = 5;

interface DocumentsTabProps {
    documents: OpenDocument[];
    /** Document shown in the detail view; `null` shows the list. */
    activeDocumentId: string | null;
    onSelectDocument: (id: string | null) => void;
    onUpdateDocumentTitle?: (id: string, title: string) => void;
    refreshKey: number;
    runId?: string;
}

function DocumentsTabComponent({
    documents,
    activeDocumentId,
    onSelectDocument,
    onUpdateDocumentTitle,
    refreshKey,
    runId,
}: DocumentsTabProps) {
    const { t } = useUITranslation();
    const [filterValue, setFilterValue] = useState('');
    const filterInputId = useId();

    const normalizedFilterValue = filterValue.trim().toLocaleLowerCase();
    const filteredDocuments = useMemo(() => {
        if (!normalizedFilterValue) return documents;
        return documents.filter((doc) => doc.title.toLocaleLowerCase().includes(normalizedFilterValue));
    }, [documents, normalizedFilterValue]);

    const handleBack = useCallback(() => onSelectDocument(null), [onSelectDocument]);

    const activeDocument = activeDocumentId ? documents.find((doc) => doc.id === activeDocumentId) : undefined;

    if (activeDocumentId) {
        return (
            <DocumentPanel
                documentId={activeDocumentId}
                title={activeDocument?.title}
                onBack={handleBack}
                onUpdateDocumentTitle={onUpdateDocumentTitle}
                refreshKey={refreshKey}
                runId={runId}
            />
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Top bar */}
            <div className="flex shrink-0 flex-col gap-2 border-b px-3 py-2">
                <span className="text-xs text-muted">
                    {normalizedFilterValue
                        ? t('agent.documentsFiltered', {
                              visible: filteredDocuments.length,
                              total: documents.length,
                          })
                        : t('agent.documentCount', { count: documents.length })}
                </span>
                {documents.length > FILTER_VISIBILITY_THRESHOLD && (
                    <>
                        <label htmlFor={filterInputId} className="sr-only">
                            {t('form.filter')}
                        </label>
                        <Input
                            id={filterInputId}
                            type="text"
                            role="searchbox"
                            autoComplete="off"
                            placeholder={t('store.searchPlaceholder')}
                            value={filterValue}
                            onChange={setFilterValue}
                            clearable={true}
                        />
                    </>
                )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-3 py-2">
                {filteredDocuments.length > 0 ? (
                    <div className="min-w-0">
                        {filteredDocuments.map((doc) => (
                            <div key={doc.id} className="flex min-w-0 items-center gap-1">
                                <Button
                                    variant="unstyled"
                                    className="flex min-w-0 flex-1 items-center justify-start gap-1.5 rounded px-1 py-1 text-start text-sm hover:bg-muted/30"
                                    onClick={() => onSelectDocument(doc.id)}
                                    title={doc.title}
                                >
                                    <FileTextIcon className="size-4 shrink-0 text-muted" />
                                    <span className="min-w-0 truncate">{doc.title}</span>
                                </Button>
                                <NavLink
                                    href={`/store/objects/${doc.id}#overview`}
                                    topLevelNav
                                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-muted/20 hover:text-foreground"
                                >
                                    <VTooltip description={t('agent.openDocument')} placement="top" size="xs" asChild>
                                        <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
                                    </VTooltip>
                                    <span className="sr-only">{t('agent.openDocument')}</span>
                                </NavLink>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="px-1 py-6 text-sm text-muted">{t('agent.noMatchingDocuments')}</div>
                )}
            </div>
        </div>
    );
}

export const DocumentsTab = React.memo(DocumentsTabComponent);
