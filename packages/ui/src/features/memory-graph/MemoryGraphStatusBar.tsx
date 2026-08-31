import { cn } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { formatModelName, type MemoryBrain } from './memoryBrainModel.js';

export interface MemoryGraphStatusBarProps {
    brain?: MemoryBrain;
    /** ISO instant of the last successful load, or `undefined` while nothing has loaded. */
    loadedAt?: string;
    isLoading: boolean;
    pollIntervalMs: number;
    entityCount: number;
    statementCount: number;
    memoryCount: number;
    sourceCount: number;
    evidenceCoverage?: number;
}

function Segment({ label, value, className }: { label: string; value: string; className?: string }) {
    return (
        <span className={cn('flex shrink-0 items-center gap-1.5 whitespace-nowrap', className)}>
            <span className="text-muted">{label}</span>
            <span className="text-foreground">{value}</span>
        </span>
    );
}

export function MemoryGraphStatusBar({
    brain,
    loadedAt,
    isLoading,
    pollIntervalMs,
    entityCount,
    statementCount,
    memoryCount,
    sourceCount,
    evidenceCoverage,
}: MemoryGraphStatusBarProps) {
    const { t } = useUITranslation();
    const partition = brain?.partitionField
        ? `${brain.partitionInterval ?? '—'} · ${
              brain.partitionOrder === 'descending' ? t('memoryGraph.newestFirst') : t('memoryGraph.oldestFirst')
          }`
        : undefined;

    return (
        <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-3 py-1.5 font-mono text-[10.5px]">
            <span className="flex shrink-0 items-center gap-1.5">
                <span
                    className={cn(
                        'size-1.5 rounded-full',
                        isLoading ? 'bg-info motion-safe:animate-pulse' : 'bg-success',
                    )}
                    aria-hidden={true}
                />
                <span className="text-foreground">{brain?.displayName ?? '—'}</span>
            </span>
            {brain ? <Segment label={t('memoryGraph.model')} value={formatModelName(brain.model)} /> : null}
            {brain?.reasoningEffort ? <Segment label={t('memoryGraph.effort')} value={brain.reasoningEffort} /> : null}
            {brain?.generation ? <Segment label={t('memoryGraph.generation')} value={brain.generation} /> : null}
            {partition ? <Segment label={t('memoryGraph.partition')} value={partition} /> : null}
            <Segment label={t('memoryGraph.entities')} value={String(entityCount)} />
            <Segment label={t('memoryGraph.statements')} value={String(statementCount)} />
            <Segment label={t('memoryGraph.memories')} value={String(memoryCount)} />
            <Segment label={t('memoryGraph.sources')} value={String(sourceCount)} />
            {evidenceCoverage !== undefined ? (
                <Segment
                    label={t('memoryGraph.evidenceCoverage')}
                    value={`${evidenceCoverage}%`}
                    className="text-attention"
                />
            ) : null}
            <span className="ms-auto shrink-0 whitespace-nowrap text-muted">
                {pollIntervalMs > 0
                    ? t('memoryGraph.autoRefresh', { seconds: Math.round(pollIntervalMs / 1000) })
                    : t('memoryGraph.autoRefreshOff')}
                {' · '}
                {loadedAt ? new Date(loadedAt).toLocaleTimeString() : t('memoryGraph.notLoaded')}
            </span>
        </footer>
    );
}
