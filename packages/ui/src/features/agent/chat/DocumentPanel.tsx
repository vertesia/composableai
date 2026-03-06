import React, { useCallback, useEffect, useState } from 'react';
import { ExternalLinkIcon, FileTextIcon, Loader2Icon, X } from 'lucide-react';
import { useUserSession } from '@vertesia/ui/session';
import { Button } from '@vertesia/ui/core';
import { NavLink } from '@vertesia/ui/router';
import { MarkdownRenderer } from '@vertesia/ui/widgets';
import { DocumentTabBar } from './DocumentTabBar.js';
import type { OpenDocument } from './types/document.js';

interface DocumentPanelProps {
    isOpen: boolean;
    onClose: () => void;
    documents: OpenDocument[];
    activeDocumentId: string | null;
    onSelectDocument: (id: string) => void;
    onCloseDocument: (id: string) => void;
    refreshKey: number;
    runId?: string;
}

function DocumentPanelComponent({
    isOpen,
    onClose,
    documents,
    activeDocumentId,
    onSelectDocument,
    onCloseDocument,
    refreshKey,
    runId,
}: DocumentPanelProps) {
    const { client } = useUserSession();
    const [content, setContent] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [docName, setDocName] = useState<string | null>(null);

    const fetchContent = useCallback(async (docId: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const [textResult, obj] = await Promise.all([
                client.store.objects.getObjectText(docId),
                client.store.objects.retrieve(docId),
            ]);
            setContent(textResult.text);
            setDocName(obj.name);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to load document';
            setError(message);
            setContent(null);
        } finally {
            setIsLoading(false);
        }
    }, [client]);

    // Fetch content when active document changes or refreshKey bumps
    useEffect(() => {
        if (activeDocumentId && isOpen) {
            fetchContent(activeDocumentId);
        }
    }, [activeDocumentId, refreshKey, isOpen, fetchContent]);

    if (!isOpen || documents.length === 0) {
        return null;
    }

    return (
        <div className="h-full shadow-xl border border-muted/20 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-muted/20 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                    <FileTextIcon className="size-4 text-muted shrink-0" />
                    <h3 className="font-bold text-sm truncate">
                        {docName || 'Document'}
                    </h3>
                </div>
                <div className="flex items-center gap-1">
                    {activeDocumentId && (
                        <NavLink
                            href={`/store/objects/${activeDocumentId}`}
                            topLevelNav
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 w-8 hover:bg-muted/20 text-muted hover:text-foreground"
                        >
                            <ExternalLinkIcon className="size-4" />
                            <span className="sr-only">Open document</span>
                        </NavLink>
                    )}
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        <X className="size-4" />
                        <span className="sr-only">Close</span>
                    </Button>
                </div>
            </div>

            {/* Tab bar */}
            <div className="shrink-0">
                <DocumentTabBar
                    documents={documents}
                    activeId={activeDocumentId}
                    onSelect={onSelectDocument}
                    onClose={onCloseDocument}
                />
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2Icon className="size-5 animate-spin text-muted" />
                        <span className="ml-2 text-sm text-muted">Loading document...</span>
                    </div>
                ) : error ? (
                    <div className="p-4 rounded-md bg-destructive/10 text-destructive text-sm">
                        {error}
                    </div>
                ) : content ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                        <MarkdownRenderer artifactRunId={runId}>
                            {content}
                        </MarkdownRenderer>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-muted">
                        <FileTextIcon className="size-8 mb-2" />
                        <span className="text-sm">No content available</span>
                    </div>
                )}
            </div>
        </div>
    );
}

export const DocumentPanel = React.memo(DocumentPanelComponent);
