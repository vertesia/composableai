import { act, renderHook } from '@testing-library/react';
import { type AgentMessage, AgentMessageType } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { useDocumentPanel } from './useDocumentPanel';

function documentCreated(documentId: string, title: string): AgentMessage {
    return {
        type: AgentMessageType.UPDATE,
        message: '',
        timestamp: Date.now(),
        details: { event_class: 'document_created', document_id: documentId, title },
    } as unknown as AgentMessage;
}

describe('useDocumentPanel', () => {
    it('opens the newest document reported by the agent', () => {
        const messages = [documentCreated('doc-1', 'Brief'), documentCreated('doc-2', 'Summary')];
        const { result } = renderHook(() => useDocumentPanel(messages));

        expect(result.current.openDocuments.map((doc) => doc.id)).toEqual(['doc-1', 'doc-2']);
        expect(result.current.activeDocumentId).toBe('doc-2');
        expect(result.current.isDocPanelOpen).toBe(true);
    });

    it('selects null to go back to the list while keeping the documents open', () => {
        const { result } = renderHook(() => useDocumentPanel([documentCreated('doc-1', 'Brief')]));

        act(() => result.current.selectDocument(null));

        expect(result.current.activeDocumentId).toBeNull();
        expect(result.current.openDocuments).toHaveLength(1);
    });
});
