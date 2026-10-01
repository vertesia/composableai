import type { ConversationTranscriptFragment, ConversationTranscriptTurn } from '@vertesia/common';
import { Button, MessageBox } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { JSONCode } from '@vertesia/ui/widgets';
import {
    CanonicalAcceptedOutput,
    CanonicalOutputBlocks,
    type CanonicalOutputOptions,
} from '../../canonical-output/CanonicalOutputBlocks.js';
import { CanonicalAgentDraft } from './CanonicalAgentOutput.js';
import type { CanonicalAgentContentState } from './canonicalAgentContent.js';
import type { CanonicalAgentTranscriptState } from './hooks/useCanonicalAgentTranscript.js';

function TranscriptTurn({
    turn,
    assets,
    ...options
}: {
    turn: ConversationTranscriptTurn;
    assets: ConversationTranscriptFragment['assets'];
} & CanonicalOutputOptions) {
    const { t } = useUITranslation();
    const blocks = options.hideToolCalls
        ? turn.blocks.filter((block) => block.type !== 'tool_call' && block.type !== 'tool_result')
        : turn.blocks;
    if (options.hideToolCalls && (turn.kind === 'tool' || blocks.length === 0)) return null;
    return (
        <article
            className="min-w-0 max-w-full space-y-2 rounded-md border border-border p-3"
            data-canonical-turn-id={turn.id}
        >
            <div className="text-sm font-medium">{t(`agent.canonical.role.${turn.kind}`)}</div>
            {blocks.map((block) => {
                if (block.type === 'tool_call')
                    return (
                        <div key={block.id}>
                            <div>{t('canonicalOutput.toolCall', { toolName: block.tool_name })}</div>
                            {block.arguments.type === 'json' ? (
                                <JSONCode data={block.arguments.value} />
                            ) : (
                                <pre className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                                    {block.arguments.raw}
                                </pre>
                            )}
                        </div>
                    );
                if (block.type === 'tool_result')
                    return (
                        <div key={block.id}>
                            <div>{t('agent.canonical.toolResult', { status: block.status })}</div>
                            <CanonicalOutputBlocks blocks={block.content} assets={assets} {...options} />
                        </div>
                    );
                return <CanonicalOutputBlocks key={block.id} blocks={[block]} assets={assets} {...options} />;
            })}
        </article>
    );
}

/** Persisted semantic content plus only the live suffix outside the pinned snapshot, never legacy messages. */
export function CanonicalAgentTranscript({
    transcript,
    live,
    loadNext,
    ...options
}: {
    transcript: CanonicalAgentTranscriptState;
    live: CanonicalAgentContentState['live'];
    loadNext: () => Promise<void>;
} & CanonicalOutputOptions) {
    const { t } = useUITranslation();
    const draftSnapshot = options.hideToolCalls
        ? live.draft_snapshot.filter((draft) => draft.type !== 'tool_call')
        : live.draft_snapshot;
    const snapshot = transcript.tail?.snapshot;
    const persistedPages = [...transcript.pages, ...(transcript.tail ? [transcript.tail] : [])];
    const covered = new Set(persistedPages.flatMap((page) => page.fragment.turns.map((turn) => turn.id)));
    const uncovered = live.accepted_outputs.filter(
        (item) =>
            (!snapshot || item.envelope.source.conversation_id === snapshot.conversation_id) &&
            !covered.has(item.output.fragment.turn.id),
    );
    const suffix = uncovered.filter((item) => !snapshot || item.envelope.receipt.result_revision > snapshot.revision);
    const outsideHistory = uncovered.filter(
        (item) => snapshot && item.envelope.receipt.result_revision <= snapshot.revision,
    );
    const tailCoverage = new Set(transcript.tail?.fragment.turns.map((turn) => turn.id));
    const seen = new Set<string>();
    const renderedPages = persistedPages.map((page) => ({
        page,
        turns: page.fragment.turns.filter((turn) => {
            if (seen.has(turn.id) || (page !== transcript.tail && tailCoverage.has(turn.id))) return false;
            seen.add(turn.id);
            return true;
        }),
    }));
    const historyTailGap =
        transcript.pages.length > 0 &&
        transcript.tail &&
        !transcript.pages.some((page) => page.fragment.turns.some((turn) => tailCoverage.has(turn.id)));
    const gap =
        transcript.discarded ||
        transcript.tail?.fragment.completeness.gap_before ||
        transcript.pages[0]?.fragment.completeness.gap_before ||
        transcript.pages.at(-1)?.fragment.completeness.gap_after ||
        persistedPages.some((page) => {
            const completeness = page.fragment.completeness;
            return (
                completeness.semantic_content === 'partial' ||
                completeness.omitted_turns.length ||
                completeness.omitted_blocks.length ||
                completeness.omitted_assets.length
            );
        }) ||
        uncovered.some(
            (item) =>
                item.output.fragment.completeness.semantic_content === 'partial' ||
                item.output.fragment.completeness.omitted_block_ids.length > 0 ||
                item.output.fragment.completeness.omitted_asset_ids.length > 0,
        ) ||
        live.reconnect_gap ||
        live.accepted_gap_before;
    return (
        <div className="space-y-4" data-canonical-transcript="true">
            {gap && <MessageBox status="info">{t('agent.canonical.gap')}</MessageBox>}
            {(transcript.error !== undefined || transcript.tail_error !== undefined) && (
                <MessageBox status="error">{t('agent.canonical.unavailable')}</MessageBox>
            )}
            {(transcript.loading || transcript.tail_loading) && <div role="status">{t('agent.canonical.loading')}</div>}
            {renderedPages.map(({ page, turns }, index) => (
                <div key={`${page.snapshot.revision}:${index}`} className="space-y-4">
                    {page === transcript.tail && historyTailGap && (
                        <div data-canonical-history-gap="true">
                            <MessageBox status="info">{t('agent.canonical.historyGap')}</MessageBox>
                        </div>
                    )}
                    {turns.map((turn) => (
                        <TranscriptTurn key={turn.id} turn={turn} assets={page.fragment.assets} {...options} />
                    ))}
                </div>
            ))}
            {transcript.tail &&
                ((!transcript.pages.length && transcript.tail.fragment.completeness.gap_before) ||
                    transcript.pages.at(-1)?.next_after_turn_id) && (
                    <Button
                        variant="outline"
                        disabled={transcript.loading}
                        onClick={() => {
                            void loadNext();
                        }}
                    >
                        {t(transcript.pages.length ? 'agent.canonical.loadMore' : 'agent.canonical.browseEarlier')}
                    </Button>
                )}
            {suffix.map((item) => (
                <article
                    key={item.envelope.receipt.id}
                    data-canonical-live-output="true"
                    className="min-w-0 max-w-full space-y-2 rounded-md border border-border p-3"
                >
                    <div className="text-sm font-medium">{t('agent.canonical.role.agent')}</div>
                    <CanonicalAcceptedOutput fragment={item.output.fragment} {...options} />
                </article>
            ))}
            {outsideHistory.length > 0 && (
                <section
                    data-canonical-outside-history="true"
                    className="space-y-3 rounded-md border border-border p-3"
                >
                    <MessageBox status="info">{t('agent.canonical.outsideHistory')}</MessageBox>
                    {outsideHistory.map((item) => (
                        <article key={item.envelope.receipt.id} className="space-y-2">
                            <div className="text-sm font-medium">{t('agent.canonical.role.agent')}</div>
                            <CanonicalAcceptedOutput fragment={item.output.fragment} {...options} />
                        </article>
                    ))}
                </section>
            )}
            {live.status === 'error' && <MessageBox status="info">{t('agent.canonical.liveUnavailable')}</MessageBox>}
            {draftSnapshot.length > 0 && !covered.has(live.draft_turn_id ?? '') && (
                <div
                    data-canonical-live-draft="true"
                    className="min-w-0 max-w-full [&_pre]:break-words [&_pre]:[overflow-wrap:anywhere]"
                >
                    <div className="text-sm text-muted-foreground">{t('agent.canonical.draft')}</div>
                    <CanonicalAgentDraft snapshot={draftSnapshot} />
                </div>
            )}
        </div>
    );
}
