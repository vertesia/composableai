import type { AgentConversationStreamUpdate, CanonicalInteractionOutput } from '@vertesia/client';
import type {
    ConversationRef,
    ExperimentalAgentConversationAcceptedOutput,
    ExperimentalAgentConversationAcceptedOutputHistoryPage,
} from '@vertesia/common';

export const CANONICAL_AGENT_HISTORY_PAGE_LIMIT = 50;
export const CANONICAL_AGENT_HISTORY_MAX_OUTPUTS = 100;
export const CANONICAL_AGENT_HISTORY_MAX_EMPTY_PAGES_PER_REQUEST = 3;
export const CANONICAL_AGENT_HISTORY_MAX_EXACT_FETCHES = 4;

export type CanonicalAgentDraftSnapshot = NonNullable<
    Extract<AgentConversationStreamUpdate, { type: 'conversation_event' }>['draft_snapshot']
>;
export type CanonicalAcceptedAgentOutput = Omit<
    Extract<AgentConversationStreamUpdate, { type: 'accepted_output' }>,
    'draft_snapshot'
> & { draft_snapshot: CanonicalAgentDraftSnapshot };
export type CanonicalAgentPreviewGapReason = Extract<
    AgentConversationStreamUpdate,
    { type: 'preview_unavailable' }
>['reason'];

export interface CanonicalAgentHistoryWindow {
    status: 'idle' | 'loading' | 'ready' | 'error';
    snapshot?: ConversationRef;
    outputs: readonly CanonicalAcceptedAgentOutput[];
    next_after_revision?: number;
    /** Earlier accepted outputs were discarded to enforce the local window bound. */
    gap_before_window: boolean;
    /** The pinned snapshot has more accepted-output candidates after the loaded window. */
    gap_after_window: boolean;
    /** A bounded user-requested empty-page scan stopped while a cursor still remained. */
    empty_page_scan_exhausted: boolean;
    error?: unknown;
}

export interface CanonicalAgentLiveContent {
    status: 'idle' | 'connecting' | 'ready' | 'error';
    draft_snapshot: CanonicalAgentDraftSnapshot;
    draft_turn_id?: string;
    accepted_outputs: readonly CanonicalAcceptedAgentOutput[];
    /** Earlier live accepted outputs were discarded to enforce the local window bound. */
    accepted_gap_before: boolean;
    /** A live preview prefix was unavailable. This is independent from retained-history window gaps. */
    reconnect_gap?: CanonicalAgentPreviewGapReason;
    error?: unknown;
}

export interface CanonicalAgentContentState {
    history: CanonicalAgentHistoryWindow;
    live: CanonicalAgentLiveContent;
}

const EMPTY_DRAFT_SNAPSHOT: CanonicalAgentDraftSnapshot = Object.freeze([]);

export function initialCanonicalAgentContentState(): CanonicalAgentContentState {
    return {
        history: {
            status: 'idle',
            outputs: Object.freeze([]),
            gap_before_window: false,
            gap_after_window: false,
            empty_page_scan_exhausted: false,
        },
        live: {
            status: 'idle',
            draft_snapshot: EMPTY_DRAFT_SNAPSHOT,
            accepted_outputs: Object.freeze([]),
            accepted_gap_before: false,
        },
    };
}

export function exactCanonicalAcceptedOutput(
    envelope: ExperimentalAgentConversationAcceptedOutput,
    output: CanonicalInteractionOutput<unknown>,
    draftSnapshot: CanonicalAgentDraftSnapshot = EMPTY_DRAFT_SNAPSHOT,
): CanonicalAcceptedAgentOutput {
    if (
        envelope.source.conversation_id !== envelope.receipt.conversation_id ||
        envelope.source.revision !== envelope.receipt.result_revision ||
        !output.matchesReceipt(envelope.receipt)
    ) {
        throw new Error('Canonical accepted output does not match its exact reference envelope');
    }
    return { type: 'accepted_output', envelope, output, draft_snapshot: draftSnapshot };
}

function sameSnapshot(first: ConversationRef | undefined, second: ConversationRef): boolean {
    return (
        first === undefined || (first.conversation_id === second.conversation_id && first.revision === second.revision)
    );
}

function receiptKey(output: CanonicalAcceptedAgentOutput): string {
    const receipt = output.envelope.receipt;
    return `${receipt.conversation_id}:${receipt.result_revision}:${receipt.id}`;
}

function matchesAcceptedReceipt(first: CanonicalAcceptedAgentOutput, second: CanonicalAcceptedAgentOutput): boolean {
    return first.output.matchesReceipt(second.envelope.receipt);
}

function acceptedConversationId(output: CanonicalAcceptedAgentOutput): string {
    return output.envelope.receipt.conversation_id;
}

function boundAcceptedWindows(
    history: readonly CanonicalAcceptedAgentOutput[],
    live: readonly CanonicalAcceptedAgentOutput[],
): {
    history: readonly CanonicalAcceptedAgentOutput[];
    live: readonly CanonicalAcceptedAgentOutput[];
    historyOverflow: boolean;
    liveOverflow: boolean;
} {
    let historyOverflow = false;
    let liveOverflow = false;
    let boundedHistory = history;
    let boundedLive = live;
    const overflow = Math.max(0, history.length + live.length - CANONICAL_AGENT_HISTORY_MAX_OUTPUTS);
    if (overflow > 0) {
        const historyDrop = Math.min(overflow, history.length);
        historyOverflow = historyDrop > 0;
        boundedHistory = history.slice(historyDrop);
        const liveDrop = overflow - historyDrop;
        if (liveDrop > 0) {
            liveOverflow = true;
            boundedLive = live.slice(liveDrop);
        }
    }
    return {
        history: Object.freeze([...boundedHistory]),
        live: Object.freeze([...boundedLive]),
        historyOverflow,
        liveOverflow,
    };
}

export type CanonicalAgentContentAction =
    | { type: 'reset' }
    | { type: 'history_loading' }
    | {
          type: 'history_page';
          page: ExperimentalAgentConversationAcceptedOutputHistoryPage;
          outputs: readonly CanonicalAcceptedAgentOutput[];
          empty_page_scan_exhausted: boolean;
      }
    | { type: 'history_error'; error: unknown }
    | { type: 'stream_connecting' }
    | { type: 'stream_update'; update: AgentConversationStreamUpdate }
    | { type: 'stream_error'; error: unknown };

export function canonicalAgentContentReducer(
    state: CanonicalAgentContentState,
    action: CanonicalAgentContentAction,
): CanonicalAgentContentState {
    if (action.type === 'reset') return initialCanonicalAgentContentState();
    if (action.type === 'history_loading') {
        return { ...state, history: { ...state.history, status: 'loading', error: undefined } };
    }
    if (action.type === 'history_error') {
        return { ...state, history: { ...state.history, status: 'error', error: action.error } };
    }
    if (action.type === 'history_page') {
        let validationError: Error | undefined;
        if (!sameSnapshot(state.history.snapshot, action.page.snapshot)) {
            validationError = new Error('Canonical accepted-output history changed its pinned snapshot');
        } else if (
            state.live.accepted_outputs.some(
                (output) => acceptedConversationId(output) !== action.page.snapshot.conversation_id,
            )
        ) {
            validationError = new Error('Canonical accepted-output history changed the live conversation identity');
        } else if (action.outputs.length !== action.page.items.length) {
            validationError = new Error(
                'Canonical accepted-output history exact output count does not match its references',
            );
        } else {
            for (let index = 0; index < action.outputs.length; index += 1) {
                const output = action.outputs[index];
                const item = action.page.items[index];
                if (!output || !item || !output.output.matchesReceipt(item.receipt)) {
                    validationError = new Error(
                        'Canonical accepted-output history exact output order does not match its references',
                    );
                    break;
                }
            }
        }
        if (validationError) {
            return { ...state, history: { ...state.history, status: 'error', error: validationError } };
        }

        const known = new Set(state.history.outputs.map(receiptKey));
        const appended = action.outputs.filter((output) => {
            const key = receiptKey(output);
            if (known.has(key)) return false;
            known.add(key);
            return true;
        });
        const combined = [...state.history.outputs, ...appended];
        const acceptedOutputs = state.live.accepted_outputs.filter(
            (liveOutput) => !combined.some((historyOutput) => matchesAcceptedReceipt(liveOutput, historyOutput)),
        );
        const bounded = boundAcceptedWindows(combined, acceptedOutputs);
        return {
            ...state,
            history: {
                status: 'ready',
                snapshot: action.page.snapshot,
                outputs: bounded.history,
                next_after_revision: action.page.next_after_revision,
                gap_before_window: state.history.gap_before_window || bounded.historyOverflow,
                gap_after_window: action.page.next_after_revision !== undefined,
                empty_page_scan_exhausted: action.empty_page_scan_exhausted,
                error: undefined,
            },
            live: {
                ...state.live,
                accepted_outputs: bounded.live,
                accepted_gap_before: state.live.accepted_gap_before || bounded.liveOverflow,
            },
        };
    }
    if (action.type === 'stream_connecting') {
        return { ...state, live: { ...state.live, status: 'connecting', error: undefined } };
    }
    if (action.type === 'stream_error') {
        return { ...state, live: { ...state.live, status: 'error', error: action.error } };
    }

    const update = action.update;
    if (update.type === 'preview_unavailable') {
        return {
            ...state,
            live: {
                ...state.live,
                status: 'ready',
                draft_snapshot: update.draft_snapshot ?? EMPTY_DRAFT_SNAPSHOT,
                reconnect_gap: update.reason,
                error: undefined,
            },
        };
    }
    if (update.type === 'conversation_event') {
        return {
            ...state,
            live: {
                ...state.live,
                status: 'ready',
                draft_snapshot: update.draft_snapshot ?? EMPTY_DRAFT_SNAPSHOT,
                draft_turn_id: update.event.draft_turn_id,
                reconnect_gap: update.event.type === 'stream_terminated' ? state.live.reconnect_gap : undefined,
                error: undefined,
            },
        };
    }
    let accepted: CanonicalAcceptedAgentOutput;
    try {
        accepted = exactCanonicalAcceptedOutput(update.envelope, update.output, update.draft_snapshot);
    } catch (error) {
        return { ...state, live: { ...state.live, status: 'error', error } };
    }
    const conversationId =
        state.history.snapshot?.conversation_id ?? state.live.accepted_outputs[0]?.envelope.source.conversation_id;
    if (conversationId !== undefined && acceptedConversationId(accepted) !== conversationId) {
        return {
            ...state,
            live: {
                ...state.live,
                status: 'error',
                error: new Error('Canonical live accepted output changed conversation identity'),
            },
        };
    }
    const alreadyRetained = [...state.history.outputs, ...state.live.accepted_outputs].some((output) =>
        matchesAcceptedReceipt(accepted, output),
    );
    const combined = alreadyRetained ? state.live.accepted_outputs : [...state.live.accepted_outputs, accepted];
    const ordered = [...combined].sort(
        (first, second) => first.envelope.receipt.result_revision - second.envelope.receipt.result_revision,
    );
    const bounded = boundAcceptedWindows(state.history.outputs, ordered);
    return {
        ...state,
        history: {
            ...state.history,
            outputs: bounded.history,
            gap_before_window: state.history.gap_before_window || bounded.historyOverflow,
        },
        live: {
            ...state.live,
            status: 'ready',
            draft_snapshot: accepted.draft_snapshot,
            draft_turn_id: undefined,
            accepted_outputs: bounded.live,
            accepted_gap_before: state.live.accepted_gap_before || bounded.liveOverflow,
            error: undefined,
        },
    };
}
