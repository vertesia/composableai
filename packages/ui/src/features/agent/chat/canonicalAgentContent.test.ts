import { type AgentConversationStreamUpdate, CanonicalInteractionOutput } from '@vertesia/client';
import type {
    ConversationOutputBlock,
    ConversationOutputReceipt,
    ExperimentalAgentConversationAcceptedOutput,
    ExperimentalAgentConversationAcceptedOutputHistoryPage,
} from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import {
    CANONICAL_AGENT_HISTORY_MAX_OUTPUTS,
    canonicalAgentContentReducer,
    exactCanonicalAcceptedOutput,
    initialCanonicalAgentContentState,
} from './canonicalAgentContent.js';

const RECORDED_AT = '2026-10-01T00:00:00.000Z';

function accepted(revision: number, blocks: ConversationOutputBlock[] = [], conversationId = 'conversation-1') {
    const receipt: ConversationOutputReceipt = {
        id: `response-${revision}`,
        conversation_id: conversationId,
        base_revision: revision - 1,
        result_revision: revision,
        recorded_at: RECORDED_AT,
        accepted_turn_ids: [`turn-${revision}`],
        accepted_generation_ids: [`generation-${revision}`],
        accepted_asset_ids: [],
    };
    const envelope: ExperimentalAgentConversationAcceptedOutput = {
        api_version: '=20260930',
        agent_run_id: 'agent-1',
        scope: 'root',
        type: 'accepted_output',
        source: { conversation_id: receipt.conversation_id, revision },
        receipt,
    };
    const output = new CanonicalInteractionOutput({
        format: 'llumiverse.conversation-output',
        schema_version: 0,
        experimental_revision: '2026-09-30.adoption.1',
        source: envelope.source,
        receipt,
        turn: {
            id: `turn-${revision}`,
            kind: 'agent',
            authority: 'ordinary',
            blocks,
            status: 'completed',
            timestamps: { recorded_at: RECORDED_AT, completed_at: RECORDED_AT },
            provenance: { type: 'generated' },
            model_visibility: 'include',
            generation_id: `generation-${revision}`,
        },
        generation: {
            id: `generation-${revision}`,
            record_source: 'executed',
            request_id: `request-${revision}`,
            attempt_id: `attempt-${revision}`,
            purpose: 'interaction',
            requested_model: 'model-1',
            provider: 'provider-1',
            protocol: 'provider.protocol',
            adapter_version: 'adapter-1',
            status: 'completed',
            timestamps: { recorded_at: RECORDED_AT, completed_at: RECORDED_AT },
            source: { conversation_id: conversationId, revision: revision - 1 },
        },
        assets: {},
        completeness: {
            history: 'omitted',
            native_replay: 'omitted',
            metadata: 'omitted',
            semantic_content: 'complete',
            omitted_block_ids: [],
            omitted_asset_ids: [],
        },
    });
    return exactCanonicalAcceptedOutput(envelope, output);
}

function page(
    outputs: readonly ReturnType<typeof accepted>[],
    snapshotRevision = 200,
    nextAfterRevision?: number,
): ExperimentalAgentConversationAcceptedOutputHistoryPage {
    return {
        api_version: '=20260930',
        agent_run_id: 'agent-1',
        scope: 'root',
        snapshot: { conversation_id: 'conversation-1', revision: snapshotRevision },
        items: outputs.map((output) => output.envelope),
        ...(nextAfterRevision === undefined ? {} : { next_after_revision: nextAfterRevision }),
    };
}

describe('canonical agent content state', () => {
    it('rejects an exact output that does not match its reference receipt', () => {
        const first = accepted(1);
        const second = accepted(2);
        expect(() => exactCanonicalAcceptedOutput(first.envelope, second.output)).toThrow('exact reference envelope');
    });

    it('keeps retained history bounded and exposes gaps on both sides of its loaded window', () => {
        let state = initialCanonicalAgentContentState();
        const all = Array.from({ length: CANONICAL_AGENT_HISTORY_MAX_OUTPUTS + 1 }, (_, index) => accepted(index + 1));
        const batches = [all.slice(0, 50), all.slice(50, 100), all.slice(100)];
        for (const [index, batch] of batches.entries()) {
            const currentPage = page(
                batch,
                200,
                index === batches.length - 1 ? 150 : batch.at(-1)?.envelope.receipt.result_revision,
            );
            state = canonicalAgentContentReducer(state, {
                type: 'history_page',
                page: currentPage,
                outputs: batch,
                empty_page_scan_exhausted: false,
            });
        }

        expect(state.history.outputs).toHaveLength(CANONICAL_AGENT_HISTORY_MAX_OUTPUTS);
        expect(state.history.outputs[0]?.envelope.receipt.result_revision).toBe(2);
        expect(state.history.gap_before_window).toBe(true);
        expect(state.history.gap_after_window).toBe(true);
    });

    it('keeps a live accepted output separate from an ascending history window race', () => {
        const live = accepted(3);
        let state = canonicalAgentContentReducer(initialCanonicalAgentContentState(), {
            type: 'stream_update',
            update: live,
        });
        const historical = [accepted(1), accepted(2), live];
        state = canonicalAgentContentReducer(state, {
            type: 'history_page',
            page: page(historical, 3),
            outputs: historical,
            empty_page_scan_exhausted: false,
        });

        expect(state.history.outputs).toHaveLength(3);
        expect(state.live.accepted_outputs).toEqual([]);
    });

    it('retains each accepted output after a pinned snapshot and orders replayed live arrivals', () => {
        const first = accepted(1);
        const second = accepted(2);
        const third = accepted(3);
        let state = canonicalAgentContentReducer(initialCanonicalAgentContentState(), {
            type: 'history_page',
            page: page([first], 1),
            outputs: [first],
            empty_page_scan_exhausted: false,
        });
        state = canonicalAgentContentReducer(state, { type: 'stream_update', update: third });
        state = canonicalAgentContentReducer(state, { type: 'stream_update', update: second });
        state = canonicalAgentContentReducer(state, { type: 'stream_update', update: third });

        expect(state.history.outputs.map((output) => output.envelope.receipt.result_revision)).toEqual([1]);
        expect(state.live.accepted_outputs.map((output) => output.envelope.receipt.result_revision)).toEqual([2, 3]);
    });

    it('deduplicates a history-first live overlap', () => {
        const first = accepted(1);
        const second = accepted(2);
        let state = canonicalAgentContentReducer(initialCanonicalAgentContentState(), {
            type: 'history_page',
            page: page([first], 1),
            outputs: [first],
            empty_page_scan_exhausted: false,
        });
        state = canonicalAgentContentReducer(state, { type: 'stream_update', update: first });
        state = canonicalAgentContentReducer(state, { type: 'stream_update', update: second });
        expect(state.live.accepted_outputs).toEqual([second]);

        expect(state.history.outputs).toEqual([first]);
        expect(state.live.accepted_outputs).toEqual([second]);
    });

    it('bounds pinned and live accepted outputs together while exposing the omitted prefix', () => {
        const historical = Array.from({ length: CANONICAL_AGENT_HISTORY_MAX_OUTPUTS }, (_, index) =>
            accepted(index + 1),
        );
        let state = canonicalAgentContentReducer(initialCanonicalAgentContentState(), {
            type: 'history_page',
            page: page(historical, CANONICAL_AGENT_HISTORY_MAX_OUTPUTS),
            outputs: historical,
            empty_page_scan_exhausted: false,
        });
        state = canonicalAgentContentReducer(state, {
            type: 'stream_update',
            update: accepted(CANONICAL_AGENT_HISTORY_MAX_OUTPUTS + 1),
        });

        expect(state.history.outputs).toHaveLength(CANONICAL_AGENT_HISTORY_MAX_OUTPUTS - 1);
        expect(state.live.accepted_outputs).toHaveLength(1);
        expect(state.history.outputs.length + state.live.accepted_outputs.length).toBe(
            CANONICAL_AGENT_HISTORY_MAX_OUTPUTS,
        );
        expect(state.history.gap_before_window).toBe(true);
    });

    it('rejects a live accepted output from another conversation identity', () => {
        const first = accepted(1);
        let state = canonicalAgentContentReducer(initialCanonicalAgentContentState(), {
            type: 'history_page',
            page: page([first], 1),
            outputs: [first],
            empty_page_scan_exhausted: false,
        });
        state = canonicalAgentContentReducer(state, {
            type: 'stream_update',
            update: accepted(2, [], 'conversation-2'),
        });

        expect(state.live.status).toBe('error');
        expect(state.live.accepted_outputs).toEqual([]);
        expect(state.live.error).toBeInstanceOf(Error);
    });

    it('marks a visible live gap if accepted arrivals alone exceed the shared output bound', () => {
        let state = initialCanonicalAgentContentState();
        for (let revision = 1; revision <= CANONICAL_AGENT_HISTORY_MAX_OUTPUTS + 1; revision += 1) {
            state = canonicalAgentContentReducer(state, { type: 'stream_update', update: accepted(revision) });
        }

        expect(state.live.accepted_outputs).toHaveLength(CANONICAL_AGENT_HISTORY_MAX_OUTPUTS);
        expect(state.live.accepted_outputs[0]?.envelope.receipt.result_revision).toBe(2);
        expect(state.live.accepted_gap_before).toBe(true);
    });

    it('clears only provisional draft state on reconnect and retains accepted/history content', () => {
        const prior = accepted(1);
        let state = canonicalAgentContentReducer(initialCanonicalAgentContentState(), {
            type: 'history_page',
            page: page([prior], 1),
            outputs: [prior],
            empty_page_scan_exhausted: false,
        });
        state = canonicalAgentContentReducer(state, { type: 'stream_update', update: prior });
        const draftSnapshot = Object.freeze([
            Object.freeze({
                draft_block_id: 'draft-1',
                native_position: { protocol: 'test', path: ['parts', 0] },
                type: 'text' as const,
                text: 'partial',
                finished: false,
            }),
        ]);
        const draftUpdate = {
            api_version: '=20260930',
            agent_run_id: 'agent-1',
            scope: 'root',
            type: 'conversation_event',
            execution_run_id: 'execution-1',
            event: {
                format: 'llumiverse.conversation',
                schema_version: 0,
                experimental_revision: '2026-09-30.adoption.1',
                stream_id: 'stream-1',
                request_id: 'request-1',
                attempt_id: 'attempt-1',
                response_operation_id: 'response-2',
                generation_id: 'generation-2',
                draft_turn_id: 'turn-2',
                event_id: 'stream-1#1',
                sequence: 1,
                draft_block_id: 'draft-1',
                native_position: { protocol: 'test', path: ['parts', 0] },
                type: 'draft_text_delta',
                text: 'partial',
            },
            draft_snapshot: draftSnapshot,
        } satisfies AgentConversationStreamUpdate;
        state = canonicalAgentContentReducer(state, { type: 'stream_update', update: draftUpdate });
        state = canonicalAgentContentReducer(state, {
            type: 'stream_update',
            update: {
                api_version: '=20260930',
                agent_run_id: 'agent-1',
                scope: 'root',
                type: 'preview_unavailable',
                reason: 'late_join',
                draft_snapshot: Object.freeze([]),
            },
        });

        expect(state.live.draft_snapshot).toEqual([]);
        expect(state.live.accepted_outputs).toEqual([]);
        expect(state.history.outputs).toEqual([prior]);
        expect(state.live.reconnect_gap).toBe('late_join');
        expect(state.history.gap_after_window).toBe(false);
    });

    it('keeps a reconnect gap across a stale terminal and clears it only on a fresh draft prefix', () => {
        let state = canonicalAgentContentReducer(initialCanonicalAgentContentState(), {
            type: 'stream_update',
            update: {
                api_version: '=20260930',
                agent_run_id: 'agent-1',
                scope: 'root',
                type: 'preview_unavailable',
                reason: 'late_join',
                draft_snapshot: Object.freeze([]),
            },
        });
        const event = {
            format: 'llumiverse.conversation' as const,
            schema_version: 0 as const,
            experimental_revision: '2026-09-30.adoption.1' as const,
            stream_id: 'stale-stream',
            request_id: 'stale-request',
            attempt_id: 'stale-attempt',
            response_operation_id: 'stale-response',
            generation_id: 'stale-generation',
            draft_turn_id: 'stale-turn',
            event_id: 'stale-stream#1',
            sequence: 1,
        };
        state = canonicalAgentContentReducer(state, {
            type: 'stream_update',
            update: {
                api_version: '=20260930',
                agent_run_id: 'agent-1',
                scope: 'root',
                type: 'conversation_event',
                execution_run_id: 'execution-1',
                event: { ...event, type: 'stream_terminated', outcome: 'failed' },
                draft_snapshot: Object.freeze([]),
            },
        });
        expect(state.live.reconnect_gap).toBe('late_join');

        state = canonicalAgentContentReducer(state, {
            type: 'stream_update',
            update: {
                api_version: '=20260930',
                agent_run_id: 'agent-1',
                scope: 'root',
                type: 'conversation_event',
                execution_run_id: 'execution-2',
                event: {
                    ...event,
                    stream_id: 'fresh-stream',
                    event_id: 'fresh-stream#0',
                    sequence: 0,
                    type: 'draft_started',
                    origin: 'live_transport',
                },
                draft_snapshot: Object.freeze([]),
            },
        });
        expect(state.live.reconnect_gap).toBeUndefined();
    });

    it('surfaces bounded empty-page traversal exhaustion without claiming history ended', () => {
        const empty = page([], 10, 8);
        const state = canonicalAgentContentReducer(initialCanonicalAgentContentState(), {
            type: 'history_page',
            page: empty,
            outputs: [],
            empty_page_scan_exhausted: true,
        });
        expect(state.history.empty_page_scan_exhausted).toBe(true);
        expect(state.history.gap_after_window).toBe(true);
        expect(state.history.next_after_revision).toBe(8);
    });
});
