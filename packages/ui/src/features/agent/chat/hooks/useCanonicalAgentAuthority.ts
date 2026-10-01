import type { VertesiaClient } from '@vertesia/client';
import type { ExperimentalAgentConversationSourceInitialized } from '@vertesia/common';
import { useEffect, useReducer, useRef } from 'react';
import {
    type CanonicalAgentConversationSourceSelection,
    canonicalAgentConversationAuthorityReducer,
    initialCanonicalAgentConversationAuthorityState,
} from '../canonicalAgentConversationAuthority.js';

export const CANONICAL_AGENT_SOURCE_PROBE_INTERVAL_MS = 2000;
export const CANONICAL_AGENT_SOURCE_MAX_PROBES = 12;

/** Probe independently from legacy semantic content. Each activity change starts a bounded refresh window. */
export function useCanonicalAgentAuthority(
    client: VertesiaClient,
    selection: CanonicalAgentConversationSourceSelection,
    activityVersion: number,
) {
    const [state, dispatch] = useReducer(
        canonicalAgentConversationAuthorityReducer,
        selection,
        initialCanonicalAgentConversationAuthorityState,
    );
    const selectionRef = useRef(selection);
    if (selectionRef.current.key !== selection.key) selectionRef.current = selection;
    const stableSelection = selectionRef.current;
    const requestId = useRef(0);
    const owner = useRef(client);
    const latches = useRef(new Map<string, ExperimentalAgentConversationSourceInitialized>());
    const sameClient = owner.current === client;
    if (sameClient && state.phase === 'canonical') latches.current.set(state.selection.key, state.descriptor);
    useEffect(() => {
        void activityVersion;
        const reset = owner.current !== client;
        if (reset) {
            owner.current = client;
            latches.current.clear();
        }
        dispatch({
            type: 'selection_changed',
            selection: stableSelection,
            reset,
            latched_descriptor: latches.current.get(stableSelection.key),
        });
        if (stableSelection.status !== 'selected') return;
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        let attempts = 0;
        const probe = async () => {
            const id = ++requestId.current;
            attempts += 1;
            dispatch({ type: 'probe_started', selection_key: stableSelection.key, request_id: id });
            try {
                const descriptor = await client.agents.getConversationSource(
                    stableSelection.agent_run_id,
                    {
                        conversation_scope: stableSelection.scope,
                        ...(stableSelection.workstream_id ? { workstream_id: stableSelection.workstream_id } : {}),
                    },
                    { signal: controller.signal },
                );
                if (!controller.signal.aborted) {
                    dispatch({
                        type: 'descriptor_received',
                        selection_key: stableSelection.key,
                        request_id: id,
                        descriptor,
                    });
                }
            } catch (error: unknown) {
                if (!controller.signal.aborted) {
                    dispatch({ type: 'probe_failed', selection_key: stableSelection.key, request_id: id, error });
                }
            }
            if (!controller.signal.aborted && attempts < CANONICAL_AGENT_SOURCE_MAX_PROBES) {
                timer = setTimeout(() => {
                    void probe();
                }, CANONICAL_AGENT_SOURCE_PROBE_INTERVAL_MS);
            }
        };
        void probe();
        return () => {
            controller.abort();
            if (timer !== undefined) clearTimeout(timer);
        };
        // The stableSelection key includes every exact route field; activity wakes a bounded retry window.
    }, [client, stableSelection, activityVersion]);
    if (sameClient && state.selection.key === selection.key) return state;
    const latched = sameClient ? latches.current.get(selection.key) : undefined;
    const initial = initialCanonicalAgentConversationAuthorityState(selection);
    return latched
        ? canonicalAgentConversationAuthorityReducer(initial, {
              type: 'selection_changed',
              selection,
              reset: true,
              latched_descriptor: latched,
          })
        : initial;
}
