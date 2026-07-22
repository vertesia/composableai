import type { VertesiaClient } from '@vertesia/client';
import type * as Common from '@vertesia/common';
import {
    type AgentMessage,
    AgentMessageType,
    type ConversationFile,
    type FileProcessingDetails,
} from '@vertesia/common';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    debugAgentChat,
    insertMessageInTimeline,
    isInProgress,
    isUserStoppedMessage,
} from '../ModernAgentOutput/utils';

/** Streaming data for a single active stream, keyed by streaming/activity ID */
export interface StreamingData {
    text: string;
    workstreamId?: string;
    isComplete?: boolean;
    startTimestamp: number;
    activityId?: string;
    streamingId?: string;
}

export interface UseAgentStreamResult {
    messages: AgentMessage[];
    streamingMessages: Map<string, StreamingData>;
    isCompleted: boolean;
    /** Initial history fetch state for deciding whether empty-run fallbacks are legitimate. */
    initialHistoryStatus: 'loading' | 'empty' | 'has_messages' | 'error';
    /** Whether we are receiving chunks right now (for visual indicators) */
    debugChunkFlash: boolean;
    /** Add an optimistic message (for user input) */
    addOptimisticMessage: (msg: AgentMessage) => void;
    /** Update optimistic delivery state for a client-generated message id */
    updateOptimisticMessageStatus: (
        messageId: string,
        status: NonNullable<Common.AgentMessageDetails['_deliveryStatus']>,
    ) => void;
    /** Remove optimistic messages matching a predicate */
    removeOptimisticMessages: (predicate: (msg: AgentMessage) => boolean) => void;
    /**
     * Re-open the SSE stream for the SAME agentRunId without clearing the existing
     * timeline. Used after restarting a completed workflow so newly produced messages
     * append seamlessly at the bottom instead of forcing a full reload.
     */
    reconnect: () => void;
    /** AgentRun status fetched from API (RUNNING, COMPLETED, FAILED, etc.) */
    agentRunStatus: string | null;
    /** Temporal workflow run ID (first_workflow_run_id from AgentRun) */
    workflowRunId: string | null;
    /** Server-side file processing status updates (from SYSTEM messages) */
    serverFileUpdates: Map<string, ConversationFile>;
}

function withDeliveryStatus(
    message: AgentMessage,
    status: NonNullable<Common.AgentMessageDetails['_deliveryStatus']>,
): AgentMessage {
    return {
        ...message,
        details: {
            ...(message.details ?? {}),
            _deliveryStatus: status,
        },
    };
}

function getClientMessageId(message: AgentMessage): string | undefined {
    const details = message.details;
    const messageId = details?._messageId;
    if (typeof messageId === 'string' && messageId) return messageId;

    const ack = details?.ack;
    return typeof ack === 'string' && ack ? ack : undefined;
}

function getStringDetail(details: Common.AgentMessageDetails | undefined, key: string): string | undefined {
    const value = details?.[key];
    return typeof value === 'string' && value ? value : undefined;
}

function isWorkflowRunScopedStreamingId(details: Common.AgentMessageDetails | undefined): boolean {
    return details?.streaming_id_scope === 'workflow_run';
}

function isTimelineStateMessage(message: AgentMessage): boolean {
    return [
        AgentMessageType.COMPLETE,
        AgentMessageType.IDLE,
        AgentMessageType.TERMINATED,
        AgentMessageType.REQUEST_INPUT,
    ].includes(message.type);
}

function shouldStoreTimelineMessage(message: AgentMessage): boolean {
    if (message.type === AgentMessageType.STREAMING_CHUNK) return false;

    // Structured resource events must survive replay even if a producer accidentally
    // omits the human-readable display message.
    if (message.type === AgentMessageType.UPDATE && typeof message.details?.event_class === 'string') return true;

    if (message.type === AgentMessageType.SYSTEM) {
        const details = message.details as FileProcessingDetails | undefined;
        if (details?.system_type === 'file_processing' && details.files) return false;
    }

    return Boolean(message.message) || isTimelineStateMessage(message);
}

function summarizeMessage(message: AgentMessage | undefined): Record<string, unknown> | undefined {
    if (!message) return undefined;
    return {
        type: message.type,
        timestamp: message.timestamp,
        workstream_id: message.workstream_id,
        text:
            typeof message.message === 'string' ? message.message.slice(0, 80) : message.message ? '[non-string]' : '',
        display_role: message.details?.display_role,
        source: message.details?.source,
    };
}

function insertTimelineMessage(prev: AgentMessage[], message: AgentMessage): AgentMessage[] {
    if (prev.find((m) => m.timestamp === message.timestamp)) {
        return prev;
    }

    // For acked server messages, replace the matching optimistic version.
    if (
        !message.details?._optimistic &&
        (message.type === AgentMessageType.QUESTION || isUserStoppedMessage(message))
    ) {
        const ack = typeof message.details?.ack === 'string' ? message.details.ack : undefined;
        const consumedMessage = ack ? withDeliveryStatus(message, 'consumed') : message;

        if (ack) {
            const next = prev.filter(
                (m) =>
                    !(
                        (m.type === message.type || isUserStoppedMessage(m)) &&
                        m.details?._optimistic &&
                        getClientMessageId(m) === ack
                    ),
            );
            insertMessageInTimeline(next, consumedMessage);
            return next;
        }

        if (message.type === AgentMessageType.QUESTION) {
            // Legacy fallback for older workflow echoes that predate `details.ack`.
            const matchingOptimistic = prev.filter(
                (m) =>
                    m.type === AgentMessageType.QUESTION &&
                    m.details?._optimistic &&
                    m.message === message.message &&
                    (m.workstream_id ?? 'main') === (message.workstream_id ?? 'main'),
            );
            if (matchingOptimistic.length === 1) {
                const next = prev.filter((m) => m !== matchingOptimistic[0]);
                insertMessageInTimeline(next, message);
                return next;
            }
        }
    }

    const next = [...prev];
    insertMessageInTimeline(next, message);
    return next;
}

function getStreamingChunkKey(message: AgentMessage): string | undefined {
    const details = message.details;
    const streamingId = getStringDetail(details, 'streaming_id');
    const activityId = getStringDetail(details, 'activity_id');

    if (streamingId && isWorkflowRunScopedStreamingId(details)) return streamingId;

    // Backward compatibility: older compact chunks used workstream_id as
    // streaming_id, so activity_id is the more specific key when present.
    return activityId ?? streamingId;
}

function getStreamingReplacementKeys(message: AgentMessage): string[] {
    const details = message.details;
    const streamingId = getStringDetail(details, 'streaming_id');
    const activityId = getStringDetail(details, 'activity_id');
    const keys: string[] = [];

    if (streamingId && isWorkflowRunScopedStreamingId(details)) {
        keys.push(streamingId);
    }
    if (activityId) {
        keys.push(activityId);
    }

    return [...new Set(keys)];
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
 * - State reset when `agentRunId` changes
 *
 * File-processing SYSTEM messages are passed through to the messages array
 * (Option A from the plan) so downstream hooks can react to them.
 */
export function useAgentStream(
    client: VertesiaClient,
    agentRunId: string,
    onMessage?: (message: AgentMessage) => void,
): UseAgentStreamResult {
    const [messages, setMessages] = useState<AgentMessage[]>([]);
    const [isCompleted, setIsCompleted] = useState(false);
    const [initialHistoryStatus, setInitialHistoryStatus] =
        useState<UseAgentStreamResult['initialHistoryStatus']>('loading');
    const [agentRunStatus, setAgentRunStatus] = useState<string | null>(null);
    const [workflowRunId, setWorkflowRunId] = useState<string | null>(null);
    const onMessageRef = useRef(onMessage);
    onMessageRef.current = onMessage;

    // Server-side file processing status updates
    const [serverFileUpdates, setServerFileUpdates] = useState<Map<string, ConversationFile>>(new Map());

    // Bumped to re-open the stream in place (same agentRunId) without resetting the timeline.
    const [streamNonce, setStreamNonce] = useState(0);
    const reconnect = useCallback(() => setStreamNonce((n) => n + 1), []);

    // Tracks the last agentRunId the stream effect ran for, so a reconnect (nonce bump)
    // can be distinguished from switching to a different conversation.
    const prevAgentRunIdRef = useRef<string | null>(null);

    // Highest message timestamp delivered so far. On a same-run reconnect this is passed
    // as the `since` cursor so the history replay excludes the previous run's terminal
    // (COMPLETE/TERMINATED) message — otherwise streamMessages would treat that stale
    // event as stream-ending and close before the restarted run's reply arrives.
    const lastDeliveredTsRef = useRef(0);

    // Streaming messages by streaming_id for real-time chunk aggregation
    const [streamingMessages, setStreamingMessages] = useState<Map<string, StreamingData>>(new Map());

    // RAF-batched streaming updates
    const pendingStreamingChunks = useRef<Map<string, StreamingData>>(new Map());
    const streamingFlushScheduled = useRef<{ mode: 'raf' | 'timeout'; id: number } | null>(null);

    // Debug: visual flash indicator for incoming chunks
    const [debugChunkFlash, setDebugChunkFlash] = useState(false);
    const debugFlashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const cancelScheduledStreamingFlush = useCallback(() => {
        const scheduled = streamingFlushScheduled.current;
        if (!scheduled) return;

        if (scheduled.mode === 'raf') {
            cancelAnimationFrame(scheduled.id);
        } else {
            clearTimeout(scheduled.id);
        }
        streamingFlushScheduled.current = null;
    }, []);

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

    useEffect(() => {
        debugAgentChat('stream state', {
            agentRunId,
            messageCount: messages.length,
            streamingCount: streamingMessages.size,
            initialHistoryStatus,
            isCompleted,
            lastDeliveredTs: lastDeliveredTsRef.current,
            first: summarizeMessage(messages[0]),
            last: summarizeMessage(messages[messages.length - 1]),
        });
    }, [agentRunId, initialHistoryStatus, isCompleted, messages, streamingMessages.size]);

    // Stream messages from the agent
    useEffect(() => {
        // A nonce bump reconnects the current conversation without clearing the timeline.
        void streamNonce;

        // Only reset state when switching to a different conversation. A reconnect
        // (nonce bump for the same agentRunId) keeps the existing timeline so newly
        // streamed messages append in place — re-delivered history is de-duped by
        // timestamp below.
        const isNewConversation = prevAgentRunIdRef.current !== agentRunId;
        prevAgentRunIdRef.current = agentRunId;

        if (isNewConversation) {
            setMessages([]);
            setInitialHistoryStatus('loading');
            setAgentRunStatus(null);
            setWorkflowRunId(null);
            setStreamingMessages(new Map());
            setServerFileUpdates(new Map());
            lastDeliveredTsRef.current = 0;
        }
        const abortController = new AbortController();

        // Resume from the last delivered message on a reconnect; fetch full history for a
        // new conversation. The cursor is exclusive server-side (ts > since), so the prior
        // run's terminal message is skipped on reconnect.
        const since = isNewConversation ? undefined : lastDeliveredTsRef.current || undefined;
        debugAgentChat('stream start', {
            agentRunId,
            isNewConversation,
            since,
            streamNonce,
        });

        // Check agent run status
        client.agents
            .getInternals(agentRunId)
            .then((agentRun) => {
                if (!abortController.signal.aborted) {
                    debugAgentChat('internals loaded', {
                        agentRunId,
                        status: agentRun.status,
                        first_workflow_run_id: agentRun.first_workflow_run_id,
                    });
                    setAgentRunStatus(agentRun.status?.toUpperCase() ?? null);
                    setWorkflowRunId(agentRun.first_workflow_run_id ?? null);
                }
            })
            .catch((error) => {
                if (!abortController.signal.aborted) {
                    console.error('Failed to check agent run status:', error);
                }
            });

        client.agents
            .streamMessages(
                agentRunId,
                (message) => {
                    if (abortController.signal.aborted) return;
                    // Completed and idle runs replay their archived history through the live
                    // stream. Only forward genuinely new deliveries so onMessage consumers
                    // never treat replayed events as fresh ones.
                    if (!message.timestamp || message.timestamp > lastDeliveredTsRef.current) {
                        onMessageRef.current?.(message);
                    }

                    debugAgentChat('stream message', {
                        agentRunId,
                        type: message.type,
                        timestamp: message.timestamp,
                        workstream_id: message.workstream_id,
                        hasMessage: Boolean(message.message),
                        display_role: message.details?.display_role,
                        source: message.details?.source,
                    });

                    // Advance the reconnect cursor past every delivered message.
                    if (message.timestamp && message.timestamp > lastDeliveredTsRef.current) {
                        lastDeliveredTsRef.current = message.timestamp;
                    }

                    // Handle streaming chunks separately for real-time aggregation
                    // PERFORMANCE: Batch updates using RAF instead of immediate state updates
                    if (message.type === AgentMessageType.STREAMING_CHUNK) {
                        const details = message.details as Common.StreamingChunkDetails;
                        const streamKey = getStreamingChunkKey(message);
                        if (!streamKey) return;

                        // Accumulate chunks in the ref (no state update yet)
                        const current = pendingStreamingChunks.current.get(streamKey) || {
                            text: '',
                            workstreamId: message.workstream_id,
                            startTimestamp: Date.now(),
                            activityId: details?.activity_id,
                            streamingId: details?.streaming_id,
                        };
                        const newText = current.text + (message.message || '');

                        pendingStreamingChunks.current.set(streamKey, {
                            text: newText,
                            workstreamId: message.workstream_id,
                            isComplete: details.is_final,
                            startTimestamp: current.startTimestamp,
                            activityId: details?.activity_id,
                            streamingId: details?.streaming_id,
                        });

                        // Schedule a flush if not already scheduled (~60 updates/sec max)
                        if (streamingFlushScheduled.current === null) {
                            if (document.hidden) {
                                streamingFlushScheduled.current = {
                                    mode: 'timeout',
                                    id: window.setTimeout(flushStreamingChunks, 16),
                                };
                            } else {
                                streamingFlushScheduled.current = {
                                    mode: 'raf',
                                    id: requestAnimationFrame(flushStreamingChunks),
                                };
                            }
                        }
                        return;
                    }

                    // Handle file processing SYSTEM messages — update serverFileUpdates
                    // for downstream useFileProcessing hook, don't add to messages array
                    if (message.type === AgentMessageType.SYSTEM) {
                        const details = message.details as FileProcessingDetails | undefined;
                        if (details?.system_type === 'file_processing' && details.files) {
                            setServerFileUpdates(new Map(details.files.map((file) => [file.id, file])));
                            return;
                        }
                        // Other SYSTEM messages fall through to normal handling
                    }

                    // When THOUGHT or ANSWER arrives, remove matching live streaming content.
                    if (message.type === AgentMessageType.THOUGHT || message.type === AgentMessageType.ANSWER) {
                        const replacementKeys = getStreamingReplacementKeys(message);
                        if (replacementKeys.length > 0) {
                            for (const key of replacementKeys) {
                                pendingStreamingChunks.current.delete(key);
                            }
                            setStreamingMessages((prev) => {
                                const next = new Map(prev);
                                let changed = false;
                                for (const key of replacementKeys) {
                                    changed = next.delete(key) || changed;
                                }
                                return changed ? next : prev;
                            });
                        }
                    }

                    // On COMPLETE or IDLE, flush any pending chunks
                    if (message.type === AgentMessageType.COMPLETE || message.type === AgentMessageType.IDLE) {
                        if (pendingStreamingChunks.current.size > 0) {
                            flushStreamingChunks();
                        }
                    }

                    if (shouldStoreTimelineMessage(message)) {
                        setMessages((prev) => insertTimelineMessage(prev, message));
                    }
                },
                since,
                abortController.signal,
                {
                    onHistoryLoaded: (historical) => {
                        if (abortController.signal.aborted) return;
                        const timelineMessages = historical.filter(shouldStoreTimelineMessage);
                        // Advance the watermark synchronously before React processes the
                        // history state update. Some completed streams replay history via
                        // the live callback immediately after onHistoryLoaded returns.
                        for (const message of historical) {
                            if (message.timestamp && message.timestamp > lastDeliveredTsRef.current) {
                                lastDeliveredTsRef.current = message.timestamp;
                            }
                        }
                        debugAgentChat('history loaded', {
                            agentRunId,
                            count: historical.length,
                            timelineCount: timelineMessages.length,
                            since,
                            first: summarizeMessage(historical[0]),
                            last: summarizeMessage(historical[historical.length - 1]),
                        });
                        setInitialHistoryStatus(historical.length > 0 ? 'has_messages' : 'empty');
                        if (timelineMessages.length > 0) {
                            setMessages((prev) =>
                                timelineMessages.reduce((next, message) => insertTimelineMessage(next, message), prev),
                            );
                        }
                    },
                    onHistoryError: (error) => {
                        if (abortController.signal.aborted) return;
                        debugAgentChat('history error', {
                            agentRunId,
                            error: error instanceof Error ? error.message : String(error),
                        });
                        setInitialHistoryStatus('error');
                    },
                },
            )
            .then(() => {
                // The stream resolves when the run reaches a terminal state. The status was
                // fetched once at effect start and may still read RUNNING, so re-fetch the
                // authoritative status now — otherwise a run that FAILS while the panel is
                // open never surfaces the failed UI until the conversation is remounted.
                if (abortController.signal.aborted) return undefined;
                debugAgentChat('stream resolved', { agentRunId });
                return client.agents
                    .getInternals(agentRunId)
                    .then((agentRun) => {
                        if (!abortController.signal.aborted) {
                            debugAgentChat('internals refreshed after stream end', {
                                agentRunId,
                                status: agentRun.status,
                            });
                            setAgentRunStatus(agentRun.status?.toUpperCase() ?? null);
                        }
                    })
                    .catch((error) => {
                        if (!abortController.signal.aborted) {
                            console.error('Failed to refresh agent run status on stream end:', error);
                        }
                    });
            })
            .catch((error) => {
                if (!abortController.signal.aborted) {
                    debugAgentChat('stream failed', {
                        agentRunId,
                        error: error instanceof Error ? error.message : String(error),
                    });
                    console.error('Failed to stream agent messages:', error);
                }
            });

        return () => {
            debugAgentChat('stream cleanup', { agentRunId, streamNonce });
            abortController.abort();
            // Note: messages are intentionally NOT cleared here. Switching conversations
            // resets them at effect start (isNewConversation); a reconnect must preserve
            // the timeline so the UI doesn't flash/reload.
            cancelScheduledStreamingFlush();
            pendingStreamingChunks.current.clear();
            if (debugFlashTimeout.current) {
                clearTimeout(debugFlashTimeout.current);
                debugFlashTimeout.current = null;
            }
        };
    }, [agentRunId, streamNonce, client.agents, flushStreamingChunks, cancelScheduledStreamingFlush]);

    // Flush pending streaming chunks when tab becomes visible.
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden && pendingStreamingChunks.current.size > 0) {
                cancelScheduledStreamingFlush();
                flushStreamingChunks();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [flushStreamingChunks, cancelScheduledStreamingFlush]);

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

    const updateOptimisticMessageStatus = useCallback(
        (messageId: string, status: NonNullable<Common.AgentMessageDetails['_deliveryStatus']>) => {
            setMessages((prev) =>
                prev.map((message) => {
                    if (message.details?._optimistic && getClientMessageId(message) === messageId) {
                        return withDeliveryStatus(message, status);
                    }
                    return message;
                }),
            );
        },
        [],
    );

    // Remove optimistic messages matching a predicate
    const removeOptimisticMessages = useCallback((predicate: (msg: AgentMessage) => boolean) => {
        setMessages((prev) => prev.filter((m) => !predicate(m)));
    }, []);

    return {
        messages,
        streamingMessages,
        isCompleted,
        initialHistoryStatus,
        debugChunkFlash,
        addOptimisticMessage,
        updateOptimisticMessageStatus,
        removeOptimisticMessages,
        reconnect,
        agentRunStatus,
        workflowRunId,
        serverFileUpdates,
    };
}
