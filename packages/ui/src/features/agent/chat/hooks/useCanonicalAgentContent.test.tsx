import { act, renderHook, waitFor } from '@testing-library/react';
import type { AgentConversationStreamSessionOptions } from '@vertesia/client';
import { type AgentConversationStreamUpdate, CanonicalInteractionOutput, type VertesiaClient } from '@vertesia/client';
import type {
    CanonicalConversationHeadScope,
    ConversationOutputReceipt,
    ExperimentalAgentConversationAcceptedOutput,
    ExperimentalAgentConversationAcceptedOutputHistoryPage,
    ExperimentalAgentConversationAcceptedOutputHistoryQuery,
    ExperimentalAgentRunControlNotification,
    ExperimentalAgentRunUpdatesResponse,
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
    const streamOptions: Array<Omit<AgentConversationStreamSessionOptions, 'agent_run_id' | 'on_update'>> = [];
    const streamSignals: AbortSignal[] = [];
    const streamCallbacks: Array<(update: AgentConversationStreamUpdate) => void | Promise<void>> = [];
    const streamCanonicalConversation = vi.fn(
        async (
            _id: string,
            onUpdate: (update: AgentConversationStreamUpdate) => void | Promise<void>,
            options?: Omit<AgentConversationStreamSessionOptions, 'agent_run_id' | 'on_update'>,
        ) => {
            const signal = options?.signal;
            if (!signal) return;
            streamOptions.push(options ?? {});
            streamSignals.push(signal);
            streamCallbacks.push(onUpdate);
            await new Promise<void>((resolve) => {
                if (signal.aborted) resolve();
                else signal.addEventListener('abort', () => resolve(), { once: true });
            });
        },
    );
    const retrieveCanonicalUpdates = vi.fn(
        async (): Promise<ExperimentalAgentRunUpdatesResponse> => ({
            run: {
                api_version: '=20260930',
                agent_run_id: 'agent-1',
                scope: 'root',
                type: 'run_status',
                status: 'running',
                activity_state: 'working',
                updated_at: '2026-10-01T00:00:00.000Z',
            },
            source: { api_version: '=20260930', agent_run_id: 'agent-1', scope: 'root', status: 'uninitialized' },
            controls: [],
            control_page: { after: 0, has_more: false, gap_before: false },
        }),
    );
    const client = {
        agents: {
            listConversationAcceptedOutputs,
            retrieveCanonicalUpdates,
            retrieveConversationAcceptedOutput: vi.fn(),
            streamCanonicalConversation,
        },
    } as unknown as VertesiaClient;
    return {
        client,
        listConversationAcceptedOutputs,
        streamCanonicalConversation,
        streamSignals,
        streamCallbacks,
        streamOptions,
        retrieveCanonicalUpdates,
    };
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

describe('canonical agent lifecycle and control UI consumption', () => {
    it('uses actual negotiated callbacks and poll snapshot without admitting host events as content', async () => {
        const fixture = createClient([]);
        const notification: ExperimentalAgentRunControlNotification = {
            api_version: '=20260930',
            agent_run_id: 'agent-1',
            scope: 'root',
            type: 'run_control',
            timestamp: 1790812800000,
            control: {
                version: 1,
                event: 'user_input_received',
                event_id: 'control:one',
                ack: 'client:one',
                editing_action: {
                    operation_id: 'edit:one',
                    resource: { kind: 'store_document', document_id: 'document:one' },
                },
                request_input_response: { request_id: 'input:one' },
            },
        };
        const snapshot: ExperimentalAgentRunUpdatesResponse = {
            run: {
                api_version: '=20260930',
                agent_run_id: 'agent-1',
                scope: 'root',
                type: 'run_status',
                status: 'running',
                activity_state: 'idle',
                updated_at: RECORDED_AT,
            },
            source: {
                api_version: '=20260930',
                agent_run_id: 'agent-1',
                scope: 'root',
                status: 'initialized',
                contract_version: 'canonical-conversation-v1',
                head: {
                    format: 'llumiverse.conversation',
                    schema_version: 0,
                    experimental_revision: '2026-09-30.adoption.1',
                    conversation_id: 'conversation-1',
                    revision: 3,
                },
            },
            controls: [notification],
            control_page: { after: notification.timestamp, has_more: false, gap_before: false },
        };
        fixture.retrieveCanonicalUpdates.mockResolvedValue(snapshot);
        const status = vi.fn();
        const control = vi.fn();
        const sourceChanged = vi.fn();
        const { result, unmount } = renderHook(() =>
            useCanonicalAgentContent(fixture.client, {
                enabled: true,
                loadAcceptedHistory: false,
                conversationId: 'conversation-1',
                agentRunId: 'agent-1',
                onRunStatus: status,
                onRunControl: control,
                onSourceChanged: sourceChanged,
            }),
        );
        await waitFor(() => expect(control).toHaveBeenCalledExactlyOnceWith(notification));
        expect(status).toHaveBeenCalledExactlyOnceWith(snapshot.run);
        expect(sourceChanged).toHaveBeenCalledOnce();
        const callbacks = fixture.streamOptions[0];
        if (!callbacks?.on_run_control || !callbacks.on_run_status)
            throw new Error('Actual canonical hook did not negotiate control and status callbacks');
        const onControl = callbacks.on_run_control;
        const onStatus = callbacks.on_run_status;
        await act(async () => {
            await onControl({ ...notification, timestamp: notification.timestamp + 1000 });
            await onStatus(snapshot.run);
            await onStatus({
                ...snapshot.run,
                status: 'completed',
                updated_at: '2026-10-01T00:00:01.000Z',
            });
            await onStatus(snapshot.run);
        });
        expect(control).toHaveBeenCalledOnce();
        expect(status).toHaveBeenCalledTimes(2);
        expect(status.mock.calls[1][0].status).toBe('completed');
        expect(result.current.live.accepted_outputs).toEqual([]);
        expect(result.current.live.draft_snapshot).toEqual([]);
        expect(fixture.listConversationAcceptedOutputs).not.toHaveBeenCalled();
        unmount();
        expect(fixture.streamSignals[0].aborted).toBe(true);
    });

    it('surfaces bounded poll and SSE retention gaps only in the authenticated active session', async () => {
        const first = createClient([]);
        const initial = await first.retrieveCanonicalUpdates();
        first.retrieveCanonicalUpdates.mockClear();
        first.retrieveCanonicalUpdates.mockResolvedValue({
            ...initial,
            control_page: { after: 10, has_more: false, gap_before: true },
        });
        const second = createClient([]);
        const options: UseCanonicalAgentContentOptions = {
            enabled: true,
            loadAcceptedHistory: false,
            agentRunId: 'agent-1',
            onRunControl: vi.fn(),
        };
        const renderedGaps: boolean[] = [];
        const { result, rerender, unmount } = renderHook(
            ({ client }: { client: VertesiaClient }) => {
                const content = useCanonicalAgentContent(client, options);
                renderedGaps.push(content.controlDeliveryGap);
                return content;
            },
            { initialProps: { client: first.client } },
        );
        await waitFor(() => expect(result.current.controlDeliveryGap).toBe(true));
        await waitFor(() => expect(first.streamOptions).toHaveLength(1));
        const staleStatus = first.streamOptions[0].on_run_status;
        if (!staleStatus) throw new Error('Control-only consumer must negotiate retention status');
        expect(first.listConversationAcceptedOutputs).not.toHaveBeenCalled();
        renderedGaps.length = 0;
        rerender({ client: second.client });
        expect(renderedGaps[0]).toBe(false);
        expect(result.current.controlDeliveryGap).toBe(false);
        await waitFor(() => expect(second.streamOptions).toHaveLength(1));
        const status = second.streamOptions[0].on_run_status;
        if (!status) throw new Error('Missing active canonical status consumer');
        await act(async () => {
            await staleStatus({ ...initial.run, control_page: { after: 11, has_more: false, gap_before: true } });
        });
        expect(result.current.controlDeliveryGap).toBe(false);
        // A foreign route cannot taint the active session's retention state.
        expect(() =>
            status({
                ...initial.run,
                agent_run_id: 'foreign:agent',
                control_page: { after: 12, has_more: false, gap_before: true },
            }),
        ).toThrow('route');
        expect(result.current.controlDeliveryGap).toBe(false);
        await act(async () =>
            status({
                ...initial.run,
                control_page: { after: 13, has_more: false, gap_before: true },
            }),
        );
        expect(result.current.controlDeliveryGap).toBe(true);
        await act(async () =>
            status({
                ...initial.run,
                updated_at: '2026-10-01T00:00:01.000Z',
                control_page: { after: 14, has_more: false, gap_before: false },
            }),
        );
        expect(result.current.controlDeliveryGap).toBe(true); // Later pages cannot erase a known retention gap.
        expect(second.listConversationAcceptedOutputs).not.toHaveBeenCalled();
        unmount();
        expect(second.streamSignals[0].aborted).toBe(true);
    });

    it('accepts valid uninitialized lifecycle status before a conversation is pinned, retaining the pinned-source guard', async () => {
        const beforeHead = createClient([]);
        const status = vi.fn();
        const { result, unmount } = renderHook(() =>
            useCanonicalAgentContent(beforeHead.client, {
                enabled: true,
                loadAcceptedHistory: false,
                agentRunId: 'agent-1',
                onRunStatus: status,
            }),
        );
        await waitFor(() => expect(status).toHaveBeenCalledOnce());
        await act(async () => undefined);
        expect(result.current.live.error).toBeUndefined();
        expect(result.current.live.accepted_outputs).toEqual([]);
        expect(beforeHead.listConversationAcceptedOutputs).not.toHaveBeenCalled();
        unmount();
        const pinned = createClient([]);
        const mounted = renderHook(() =>
            useCanonicalAgentContent(pinned.client, {
                enabled: true,
                loadAcceptedHistory: false,
                agentRunId: 'agent-1',
                conversationId: 'conversation-1',
                onRunStatus: vi.fn(),
            }),
        );
        await waitFor(() =>
            expect(mounted.result.current.live.error).toMatchObject({
                message: 'Canonical run lifecycle lost its exact source descriptor',
            }),
        );
        mounted.unmount();
    });

    it('rejects changed exact control identity and foreign route through the actual UI callback', async () => {
        const fixture = createClient([]);
        const { unmount } = renderHook(() =>
            useCanonicalAgentContent(fixture.client, {
                enabled: true,
                loadAcceptedHistory: false,
                agentRunId: 'agent-1',
                onRunControl: vi.fn(),
            }),
        );
        await waitFor(() => expect(fixture.streamOptions).toHaveLength(1));
        const callback = fixture.streamOptions[0].on_run_control;
        if (!callback) throw new Error('Missing canonical control consumer');
        const event: ExperimentalAgentRunControlNotification = {
            api_version: '=20260930',
            agent_run_id: 'agent-1',
            scope: 'root',
            type: 'run_control',
            timestamp: 1,
            control: { version: 1, event: 'user_input_received', event_id: 'one', ack: 'client:one' },
        };
        await callback(event);
        expect(() => callback({ ...event, control: { ...event.control, ack: 'foreign:ack' } })).toThrow('identity');
        expect(() => callback({ ...event, agent_run_id: 'foreign:agent' })).toThrow('route');
        unmount();
    });
});
