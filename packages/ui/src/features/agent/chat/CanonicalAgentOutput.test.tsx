// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { CanonicalInteractionOutput } from '@vertesia/client';
import type { ConversationOutputReceipt, ExperimentalAgentConversationAcceptedOutput } from '@vertesia/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanonicalAgentOutput } from './CanonicalAgentOutput.js';
import {
    canonicalAgentContentReducer,
    exactCanonicalAcceptedOutput,
    initialCanonicalAgentContentState,
} from './canonicalAgentContent.js';

vi.mock('@vertesia/ui/session', () => ({
    useUserSession: () => ({ client: { objects: { getDownloadUrl: vi.fn() } } }),
}));
vi.mock('@vertesia/ui/widgets', () => ({
    JSONCode: ({ data }: { data: unknown }) => <pre>{JSON.stringify(data)}</pre>,
}));

const RECORDED_AT = '2026-10-01T00:00:00.000Z';

function accepted(text: string, revision = 1) {
    const receipt: ConversationOutputReceipt = {
        id: `response-${revision}`,
        conversation_id: 'conversation-1',
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
        source: { conversation_id: 'conversation-1', revision },
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
            blocks: [{ id: `text-${revision}`, type: 'text', text, format: 'plain' }],
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
            source: { conversation_id: 'conversation-1', revision: revision - 1 },
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

afterEach(cleanup);

describe('CanonicalAgentOutput', () => {
    it('does not duplicate a live accepted output already present in the retained window', () => {
        const output = accepted('one exact answer');
        let state = canonicalAgentContentReducer(initialCanonicalAgentContentState(), {
            type: 'history_page',
            page: {
                api_version: '=20260930',
                agent_run_id: 'agent-1',
                scope: 'root',
                snapshot: { conversation_id: 'conversation-1', revision: 1 },
                items: [output.envelope],
            },
            outputs: [output],
            empty_page_scan_exhausted: false,
        });
        state = canonicalAgentContentReducer(state, { type: 'stream_update', update: output });

        render(<CanonicalAgentOutput state={state} renderGapNotice={() => null} />);

        expect(screen.getAllByText('one exact answer')).toHaveLength(1);
        expect(document.querySelector('[data-canonical-live-output]')).toBeNull();
    });

    it('renders every bounded live accepted output after the pinned history window', () => {
        const first = accepted('pinned answer', 1);
        const second = accepted('first live answer', 2);
        const third = accepted('second live answer', 3);
        let state = canonicalAgentContentReducer(initialCanonicalAgentContentState(), {
            type: 'history_page',
            page: {
                api_version: '=20260930',
                agent_run_id: 'agent-1',
                scope: 'root',
                snapshot: { conversation_id: 'conversation-1', revision: 1 },
                items: [first.envelope],
            },
            outputs: [first],
            empty_page_scan_exhausted: false,
        });
        state = canonicalAgentContentReducer(state, { type: 'stream_update', update: second });
        state = canonicalAgentContentReducer(state, { type: 'stream_update', update: third });

        render(<CanonicalAgentOutput state={state} renderGapNotice={() => null} />);

        expect(screen.getByText('pinned answer')).not.toBeNull();
        expect(screen.getByText('first live answer')).not.toBeNull();
        expect(screen.getByText('second live answer')).not.toBeNull();
    });

    it('renders a canonical live draft while keeping history-gap and reconnect-gap signals distinct', () => {
        const draft = Object.freeze([
            Object.freeze({
                draft_block_id: 'draft-1',
                native_position: { protocol: 'test', path: ['parts', 0] },
                type: 'text' as const,
                text: 'live draft',
                finished: false,
            }),
        ]);
        const state = {
            ...initialCanonicalAgentContentState(),
            history: {
                ...initialCanonicalAgentContentState().history,
                status: 'ready' as const,
                gap_after_window: true,
            },
            live: {
                ...initialCanonicalAgentContentState().live,
                status: 'ready' as const,
                draft_snapshot: draft,
                reconnect_gap: 'late_join' as const,
                accepted_gap_before: true,
            },
        };

        const { container } = render(
            <CanonicalAgentOutput
                state={state}
                renderGapNotice={(gaps) => (
                    <span>
                        History after: {String(gaps.history_after)}; live preview: {gaps.live_preview}; live accepted
                        before: {String(gaps.live_accepted_before)}
                    </span>
                )}
            />,
        );

        expect(screen.getByText('live draft')).not.toBeNull();
        expect(
            screen.getByText('History after: true; live preview: late_join; live accepted before: true'),
        ).not.toBeNull();
        expect(container.querySelector('[data-canonical-output-gap]')).not.toBeNull();
        expect((container.firstChild as HTMLElement | null)?.getAttribute('data-history-gap-after')).toBe('true');
        expect((container.firstChild as HTMLElement | null)?.getAttribute('data-stream-gap')).toBe('late_join');
    });
});
