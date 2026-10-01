import { act, renderHook, waitFor } from '@testing-library/react';
import { type AgentConversationStreamUpdate, CanonicalInteractionOutput, type VertesiaClient } from '@vertesia/client';
import type {
    CanonicalConversationHeadScope,
    ConversationOutputReceipt,
    ExperimentalAgentConversationAcceptedOutput,
    ExperimentalAgentConversationAcceptedOutputHistoryPage,
    ExperimentalAgentConversationAcceptedOutputHistoryQuery,
} from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
import { type UseCanonicalAgentContentOptions, useCanonicalAgentContent } from './useCanonicalAgentContent.js';

function historyPage(
    nextAfterRevision?: number,
    scope: CanonicalConversationHeadScope = 'root',
): ExperimentalAgentConversationAcceptedOutputHistoryPage {
    return {
        api_version: '=20260930',
        agent_run_id: 'agent-1',
        scope,
        snapshot: { conversation_id: 'conversation-1', revision: 10 },
        items: [],
        ...(nextAfterRevision === undefined ? {} : { next_after_revision: nextAfterRevision }),
    };
}

function createClient(pages: ExperimentalAgentConversationAcceptedOutputHistoryPage[]) {
    const listConversationAcceptedOutputs = vi.fn(
        async (
            _id: string,
            _query?: ExperimentalAgentConversationAcceptedOutputHistoryQuery,
            _options?: { signal?: AbortSignal },
        ) => pages.shift() ?? historyPage(),
    );
    const streamSignals: AbortSignal[] = [];
    const streamCallbacks: Array<(update: AgentConversationStreamUpdate) => void | Promise<void>> = [];
    const streamCanonicalConversation = vi.fn(
        async (
            _id: string,
            onUpdate: (update: AgentConversationStreamUpdate) => void | Promise<void>,
            options?: { signal?: AbortSignal },
        ) => {
            const signal = options?.signal;
            if (!signal) return;
            streamSignals.push(signal);
            streamCallbacks.push(onUpdate);
            await new Promise<void>((resolve) => {
                if (signal.aborted) resolve();
                else signal.addEventListener('abort', () => resolve(), { once: true });
            });
        },
    );
    const client = {
        agents: {
            listConversationAcceptedOutputs,
            retrieveConversationAcceptedOutput: vi.fn(),
            streamCanonicalConversation,
        },
    } as unknown as VertesiaClient;
    return { client, listConversationAcceptedOutputs, streamCanonicalConversation, streamSignals, streamCallbacks };
}

const RECORDED_AT = '2026-10-01T00:00:00.000Z';

function acceptedUpdate(): AgentConversationStreamUpdate {
    const receipt: ConversationOutputReceipt = {
        id: 'response-1',
        conversation_id: 'conversation-1',
        base_revision: 0,
        result_revision: 1,
        recorded_at: RECORDED_AT,
        accepted_turn_ids: ['turn-1'],
        accepted_generation_ids: ['generation-1'],
        accepted_asset_ids: [],
    };
    const envelope: ExperimentalAgentConversationAcceptedOutput = {
        api_version: '=20260930',
        agent_run_id: 'agent-1',
        scope: 'root',
        type: 'accepted_output',
        source: { conversation_id: 'conversation-1', revision: 1 },
        receipt,
    };
    const output = new CanonicalInteractionOutput({
        format: 'llumiverse.conversation-output',
        schema_version: 0,
        experimental_revision: '2026-09-30.adoption.1',
        source: envelope.source,
        receipt,
        turn: {
            id: 'turn-1',
            kind: 'agent',
            authority: 'ordinary',
            blocks: [{ id: 'text-1', type: 'text', text: 'stale accepted', format: 'plain' }],
            status: 'completed',
            timestamps: { recorded_at: RECORDED_AT, completed_at: RECORDED_AT },
            provenance: { type: 'generated' },
            model_visibility: 'include',
            generation_id: 'generation-1',
        },
        generation: {
            id: 'generation-1',
            record_source: 'executed',
            request_id: 'request-1',
            attempt_id: 'attempt-1',
            purpose: 'interaction',
            requested_model: 'model-1',
            provider: 'provider-1',
            protocol: 'provider.protocol',
            adapter_version: 'adapter-1',
            status: 'completed',
            timestamps: { recorded_at: RECORDED_AT, completed_at: RECORDED_AT },
            source: { conversation_id: 'conversation-1', revision: 0 },
        },
        assets: {},
        completeness: {
            history: 'omitted',
            native_replay: 'omitted',
            metadata: 'omitted',
            semantic_content: 'complete',
            omitted_block_ids: [],
            omitted_asset_ids: [],
        },
    });
    return { type: 'accepted_output', envelope, output, draft_snapshot: Object.freeze([]) };
}

function draftUpdate(text: string): AgentConversationStreamUpdate {
    const draft_snapshot = Object.freeze([
        Object.freeze({
            draft_block_id: 'draft-1',
            native_position: { protocol: 'test', path: ['parts', 0] },
            type: 'text' as const,
            text,
            finished: false,
        }),
    ]);
    return {
        api_version: '=20260930',
        agent_run_id: 'agent-1',
        scope: 'root',
        type: 'conversation_event',
        execution_run_id: 'execution-1',
        event: {
            format: 'llumiverse.conversation',
            schema_version: 0,
            experimental_revision: '2026-09-30.adoption.1',
            stream_id: 'stream-1',
            request_id: 'request-1',
            attempt_id: 'attempt-1',
            response_operation_id: 'response-2',
            generation_id: 'generation-2',
            draft_turn_id: 'turn-2',
            event_id: 'stream-1#1',
            sequence: 1,
            draft_block_id: 'draft-1',
            native_position: { protocol: 'test', path: ['parts', 0] },
            type: 'draft_text_delta',
            text,
        },
        draft_snapshot,
    };
}

describe('useCanonicalAgentContent', () => {
    it('performs no history or stream I/O unless the internal mode is explicitly enabled', async () => {
        const fixture = createClient([historyPage()]);
        const { result } = renderHook(() =>
            useCanonicalAgentContent(fixture.client, { enabled: false, agentRunId: 'agent-1' }),
        );

        await act(async () => undefined);
        expect(result.current.history.status).toBe('idle');
        expect(fixture.listConversationAcceptedOutputs).not.toHaveBeenCalled();
        expect(fixture.streamCanonicalConversation).not.toHaveBeenCalled();
    });

    it('aborts the prior history and live subscription when agent scope changes', async () => {
        const historySignals: AbortSignal[] = [];
        const fixture = createClient([historyPage(undefined, 'root'), historyPage(undefined, 'workstream:child')]);
        fixture.listConversationAcceptedOutputs.mockImplementation(async (_id, query, options) => {
            const signal = options?.signal;
            if (signal) historySignals.push(signal);
            return historyPage(undefined, query?.conversation_scope ?? 'root');
        });
        const initial: UseCanonicalAgentContentOptions = { enabled: true, agentRunId: 'agent-1', scope: 'root' };
        const { rerender } = renderHook(
            ({ options }: { options: UseCanonicalAgentContentOptions }) =>
                useCanonicalAgentContent(fixture.client, options),
            { initialProps: { options: initial } },
        );

        await waitFor(() => expect(fixture.streamSignals).toHaveLength(1));
        rerender({
            options: { enabled: true, agentRunId: 'agent-1', scope: 'workstream:child', workstreamId: 'child' },
        });
        await waitFor(() => expect(fixture.streamSignals).toHaveLength(2));

        expect(fixture.streamSignals[0]?.aborted).toBe(true);
        expect(historySignals[0]?.aborted).toBe(true);
        expect(fixture.listConversationAcceptedOutputs).toHaveBeenLastCalledWith(
            'agent-1',
            expect.objectContaining({ conversation_scope: 'workstream:child', workstream_id: 'child' }),
            expect.objectContaining({ signal: expect.any(AbortSignal) }),
        );
    });

    it('ignores late draft and accepted callbacks from an aborted scope subscription', async () => {
        const fixture = createClient([historyPage(undefined, 'root'), historyPage(undefined, 'workstream:child')]);
        const initial: UseCanonicalAgentContentOptions = {
            enabled: true,
            agentRunId: 'agent-1',
            scope: 'root',
        };
        const { result, rerender } = renderHook(
            ({ options }: { options: UseCanonicalAgentContentOptions }) =>
                useCanonicalAgentContent(fixture.client, options),
            { initialProps: { options: initial } },
        );
        await waitFor(() => expect(fixture.streamCallbacks).toHaveLength(1));
        const staleCallback = fixture.streamCallbacks[0];

        rerender({
            options: {
                enabled: true,
                agentRunId: 'agent-1',
                scope: 'workstream:child',
                workstreamId: 'child',
            },
        });
        await waitFor(() => expect(fixture.streamCallbacks).toHaveLength(2));
        await act(async () => {
            await staleCallback?.(draftUpdate('stale draft'));
            await staleCallback?.(acceptedUpdate());
        });

        expect(result.current.live.draft_snapshot).toEqual([]);
        expect(result.current.live.accepted_outputs).toEqual([]);
    });

    it('does not expose prior content during the synchronous render before a changed client session resets', async () => {
        const first = createClient([historyPage()]);
        const second = createClient([historyPage()]);
        const options: UseCanonicalAgentContentOptions = { enabled: true, agentRunId: 'agent-1', scope: 'root' };
        const renderedDrafts: string[][] = [];
        const { result, rerender } = renderHook(
            ({ client }: { client: VertesiaClient }) => {
                const content = useCanonicalAgentContent(client, options);
                renderedDrafts.push(content.live.draft_snapshot.map((draft) => draft.text ?? ''));
                return content;
            },
            { initialProps: { client: first.client } },
        );
        await waitFor(() => expect(first.streamCallbacks).toHaveLength(1));
        await act(async () => first.streamCallbacks[0]?.(draftUpdate('prior client draft')));
        await waitFor(() => expect(result.current.live.draft_snapshot).toHaveLength(1));

        renderedDrafts.length = 0;
        rerender({ client: second.client });

        expect(renderedDrafts[0]).toEqual([]);
        expect(result.current.live.draft_snapshot).toEqual([]);
    });

    it('reports a non-advancing or out-of-snapshot cursor as history state error', async () => {
        const fixture = createClient([historyPage(11)]);
        const { result } = renderHook(() =>
            useCanonicalAgentContent(fixture.client, { enabled: true, agentRunId: 'agent-1' }),
        );

        await waitFor(() => expect(result.current.history.status).toBe('error'));
        expect(result.current.history.error).toMatchObject({
            message: 'Canonical accepted-output history cursor does not advance within its pinned snapshot',
        });
    });

    it('follows only a bounded number of empty imported-only pages per user request', async () => {
        const fixture = createClient([historyPage(1), historyPage(2), historyPage(3), historyPage(4), historyPage()]);
        const { result } = renderHook(() =>
            useCanonicalAgentContent(fixture.client, { enabled: true, agentRunId: 'agent-1' }),
        );
        await waitFor(() => expect(result.current.history.next_after_revision).toBe(1));

        await act(async () => result.current.loadNextHistory());

        expect(fixture.listConversationAcceptedOutputs).toHaveBeenCalledTimes(4);
        expect(result.current.history.outputs).toEqual([]);
        expect(result.current.history.next_after_revision).toBe(4);
        expect(result.current.history.gap_after_window).toBe(true);
        expect(result.current.history.empty_page_scan_exhausted).toBe(true);
        expect(fixture.listConversationAcceptedOutputs.mock.calls.slice(1).map((call) => call[1])).toEqual([
            expect.objectContaining({ after_revision: 1, snapshot_conversation_id: 'conversation-1' }),
            expect.objectContaining({ after_revision: 2, snapshot_conversation_id: 'conversation-1' }),
            expect.objectContaining({ after_revision: 3, snapshot_conversation_id: 'conversation-1' }),
        ]);
    });
});
