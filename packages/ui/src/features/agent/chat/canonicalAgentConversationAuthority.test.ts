import type {
    ExperimentalAgentConversationSourceDescriptor,
    ExperimentalAgentConversationSourceInitialized,
} from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import {
    canonicalAgentConversationAuthorityReducer,
    initialCanonicalAgentConversationAuthorityState,
    resolveCanonicalAgentConversationSource,
} from './canonicalAgentConversationAuthority.js';

function initialized(
    revision = 1,
    options: {
        agentRunId?: string;
        conversationId?: string;
        scope?: 'root' | `workstream:${string}`;
        workstreamId?: string;
    } = {},
): ExperimentalAgentConversationSourceInitialized {
    return {
        api_version: '=20260930',
        agent_run_id: options.agentRunId ?? 'agent-1',
        scope: options.scope ?? 'root',
        ...(options.workstreamId === undefined ? {} : { workstream_id: options.workstreamId }),
        status: 'initialized',
        contract_version: 'canonical-conversation-v1',
        head: {
            format: 'llumiverse.conversation',
            schema_version: 0,
            experimental_revision: '2026-09-30.adoption.1',
            conversation_id: options.conversationId ?? 'conversation-1',
            revision,
        },
    };
}

function uninitialized(
    options: { agentRunId?: string; scope?: 'root' | `workstream:${string}`; workstreamId?: string } = {},
): ExperimentalAgentConversationSourceDescriptor {
    return {
        api_version: '=20260930',
        agent_run_id: options.agentRunId ?? 'agent-1',
        scope: options.scope ?? 'root',
        ...(options.workstreamId === undefined ? {} : { workstream_id: options.workstreamId }),
        status: 'uninitialized',
    };
}

function startProbe(state: ReturnType<typeof initialCanonicalAgentConversationAuthorityState>, requestId: number) {
    return canonicalAgentConversationAuthorityReducer(state, {
        type: 'probe_started',
        selection_key: state.selection.key,
        request_id: requestId,
    });
}

describe('canonical agent conversation source selection', () => {
    const workstreams = [
        { workstream_id: 'research', launch_id: 'launch-research-1' },
        { workstream_id: 'review', launch_id: 'launch-review-1' },
    ];

    it('maps the main and all views to the root source', () => {
        expect(resolveCanonicalAgentConversationSource('agent-1', 'all', workstreams)).toEqual({
            status: 'selected',
            key: JSON.stringify(['agent-1', 'root', null]),
            agent_run_id: 'agent-1',
            scope: 'root',
        });
        expect(resolveCanonicalAgentConversationSource('agent-1', 'main', workstreams)).toEqual(
            resolveCanonicalAgentConversationSource('agent-1', 'all', workstreams),
        );
    });

    it('uses the exact durable launch id for a selected workstream', () => {
        expect(resolveCanonicalAgentConversationSource('agent-1', 'research', workstreams)).toMatchObject({
            status: 'selected',
            agent_run_id: 'agent-1',
            scope: 'workstream:launch-research-1',
            workstream_id: 'research',
        });
        expect(resolveCanonicalAgentConversationSource('agent-1', 'launch-review-1', workstreams)).toMatchObject({
            status: 'selected',
            scope: 'workstream:launch-review-1',
            workstream_id: 'review',
        });
    });

    it('fails closed for missing, ambiguous, or invalid workstream bindings', () => {
        expect(resolveCanonicalAgentConversationSource('agent-1', 'missing', workstreams)).toMatchObject({
            status: 'unavailable',
            reason: 'workstream_not_found',
        });
        expect(
            resolveCanonicalAgentConversationSource('agent-1', 'research', [
                ...workstreams,
                { workstream_id: 'research', launch_id: 'launch-research-2' },
            ]),
        ).toMatchObject({ status: 'unavailable', reason: 'workstream_ambiguous' });
        expect(
            resolveCanonicalAgentConversationSource('agent-1', 'unsafe', [
                { workstream_id: 'unsafe', launch_id: '../../sibling' },
            ]),
        ).toMatchObject({ status: 'unavailable', reason: 'invalid_launch_id' });
    });
});

describe('canonical agent conversation authority', () => {
    it('promotes provisional legacy content atomically and permanently when the descriptor initializes', () => {
        const selection = resolveCanonicalAgentConversationSource('agent-1', 'all', []);
        let state = startProbe(initialCanonicalAgentConversationAuthorityState(selection), 1);
        state = canonicalAgentConversationAuthorityReducer(state, {
            type: 'descriptor_received',
            selection_key: selection.key,
            request_id: 1,
            descriptor: uninitialized(),
        });
        expect(state).toMatchObject({ phase: 'provisional_legacy', content_authority: 'legacy' });

        state = startProbe(state, 2);
        state = canonicalAgentConversationAuthorityReducer(state, {
            type: 'descriptor_received',
            selection_key: selection.key,
            request_id: 2,
            descriptor: initialized(1),
        });
        expect(state).toMatchObject({
            phase: 'canonical',
            content_authority: 'canonical',
            source_status: 'available',
            acceptance: 'unconfirmed',
        });

        state = startProbe(state, 3);
        state = canonicalAgentConversationAuthorityReducer(state, {
            type: 'descriptor_received',
            selection_key: selection.key,
            request_id: 3,
            descriptor: uninitialized(),
        });
        expect(state).toMatchObject({
            phase: 'canonical',
            content_authority: 'canonical',
            source_status: 'inconsistent',
        });
    });

    it('treats revision zero as canonical location without inferring acceptance or readiness', () => {
        const selection = resolveCanonicalAgentConversationSource('agent-1', 'all', []);
        let state = startProbe(initialCanonicalAgentConversationAuthorityState(selection), 1);
        state = canonicalAgentConversationAuthorityReducer(state, {
            type: 'descriptor_received',
            selection_key: selection.key,
            request_id: 1,
            descriptor: initialized(0),
        });

        expect(state).toMatchObject({
            phase: 'canonical',
            content_authority: 'canonical',
            acceptance: 'unconfirmed',
            descriptor: { head: { revision: 0 } },
        });
    });

    it('does not infer legacy authority from an initial descriptor error', () => {
        const selection = resolveCanonicalAgentConversationSource('agent-1', 'all', []);
        let state = startProbe(initialCanonicalAgentConversationAuthorityState(selection), 1);
        const error = new Error('source unavailable');
        state = canonicalAgentConversationAuthorityReducer(state, {
            type: 'probe_failed',
            selection_key: selection.key,
            request_id: 1,
            error,
        });

        expect(state).toMatchObject({ phase: 'source_error', content_authority: 'none', error });
    });

    it('retains provisional legacy after a bounded refresh error and canonical after a later error', () => {
        const selection = resolveCanonicalAgentConversationSource('agent-1', 'all', []);
        let state = startProbe(initialCanonicalAgentConversationAuthorityState(selection), 1);
        state = canonicalAgentConversationAuthorityReducer(state, {
            type: 'descriptor_received',
            selection_key: selection.key,
            request_id: 1,
            descriptor: uninitialized(),
        });
        state = startProbe(state, 2);
        state = canonicalAgentConversationAuthorityReducer(state, {
            type: 'probe_failed',
            selection_key: selection.key,
            request_id: 2,
            error: new Error('temporary'),
        });
        expect(state).toMatchObject({
            phase: 'provisional_legacy',
            content_authority: 'legacy',
            source_status: 'refresh_error',
        });

        state = startProbe(state, 3);
        state = canonicalAgentConversationAuthorityReducer(state, {
            type: 'descriptor_received',
            selection_key: selection.key,
            request_id: 3,
            descriptor: initialized(2),
        });
        state = startProbe(state, 4);
        state = canonicalAgentConversationAuthorityReducer(state, {
            type: 'probe_failed',
            selection_key: selection.key,
            request_id: 4,
            error: new Error('missing blob'),
        });
        expect(state).toMatchObject({
            phase: 'canonical',
            content_authority: 'canonical',
            source_status: 'refresh_error',
            descriptor: { head: { revision: 2 } },
        });
    });

    it('ignores stale probe results and resets authority when the selected source changes', () => {
        const root = resolveCanonicalAgentConversationSource('agent-1', 'all', []);
        let state = startProbe(initialCanonicalAgentConversationAuthorityState(root), 1);
        state = startProbe(state, 2);
        const beforeStale = state;
        state = canonicalAgentConversationAuthorityReducer(state, {
            type: 'descriptor_received',
            selection_key: root.key,
            request_id: 1,
            descriptor: initialized(1),
        });
        expect(state).toBe(beforeStale);

        const child = resolveCanonicalAgentConversationSource('agent-1', 'research', [
            { workstream_id: 'research', launch_id: 'launch-1' },
        ]);
        state = canonicalAgentConversationAuthorityReducer(state, { type: 'selection_changed', selection: child });
        expect(state).toMatchObject({ phase: 'resolving', content_authority: 'none', selection: child });

        const beforeOldSource = state;
        state = canonicalAgentConversationAuthorityReducer(state, {
            type: 'descriptor_received',
            selection_key: root.key,
            request_id: 2,
            descriptor: initialized(1),
        });
        expect(state).toBe(beforeOldSource);
    });

    it('rejects a descriptor outside the selected route and preserves a latched canonical source', () => {
        const selection = resolveCanonicalAgentConversationSource('agent-1', 'all', []);
        let state = startProbe(initialCanonicalAgentConversationAuthorityState(selection), 1);
        state = canonicalAgentConversationAuthorityReducer(state, {
            type: 'descriptor_received',
            selection_key: selection.key,
            request_id: 1,
            descriptor: initialized(1, { agentRunId: 'other-agent' }),
        });
        expect(state).toMatchObject({ phase: 'source_error', content_authority: 'none' });

        state = startProbe(state, 2);
        state = canonicalAgentConversationAuthorityReducer(state, {
            type: 'descriptor_received',
            selection_key: selection.key,
            request_id: 2,
            descriptor: initialized(2),
        });
        state = startProbe(state, 3);
        state = canonicalAgentConversationAuthorityReducer(state, {
            type: 'descriptor_received',
            selection_key: selection.key,
            request_id: 3,
            descriptor: initialized(3, { conversationId: 'other-conversation' }),
        });
        expect(state).toMatchObject({
            phase: 'canonical',
            content_authority: 'canonical',
            source_status: 'inconsistent',
            descriptor: { head: { conversation_id: 'conversation-1', revision: 2 } },
        });
    });

    it('accepts a monotonic descriptor refresh for the same canonical conversation', () => {
        const selection = resolveCanonicalAgentConversationSource('agent-1', 'all', []);
        let state = startProbe(initialCanonicalAgentConversationAuthorityState(selection), 1);
        state = canonicalAgentConversationAuthorityReducer(state, {
            type: 'descriptor_received',
            selection_key: selection.key,
            request_id: 1,
            descriptor: initialized(1),
        });
        state = startProbe(state, 2);
        state = canonicalAgentConversationAuthorityReducer(state, {
            type: 'descriptor_received',
            selection_key: selection.key,
            request_id: 2,
            descriptor: initialized(4),
        });
        expect(state).toMatchObject({
            phase: 'canonical',
            source_status: 'available',
            descriptor: { head: { conversation_id: 'conversation-1', revision: 4 } },
        });
    });
});

describe('canonical wire descriptor validation', () => {
    it('rejects unknown versions, malformed status, empty identity and fractional or negative revisions', () => {
        const selection = resolveCanonicalAgentConversationSource('agent-1', 'all', []);
        const initial = startProbe(initialCanonicalAgentConversationAuthorityState(selection), 1);
        const valid = initialized();
        for (const descriptor of [
            { ...valid, api_version: 'future' },
            { ...valid, contract_version: 'future' },
            { ...valid, status: 'future' },
            { ...valid, head: { ...valid.head, format: 'future' } },
            { ...valid, head: { ...valid.head, schema_version: 1 } },
            { ...valid, head: { ...valid.head, experimental_revision: 'future' } },
            { ...valid, head: { ...valid.head, conversation_id: '' } },
            { ...valid, head: { ...valid.head, revision: -1 } },
            { ...valid, head: { ...valid.head, revision: 0.5 } },
            null,
        ]) {
            expect(
                canonicalAgentConversationAuthorityReducer(initial, {
                    type: 'descriptor_received',
                    selection_key: selection.key,
                    request_id: 1,
                    descriptor,
                }).content_authority,
            ).toBe('none');
        }
    });
});
