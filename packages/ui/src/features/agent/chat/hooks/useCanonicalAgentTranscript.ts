import type { VertesiaClient } from '@vertesia/client';
import type {
    ExperimentalAgentConversationSourceInitialized,
    ExperimentalAgentConversationTranscriptPage,
    ExperimentalAgentConversationTranscriptQuery,
} from '@vertesia/common';
import { parseExperimentalAgentConversationTranscriptPage } from '@vertesia/common/canonical-stream-runtime';
import { useCallback, useEffect, useRef, useState } from 'react';

export const CANONICAL_TRANSCRIPT_PAGE_LIMIT = 50;
export const CANONICAL_TRANSCRIPT_MAX_PAGES = 2;
export const CANONICAL_TRANSCRIPT_MAX_EMPTY_SCANS = 3;

export interface CanonicalAgentTranscriptState {
    /** Independently pinned forward history, populated only when the user browses earlier content. */
    pages: readonly ExperimentalAgentConversationTranscriptPage[];
    /** Fresh bounded tail at the latest validated descriptor head. */
    tail?: ExperimentalAgentConversationTranscriptPage;
    loading: boolean;
    tail_loading: boolean;
    error?: unknown;
    tail_error?: unknown;
    discarded: boolean;
}
const EMPTY: CanonicalAgentTranscriptState = { pages: [], loading: false, tail_loading: false, discarded: false };

/** Shared generated schema validation precedes exact route/head checks, including every nested turn block. */
export function validateCanonicalAgentTranscriptPage(
    input: unknown,
    descriptor: ExperimentalAgentConversationSourceInitialized,
    afterTurnId?: string,
): ExperimentalAgentConversationTranscriptPage {
    const page = parseExperimentalAgentConversationTranscriptPage(input);
    if (
        page.agent_run_id !== descriptor.agent_run_id ||
        page.scope !== descriptor.scope ||
        page.workstream_id !== descriptor.workstream_id ||
        page.snapshot.conversation_id !== descriptor.head.conversation_id ||
        page.snapshot.revision !== descriptor.head.revision ||
        page.fragment.source.conversation_id !== page.snapshot.conversation_id ||
        page.fragment.source.revision !== page.snapshot.revision ||
        page.fragment.turns.length > CANONICAL_TRANSCRIPT_PAGE_LIMIT ||
        (page.next_after_turn_id !== undefined && page.next_after_turn_id === afterTurnId) ||
        new Set(page.fragment.turns.map((turn) => turn.id)).size !== page.fragment.turns.length
    )
        throw new Error('Canonical transcript page does not match its exact pinned source');
    return page;
}

interface TranscriptSession {
    key: string;
    client: VertesiaClient;
    controller: AbortController;
    history_busy: boolean;
    history_descriptor?: ExperimentalAgentConversationSourceInitialized;
}

export function useCanonicalAgentTranscript(
    client: VertesiaClient,
    descriptor: ExperimentalAgentConversationSourceInitialized | undefined,
) {
    const key = descriptor
        ? JSON.stringify([
              descriptor.agent_run_id,
              descriptor.scope,
              descriptor.workstream_id,
              descriptor.head.conversation_id,
          ])
        : '';
    const descriptorRef = useRef(descriptor);
    descriptorRef.current = descriptor;
    const [stored, setStored] = useState<{ key: string; client: VertesiaClient; state: CanonicalAgentTranscriptState }>(
        {
            key: '',
            client,
            state: EMPTY,
        },
    );
    const stateRef = useRef(stored);
    stateRef.current = stored;
    const sessionRef = useRef<TranscriptSession | undefined>(undefined);

    useEffect(() => {
        if (!key) return;
        const session: TranscriptSession = { key, client, controller: new AbortController(), history_busy: false };
        sessionRef.current = session;
        setStored({ key, client, state: EMPTY });
        return () => {
            session.controller.abort();
            if (sessionRef.current === session) sessionRef.current = undefined;
        };
    }, [client, key]);

    // A head advance replaces only the latest window. Browsed history and its exact snapshot stay pinned.
    useEffect(() => {
        const session = sessionRef.current;
        if (!descriptor || !session || session.key !== key || session.client !== client) return;
        const controller = new AbortController();
        const current = () => sessionRef.current === session && !controller.signal.aborted;
        const change = (update: (state: CanonicalAgentTranscriptState) => CanonicalAgentTranscriptState) => {
            if (current())
                setStored((previous) => ({
                    key,
                    client,
                    state: update(previous.key === key && previous.client === client ? previous.state : EMPTY),
                }));
        };
        change((previous) => ({ ...previous, tail_loading: true, tail_error: undefined }));
        const load = async () => {
            try {
                const query: ExperimentalAgentConversationTranscriptQuery = {
                    window: 'tail',
                    conversation_scope: descriptor.scope,
                    ...(descriptor.workstream_id ? { workstream_id: descriptor.workstream_id } : {}),
                    snapshot_conversation_id: descriptor.head.conversation_id,
                    snapshot_revision: descriptor.head.revision,
                    limit: CANONICAL_TRANSCRIPT_PAGE_LIMIT,
                };
                const response = await client.agents.getConversationTranscript(descriptor.agent_run_id, query, {
                    signal: controller.signal,
                });
                if (!current()) return;
                const tail = validateCanonicalAgentTranscriptPage(response, descriptor);
                if (tail.next_after_turn_id !== undefined || tail.fragment.completeness.gap_after) {
                    throw new Error('Canonical tail did not end at its exact snapshot head');
                }
                change((previous) => ({ ...previous, tail, tail_loading: false, tail_error: undefined }));
            } catch (error: unknown) {
                change((previous) => ({ ...previous, tail_loading: false, tail_error: error }));
            }
        };
        void load();
        return () => controller.abort();
    }, [client, key, descriptor]);

    const loadNext = useCallback(async () => {
        const session = sessionRef.current;
        const currentDescriptor = descriptorRef.current;
        const storedState = stateRef.current;
        if (
            !session ||
            session.key !== key ||
            session.client !== client ||
            session.history_busy ||
            !currentDescriptor ||
            storedState.key !== key ||
            storedState.client !== client ||
            !storedState.state.tail
        )
            return;
        const previous = storedState.state;
        let cursor = previous.pages.at(-1)?.next_after_turn_id;
        if (previous.pages.length && cursor === undefined) return;
        // Pin first browsing request to the loaded tail, which may briefly precede the currently resolving head.
        session.history_descriptor ??= {
            ...currentDescriptor,
            head: {
                ...currentDescriptor.head,
                revision: previous.tail?.snapshot.revision ?? currentDescriptor.head.revision,
            },
        };
        const source = session.history_descriptor;
        const current = () => sessionRef.current === session && !session.controller.signal.aborted;
        const change = (update: (state: CanonicalAgentTranscriptState) => CanonicalAgentTranscriptState) => {
            if (current())
                setStored((value) => ({
                    key,
                    client,
                    state: update(value.key === key && value.client === client ? value.state : EMPTY),
                }));
        };
        const seenTurns = new Set(previous.pages.flatMap((page) => page.fragment.turns.map((turn) => turn.id)));
        const seenCursors = new Set(cursor ? [cursor] : []);
        session.history_busy = true;
        change((value) => ({ ...value, loading: true, error: undefined }));
        try {
            for (let scan = 0; scan < CANONICAL_TRANSCRIPT_MAX_EMPTY_SCANS; scan += 1) {
                const query: ExperimentalAgentConversationTranscriptQuery = {
                    window: 'start',
                    conversation_scope: source.scope,
                    ...(source.workstream_id ? { workstream_id: source.workstream_id } : {}),
                    snapshot_conversation_id: source.head.conversation_id,
                    snapshot_revision: source.head.revision,
                    ...(cursor ? { after_turn_id: cursor } : {}),
                    limit: CANONICAL_TRANSCRIPT_PAGE_LIMIT,
                };
                const response = await client.agents.getConversationTranscript(source.agent_run_id, query, {
                    signal: session.controller.signal,
                });
                if (!current()) return;
                const page = validateCanonicalAgentTranscriptPage(response, source, cursor);
                for (const turn of page.fragment.turns) {
                    if (seenTurns.has(turn.id))
                        throw new Error('Canonical transcript continuation repeated a retained turn');
                    seenTurns.add(turn.id);
                }
                if (page.next_after_turn_id && seenCursors.has(page.next_after_turn_id)) {
                    throw new Error('Canonical transcript continuation repeated a cursor');
                }
                if (page.next_after_turn_id) seenCursors.add(page.next_after_turn_id);
                change((value) => {
                    const pages = [...value.pages, page];
                    return {
                        ...value,
                        pages: pages.slice(-CANONICAL_TRANSCRIPT_MAX_PAGES),
                        loading: false,
                        discarded: value.discarded || pages.length > CANONICAL_TRANSCRIPT_MAX_PAGES,
                    };
                });
                if (page.fragment.turns.length || !page.next_after_turn_id) return;
                cursor = page.next_after_turn_id;
            }
        } catch (error: unknown) {
            change((value) => ({ ...value, loading: false, error }));
        } finally {
            session.history_busy = false;
        }
    }, [client, key]);
    return { ...(stored.key === key && stored.client === client ? stored.state : EMPTY), loadNext };
}
