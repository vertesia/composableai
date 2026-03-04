import { useCallback, useEffect, useRef, useState } from 'react';
import { AgentMessage, AgentMessageType } from '@vertesia/common';
import type { OpenDocument } from '../types/document.js';

export interface UseDocumentPanelResult {
    openDocuments: OpenDocument[];
    activeDocumentId: string | null;
    isDocPanelOpen: boolean;
    docRefreshKey: number;
    closeDocPanel: () => void;
    closeDocument: (docId: string) => void;
    selectDocument: (docId: string) => void;
    openDocInPanel: (docId: string) => void;
}

/**
 * Hook that manages the document side panel.
 *
 * Listens for UPDATE messages with `event_class: 'document_created' | 'document_updated'`
 * and manages panel open/close, tab selection, and refresh state.
 *
 * Uses incremental processing — only scans new messages.
 */
export function useDocumentPanel(messages: AgentMessage[]): UseDocumentPanelResult {
    const [openDocuments, setOpenDocuments] = useState<OpenDocument[]>([]);
    const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
    const [isDocPanelOpen, setIsDocPanelOpen] = useState(false);
    const [docRefreshKey, setDocRefreshKey] = useState(0);

    // Incremental processing
    const lastProcessedIndex = useRef<number>(-1);

    // Reset when messages are cleared
    useEffect(() => {
        if (messages.length === 0) {
            setOpenDocuments([]);
            setActiveDocumentId(null);
            setIsDocPanelOpen(false);
            setDocRefreshKey(0);
            lastProcessedIndex.current = -1;
        }
    }, [messages.length === 0]);

    // Process new messages incrementally for document events
    useEffect(() => {
        const startIdx = lastProcessedIndex.current + 1;
        if (startIdx >= messages.length) return;

        for (let i = startIdx; i < messages.length; i++) {
            const message = messages[i];

            if (message.type === AgentMessageType.UPDATE && message.details) {
                const details = message.details as Record<string, unknown>;
                if (details.event_class === 'document_created' || details.event_class === 'document_updated') {
                    const docId = details.document_id as string;
                    const docTitle = details.title as string;
                    if (docId) {
                        setOpenDocuments(prev => {
                            if (prev.some(d => d.id === docId)) return prev;
                            return [...prev, { id: docId, title: docTitle || 'Document' }];
                        });
                        setActiveDocumentId(docId);
                        setIsDocPanelOpen(true);
                        if (details.event_class === 'document_updated') {
                            setDocRefreshKey(k => k + 1);
                        }
                    }
                }
            }
        }

        lastProcessedIndex.current = messages.length - 1;
    }, [messages]);

    const closeDocPanel = useCallback(() => {
        setIsDocPanelOpen(false);
    }, []);

    const closeDocument = useCallback((docId: string) => {
        setOpenDocuments(prev => {
            const next = prev.filter(d => d.id !== docId);
            if (next.length === 0) {
                setIsDocPanelOpen(false);
                setActiveDocumentId(null);
            } else {
                setActiveDocumentId(current => {
                    if (current === docId) return next[0].id;
                    return current;
                });
            }
            return next;
        });
    }, []);

    const selectDocument = useCallback((docId: string) => {
        setActiveDocumentId(docId);
    }, []);

    const openDocInPanel = useCallback((docId: string) => {
        setOpenDocuments(prev => {
            if (prev.some(d => d.id === docId)) return prev;
            return [...prev, { id: docId, title: 'Document' }];
        });
        setActiveDocumentId(docId);
        setIsDocPanelOpen(true);
    }, []);

    return {
        openDocuments,
        activeDocumentId,
        isDocPanelOpen,
        docRefreshKey,
        closeDocPanel,
        closeDocument,
        selectDocument,
        openDocInPanel,
    };
}
