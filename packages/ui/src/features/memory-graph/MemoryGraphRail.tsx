import { Button, cn, Slider, VTooltip } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import type { TemporalGraphGroup, TemporalTimelineMarker } from '@vertesia/ui/widgets';
import { CalendarOff, SkipForward } from 'lucide-react';
import type { MemoryEntry, MemoryTimeAxis } from './memoryGraphModel.js';

export interface MemoryGraphRailProps {
    /** Sorted stops on the active axis. Empty when no record carries a date for it. */
    stops: string[];
    /** Which time axis the scrubber walks. */
    timeAxis: MemoryTimeAxis;
    onTimeAxisChange: (axis: MemoryTimeAxis) => void;
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

function RailSection({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
    return (
        <section className="mt-4 first:mt-0">
            <div className="flex items-baseline justify-between gap-2 border-b pb-1">
                <h3 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">{title}</h3>
                {count !== undefined ? (
                    <span className="font-mono text-[10px] tabular-nums text-muted">{count}</span>
                ) : null}
            </div>
            <div className="mt-2">{children}</div>
        </section>
    );
}

/**
 * Which of the record's two dates the scrubber walks.
 *
 * Labelled in plain language, because "bitemporal" is not what a reader is thinking; the field
 * names an operator debugs against stay one hover away.
 */
function TimeAxisToggle({ axis, onChange }: { axis: MemoryTimeAxis; onChange: (axis: MemoryTimeAxis) => void }) {
    const { t } = useUITranslation();
    const options: { value: MemoryTimeAxis; label: string; fields: string }[] = [
        { value: 'valid', label: t('memoryGraph.axisValid'), fields: 'valid_from → valid_to' },
        { value: 'observed', label: t('memoryGraph.axisObserved'), fields: 'observed_at' },
    ];
    return (
        <fieldset className="mb-2 flex gap-1" aria-label={t('memoryGraph.timeAxisLabel')}>
            {options.map((option) => (
                <VTooltip key={option.value} description={option.fields} asChild>
                    <Button
                        variant={axis === option.value ? 'secondary' : 'ghost'}
                        size="xs"
                        className="flex-1 justify-center"
                        aria-pressed={axis === option.value}
                        onClick={() => onChange(option.value)}
                    >
                        {option.label}
                    </Button>
                </VTooltip>
            ))}
        </fieldset>
    );
}

export function MemoryGraphRail({
    stops,
    timeAxis,
    onTimeAxisChange,
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
    const groupEntries = Object.entries(groups);

    return (
        // The time machine is pinned: only the legends below it scroll, so a corpus with a dozen
        // groups can never push the scrubber and its episode markers out of view.
        <aside className="flex min-h-0 flex-col rounded-lg border bg-card">
            <div className="shrink-0 p-3">
                <RailSection title={t('memoryGraph.timeMachine')}>
                    {/* Rendered above the empty state too: an axis with no stop is exactly when the
                        user needs to be able to switch to the other one. */}
                    <TimeAxisToggle axis={timeAxis} onChange={onTimeAxisChange} />
                    {stops.length === 0 ? (
                        <div className="rounded-lg border border-dashed bg-background px-3 py-4 text-center">
                            <CalendarOff className="mx-auto size-4 text-muted" aria-hidden={true} />
                            <p className="mt-2 text-xs font-medium text-foreground">{t('memoryGraph.noTimeline')}</p>
                            <p className="mt-1 text-[11px] leading-relaxed text-muted">
                                {timeAxis === 'valid'
                                    ? t('memoryGraph.noTimelineHintValid')
                                    : t('memoryGraph.noTimelineHintObserved')}
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-lg border bg-background p-2.5">
                            <div className="font-mono text-[15px] tabular-nums text-attention">{asOf}</div>
                            <div className="mt-0.5 font-mono text-[10px] tabular-nums text-muted">
                                {timeAxis === 'valid'
                                    ? t('memoryGraph.statementsInForce', {
                                          known: knownEdgeCount,
                                          total: totalEdgeCount,
                                      })
                                    : t('memoryGraph.statementsKnown', {
                                          known: knownEdgeCount,
                                          total: totalEdgeCount,
                                      })}
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
                                                'absolute top-1 size-2 cursor-pointer border transition-colors',
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
                            <div className="mt-1 font-mono text-[10px] tabular-nums text-muted">
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
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
                <RailSection title={t('memoryGraph.predicates')} count={predicates.length}>
                    {predicates.length === 0 ? (
                        <p className="text-[11px] leading-relaxed text-muted">{t('memoryGraph.noPredicates')}</p>
                    ) : (
                        <div className="-me-1 flex max-h-40 flex-wrap gap-1 overflow-y-auto pe-1">
                            <Button
                                variant={activePredicates.length === 0 ? 'secondary' : 'ghost'}
                                size="xs"
                                aria-pressed={activePredicates.length === 0}
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
                    )}
                </RailSection>

                <RailSection title={t('memoryGraph.groups')} count={groupEntries.length}>
                    {groupEntries.length === 0 ? (
                        <p className="text-[11px] leading-relaxed text-muted">{t('memoryGraph.noGroups')}</p>
                    ) : (
                        <ul className="-me-1 flex max-h-44 flex-col gap-1 overflow-y-auto pe-1 text-[11px] text-muted">
                            {groupEntries.map(([key, group]) => (
                                <li key={key} className="flex items-center gap-2">
                                    <span
                                        className="size-2 shrink-0 rounded-full"
                                        style={{ backgroundColor: group.color }}
                                        aria-hidden={true}
                                    />
                                    <span className="truncate">{group.label}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </RailSection>

                <RailSection title={t('memoryGraph.edgeConfidence')}>
                    <ul className="flex flex-col gap-1.5 text-[11px] text-muted">
                        <li className="flex items-center gap-2">
                            <span className="h-0 w-6 shrink-0 border-t-2 border-muted" aria-hidden={true} />
                            {t('memoryGraph.legendExplicit')}
                        </li>
                        <li className="flex items-center gap-2">
                            <span
                                className="h-0 w-6 shrink-0 border-t-2 border-dashed border-muted"
                                aria-hidden={true}
                            />
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
            </div>
        </aside>
    );
}
