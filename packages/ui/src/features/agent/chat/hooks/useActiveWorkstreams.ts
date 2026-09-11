import type { VertesiaClient } from '@vertesia/client';
import type { ActiveWorkstreamEntry, CompletedWorkstreamEntry } from '@vertesia/common';
import { useEffect, useRef, useState } from 'react';
import { debugAgentChat } from '../ModernAgentOutput/utils.js';

/** Default gap between `getActiveWorkstreams` polls, in milliseconds. */
export const ACTIVE_WORKSTREAMS_POLL_INTERVAL_MS = 10_000;

export interface UseActiveWorkstreamsResult {
    /** Workstreams the query reports as still running. Cleared while polling is off. */
    active: ActiveWorkstreamEntry[];
    /** Workstreams the query reports as settled. Retained after polling stops. */
    completed: CompletedWorkstreamEntry[];
    /**
     * True once the workflow can no longer answer the query — it reported itself
     * unavailable, or the request failed. Polling stops and does not resume until
     * `runId` changes; persisted messages become the only source of truth.
     */
    isUnavailable: boolean;
}

/**
 * Polls `client.agents.getActiveWorkstreams(runId)` as *live enrichment* on top of the
 * message stream, stopping once the run settles or the query goes away.
 *
 * Callers pass `enabled: false` for the conditions they own (history still loading, run
 * already completed or terminal); the hook adds its own unavailability latch. State
 * resets whenever `runId` changes.
 */
export function useActiveWorkstreams(
    client: VertesiaClient,
    runId: string,
    enabled: boolean,
    pollIntervalMs: number = ACTIVE_WORKSTREAMS_POLL_INTERVAL_MS,
): UseActiveWorkstreamsResult {
    const [active, setActive] = useState<ActiveWorkstreamEntry[]>([]);
    const [completed, setCompleted] = useState<CompletedWorkstreamEntry[]>([]);
    const [isUnavailable, setIsUnavailable] = useState(false);
    // Keeps a persistently failing query from flooding the console on every poll.
    const fetchFailedRef = useRef(false);

    useEffect(() => {
        void runId;
        fetchFailedRef.current = false;
        setIsUnavailable(false);
        setActive([]);
        setCompleted([]);
    }, [runId]);

    // Poll the backend query only as live enrichment. Persisted messages remain the
    // source of truth for the right-panel history once a workflow can no longer be queried.
    useEffect(() => {
        const shouldPoll = enabled && !isUnavailable;
        debugAgentChat('active workstreams poll state', { agentRunId: runId, shouldPoll, enabled, isUnavailable });
        if (!shouldPoll) {
            setActive((prev) => (prev.length === 0 ? prev : []));
            return;
        }

        let isCancelled = false;
        let isFetchInFlight = false;

        const fetchActiveWorkstreams = async () => {
            if (isFetchInFlight) {
                debugAgentChat('active workstreams fetch skipped while previous request is pending', {
                    agentRunId: runId,
                });
                return;
            }

            isFetchInFlight = true;
            try {
                debugAgentChat('active workstreams fetch start', { agentRunId: runId });
                const result = await client.agents.getActiveWorkstreams(runId);
                if (isCancelled) return;
                debugAgentChat('active workstreams fetch success', {
                    agentRunId: runId,
                    runningCount: result.running?.length ?? 0,
                    completedCount: result.completed?.length ?? 0,
                    unavailable: result.unavailable === true,
                });
                setActive(result.running ?? []);
                setCompleted(result.completed ?? []);
                if (result.unavailable) {
                    setIsUnavailable(true);
                    return;
                }
                fetchFailedRef.current = false;
            } catch (error) {
                if (isCancelled) return;
                setActive((prev) => (prev.length === 0 ? prev : []));
                setIsUnavailable(true);
                debugAgentChat('active workstreams fetch failed', {
                    agentRunId: runId,
                    error: error instanceof Error ? error.message : String(error),
                });
                if (!fetchFailedRef.current) {
                    console.warn('Failed to fetch active workstreams:', error);
                    fetchFailedRef.current = true;
                }
            } finally {
                isFetchInFlight = false;
            }
        };

        void fetchActiveWorkstreams();
        const pollHandle = window.setInterval(fetchActiveWorkstreams, pollIntervalMs);

        return () => {
            isCancelled = true;
            window.clearInterval(pollHandle);
        };
    }, [client.agents, runId, enabled, isUnavailable, pollIntervalMs]);

    return { active, completed, isUnavailable };
}
