import { type AgentMessage, AgentMessageType } from '@vertesia/common';
import { useCallback, useEffect, useRef, useState } from 'react';
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
    updateDocumentTitle: (docId: string, title: string) => void;
}

function toNonEmptyString(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim().length > 0) {
        return value;
    }
    return undefined;
}

function getRevisionRootId(details: Record<string, unknown>, fallbackId: string): string {
    const directRootId =
        toNonEmptyString(details.revision_root_id) ||
        toNonEmptyString(details.revision_root) ||
        toNonEmptyString(details.root_document_id) ||
        toNonEmptyString(details.root_id);
    if (directRootId) return directRootId;

    const revisionInfo = details.revision_info;
    if (revisionInfo && typeof revisionInfo === 'object') {
        const rootFromRevisionInfo = toNonEmptyString((revisionInfo as Record<string, unknown>).root);
        if (rootFromRevisionInfo) return rootFromRevisionInfo;
    }

    return fallbackId;
}

function isSameRevisionChain(existing: OpenDocument, incoming: OpenDocument): boolean {
    if (existing.revisionRootId && incoming.revisionRootId) {
        return existing.revisionRootId === incoming.revisionRootId;
    }
    if (incoming.revisionRootId) {
        return existing.id === incoming.revisionRootId;
    }
    if (existing.revisionRootId) {
        return existing.revisionRootId === incoming.id;
    }
    return existing.id === incoming.id;
}

/** Build an OpenDocument from a document event's details, or null if it isn't one. */
function describeDocument(details: Record<string, unknown>): OpenDocument | null {
    // Artifact draft: `document_opened` (and later `document_updated`) carrying an
    // artifact_path. Keyed by `artifact:<path>` so tab selection/dedupe stay id-based.
    const artifactPath = toNonEmptyString(details.artifact_path);
    if (details.source === 'artifact' || artifactPath) {
        if (!artifactPath) return null;
        return {
            id: `artifact:${artifactPath}`,
            kind: 'artifact',
            title: toNonEmptyString(details.title) || artifactPath.split('/').pop() || 'Document',
            artifactPath,
        };
    }

    // Persisted store object: `document_created` / `document_updated`.
    const sourceDocId = toNonEmptyString(details.document_id);
    const updatedDocId = toNonEmptyString(details.updated_document_id);
    const docId = updatedDocId || sourceDocId;
    if (!docId) return null;
    return {
        id: docId,
        kind: 'object',
        title: toNonEmptyString(details.title) || 'Document',
        revisionRootId: getRevisionRootId(details, sourceDocId || docId),
    };
}

function upsertDocument(prev: OpenDocument[], incoming: OpenDocument): OpenDocument[] {
    const existingIndex = prev.findIndex((doc) =>
        incoming.kind === 'artifact' ? doc.id === incoming.id : isSameRevisionChain(doc, incoming),
    );
    if (existingIndex < 0) {
        return [...prev, incoming];
    }
    const existing = prev[existingIndex];
    if (
        existing.id === incoming.id &&
        existing.kind === incoming.kind &&
        existing.title === incoming.title &&
        existing.revisionRootId === incoming.revisionRootId &&
        existing.artifactPath === incoming.artifactPath
    ) {
        return prev;
    }
    const next = [...prev];
    next[existingIndex] = incoming;
    return next;
}

/**
 * Hook that manages the document side panel.
 *
 * Listens for UPDATE messages with `event_class: 'document_opened' | 'document_created' |
 * 'document_updated'` and manages panel open/close, tab selection, and refresh state.
 * `document_opened`/`document_updated` carrying an `artifact_path` open an editable
 * run-scoped draft; `document_created`/`document_updated` with a `document_id` open a
 * persisted store object.
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
    }, [messages.length]);

    // Process new messages incrementally for document events
    useEffect(() => {
        const startIdx = lastProcessedIndex.current + 1;
        if (startIdx >= messages.length) return;

        for (let i = startIdx; i < messages.length; i++) {
            const message = messages[i];

            if (message.type !== AgentMessageType.UPDATE || !message.details) continue;
            const details = message.details as Record<string, unknown>;
            const eventClass = details.event_class;
            if (
                eventClass !== 'document_opened' &&
                eventClass !== 'document_created' &&
                eventClass !== 'document_updated'
            ) {
                continue;
            }

            const incomingDoc = describeDocument(details);
            if (!incomingDoc) continue;

            setOpenDocuments((prev) => upsertDocument(prev, incomingDoc));
            setActiveDocumentId(incomingDoc.id);
            setIsDocPanelOpen(true);
            if (eventClass === 'document_updated') {
                setDocRefreshKey((k) => k + 1);
            }
        }

        lastProcessedIndex.current = messages.length - 1;
    }, [messages]);

    const closeDocPanel = useCallback(() => {
        setIsDocPanelOpen(false);
    }, []);

    const closeDocument = useCallback((docId: string) => {
        setOpenDocuments((prev) => {
            const next = prev.filter((d) => d.id !== docId);
            if (next.length === 0) {
                setIsDocPanelOpen(false);
                setActiveDocumentId(null);
            } else {
                setActiveDocumentId((current) => {
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
        setOpenDocuments((prev) => {
            if (prev.some((d) => d.id === docId)) return prev;
            return [...prev, { id: docId, kind: 'object', title: 'Document', revisionRootId: docId }];
        });
        setActiveDocumentId(docId);
        setIsDocPanelOpen(true);
    }, []);

    const updateDocumentTitle = useCallback((docId: string, title: string) => {
        setOpenDocuments((prev) => prev.map((d) => (d.id === docId ? { ...d, title } : d)));
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
        updateDocumentTitle,
    };
}
