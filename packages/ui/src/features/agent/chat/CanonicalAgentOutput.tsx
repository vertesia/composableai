import type { ReactNode } from 'react';
import { CanonicalAcceptedOutput } from '../../canonical-output/CanonicalOutputBlocks.js';
import type { CanonicalAgentContentState, CanonicalAgentDraftSnapshot } from './canonicalAgentContent.js';

export interface CanonicalAgentOutputGapState {
    history_before: boolean;
    history_after: boolean;
    history_scan_exhausted: boolean;
    live_preview: CanonicalAgentContentState['live']['reconnect_gap'];
    live_accepted_before: boolean;
}

export interface CanonicalAgentOutputProps {
    state: CanonicalAgentContentState;
    /** Required visible presentation for any unloaded history window or unavailable live preview prefix. */
    renderGapNotice: (gaps: CanonicalAgentOutputGapState) => ReactNode;
}

export function CanonicalAgentDraft({ snapshot }: { snapshot: CanonicalAgentDraftSnapshot }) {
    return (
        <div className="space-y-3" aria-live="polite">
            {snapshot.map((draft) => {
                if (draft.type === 'text') {
                    return (
                        <pre key={draft.draft_block_id} className="whitespace-pre-wrap">
                            {draft.text ?? ''}
                        </pre>
                    );
                }
                if (draft.type === 'reasoning') {
                    return (
                        <div
                            key={draft.draft_block_id}
                            className="rounded-md border border-mixer-muted/30 bg-mixer-muted/10 p-3 text-muted-foreground"
                        >
                            <pre className="whitespace-pre-wrap text-sm">{draft.text ?? ''}</pre>
                        </div>
                    );
                }
                if (draft.type === 'tool_call') {
                    return (
                        <div key={draft.draft_block_id} className="rounded-md border border-border p-3">
                            {draft.tool_name && <div className="mb-2 text-sm font-medium">{draft.tool_name}</div>}
                            {draft.text && <pre className="whitespace-pre-wrap text-sm">{draft.text}</pre>}
                        </div>
                    );
                }
                return null;
            })}
        </div>
    );
}

/**
 * Direct canonical content renderer for explicitly opted-in callers. Retained pages and live content stay visibly
 * separate so an unloaded history gap is never presented as a complete transcript.
 */
export function CanonicalAgentOutput({ state, renderGapNotice }: CanonicalAgentOutputProps) {
    const liveAccepted = state.live.accepted_outputs.filter(
        (item) =>
            !state.history.outputs.some((historyItem) => item.output.matchesReceipt(historyItem.envelope.receipt)),
    );
    const gaps: CanonicalAgentOutputGapState = {
        history_before: state.history.gap_before_window,
        history_after: state.history.gap_after_window,
        history_scan_exhausted: state.history.empty_page_scan_exhausted,
        live_preview: state.live.reconnect_gap,
        live_accepted_before: state.live.accepted_gap_before,
    };
    const hasGap =
        gaps.history_before ||
        gaps.history_after ||
        gaps.history_scan_exhausted ||
        gaps.live_preview ||
        gaps.live_accepted_before;

    return (
        <div
            className="space-y-4"
            data-history-gap-before={state.history.gap_before_window || undefined}
            data-history-gap-after={state.history.gap_after_window || undefined}
            data-stream-gap={state.live.reconnect_gap}
        >
            {hasGap && <div data-canonical-output-gap="true">{renderGapNotice(gaps)}</div>}
            <div data-canonical-history-window="true" className="space-y-4">
                {state.history.outputs.map((item) => (
                    <CanonicalAcceptedOutput key={item.envelope.receipt.id} fragment={item.output.fragment} />
                ))}
            </div>
            {liveAccepted.length > 0 && (
                <div data-canonical-live-output="true" className="space-y-4">
                    {liveAccepted.map((item) => (
                        <CanonicalAcceptedOutput key={item.envelope.receipt.id} fragment={item.output.fragment} />
                    ))}
                </div>
            )}
            {state.live.draft_snapshot.length > 0 && (
                <div data-canonical-live-draft="true">
                    <CanonicalAgentDraft snapshot={state.live.draft_snapshot} />
                </div>
            )}
        </div>
    );
}
