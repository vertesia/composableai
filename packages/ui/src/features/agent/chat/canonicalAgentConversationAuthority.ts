import type {
    CanonicalConversationHeadScope,
    ExperimentalAgentConversationSourceDescriptor,
    ExperimentalAgentConversationSourceInitialized,
} from '@vertesia/common';
import { parseExperimentalAgentConversationSourceDescriptor } from '@vertesia/common/canonical-stream-runtime';

const CANONICAL_WORKSTREAM_SCOPE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export interface CanonicalAgentWorkstreamSource {
    workstream_id: string;
    launch_id: string;
}

export interface CanonicalAgentConversationSelectedSource {
    status: 'selected';
    key: string;
    agent_run_id: string;
    scope: CanonicalConversationHeadScope;
    workstream_id?: string;
}

export interface CanonicalAgentConversationUnavailableSource {
    status: 'unavailable';
    key: string;
    reason: 'invalid_agent_run' | 'workstream_not_found' | 'workstream_ambiguous' | 'invalid_launch_id';
}

export type CanonicalAgentConversationSourceSelection =
    | CanonicalAgentConversationSelectedSource
    | CanonicalAgentConversationUnavailableSource;

function selectedSource(
    agentRunId: string,
    scope: CanonicalConversationHeadScope,
    workstreamId?: string,
): CanonicalAgentConversationSelectedSource {
    return {
        status: 'selected',
        key: JSON.stringify([agentRunId, scope, workstreamId ?? null]),
        agent_run_id: agentRunId,
        scope,
        ...(workstreamId === undefined ? {} : { workstream_id: workstreamId }),
    };
}

function unavailableSource(
    agentRunId: string,
    activeWorkstream: string,
    reason: CanonicalAgentConversationUnavailableSource['reason'],
): CanonicalAgentConversationUnavailableSource {
    return {
        status: 'unavailable',
        key: JSON.stringify([agentRunId, activeWorkstream, reason]),
        reason,
    };
}

/**
 * Resolve the exact canonical source selected by the existing agent-chat tabs.
 *
 * The `all` view is the main-agent timeline rather than an aggregate of child transcripts, so it and `main`
 * both select the root scope. Child scopes use the durable launch id, which remains stable across a workstream
 * resume. A display workstream that maps to multiple launches is deliberately not guessed.
 */
export function resolveCanonicalAgentConversationSource(
    agentRunId: string,
    activeWorkstream: string,
    workstreams: readonly CanonicalAgentWorkstreamSource[],
): CanonicalAgentConversationSourceSelection {
    if (!agentRunId) return unavailableSource(agentRunId, activeWorkstream, 'invalid_agent_run');
    if (activeWorkstream === 'all' || activeWorkstream === 'main') {
        return selectedSource(agentRunId, 'root');
    }

    const exactLaunchMatches = workstreams.filter((workstream) => workstream.launch_id === activeWorkstream);
    const candidates = exactLaunchMatches.length
        ? exactLaunchMatches
        : workstreams.filter((workstream) => workstream.workstream_id === activeWorkstream);
    const uniqueCandidates = new Map(
        candidates.map((candidate) => [`${candidate.launch_id}\u0000${candidate.workstream_id}`, candidate]),
    );
    if (uniqueCandidates.size === 0) {
        return unavailableSource(agentRunId, activeWorkstream, 'workstream_not_found');
    }
    if (uniqueCandidates.size !== 1) {
        return unavailableSource(agentRunId, activeWorkstream, 'workstream_ambiguous');
    }

    const candidate = uniqueCandidates.values().next().value;
    if (!candidate?.workstream_id || !CANONICAL_WORKSTREAM_SCOPE_SEGMENT.test(candidate.launch_id)) {
        return unavailableSource(agentRunId, activeWorkstream, 'invalid_launch_id');
    }
    return selectedSource(agentRunId, `workstream:${candidate.launch_id}`, candidate.workstream_id);
}

interface CanonicalAgentConversationProbe {
    request_id: number;
    selection_key: string;
}

interface CanonicalAgentConversationAuthorityBase {
    selection: CanonicalAgentConversationSourceSelection;
    active_probe?: CanonicalAgentConversationProbe;
}

export interface CanonicalAgentConversationSelectionUnavailableState extends CanonicalAgentConversationAuthorityBase {
    phase: 'selection_unavailable';
    content_authority: 'none';
    selection: CanonicalAgentConversationUnavailableSource;
}

export interface CanonicalAgentConversationResolvingState extends CanonicalAgentConversationAuthorityBase {
    phase: 'resolving';
    content_authority: 'none';
    selection: CanonicalAgentConversationSelectedSource;
}

export interface CanonicalAgentConversationSourceErrorState extends CanonicalAgentConversationAuthorityBase {
    phase: 'source_error';
    content_authority: 'none';
    selection: CanonicalAgentConversationSelectedSource;
    error: unknown;
}

export interface CanonicalAgentConversationProvisionalLegacyState extends CanonicalAgentConversationAuthorityBase {
    phase: 'provisional_legacy';
    content_authority: 'legacy';
    selection: CanonicalAgentConversationSelectedSource;
    source_status: 'uninitialized' | 'refreshing' | 'refresh_error';
    error?: unknown;
}

export interface CanonicalAgentConversationCanonicalState extends CanonicalAgentConversationAuthorityBase {
    phase: 'canonical';
    content_authority: 'canonical';
    selection: CanonicalAgentConversationSelectedSource;
    descriptor: ExperimentalAgentConversationSourceInitialized;
    /** A source locator, including revision zero, never proves that a response was accepted or is ready. */
    acceptance: 'unconfirmed';
    source_status: 'available' | 'refreshing' | 'refresh_error' | 'inconsistent';
    error?: unknown;
}

export type CanonicalAgentConversationAuthorityState =
    | CanonicalAgentConversationSelectionUnavailableState
    | CanonicalAgentConversationResolvingState
    | CanonicalAgentConversationSourceErrorState
    | CanonicalAgentConversationProvisionalLegacyState
    | CanonicalAgentConversationCanonicalState;

export type CanonicalAgentConversationAuthorityAction =
    | {
          type: 'selection_changed';
          selection: CanonicalAgentConversationSourceSelection;
          latched_descriptor?: ExperimentalAgentConversationSourceInitialized;
          reset?: boolean;
      }
    | { type: 'probe_started'; selection_key: string; request_id: number }
    | {
          type: 'descriptor_received';
          selection_key: string;
          request_id: number;
          descriptor: unknown;
      }
    | { type: 'probe_failed'; selection_key: string; request_id: number; error: unknown };

export function initialCanonicalAgentConversationAuthorityState(
    selection: CanonicalAgentConversationSourceSelection,
): CanonicalAgentConversationAuthorityState {
    if (selection.status === 'unavailable') {
        return { phase: 'selection_unavailable', content_authority: 'none', selection };
    }
    return { phase: 'resolving', content_authority: 'none', selection };
}

function probeMatches(
    state: CanonicalAgentConversationAuthorityState,
    action: { selection_key: string; request_id: number },
): boolean {
    return (
        action.selection_key === state.selection.key &&
        action.selection_key === state.active_probe?.selection_key &&
        action.request_id === state.active_probe.request_id
    );
}

/** Validate the wire boundary in browser-safe code; SDK types do not validate JSON at runtime. */
export function isCanonicalAgentConversationDescriptor(
    value: unknown,
    selection: CanonicalAgentConversationSelectedSource,
): value is ExperimentalAgentConversationSourceDescriptor {
    let descriptor: ExperimentalAgentConversationSourceDescriptor;
    try {
        descriptor = parseExperimentalAgentConversationSourceDescriptor(value);
    } catch {
        return false;
    }
    return (
        descriptor.agent_run_id === selection.agent_run_id &&
        descriptor.scope === selection.scope &&
        descriptor.workstream_id === selection.workstream_id
    );
}

function canonicalRefreshError(
    state: CanonicalAgentConversationCanonicalState,
    error: unknown,
    sourceStatus: CanonicalAgentConversationCanonicalState['source_status'],
): CanonicalAgentConversationCanonicalState {
    return {
        ...state,
        active_probe: undefined,
        source_status: sourceStatus,
        error,
    };
}

function acceptInitializedDescriptor(
    state: CanonicalAgentConversationAuthorityState,
    descriptor: ExperimentalAgentConversationSourceInitialized,
): CanonicalAgentConversationAuthorityState {
    if (state.phase === 'canonical') {
        const previous = state.descriptor.head;
        if (
            descriptor.head.conversation_id !== previous.conversation_id ||
            descriptor.head.revision < previous.revision
        ) {
            return canonicalRefreshError(
                state,
                new Error('Canonical conversation source descriptor conflicts with its latched source'),
                'inconsistent',
            );
        }
    }
    return {
        phase: 'canonical',
        content_authority: 'canonical',
        selection: state.selection as CanonicalAgentConversationSelectedSource,
        descriptor:
            state.phase === 'canonical' && descriptor.head.revision === state.descriptor.head.revision
                ? state.descriptor
                : descriptor,
        acceptance: 'unconfirmed',
        source_status: 'available',
    };
}

/**
 * Choose transcript authority without observing legacy messages. An explicit uninitialized descriptor permits
 * provisional legacy presentation. A later validated initialized descriptor atomically replaces that authority and
 * latches canonical presentation; later missing or failed probes can never restore legacy authority.
 */
export function canonicalAgentConversationAuthorityReducer(
    state: CanonicalAgentConversationAuthorityState,
    action: CanonicalAgentConversationAuthorityAction,
): CanonicalAgentConversationAuthorityState {
    if (action.type === 'selection_changed') {
        if (!action.reset && action.selection.key === state.selection.key) return state;
        const initial = initialCanonicalAgentConversationAuthorityState(action.selection);
        if (
            action.selection.status === 'selected' &&
            action.latched_descriptor &&
            isCanonicalAgentConversationDescriptor(action.latched_descriptor, action.selection)
        ) {
            return acceptInitializedDescriptor(initial, action.latched_descriptor);
        }
        return initial;
    }
    if (action.type === 'probe_started') {
        if (state.selection.status !== 'selected' || action.selection_key !== state.selection.key) return state;
        const active_probe = { selection_key: action.selection_key, request_id: action.request_id };
        if (state.phase === 'canonical') {
            return { ...state, active_probe, source_status: 'refreshing', error: undefined };
        }
        if (state.phase === 'provisional_legacy') {
            return { ...state, active_probe, source_status: 'refreshing', error: undefined };
        }
        return { phase: 'resolving', content_authority: 'none', selection: state.selection, active_probe };
    }
    if (!probeMatches(state, action)) return state;

    if (action.type === 'probe_failed') {
        if (state.phase === 'canonical') return canonicalRefreshError(state, action.error, 'refresh_error');
        if (state.phase === 'provisional_legacy') {
            return {
                ...state,
                active_probe: undefined,
                source_status: 'refresh_error',
                error: action.error,
            };
        }
        return {
            phase: 'source_error',
            content_authority: 'none',
            selection: state.selection as CanonicalAgentConversationSelectedSource,
            error: action.error,
        };
    }

    if (
        !isCanonicalAgentConversationDescriptor(
            action.descriptor,
            state.selection as CanonicalAgentConversationSelectedSource,
        )
    ) {
        const error = new Error('Canonical conversation descriptor has an invalid contract or source identity');
        if (state.phase === 'canonical') return canonicalRefreshError(state, error, 'inconsistent');
        return {
            phase: 'source_error',
            content_authority: 'none',
            selection: state.selection as CanonicalAgentConversationSelectedSource,
            error,
        };
    }
    if (action.descriptor.status === 'initialized') {
        return acceptInitializedDescriptor(state, action.descriptor);
    }
    if (state.phase === 'canonical') {
        return canonicalRefreshError(
            state,
            new Error('Canonical conversation source became uninitialized after canonical authority was latched'),
            'inconsistent',
        );
    }
    return {
        phase: 'provisional_legacy',
        content_authority: 'legacy',
        selection: state.selection as CanonicalAgentConversationSelectedSource,
        source_status: 'uninitialized',
    };
}
