import { Button, cn, Slider } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import type { TemporalGraphGroup, TemporalTimelineMarker } from '@vertesia/ui/widgets';
import { SkipForward } from 'lucide-react';
import type { MemoryEntry } from './memoryGraphModel.js';

export interface MemoryGraphRailProps {
    /** Sorted belief-time stops. Empty when the corpus carries no dated statement. */
    stops: string[];
    asOfIndex: number;
    onAsOfIndexChange: (index: number) => void;
    /** Episodic memory entries placed on the scrubber track. */
    episodes: TemporalTimelineMarker<MemoryEntry>[];
    knownEdgeCount: number;
    totalEdgeCount: number;
    predicates: string[];
    activePredicates: string[];
    onTogglePredicate: (predicate: string) => void;
    onClearPredicates: () => void;
    groups: Record<string, Required<TemporalGraphGroup>>;
}

function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="mt-5 first:mt-0">
            <h3 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">{title}</h3>
            <div className="mt-2">{children}</div>
        </section>
    );
}

export function MemoryGraphRail({
    stops,
    asOfIndex,
    onAsOfIndexChange,
    episodes,
    knownEdgeCount,
    totalEdgeCount,
    predicates,
    activePredicates,
    onTogglePredicate,
    onClearPredicates,
    groups,
}: MemoryGraphRailProps) {
    const { t } = useUITranslation();
    const lastIndex = Math.max(stops.length - 1, 0);
    const asOf = stops[asOfIndex];
    const knownEpisodes = asOf ? episodes.filter((episode) => episode.date <= asOf).length : episodes.length;

    return (
        <aside className="overflow-y-auto rounded-lg border bg-card p-3">
            <RailSection title={t('memoryGraph.timeMachine')}>
                {stops.length === 0 ? (
                    <p className="text-xs text-muted">{t('memoryGraph.noTimeline')}</p>
                ) : (
                    <div className="rounded-lg border bg-background p-3">
                        <div className="font-mono text-[15px] text-attention">{asOf}</div>
                        <div className="mt-0.5 font-mono text-[10px] text-muted">
                            {t('memoryGraph.statementsKnown', { known: knownEdgeCount, total: totalEdgeCount })}
                        </div>
                        <Slider
                            className="mt-3"
                            aria-label={t('memoryGraph.asOfLabel')}
                            min={0}
                            max={lastIndex}
                            step={1}
                            value={[Math.min(asOfIndex, lastIndex)]}
                            onValueChange={([next]) => onAsOfIndexChange(next ?? lastIndex)}
                        />
                        {episodes.length > 0 ? (
                            <div className="relative mt-2 h-4">
                                {episodes.map((episode) => (
                                    <button
                                        // Not a <Button>: this is a 8px diamond positioned on the
                                        // scrubber track, and the variant paddings would swallow it.
                                        type="button"
                                        key={episode.id}
                                        aria-label={t('memoryGraph.episodeAria', {
                                            date: episode.date,
                                            title: episode.label,
                                        })}
                                        title={`${episode.date} · ${episode.label}`}
                                        onClick={() => onAsOfIndexChange(episode.stopIndex)}
                                        className={cn(
                                            'absolute top-1 size-2 border transition-colors',
                                            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring',
                                            asOf && episode.date <= asOf
                                                ? 'border-attention bg-attention'
                                                : 'border-muted bg-transparent hover:border-attention',
                                        )}
                                        style={{
                                            insetInlineStart: `${episode.ratio * 100}%`,
                                            transform: 'translateX(-50%) rotate(45deg)',
                                        }}
                                    />
                                ))}
                            </div>
                        ) : null}
                        <div className="mt-1 font-mono text-[10px] text-muted">
                            {t('memoryGraph.episodesCount', { known: knownEpisodes, total: episodes.length })}
                        </div>
                        <Button
                            variant="outline"
                            size="xs"
                            className="mt-3 w-full justify-center"
                            onClick={() => onAsOfIndexChange(lastIndex)}
                            isDisabled={asOfIndex >= lastIndex}
                        >
                            <SkipForward className="size-3" aria-hidden={true} />
                            {t('memoryGraph.jumpToNow')}
                        </Button>
                    </div>
                )}
            </RailSection>

            <RailSection title={t('memoryGraph.predicates')}>
                <div className="flex flex-wrap gap-1.5">
                    <Button
                        variant={activePredicates.length === 0 ? 'secondary' : 'ghost'}
                        size="xs"
                        onClick={onClearPredicates}
                    >
                        {t('memoryGraph.allPredicates')}
                    </Button>
                    {predicates.map((predicate) => (
                        <Button
                            key={predicate}
                            variant={activePredicates.includes(predicate) ? 'secondary' : 'ghost'}
                            size="xs"
                            aria-pressed={activePredicates.includes(predicate)}
                            onClick={() => onTogglePredicate(predicate)}
                        >
                            {predicate.replaceAll('_', ' ')}
                        </Button>
                    ))}
                </div>
            </RailSection>

            <RailSection title={t('memoryGraph.groups')}>
                <ul className="flex flex-col gap-1.5 text-xs text-muted">
                    {Object.entries(groups).map(([key, group]) => (
                        <li key={key} className="flex items-center gap-2">
                            <span
                                className="size-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: group.color }}
                                aria-hidden={true}
                            />
                            {group.label}
                        </li>
                    ))}
                </ul>
            </RailSection>

            <RailSection title={t('memoryGraph.edgeConfidence')}>
                <ul className="flex flex-col gap-2 text-xs text-muted">
                    <li className="flex items-center gap-2">
                        <span className="h-0 w-6 shrink-0 border-t-2 border-muted" aria-hidden={true} />
                        {t('memoryGraph.legendExplicit')}
                    </li>
                    <li className="flex items-center gap-2">
                        <span className="h-0 w-6 shrink-0 border-t-2 border-dashed border-muted" aria-hidden={true} />
                        {t('memoryGraph.legendInference')}
                    </li>
                    <li className="flex items-center gap-2">
                        <span
                            className="h-0 w-6 shrink-0 border-t-2 border-dotted border-muted opacity-40"
                            aria-hidden={true}
                        />
                        {t('memoryGraph.legendExpired')}
                    </li>
                </ul>
            </RailSection>
        </aside>
    );
}
