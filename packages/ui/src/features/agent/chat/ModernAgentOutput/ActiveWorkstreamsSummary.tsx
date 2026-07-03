import { cn } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { Bot } from 'lucide-react';
import { useMemo } from 'react';
import {
    formatWorkstreamName,
    getWorkstreamDisplayName,
    getWorkstreamStatusClass,
    type WorkstreamInfo,
} from '../workstreams.js';

interface ActiveWorkstreamsSummaryProps {
    activeWorkstreams: WorkstreamInfo[];
    className?: string;
}

export function ActiveWorkstreamsSummary({ activeWorkstreams, className }: ActiveWorkstreamsSummaryProps) {
    const { t } = useUITranslation();
    const runningWorkstreams = useMemo(
        () => activeWorkstreams.filter((ws) => ws.status === 'running' || ws.status === 'canceling'),
        [activeWorkstreams],
    );
    const visibleRunningWorkstreams = runningWorkstreams.slice(0, 3);
    const hiddenRunningWorkstreamCount = Math.max(0, runningWorkstreams.length - visibleRunningWorkstreams.length);

    if (runningWorkstreams.length === 0) return null;

    return (
        <div className={cn('mx-auto mb-2 w-full max-w-3xl px-1', className)} data-agent-active-workstreams>
            <output
                className="flex flex-col gap-1.5 rounded-2xl border border-border/70 bg-background/95 p-2 text-xs text-muted shadow-lg shadow-black/5"
                aria-live="polite"
            >
                <div className="flex items-center gap-2 px-1 font-medium">
                    <Bot className="size-3.5 text-muted" aria-hidden="true" />
                    <span>{t('agent.activeWorkstreams', { count: runningWorkstreams.length })}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                    {visibleRunningWorkstreams.map((workstream) => {
                        const workstreamName = getWorkstreamDisplayName(
                            workstream.workstream_id,
                            workstream.interaction,
                        );

                        return (
                            <span
                                key={workstream.launch_id || workstream.workstream_id}
                                className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 text-sm text-foreground/80"
                                title={workstreamName}
                            >
                                <span
                                    className={cn(
                                        'size-1.5 shrink-0 rounded-full',
                                        getWorkstreamStatusClass(workstream.status),
                                    )}
                                    aria-hidden="true"
                                />
                                <span className="truncate font-medium">{workstreamName}</span>
                                {workstream.phase && (
                                    <span className="truncate text-xs text-muted/75">
                                        {formatWorkstreamName(workstream.phase)}
                                    </span>
                                )}
                            </span>
                        );
                    })}
                    {hiddenRunningWorkstreamCount > 0 && (
                        <span className="px-1 py-1 text-xs text-muted">+{hiddenRunningWorkstreamCount}</span>
                    )}
                </div>
            </output>
        </div>
    );
}
