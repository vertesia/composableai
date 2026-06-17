import { act, renderHook, waitFor } from '@testing-library/react';
import type { VertesiaClient } from '@vertesia/client';
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
