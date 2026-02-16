import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentMessage } from '@vertesia/common';
import { AgentMessageType } from '@vertesia/common';
import type { VertesiaClient } from '@vertesia/client';

export interface StreamState {
    messages: AgentMessage[];
    isStreaming: boolean;
    error: string | null;
    isComplete: boolean;
}

/**
 * Hook that wraps client.workflows.streamMessages() as React state.
 * Batches messages to avoid excessive re-renders.
 */
export function useStreamMessages(
    client: VertesiaClient | null,
    workflowId: string | null,
    runId: string | null,
) {
    const [state, setState] = useState<StreamState>({
        messages: [],
        isStreaming: false,
        error: null,
        isComplete: false,
    });

    const bufferRef = useRef<AgentMessage[]>([]);
    const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const flush = useCallback(() => {
        if (bufferRef.current.length > 0) {
            const batch = bufferRef.current;
            bufferRef.current = [];
            setState(prev => ({
                ...prev,
                messages: [...prev.messages, ...batch],
            }));
        }
    }, []);

    useEffect(() => {
        if (!client || !workflowId || !runId) return;

        setState({ messages: [], isStreaming: true, error: null, isComplete: false });

        // Flush batched messages every 100ms
        flushTimerRef.current = setInterval(flush, 100);

        const onMessage = (message: AgentMessage) => {
            // Skip empty heartbeats
            if (!message || (!message.type && !message.message)) return;

            // Check for terminal message types
            if (message.type === AgentMessageType.COMPLETE ||
                message.type === AgentMessageType.ERROR ||
                message.type === AgentMessageType.TERMINATED) {
                bufferRef.current.push(message);
                flush();
                setState(prev => ({ ...prev, isComplete: true, isStreaming: false }));
                return;
            }

            // Batch STREAMING_CHUNK messages more aggressively
            bufferRef.current.push(message);

            // Force flush if buffer is large
            if (bufferRef.current.length >= 20) {
                flush();
            }
        };

        client.workflows.streamMessages(workflowId, runId, onMessage)
            .then(() => {
                flush();
                setState(prev => ({ ...prev, isStreaming: false }));
            })
            .catch(err => {
                flush();
                setState(prev => ({
                    ...prev,
                    isStreaming: false,
                    error: String(err),
                }));
            });

        return () => {
            if (flushTimerRef.current) {
                clearInterval(flushTimerRef.current);
            }
        };
    }, [client, workflowId, runId, flush]);

    return state;
}
