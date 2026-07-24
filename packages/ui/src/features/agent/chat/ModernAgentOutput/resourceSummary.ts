import {
    type AgentMessage,
    AgentMessageType,
    type AgentResourceReference,
    getResourcesFromMessage,
} from '@vertesia/common';
import { getWorkstreamId, isInProgress } from './utils';

interface ResourceAccumulator {
    ref: AgentResourceReference;
    /** The first action observed for this resource in the turn — indicates whether it pre-existed. */
    firstAction: AgentResourceReference['action'];
    /** The most recent action observed, in message order. */
    lastAction: AgentResourceReference['action'];
    /** True once a `created` action was seen for this resource within the turn. */
    createdInTurn: boolean;
}

/**
 * Dedupe the resources referenced across a set of messages by (type, id), modeling operations
 * sequentially (in message order):
 * - first created then finally deleted (create → … → delete) → transient scratch work that never
 *   existed before the turn, omitted;
 * - a resource that pre-existed (first action was delete/update) and ends deleted → kept as `deleted`
 *   (e.g. delete → create → delete reports `deleted`, not transient);
 * - any sequence ending in create, or containing a create when not ending deleted → kept as `created`;
 * - otherwise `updated`.
 * The most recently seen label/revision is retained, and first-mention order is preserved.
 */
function dedupeResources(messages: AgentMessage[]): AgentResourceReference[] {
    const order: string[] = [];
    const byKey = new Map<string, ResourceAccumulator>();

    for (const message of messages) {
        for (const ref of getResourcesFromMessage(message)) {
            const key = `${ref.type}:${ref.id}`;
            let entry = byKey.get(key);
            if (!entry) {
                entry = { ref, firstAction: ref.action, lastAction: ref.action, createdInTurn: false };
                byKey.set(key, entry);
                order.push(key);
            }
            entry.ref = ref;
            entry.lastAction = ref.action;
            if (ref.action === 'created') entry.createdInTurn = true;
        }
    }

    const result: AgentResourceReference[] = [];
    for (const key of order) {
        const entry = byKey.get(key);
        if (!entry) continue;
        // Created first and ultimately deleted → never existed before the turn, transient: omit.
        if (entry.firstAction === 'created' && entry.lastAction === 'deleted') continue;
        const action: AgentResourceReference['action'] =
            entry.lastAction === 'deleted'
                ? 'deleted'
                : entry.lastAction === 'created' || entry.createdInTurn
                  ? 'created'
                  : 'updated';
        result.push({ ...entry.ref, action });
    }
    return result;
}

/**
 * Split the conversation into turns at user QUESTION boundaries and return the deduped resources for
 * each turn, in order. A turn spans from one user message up to (but excluding) the next. Turns with
 * no resources still produce an entry (empty list) so callers can align positions with turn indices.
 */
export function segmentTurnResources(messages: AgentMessage[]): AgentResourceReference[][] {
    if (messages.length === 0) return [];
    const turns: AgentMessage[][] = [];
    let current: AgentMessage[] = [];
    let currentHasQuestion = false;
    for (const message of messages) {
        // Start a new turn at each user QUESTION, but fold any leading non-question messages (e.g. an
        // initial system prompt) into the first turn so turn indices align with QUESTION order.
        if (message.type === AgentMessageType.QUESTION && currentHasQuestion) {
            turns.push(current);
            current = [];
            currentHasQuestion = false;
        }
        if (message.type === AgentMessageType.QUESTION) currentHasQuestion = true;
        current.push(message);
    }
    if (current.length > 0) turns.push(current);

    return turns.map(dedupeResources);
}

/**
 * Aggregate the resources created/updated/deleted during the most recent turn. Convenience wrapper
 * over {@link segmentTurnResources} for callers that only need the latest turn.
 */
export function aggregateLatestTurnResources(messages: AgentMessage[]): AgentResourceReference[] {
    const turns = segmentTurnResources(messages);
    return turns.length > 0 ? turns[turns.length - 1] : [];
}

/**
 * Whether the latest main-workstream turn has produced its final response and its resource summary
 * can be shown. Interactive conversations commonly remain alive after an ANSWER so they can accept
 * another user message; requiring the entire workflow to become terminal would hide the summary for
 * those otherwise-complete turns.
 */
export function isResourceSummaryReady(messages: AgentMessage[]): boolean {
    if (!isInProgress(messages)) return true;

    const mainMessages = messages.filter((message) => getWorkstreamId(message) === 'main');
    const lastMainMessage = mainMessages[mainMessages.length - 1];
    return lastMainMessage?.type === AgentMessageType.ANSWER;
}

export interface ResourceSummaryRenderItem {
    type: 'resource_summary';
    key: string;
    resources: AgentResourceReference[];
}

/**
 * Interleave per-turn resource summaries into a rendered timeline of `items`. A completed turn's
 * summary is emitted right before the next turn begins, and the most recent completed turn's summary
 * at the end. `isTurnBoundary` identifies the user-message item that starts a new turn; the i-th
 * boundary maps to `turnResources[i - 1]`. The final (most recent) turn is only summarized when
 * `isLatestTurnComplete` is true, so an in-progress turn shows no summary. Empty turns are skipped.
 */
export function interleaveTurnSummaries<T>(
    items: T[],
    isTurnBoundary: (item: T) => boolean,
    turnResources: AgentResourceReference[][],
    isLatestTurnComplete: boolean,
): Array<T | ResourceSummaryRenderItem> {
    if (turnResources.length === 0) return items;
    const out: Array<T | ResourceSummaryRenderItem> = [];
    const pushSummary = (turnIndex: number) => {
        const resources = turnResources[turnIndex];
        if (!resources || resources.length === 0) return;
        const isLastTurn = turnIndex >= turnResources.length - 1;
        if (isLastTurn && !isLatestTurnComplete) return;
        out.push({ type: 'resource_summary', key: `resource-summary-${turnIndex}`, resources });
    };
    let boundariesSeen = 0;
    for (const item of items) {
        const boundary = isTurnBoundary(item);
        if (boundary && boundariesSeen > 0) pushSummary(boundariesSeen - 1);
        if (boundary) boundariesSeen += 1;
        out.push(item);
    }
    pushSummary(boundariesSeen > 0 ? boundariesSeen - 1 : turnResources.length - 1);
    return out;
}
