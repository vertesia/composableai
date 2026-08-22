import { renderHook, waitFor } from '@testing-library/react';
import { type AgentMessage, AgentMessageType } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { useDocumentPanel } from './useDocumentPanel';

function documentMessage(documentId: string, title: string): AgentMessage {
    return {
        type: AgentMessageType.UPDATE,
        message: '',
        timestamp: 1,
        details: { event_class: 'document_created', document_id: documentId, title },
    } as unknown as AgentMessage;
}

function chatter(count: number): AgentMessage[] {
    return Array.from(
        { length: count },
        (_, i) => ({ type: AgentMessageType.THOUGHT, message: `m${i}`, timestamp: 1 }) as unknown as AgentMessage,
    );
}

describe('useDocumentPanel', () => {
    it('drops the previous conversation when switching between two non-empty histories', async () => {
        // Conversation A is longer than B, so an un-rewound cursor would skip B entirely.
        const conversationA = [...chatter(8), documentMessage('doc-a', 'A report')];
        const conversationB = [...chatter(2), documentMessage('doc-b', 'B report')];

        const { result, rerender } = renderHook(({ messages, id }) => useDocumentPanel(messages, id), {
            initialProps: { messages: conversationA, id: 'run-a' },
        });

        await waitFor(() => expect(result.current.openDocuments.map((d) => d.id)).toEqual(['doc-a']));

        rerender({ messages: conversationB, id: 'run-b' });

        await waitFor(() => expect(result.current.openDocuments.map((d) => d.id)).toEqual(['doc-b']));
        expect(result.current.activeDocumentId).toBe('doc-b');
    });

    it('keeps accumulating while the conversation identity is unchanged', async () => {
        const first = [documentMessage('doc-1', 'One')];
        const second = [...first, documentMessage('doc-2', 'Two')];

        const { result, rerender } = renderHook(({ messages, id }) => useDocumentPanel(messages, id), {
            initialProps: { messages: first, id: 'run-a' },
        });

        await waitFor(() => expect(result.current.openDocuments.map((d) => d.id)).toEqual(['doc-1']));

        rerender({ messages: second, id: 'run-a' });

        await waitFor(() => expect(result.current.openDocuments.map((d) => d.id)).toEqual(['doc-1', 'doc-2']));
    });

    it('still resets when messages are cleared', async () => {
        const { result, rerender } = renderHook(({ messages, id }) => useDocumentPanel(messages, id), {
            initialProps: { messages: [documentMessage('doc-a', 'A report')], id: 'run-a' },
        });

        await waitFor(() => expect(result.current.isDocPanelOpen).toBe(true));

        rerender({ messages: [] as AgentMessage[], id: 'run-a' });

        await waitFor(() => expect(result.current.openDocuments).toEqual([]));
        expect(result.current.isDocPanelOpen).toBe(false);
        expect(result.current.activeDocumentId).toBeNull();
    });
});
