import { act, renderHook, waitFor } from '@testing-library/react';
import type { AgentRunStreamMessagesOptions, VertesiaClient } from '@vertesia/client';
import { type AgentMessage, AgentMessageType, FileProcessingStatus } from '@vertesia/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAgentStream } from './useAgentStream';

type StreamMessagesMock = ReturnType<
    typeof vi.fn<
        (
            id: string,
            onMessage?: (message: AgentMessage, exitFn?: (payload: unknown) => void) => void,
            since?: number,
            signal?: AbortSignal,
            options?: AgentRunStreamMessagesOptions,
        ) => Promise<unknown>
    >
>;

function createMessage(type: AgentMessageType, timestamp: number, message: string): AgentMessage {
    return {
        timestamp,
        workflow_run_id: 'run-1',
        type,
        message,
        workstream_id: 'main',
    };
}

function createClient(streamMessages: StreamMessagesMock): VertesiaClient {
    return {
        agents: {
            getInternals: vi.fn().mockResolvedValue({
                status: 'RUNNING',
                first_workflow_run_id: 'workflow-run-1',
            }),
            streamMessages,
        },
    } as unknown as VertesiaClient;
}

describe('useAgentStream', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('marks initial history as empty when the history fetch returns no messages', async () => {
        const streamMessages = vi.fn<
            (
                id: string,
                onMessage?: (message: AgentMessage, exitFn?: (payload: unknown) => void) => void,
                since?: number,
                signal?: AbortSignal,
                options?: AgentRunStreamMessagesOptions,
            ) => Promise<unknown>
        >(async (_id, _onMessage, _since, _signal, options) => {
            options?.onHistoryLoaded?.([]);
            return null;
        });
        const client = createClient(streamMessages);

        const { result } = renderHook(() => useAgentStream(client, 'agent-run-1'));

        await waitFor(() => {
            expect(result.current.initialHistoryStatus).toBe('empty');
        });
    });

    it('marks initial history as present when the history fetch returns messages', async () => {
        const historicalMessage = createMessage(AgentMessageType.ANSWER, 1_000, 'from history');
        const streamMessages = vi.fn<
            (
                id: string,
                onMessage?: (message: AgentMessage, exitFn?: (payload: unknown) => void) => void,
                since?: number,
                signal?: AbortSignal,
                options?: AgentRunStreamMessagesOptions,
            ) => Promise<unknown>
        >(async (_id, onMessage, _since, _signal, options) => {
            options?.onHistoryLoaded?.([historicalMessage]);
            onMessage?.(historicalMessage);
            return null;
        });
        const client = createClient(streamMessages);

        const { result } = renderHook(() => useAgentStream(client, 'agent-run-1'));

        await waitFor(() => {
            expect(result.current.initialHistoryStatus).toBe('has_messages');
            expect(result.current.messages.map((message) => message.message)).toEqual(['from history']);
        });
    });

    it('seeds messages from loaded history even if the stream callback does not replay them', async () => {
        const historicalMessages = [
            createMessage(AgentMessageType.QUESTION, 1_000, 'question from history'),
            createMessage(AgentMessageType.THOUGHT, 1_100, 'thinking from history'),
            createMessage(AgentMessageType.ANSWER, 1_200, 'answer from history'),
            createMessage(AgentMessageType.IDLE, 1_300, 'Waiting for your command...'),
        ];
        const streamMessages = vi.fn<
            (
                id: string,
                onMessage?: (message: AgentMessage, exitFn?: (payload: unknown) => void) => void,
                since?: number,
                signal?: AbortSignal,
                options?: AgentRunStreamMessagesOptions,
            ) => Promise<unknown>
        >(async (_id, _onMessage, _since, _signal, options) => {
            options?.onHistoryLoaded?.(historicalMessages);
            return null;
        });
        const client = createClient(streamMessages);

        const { result } = renderHook(() => useAgentStream(client, 'agent-run-1'));

        await waitFor(() => {
            expect(result.current.initialHistoryStatus).toBe('has_messages');
            expect(result.current.messages.map((message) => message.message)).toEqual([
                'question from history',
                'thinking from history',
                'answer from history',
                'Waiting for your command...',
            ]);
        });
    });

    it('retains resource-bearing lifecycle messages loaded from history even when their text is empty', async () => {
        const resourceMessage: AgentMessage = {
            ...createMessage(AgentMessageType.THOUGHT, 1_000, ''),
            details: {
                event_class: 'activity',
                tool: 'create_document',
                tool_event: 'completed',
                resources: [{ type: 'document', id: 'doc-1', label: 'Doc One', action: 'created' }],
            },
        };
        const streamMessages = vi.fn<
            (
                id: string,
                onMessage?: (message: AgentMessage, exitFn?: (payload: unknown) => void) => void,
                since?: number,
                signal?: AbortSignal,
                options?: AgentRunStreamMessagesOptions,
            ) => Promise<unknown>
        >(async (_id, _onMessage, _since, _signal, options) => {
            options?.onHistoryLoaded?.([resourceMessage]);
            return null;
        });
        const client = createClient(streamMessages);

        const { result } = renderHook(() => useAgentStream(client, 'agent-run-1'));

        await waitFor(() => {
            expect(result.current.messages).toEqual([resourceMessage]);
        });
    });

    it('retains resource-bearing lifecycle messages received from the live stream', async () => {
        let onStreamMessage: ((message: AgentMessage) => void) | undefined;
        const streamMessages = vi.fn<
            (
                id: string,
                onMessage?: (message: AgentMessage, exitFn?: (payload: unknown) => void) => void,
                since?: number,
                signal?: AbortSignal,
            ) => Promise<unknown>
        >(async (_id, onMessage) => {
            onStreamMessage = onMessage;
            return null;
        });
        const client = createClient(streamMessages);
        const resourceMessage: AgentMessage = {
            ...createMessage(AgentMessageType.THOUGHT, 1_000, ''),
            details: {
                event_class: 'activity',
                tool: 'create_interaction',
                tool_event: 'completed',
                resources: [{ type: 'interaction', id: 'interaction-1', label: 'Daily News Agent', action: 'created' }],
            },
        };

        const { result } = renderHook(() => useAgentStream(client, 'agent-run-1'));

        await waitFor(() => {
            expect(onStreamMessage).toBeDefined();
        });

        act(() => {
            onStreamMessage?.(resourceMessage);
        });

        await waitFor(() => {
            expect(result.current.messages).toEqual([resourceMessage]);
        });
    });

    it('continues to discard empty housekeeping messages without resources', async () => {
        const emptyThought = createMessage(AgentMessageType.THOUGHT, 1_000, '');
        const streamMessages = vi.fn<
            (
                id: string,
                onMessage?: (message: AgentMessage, exitFn?: (payload: unknown) => void) => void,
                since?: number,
                signal?: AbortSignal,
                options?: AgentRunStreamMessagesOptions,
            ) => Promise<unknown>
        >(async (_id, onMessage, _since, _signal, options) => {
            options?.onHistoryLoaded?.([emptyThought]);
            onMessage?.(emptyThought);
            return null;
        });
        const client = createClient(streamMessages);

        const { result } = renderHook(() => useAgentStream(client, 'agent-run-1'));

        await waitFor(() => {
            expect(result.current.initialHistoryStatus).toBe('has_messages');
        });
        expect(result.current.messages).toEqual([]);
    });

    it('marks initial history as errored when the history fetch fails', async () => {
        const streamMessages = vi.fn<
            (
                id: string,
                onMessage?: (message: AgentMessage, exitFn?: (payload: unknown) => void) => void,
                since?: number,
                signal?: AbortSignal,
                options?: AgentRunStreamMessagesOptions,
            ) => Promise<unknown>
        >(async (_id, _onMessage, _since, _signal, options) => {
            options?.onHistoryError?.(new Error('history failed'));
            return null;
        });
        const client = createClient(streamMessages);

        const { result } = renderHook(() => useAgentStream(client, 'agent-run-1'));

        await waitFor(() => {
            expect(result.current.initialHistoryStatus).toBe('error');
        });
    });

    it('reconnects the same agent run from the last delivered timestamp without clearing messages', async () => {
        const complete = createMessage(AgentMessageType.COMPLETE, 1_000, 'done');
        const answer = createMessage(AgentMessageType.ANSWER, 1_100, 'continued');
        const streamMessages = vi
            .fn<
                (
                    id: string,
                    onMessage?: (message: AgentMessage, exitFn?: (payload: unknown) => void) => void,
                    since?: number,
                    signal?: AbortSignal,
                ) => Promise<unknown>
            >()
            .mockImplementationOnce(async (_id, onMessage) => {
                onMessage?.(complete);
                return null;
            })
            .mockImplementationOnce(async (_id, onMessage) => {
                onMessage?.(answer);
                return null;
            });
        const client = createClient(streamMessages);

        const { result } = renderHook(() => useAgentStream(client, 'agent-run-1'));

        await waitFor(() => {
            expect(result.current.messages.map((message) => message.message)).toEqual(['done']);
        });

        act(() => {
            result.current.reconnect();
        });

        await waitFor(() => {
            expect(streamMessages).toHaveBeenCalledTimes(2);
        });

        expect(streamMessages.mock.calls[0][2]).toBeUndefined();
        expect(streamMessages.mock.calls[1][2]).toBe(1_000);

        await waitFor(() => {
            expect(result.current.messages.map((message) => message.message)).toEqual(['done', 'continued']);
        });
    });

    it('resets state and fetches full history when the agent run id changes', async () => {
        const firstRunMessage = createMessage(AgentMessageType.ANSWER, 1_000, 'first run');
        const secondRunMessage = {
            ...createMessage(AgentMessageType.ANSWER, 2_000, 'second run'),
            workflow_run_id: 'run-2',
        };
        const streamMessages = vi
            .fn<
                (
                    id: string,
                    onMessage?: (message: AgentMessage, exitFn?: (payload: unknown) => void) => void,
                    since?: number,
                    signal?: AbortSignal,
                ) => Promise<unknown>
            >()
            .mockImplementationOnce(async (_id, onMessage) => {
                onMessage?.(firstRunMessage);
                return null;
            })
            .mockImplementationOnce(async (_id, onMessage) => {
                onMessage?.(secondRunMessage);
                return null;
            });
        const client = createClient(streamMessages);

        const { result, rerender } = renderHook(({ agentRunId }) => useAgentStream(client, agentRunId), {
            initialProps: { agentRunId: 'agent-run-1' },
        });

        await waitFor(() => {
            expect(result.current.messages.map((message) => message.message)).toEqual(['first run']);
        });

        rerender({ agentRunId: 'agent-run-2' });

        await waitFor(() => {
            expect(streamMessages).toHaveBeenCalledTimes(2);
        });

        expect(streamMessages.mock.calls[1][0]).toBe('agent-run-2');
        expect(streamMessages.mock.calls[1][2]).toBeUndefined();

        await waitFor(() => {
            expect(result.current.messages.map((message) => message.message)).toEqual(['second run']);
        });
    });

    it('dedupes re-delivered messages by timestamp and replaces ack-matched optimistic questions', async () => {
        let onStreamMessage: ((message: AgentMessage) => void) | undefined;
        const streamMessages = vi.fn<
            (
                id: string,
                onMessage?: (message: AgentMessage, exitFn?: (payload: unknown) => void) => void,
                since?: number,
                signal?: AbortSignal,
            ) => Promise<unknown>
        >(async (_id, onMessage) => {
            onStreamMessage = onMessage;
            return null;
        });
        const client = createClient(streamMessages);

        const { result } = renderHook(() => useAgentStream(client, 'agent-run-1'));

        await waitFor(() => {
            expect(onStreamMessage).toBeDefined();
        });

        act(() => {
            result.current.addOptimisticMessage({
                ...createMessage(AgentMessageType.QUESTION, 1_000, 'optimistic'),
                details: { _optimistic: true, _messageId: 'message-1', _deliveryStatus: 'sending' },
            });
        });

        expect(result.current.messages).toHaveLength(1);

        act(() => {
            onStreamMessage?.({
                ...createMessage(AgentMessageType.QUESTION, 1_100, 'server question'),
                details: { ack: 'message-1' },
            });
        });

        await waitFor(() => {
            expect(result.current.messages.map((message) => message.message)).toEqual(['server question']);
            expect(result.current.messages[0]?.details?._deliveryStatus).toBe('consumed');
        });

        const answer = createMessage(AgentMessageType.ANSWER, 1_200, 'answer');
        act(() => {
            onStreamMessage?.(answer);
            onStreamMessage?.(answer);
        });

        await waitFor(() => {
            expect(result.current.messages.map((message) => message.message)).toEqual(['server question', 'answer']);
        });
    });

    it('replaces an ack-matched optimistic stop marker when the workflow consumes Stop', async () => {
        let onStreamMessage: ((message: AgentMessage) => void) | undefined;
        const streamMessages = vi.fn<
            (
                id: string,
                onMessage?: (message: AgentMessage, exitFn?: (payload: unknown) => void) => void,
                since?: number,
                signal?: AbortSignal,
            ) => Promise<unknown>
        >(async (_id, onMessage) => {
            onStreamMessage = onMessage;
            return null;
        });
        const client = createClient(streamMessages);

        const { result } = renderHook(() => useAgentStream(client, 'agent-run-1'));

        await waitFor(() => {
            expect(onStreamMessage).toBeDefined();
        });

        act(() => {
            result.current.addOptimisticMessage({
                ...createMessage(AgentMessageType.IDLE, 1_000, 'Stopped. Waiting for your command...'),
                details: {
                    _optimistic: true,
                    _messageId: 'stop-1',
                    _deliveryStatus: 'received',
                    status_reason: 'user_stopped',
                },
            });
        });

        act(() => {
            onStreamMessage?.({
                ...createMessage(AgentMessageType.IDLE, 1_100, 'Stopped. Waiting for your command...'),
                details: { ack: 'stop-1', status_reason: 'user_stopped' },
            });
        });

        await waitFor(() => {
            expect(result.current.messages).toHaveLength(1);
            expect(result.current.messages[0]?.timestamp).toBe(1_100);
            expect(result.current.messages[0]?.details?._deliveryStatus).toBe('consumed');
        });
    });

    it('keeps non-matching optimistic questions when an acknowledged server question arrives', async () => {
        let onStreamMessage: ((message: AgentMessage) => void) | undefined;
        const streamMessages = vi.fn<
            (
                id: string,
                onMessage?: (message: AgentMessage, exitFn?: (payload: unknown) => void) => void,
                since?: number,
                signal?: AbortSignal,
            ) => Promise<unknown>
        >(async (_id, onMessage) => {
            onStreamMessage = onMessage;
            return null;
        });
        const client = createClient(streamMessages);

        const { result } = renderHook(() => useAgentStream(client, 'agent-run-1'));

        await waitFor(() => {
            expect(onStreamMessage).toBeDefined();
        });

        act(() => {
            result.current.addOptimisticMessage({
                ...createMessage(AgentMessageType.QUESTION, 1_000, 'first optimistic'),
                details: { _optimistic: true, _messageId: 'message-1', _deliveryStatus: 'sending' },
            });
            result.current.addOptimisticMessage({
                ...createMessage(AgentMessageType.QUESTION, 1_050, 'second optimistic'),
                details: { _optimistic: true, _messageId: 'message-2', _deliveryStatus: 'sending' },
            });
        });

        act(() => {
            onStreamMessage?.({
                ...createMessage(AgentMessageType.QUESTION, 1_100, 'server second question'),
                details: { ack: 'message-2' },
            });
        });

        await waitFor(() => {
            expect(result.current.messages.map((message) => message.message)).toEqual([
                'first optimistic',
                'server second question',
            ]);
        });
        expect(result.current.messages[0]?.details?._deliveryStatus).toBe('sending');
        expect(result.current.messages[1]?.details?._deliveryStatus).toBe('consumed');
    });

    it('updates optimistic message delivery status', async () => {
        let onStreamMessage: ((message: AgentMessage) => void) | undefined;
        const streamMessages = vi.fn<
            (
                id: string,
                onMessage?: (message: AgentMessage, exitFn?: (payload: unknown) => void) => void,
                since?: number,
                signal?: AbortSignal,
            ) => Promise<unknown>
        >(async (_id, onMessage) => {
            onStreamMessage = onMessage;
            return null;
        });
        const client = createClient(streamMessages);

        const { result } = renderHook(() => useAgentStream(client, 'agent-run-1'));

        await waitFor(() => {
            expect(onStreamMessage).toBeDefined();
        });

        act(() => {
            result.current.addOptimisticMessage({
                ...createMessage(AgentMessageType.QUESTION, 1_000, 'optimistic'),
                details: { _optimistic: true, _messageId: 'message-1', _deliveryStatus: 'sending' },
            });
        });

        act(() => {
            result.current.updateOptimisticMessageStatus('message-1', 'received');
        });

        expect(result.current.messages[0]?.details?._deliveryStatus).toBe('received');
    });

    it('uses workflow-run scoped streaming ids so reused activity ids do not collide', async () => {
        let onStreamMessage: ((message: AgentMessage) => void) | undefined;
        const streamMessages = vi.fn<
            (
                id: string,
                onMessage?: (message: AgentMessage, exitFn?: (payload: unknown) => void) => void,
                since?: number,
                signal?: AbortSignal,
            ) => Promise<unknown>
        >(async (_id, onMessage) => {
            onStreamMessage = onMessage;
            return null;
        });
        const client = createClient(streamMessages);

        const { result } = renderHook(() => useAgentStream(client, 'agent-run-1'));

        await waitFor(() => {
            expect(onStreamMessage).toBeDefined();
        });

        act(() => {
            onStreamMessage?.({
                ...createMessage(AgentMessageType.STREAMING_CHUNK, 1_000, 'first'),
                details: {
                    streaming_id: 'run-a-activity-7',
                    streaming_id_scope: 'workflow_run',
                    activity_id: 'activity-7',
                    is_final: false,
                },
            });
            onStreamMessage?.({
                ...createMessage(AgentMessageType.STREAMING_CHUNK, 1_010, 'second'),
                details: {
                    streaming_id: 'run-b-activity-7',
                    streaming_id_scope: 'workflow_run',
                    activity_id: 'activity-7',
                    is_final: false,
                },
            });
        });

        await waitFor(() => {
            expect([...result.current.streamingMessages.keys()].sort()).toEqual([
                'run-a-activity-7',
                'run-b-activity-7',
            ]);
        });

        act(() => {
            onStreamMessage?.({
                ...createMessage(AgentMessageType.ANSWER, 1_100, 'final second'),
                details: {
                    streaming_id: 'run-b-activity-7',
                    streaming_id_scope: 'workflow_run',
                    activity_id: 'activity-7',
                },
            });
        });

        await waitFor(() => {
            expect([...result.current.streamingMessages.keys()]).toEqual(['run-a-activity-7']);
        });
    });

    it('keeps legacy activity-id cleanup for streaming chunks without scoped streaming ids', async () => {
        let onStreamMessage: ((message: AgentMessage) => void) | undefined;
        const streamMessages = vi.fn<
            (
                id: string,
                onMessage?: (message: AgentMessage, exitFn?: (payload: unknown) => void) => void,
                since?: number,
                signal?: AbortSignal,
            ) => Promise<unknown>
        >(async (_id, onMessage) => {
            onStreamMessage = onMessage;
            return null;
        });
        const client = createClient(streamMessages);

        const { result } = renderHook(() => useAgentStream(client, 'agent-run-1'));

        await waitFor(() => {
            expect(onStreamMessage).toBeDefined();
        });

        act(() => {
            onStreamMessage?.({
                ...createMessage(AgentMessageType.STREAMING_CHUNK, 1_000, 'legacy'),
                details: {
                    streaming_id: 'main',
                    activity_id: 'legacy-activity',
                    is_final: false,
                },
            });
        });

        await waitFor(() => {
            expect([...result.current.streamingMessages.keys()]).toEqual(['legacy-activity']);
        });

        act(() => {
            onStreamMessage?.({
                ...createMessage(AgentMessageType.ANSWER, 1_100, 'legacy final'),
                details: {
                    activity_id: 'legacy-activity',
                },
            });
        });

        await waitFor(() => {
            expect(result.current.streamingMessages.size).toBe(0);
        });
    });

    it('replaces file processing status with the latest server snapshot', async () => {
        let onStreamMessage: ((message: AgentMessage) => void) | undefined;
        const streamMessages = vi.fn<
            (
                id: string,
                onMessage?: (message: AgentMessage, exitFn?: (payload: unknown) => void) => void,
                since?: number,
                signal?: AbortSignal,
            ) => Promise<unknown>
        >(async (_id, onMessage) => {
            onStreamMessage = onMessage;
            return null;
        });
        const client = createClient(streamMessages);

        const { result } = renderHook(() => useAgentStream(client, 'agent-run-1'));

        await waitFor(() => {
            expect(onStreamMessage).toBeDefined();
        });

        act(() => {
            onStreamMessage?.({
                ...createMessage(AgentMessageType.SYSTEM, 1_000, 'file ready'),
                details: {
                    system_type: 'file_processing',
                    batch_id: 'batch-1',
                    files: [
                        {
                            id: 'file-1',
                            name: 'wrong.png',
                            content_type: 'image/png',
                            size: 1,
                            status: FileProcessingStatus.READY,
                            started_at: 1_000,
                        },
                    ],
                    pending_count: 0,
                    ready_count: 1,
                    error_count: 0,
                },
            });
        });

        expect(result.current.serverFileUpdates.has('file-1')).toBe(true);

        act(() => {
            onStreamMessage?.({
                ...createMessage(AgentMessageType.SYSTEM, 1_100, 'file removed'),
                details: {
                    system_type: 'file_processing',
                    batch_id: 'batch-1',
                    files: [],
                    pending_count: 0,
                    ready_count: 0,
                    error_count: 0,
                },
            });
        });

        expect(result.current.serverFileUpdates.has('file-1')).toBe(false);
    });
});
