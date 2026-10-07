import type { VertesiaClient } from '@vertesia/client';
import type {
    CanonicalConversationHeadScope,
    ExperimentalAgentConversationAcceptedOutputHistoryPage,
    ExperimentalAgentConversationAcceptedOutputHistoryQuery,
    ExperimentalAgentConversationRunStatus,
    ExperimentalAgentRunControlNotification,
} from '@vertesia/common';
import { experimentalAgentRunControlIdentity } from '@vertesia/common/canonical-stream-runtime';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
    CANONICAL_AGENT_HISTORY_MAX_EMPTY_PAGES_PER_REQUEST,
    CANONICAL_AGENT_HISTORY_MAX_EXACT_FETCHES,
    CANONICAL_AGENT_HISTORY_PAGE_LIMIT,
    type CanonicalAcceptedAgentOutput,
    type CanonicalAgentContentAction,
    canonicalAgentContentReducer,
    exactCanonicalAcceptedOutput,
    initialCanonicalAgentContentState,
} from '../canonicalAgentContent.js';

export interface UseCanonicalAgentContentOptions {
    /** Internal opt-in. Disabled mode performs no canonical history or stream I/O. */
    enabled: boolean;
    /** Transcript callers load persisted turns directly and only need this live suffix. */
    loadAcceptedHistory?: boolean;
    conversationId?: string;
    onRunControl?: (notification: ExperimentalAgentRunControlNotification) => void;
    onSourceChanged?: () => void;
    onRunStatus?: (status: ExperimentalAgentConversationRunStatus) => void;
    agentRunId: string;
    scope?: CanonicalConversationHeadScope;
    workstreamId?: string;
}

interface CanonicalAgentContentSession {
    key: string;
    client: VertesiaClient;
    controller: AbortController;
    loadingNext: boolean;
}

interface CanonicalHistoryCursor {
    snapshot_conversation_id: string;
    snapshot_revision: number;
    after_revision: number;
}

function sessionKey(options: UseCanonicalAgentContentOptions): string {
    return `${options.agentRunId}\u0000${options.scope ?? ''}\u0000${options.workstreamId ?? ''}\u0000${options.conversationId ?? ''}`;
}

function validateHistoryPage(
    page: ExperimentalAgentConversationAcceptedOutputHistoryPage,
    options: UseCanonicalAgentContentOptions,
    cursor?: CanonicalHistoryCursor,
): void {
    if (page.agent_run_id !== options.agentRunId) {
        throw new Error('Canonical accepted-output history changed agent run');
    }
    if (options.scope !== undefined && page.scope !== options.scope) {
        throw new Error('Canonical accepted-output history changed scope');
    }
    if (options.workstreamId !== undefined && page.workstream_id !== options.workstreamId) {
        throw new Error('Canonical accepted-output history changed workstream');
    }
    if (
        cursor &&
        (page.snapshot.conversation_id !== cursor.snapshot_conversation_id ||
            page.snapshot.revision !== cursor.snapshot_revision)
    ) {
        throw new Error('Canonical accepted-output history changed its pinned snapshot');
    }

    let previousRevision = cursor?.after_revision ?? -1;
    for (const item of page.items) {
        if (
            item.agent_run_id !== page.agent_run_id ||
            item.scope !== page.scope ||
            item.workstream_id !== page.workstream_id
        ) {
            throw new Error('Canonical accepted-output history contains a reference outside its route');
        }
        const revision = item.receipt.result_revision;
        if (revision <= previousRevision || revision > page.snapshot.revision) {
            throw new Error('Canonical accepted-output history reference revisions are not strictly ascending');
        }
        previousRevision = revision;
    }
    if (
        page.next_after_revision !== undefined &&
        (page.next_after_revision <= (cursor?.after_revision ?? -1) ||
            page.next_after_revision < previousRevision ||
            page.next_after_revision > page.snapshot.revision)
    ) {
        throw new Error('Canonical accepted-output history cursor does not advance within its pinned snapshot');
    }
}

async function resolveHistoryPage(
    client: VertesiaClient,
    options: UseCanonicalAgentContentOptions,
    page: ExperimentalAgentConversationAcceptedOutputHistoryPage,
    signal: AbortSignal,
): Promise<CanonicalAcceptedAgentOutput[]> {
    const outputs: CanonicalAcceptedAgentOutput[] = [];
    for (let offset = 0; offset < page.items.length; offset += CANONICAL_AGENT_HISTORY_MAX_EXACT_FETCHES) {
        signal.throwIfAborted();
        const items = page.items.slice(offset, offset + CANONICAL_AGENT_HISTORY_MAX_EXACT_FETCHES);
        const resolved = await Promise.all(
            items.map(async (item) => {
                const output = await client.agents.retrieveConversationAcceptedOutput(
                    options.agentRunId,
                    item.receipt,
                    item.scope,
                    { signal },
                );
                signal.throwIfAborted();
                return exactCanonicalAcceptedOutput(item, output);
            }),
        );
        outputs.push(...resolved);
    }
    return outputs;
}

async function loadHistoryWindow(
    client: VertesiaClient,
    options: UseCanonicalAgentContentOptions,
    signal: AbortSignal,
    dispatch: (action: CanonicalAgentContentAction) => void,
    continuation?: CanonicalHistoryCursor,
): Promise<void> {
    let cursor = continuation;
    let emptyPages = 0;
    while (true) {
        signal.throwIfAborted();
        const query: ExperimentalAgentConversationAcceptedOutputHistoryQuery = {
            ...(options.scope === undefined ? {} : { conversation_scope: options.scope }),
            ...(options.workstreamId === undefined ? {} : { workstream_id: options.workstreamId }),
            ...cursor,
            limit: CANONICAL_AGENT_HISTORY_PAGE_LIMIT,
        };
        const page = await client.agents.listConversationAcceptedOutputs(options.agentRunId, query, { signal });
        signal.throwIfAborted();
        validateHistoryPage(page, options, cursor);
        const outputs = await resolveHistoryPage(client, options, page, signal);
        const isEmptyContinuation = continuation !== undefined && outputs.length === 0;
        if (isEmptyContinuation) emptyPages += 1;
        const exhausted =
            isEmptyContinuation &&
            emptyPages >= CANONICAL_AGENT_HISTORY_MAX_EMPTY_PAGES_PER_REQUEST &&
            page.next_after_revision !== undefined;
        dispatch({ type: 'history_page', page, outputs, empty_page_scan_exhausted: exhausted });

        if (continuation === undefined || outputs.length > 0 || page.next_after_revision === undefined || exhausted) {
            return;
        }
        cursor = {
            snapshot_conversation_id: page.snapshot.conversation_id,
            snapshot_revision: page.snapshot.revision,
            after_revision: page.next_after_revision,
        };
    }
}

export function useCanonicalAgentContent(client: VertesiaClient, options: UseCanonicalAgentContentOptions) {
    const { agentRunId, enabled, scope, workstreamId, loadAcceptedHistory = true, conversationId } = options;
    const [controlGapSession, setControlGapSession] = useState<CanonicalAgentContentSession | undefined>();
    const [state, dispatch] = useReducer(canonicalAgentContentReducer, undefined, initialCanonicalAgentContentState);
    const stateRef = useRef(state);
    const onRunStatusRef = useRef(options.onRunStatus);
    onRunStatusRef.current = options.onRunStatus;
    const onRunControlRef = useRef(options.onRunControl);
    onRunControlRef.current = options.onRunControl;
    const onSourceChangedRef = useRef(options.onSourceChanged);
    onSourceChangedRef.current = options.onSourceChanged;
    const sessionRef = useRef<CanonicalAgentContentSession | undefined>(undefined);
    stateRef.current = state;

    useEffect(() => {
        dispatch({ type: 'reset' });
        const request = {
            enabled,
            agentRunId,
            scope,
            workstreamId,
            conversationId,
        } satisfies UseCanonicalAgentContentOptions;
        const key = sessionKey(request);
        if (!enabled) {
            sessionRef.current = undefined;
            return;
        }

        const controller = new AbortController();
        const session: CanonicalAgentContentSession = { key, client, controller, loadingNext: false };
        sessionRef.current = session;
        const isCurrent = () => !controller.signal.aborted && sessionRef.current === session;
        const dispatchIfCurrent = (action: CanonicalAgentContentAction) => {
            if (isCurrent()) dispatch(action);
        };
        let statusTimer: ReturnType<typeof setTimeout> | undefined;
        const controls = new Map<string, string>();
        let latestSource: string | undefined;
        let pinnedScope = scope;
        let pinnedWorkstream = workstreamId;
        let routePinned = false;
        const assertHostRoute = (route: {
            agent_run_id: string;
            scope: CanonicalConversationHeadScope;
            workstream_id?: string;
        }) => {
            if (
                route.agent_run_id !== agentRunId ||
                (pinnedScope !== undefined && route.scope !== pinnedScope) ||
                (routePinned
                    ? route.workstream_id !== pinnedWorkstream
                    : workstreamId !== undefined && route.workstream_id !== workstreamId)
            )
                throw new Error('Canonical run host event changed its authorized route');
            pinnedScope = route.scope;
            pinnedWorkstream = route.workstream_id;
            routePinned = true;
        };
        let latestStatus: ExperimentalAgentConversationRunStatus | undefined;
        const observeStatus = (status: ExperimentalAgentConversationRunStatus) => {
            if (!isCurrent()) return;
            assertHostRoute(status);
            if (status.control_page?.gap_before) setControlGapSession(session);
            const timestamp = Date.parse(status.updated_at);
            const previousTimestamp = latestStatus ? Date.parse(latestStatus.updated_at) : -1;
            const terminal = (value: ExperimentalAgentConversationRunStatus) =>
                ['completed', 'failed', 'cancelled'].includes(value.status);
            if (
                timestamp < previousTimestamp ||
                (timestamp === previousTimestamp && latestStatus && terminal(latestStatus) && !terminal(status))
            )
                return;
            if (latestStatus && JSON.stringify(latestStatus) === JSON.stringify(status)) return;
            latestStatus = status;
            onRunStatusRef.current?.(status);
        };
        const observeControl = (notification: ExperimentalAgentRunControlNotification) => {
            if (!isCurrent()) return;
            assertHostRoute(notification);
            const identity = notification.control.event_id;
            const fingerprint = experimentalAgentRunControlIdentity(notification);
            const prior = controls.get(identity);
            if (prior !== undefined) {
                if (prior !== fingerprint) throw new Error('Canonical run control identity changed');
                return;
            }
            if (controls.size >= 25_000) throw new Error('Canonical run control session exceeds its retained bound');
            onRunControlRef.current?.(notification);
            controls.set(identity, fingerprint);
        };
        let controlAfter = 0;
        let moreControls = false;
        const pollStatus = async (): Promise<void> => {
            try {
                const update = await client.agents.retrieveCanonicalUpdates(
                    agentRunId,
                    { conversation_scope: scope, workstream_id: workstreamId, control_after: controlAfter },
                    { signal: controller.signal },
                );
                if (!isCurrent()) return;
                observeStatus(update.run);
                if (update.control_page.gap_before) setControlGapSession(session);
                for (const control of update.controls) observeControl(control);
                controlAfter = update.control_page.after;
                moreControls = update.control_page.has_more;
                const sourceIdentity = JSON.stringify(update.source);
                if (sourceIdentity !== latestSource) {
                    latestSource = sourceIdentity;
                    onSourceChangedRef.current?.();
                }
                if (
                    conversationId !== undefined &&
                    (update.source.status !== 'initialized' || update.source.head.conversation_id !== conversationId)
                ) {
                    throw new Error('Canonical run lifecycle lost its exact source descriptor');
                }
            } catch (error: unknown) {
                if (isCurrent()) dispatch({ type: 'stream_error', error });
            } finally {
                if (isCurrent())
                    statusTimer = setTimeout(
                        () => {
                            void pollStatus();
                        },
                        moreControls ? 0 : 5000,
                    );
            }
        };
        if (onRunStatusRef.current || onRunControlRef.current) void pollStatus();
        if (loadAcceptedHistory) dispatch({ type: 'history_loading' });
        dispatch({ type: 'stream_connecting' });

        if (loadAcceptedHistory)
            void loadHistoryWindow(client, request, controller.signal, dispatchIfCurrent).catch((error: unknown) => {
                if (isCurrent()) dispatch({ type: 'history_error', error });
            });
        void client.agents
            .streamCanonicalConversation(
                agentRunId,
                (update) => {
                    const envelope = update.type === 'accepted_output' ? update.envelope : update;
                    if (
                        envelope.api_version !== '=20260930' ||
                        envelope.agent_run_id !== agentRunId ||
                        (scope !== undefined && envelope.scope !== scope) ||
                        envelope.workstream_id !== workstreamId ||
                        (conversationId !== undefined &&
                            update.type === 'accepted_output' &&
                            update.envelope.source.conversation_id !== conversationId)
                    ) {
                        dispatchIfCurrent({
                            type: 'stream_error',
                            error: new Error('Canonical live output changed its exact source'),
                        });
                        return;
                    }
                    dispatchIfCurrent({ type: 'stream_update', update });
                },
                {
                    scope,
                    workstream_id: workstreamId,
                    signal: controller.signal,
                    ...(onRunStatusRef.current || onRunControlRef.current ? { on_run_status: observeStatus } : {}),
                    ...(onRunControlRef.current ? { on_run_control: observeControl } : {}),
                },
            )
            .catch((error: unknown) => {
                if (isCurrent()) dispatch({ type: 'stream_error', error });
            });

        return () => {
            if (statusTimer !== undefined) clearTimeout(statusTimer);
            controller.abort();
            if (sessionRef.current === session) sessionRef.current = undefined;
        };
    }, [agentRunId, client, enabled, loadAcceptedHistory, scope, workstreamId, conversationId]);

    const loadNextHistory = useCallback(async (): Promise<void> => {
        const request = {
            enabled,
            agentRunId,
            scope,
            workstreamId,
            conversationId,
        } satisfies UseCanonicalAgentContentOptions;
        const session = sessionRef.current;
        const history = stateRef.current.history;
        if (
            !enabled ||
            !session ||
            session.key !== sessionKey(request) ||
            session.client !== client ||
            session.loadingNext ||
            !history.snapshot ||
            history.next_after_revision === undefined
        ) {
            return;
        }
        session.loadingNext = true;
        const isCurrent = () => !session.controller.signal.aborted && sessionRef.current === session;
        const dispatchIfCurrent = (action: CanonicalAgentContentAction) => {
            if (isCurrent()) dispatch(action);
        };
        dispatch({ type: 'history_loading' });
        try {
            await loadHistoryWindow(client, request, session.controller.signal, dispatchIfCurrent, {
                snapshot_conversation_id: history.snapshot.conversation_id,
                snapshot_revision: history.snapshot.revision,
                after_revision: history.next_after_revision,
            });
        } catch (error: unknown) {
            if (isCurrent()) dispatch({ type: 'history_error', error });
        } finally {
            session.loadingNext = false;
        }
    }, [agentRunId, client, enabled, scope, workstreamId, conversationId]);

    const currentKey = sessionKey({ enabled, agentRunId, scope, workstreamId, conversationId });
    const session = sessionRef.current;
    const presentedState =
        enabled && session?.key === currentKey && session.client === client
            ? state
            : initialCanonicalAgentContentState();
    return {
        ...presentedState,
        loadNextHistory,
        controlDeliveryGap:
            enabled && session?.key === currentKey && session.client === client && controlGapSession === session,
    };
}
