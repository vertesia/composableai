import { useCallback, useEffect, useRef, useState } from 'react';
import { AsyncExecutionResult, VertesiaClient } from '@vertesia/client';
import {
    AgentMessage,
    AgentMessageType,
    ConversationFile,
    FileProcessingDetails,
    StreamingChunkDetails,
} from '@vertesia/common';
import { insertMessageInTimeline, isInProgress } from '../ModernAgentOutput/utils';

/** Streaming data for a single active stream, keyed by streaming/activity ID */
export interface StreamingData {
    text: string;
    workstreamId?: string;
    isComplete?: boolean;
    startTimestamp: number;
    activityId?: string;
}

export interface UseAgentStreamResult {
    messages: AgentMessage[];
    streamingMessages: Map<string, StreamingData>;
    isCompleted: boolean;
    /** Whether we are receiving chunks right now (for visual indicators) */
    debugChunkFlash: boolean;
    /** Add an optimistic message (for user input) */
    addOptimisticMessage: (msg: AgentMessage) => void;
    /** Remove optimistic messages matching a predicate */
    removeOptimisticMessages: (predicate: (msg: AgentMessage) => boolean) => void;
    /** Workflow status fetched from API (RUNNING, COMPLETED, FAILED, etc.) */
    workflowStatus: string | null;
    /** Server-side file processing status updates (from SYSTEM messages) */
    serverFileUpdates: Map<string, ConversationFile>;
}

/**
 * Hook that manages the SSE message stream for an agent conversation.
 *
 * Encapsulates:
 * - `client.store.workflows.streamMessages()` call and cleanup
 * - STREAMING_CHUNK accumulation with RAF-batched flushing
 * - Streaming→persisted message dedup (activity_id matching on THOUGHT/ANSWER arrival)
 * - COMPLETE/IDLE streaming flush
 * - Timestamp-based message dedup and optimistic QUESTION replacement
 * - `isCompleted` derived state
 * - State reset when `run.runId` changes
 *
 * File-processing SYSTEM messages are passed through to the messages array
 * (Option A from the plan) so downstream hooks can react to them.
 */
export function useAgentStream(
    client: VertesiaClient,
    run: AsyncExecutionResult,
): UseAgentStreamResult {
    const [messages, setMessages] = useState<AgentMessage[]>([]);
    const [isCompleted, setIsCompleted] = useState(false);
    const [workflowStatus, setWorkflowStatus] = useState<string | null>(null);

    // Server-side file processing status updates
    const [serverFileUpdates, setServerFileUpdates] = useState<Map<string, ConversationFile>>(new Map());

    // Streaming messages by streaming_id for real-time chunk aggregation
    const [streamingMessages, setStreamingMessages] = useState<Map<string, StreamingData>>(new Map());

    // RAF-batched streaming updates
    const pendingStreamingChunks = useRef<Map<string, StreamingData>>(new Map());
    const streamingFlushScheduled = useRef<number | null>(null);

    // Debug: visual flash indicator for incoming chunks
    const [debugChunkFlash, setDebugChunkFlash] = useState(false);
    const debugFlashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const flushStreamingChunks = useCallback(() => {
        if (pendingStreamingChunks.current.size > 0) {
            setStreamingMessages(new Map(pendingStreamingChunks.current));
            setDebugChunkFlash(true);
            if (debugFlashTimeout.current) clearTimeout(debugFlashTimeout.current);
            debugFlashTimeout.current = setTimeout(() => setDebugChunkFlash(false), 50);
        }
        streamingFlushScheduled.current = null;
    }, []);

    // Update isCompleted when messages change
    useEffect(() => {
        setIsCompleted(!isInProgress(messages));
    }, [messages]);

    // Stream messages from the agent
    useEffect(() => {
        // Reset all state when runId changes (new agent)
        setMessages([]);
        setWorkflowStatus(null);
        setStreamingMessages(new Map());
        setServerFileUpdates(new Map());

        // Check workflow status
        client.store.workflows.getRunDetails(run.runId, run.workflowId)
            .then((statusResult) => {
                setWorkflowStatus(statusResult.status as string);
            })
            .catch((error) => {
                console.error('Failed to check workflow status:', error);
            });

        client.store.workflows.streamMessages(run.workflowId, run.runId, (message) => {
            // Handle streaming chunks separately for real-time aggregation
            // PERFORMANCE: Batch updates using RAF instead of immediate state updates
            if (message.type === AgentMessageType.STREAMING_CHUNK) {
                const details = message.details as StreamingChunkDetails;
                const streamKey = details?.activity_id || details?.streaming_id;
                if (!streamKey) return;

                // Accumulate chunks in the ref (no state update yet)
                const current = pendingStreamingChunks.current.get(streamKey) || {
                    text: '',
                    workstreamId: message.workstream_id,
                    startTimestamp: Date.now(),
                    activityId: details?.activity_id,
                };
                const newText = current.text + (message.message || '');

                pendingStreamingChunks.current.set(streamKey, {
                    text: newText,
                    workstreamId: message.workstream_id,
                    isComplete: details.is_final,
                    startTimestamp: current.startTimestamp,
                    activityId: details?.activity_id,
                });

                // Schedule a flush if not already scheduled (~60 updates/sec max)
                if (streamingFlushScheduled.current === null) {
                    streamingFlushScheduled.current = requestAnimationFrame(flushStreamingChunks);
                }
                return;
            }

            // Handle file processing SYSTEM messages — update serverFileUpdates
            // for downstream useFileProcessing hook, don't add to messages array
            if (message.type === AgentMessageType.SYSTEM) {
                const details = message.details as FileProcessingDetails | undefined;
                if (details?.system_type === 'file_processing' && details.files) {
                    setServerFileUpdates(prev => {
                        const newMap = new Map(prev);
                        for (const file of details.files) {
                            newMap.set(file.id, file);
                        }
                        return newMap;
                    });
                    return;
                }
                // Other SYSTEM messages fall through to normal handling
            }

            // When THOUGHT or ANSWER arrives with activity_id, remove matching streaming message
            if (
                (message.type === AgentMessageType.THOUGHT || message.type === AgentMessageType.ANSWER) &&
                message.details?.activity_id
            ) {
                const activityId = message.details.activity_id as string;
                pendingStreamingChunks.current.delete(activityId);
                setStreamingMessages(prev => {
                    if (prev.has(activityId)) {
                        const next = new Map(prev);
                        next.delete(activityId);
                        return next;
                    }
                    return prev;
                });
            }

            // On COMPLETE or IDLE, flush any pending chunks
            if (message.type === AgentMessageType.COMPLETE || message.type === AgentMessageType.IDLE) {
                if (pendingStreamingChunks.current.size > 0) {
                    flushStreamingChunks();
                }
            }

            if (message.message) {
                setMessages((prev) => {
                    // Check for duplicate by timestamp
                    if (prev.find((m) => m.timestamp === message.timestamp)) {
                        return prev;
                    }

                    // For QUESTION messages from server, replace any optimistic version
                    if (message.type === AgentMessageType.QUESTION && !message.details?._optimistic) {
                        const withoutOptimistic = prev.filter(
                            (m) => !(m.type === AgentMessageType.QUESTION && m.details?._optimistic),
                        );
                        insertMessageInTimeline(withoutOptimistic, message);
                        return [...withoutOptimistic];
                    }

                    insertMessageInTimeline(prev, message);
                    return [...prev];
                });
            }
        });

        return () => {
            setMessages([]);
            if (streamingFlushScheduled.current !== null) {
                cancelAnimationFrame(streamingFlushScheduled.current);
                streamingFlushScheduled.current = null;
            }
            pendingStreamingChunks.current.clear();
        };
    }, [run.runId, client.store.workflows, flushStreamingChunks]);

    // Add an optimistic message to the timeline
    const addOptimisticMessage = useCallback((msg: AgentMessage) => {
        setMessages((prev) => {
            const newMessages = [...prev, msg];
            newMessages.sort((a, b) => {
                const timeA = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime();
                const timeB = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime();
                return timeA - timeB;
            });
            return newMessages;
        });
    }, []);

    // Remove optimistic messages matching a predicate
    const removeOptimisticMessages = useCallback((predicate: (msg: AgentMessage) => boolean) => {
        setMessages((prev) => prev.filter((m) => !predicate(m)));
    }, []);

    return {
        messages,
        streamingMessages,
        isCompleted,
        debugChunkFlash,
        addOptimisticMessage,
        removeOptimisticMessages,
        workflowStatus,
        serverFileUpdates,
    };
}
