import { act, renderHook, waitFor } from '@testing-library/react';
import type { VertesiaClient } from '@vertesia/client';
import type {
    ExperimentalAgentConversationSourceInitialized,
    ExperimentalAgentConversationTranscriptPage,
} from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
import { useCanonicalAgentTranscript, validateCanonicalAgentTranscriptPage } from './useCanonicalAgentTranscript.js';

function descriptor(conversationId = 'conversation-1'): ExperimentalAgentConversationSourceInitialized {
    return {
        api_version: '=20260930',
        agent_run_id: 'agent-1',
        scope: 'root',
        status: 'initialized',
        contract_version: 'canonical-conversation-v1',
        head: {
            format: 'llumiverse.conversation',
            schema_version: 0,
            experimental_revision: '2026-09-30.adoption.1',
            conversation_id: conversationId,
            revision: 2,
        },
    };
}
function page(turnId: string, next?: string, empty = false): ExperimentalAgentConversationTranscriptPage {
    const snapshot = { conversation_id: 'conversation-1', revision: 2 };
    return {
        api_version: '=20260930',
        agent_run_id: 'agent-1',
        scope: 'root',
        snapshot,
        ...(next ? { next_after_turn_id: next } : {}),
        fragment: {
            format: 'llumiverse.conversation-transcript',
            schema_version: 0,
            experimental_revision: '2026-09-30.adoption.1',
            source: snapshot,
            turns: empty
                ? []
                : [
                      {
                          id: turnId,
                          kind: 'user',
                          status: 'completed',
                          timestamps: { recorded_at: '2026-10-01T00:00:00Z' },
                          blocks: [{ id: `block-${turnId}`, type: 'text', text: turnId, format: 'plain' }],
                      },
                  ],
            assets: {},
            generations: {},
            completeness: {
                gap_before: false,
                gap_after: Boolean(next),
                semantic_content: 'complete',
                metadata: 'omitted',
                provenance: 'omitted',
                native_replay: 'omitted',
                omitted_turns: [],
                omitted_assets: [],
                omitted_blocks: [],
                omitted_generations: [],
            },
        },
    };
}

describe('canonical transcript windows', () => {
    it('pins every page to the exact descriptor and bounds retained pages with an explicit gap', async () => {
        const getConversationTranscript = vi
            .fn()
            .mockResolvedValueOnce(page('tail'))
            .mockResolvedValueOnce(page('one', 'one'))
            .mockResolvedValueOnce(page('two', 'two'))
            .mockResolvedValueOnce(page('three'));
        const client = { agents: { getConversationTranscript } } as unknown as VertesiaClient;
        const source = descriptor();
        const { result } = renderHook(() => useCanonicalAgentTranscript(client, source));
        await waitFor(() => expect(result.current.tail).toBeDefined());
        await act(() => result.current.loadNext());
        await act(() => result.current.loadNext());
        await act(() => result.current.loadNext());
        expect(result.current.pages.map((item) => item.fragment.turns[0]?.id)).toEqual(['two', 'three']);
        expect(result.current.discarded).toBe(true);
        expect(getConversationTranscript).toHaveBeenLastCalledWith(
            'agent-1',
            {
                window: 'start',
                conversation_scope: 'root',
                snapshot_conversation_id: 'conversation-1',
                snapshot_revision: 2,
                after_turn_id: 'two',
                limit: 50,
            },
            expect.objectContaining({ signal: expect.any(AbortSignal) }),
        );
    });

    it('bounds empty internal-turn scans and retains the continuation for a user request', async () => {
        const getConversationTranscript = vi
            .fn()
            .mockResolvedValueOnce(page('tail'))
            .mockResolvedValueOnce(page('one', 'one', true))
            .mockResolvedValueOnce(page('two', 'two', true))
            .mockResolvedValueOnce(page('three', 'three', true))
            .mockResolvedValueOnce(page('visible'));
        const client = { agents: { getConversationTranscript } } as unknown as VertesiaClient;
        const source = descriptor();
        const { result } = renderHook(() => useCanonicalAgentTranscript(client, source));
        await waitFor(() => expect(result.current.tail).toBeDefined());
        await act(() => result.current.loadNext());
        await waitFor(() => expect(getConversationTranscript).toHaveBeenCalledTimes(4));
        await waitFor(() => expect(result.current.pages.at(-1)?.next_after_turn_id).toBe('three'));
        await act(() => result.current.loadNext());
        expect(result.current.pages.at(-1)?.fragment.turns[0]?.id).toBe('visible');
        expect(getConversationTranscript).toHaveBeenCalledTimes(5);
    });

    it('refreshes only the bounded tail at a newer head while preserving the pinned browse position', async () => {
        const tail = page('tail');
        tail.fragment.completeness.gap_before = true;
        const newerTail = page('latest');
        newerTail.snapshot.revision = 3;
        newerTail.fragment.source.revision = 3;
        const getConversationTranscript = vi
            .fn()
            .mockResolvedValueOnce(tail)
            .mockResolvedValueOnce(page('older', 'older'))
            .mockResolvedValueOnce(newerTail)
            .mockResolvedValueOnce(page('next-older', 'next-older'));
        const client = { agents: { getConversationTranscript } } as unknown as VertesiaClient;
        const source = descriptor();
        const { result, rerender } = renderHook(({ source }) => useCanonicalAgentTranscript(client, source), {
            initialProps: { source },
        });
        await waitFor(() => expect(result.current.tail).toBeDefined());
        await act(() => result.current.loadNext());
        rerender({ source: { ...source, head: { ...source.head, revision: 3 } } });
        await waitFor(() => expect(result.current.tail?.snapshot.revision).toBe(3));
        expect(result.current.pages[0]?.fragment.turns[0]?.id).toBe('older');
        await act(() => result.current.loadNext());
        expect(getConversationTranscript).toHaveBeenLastCalledWith(
            'agent-1',
            expect.objectContaining({
                window: 'start',
                snapshot_revision: 2,
                after_turn_id: 'older',
            }),
            expect.any(Object),
        );
        expect(result.current.pages.map((item) => item.fragment.turns[0]?.id)).toEqual(['older', 'next-older']);
    });

    it('rejects hostile nested tool arguments before they can enter rendered transcript state', () => {
        const source = descriptor();
        const value = page('one');
        const invalid = {
            ...value,
            fragment: {
                ...value.fragment,
                turns: [
                    {
                        ...value.fragment.turns[0],
                        kind: 'agent',
                        blocks: [
                            {
                                id: 'bad-tool',
                                type: 'tool_call',
                                tool_name: 'search',
                                executor: 'application',
                                call_id: 'call-1',
                                arguments: null,
                            },
                        ],
                    },
                ],
            },
        };
        expect(() => validateCanonicalAgentTranscriptPage(invalid, source)).toThrow();
    });

    it('rejects route, version, pinned source and non-advancing cursor changes', () => {
        const source = descriptor();
        const valid = page('one');
        expect(() => validateCanonicalAgentTranscriptPage(valid, source)).not.toThrow();
        for (const invalid of [
            { ...valid, agent_run_id: 'other' },
            { ...valid, scope: 'workstream:other' as const },
            { ...valid, api_version: 'future' },
            { ...valid, snapshot: { ...valid.snapshot, revision: 3 } },
            { ...valid, fragment: { ...valid.fragment, experimental_revision: 'future' } },
            { ...valid, next_after_turn_id: 'cursor' },
        ])
            expect(() =>
                validateCanonicalAgentTranscriptPage(
                    invalid as ExperimentalAgentConversationTranscriptPage,
                    source,
                    'cursor',
                ),
            ).toThrow();
    });

    it('does not paint an obsolete scope response after the descriptor changes', async () => {
        let resolveOld: ((value: ExperimentalAgentConversationTranscriptPage) => void) | undefined;
        const getConversationTranscript = vi
            .fn()
            .mockImplementationOnce(
                () =>
                    new Promise((resolve) => {
                        resolveOld = resolve;
                    }),
            )
            .mockResolvedValueOnce({
                ...page('new'),
                snapshot: { conversation_id: 'conversation-2', revision: 2 },
                fragment: { ...page('new').fragment, source: { conversation_id: 'conversation-2', revision: 2 } },
            });
        const client = { agents: { getConversationTranscript } } as unknown as VertesiaClient;
        const { result, rerender } = renderHook(({ source }) => useCanonicalAgentTranscript(client, source), {
            initialProps: { source: descriptor() },
        });
        rerender({ source: descriptor('conversation-2') });
        await waitFor(() => expect(result.current.tail?.snapshot.conversation_id).toBe('conversation-2'));
        await act(async () => {
            resolveOld?.(page('old'));
        });
        expect(result.current.tail?.fragment.turns[0]?.id).toBe('new');
        expect(getConversationTranscript.mock.calls[0]?.[2].signal.aborted).toBe(true);
    });
});
