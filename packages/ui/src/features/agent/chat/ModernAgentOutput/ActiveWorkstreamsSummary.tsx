import { Button, cn } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { Bot, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import {
    formatWorkstreamName,
    getWorkstreamDisplayName,
    getWorkstreamStatusClass,
    type WorkstreamInfo,
} from '../workstreams.js';

interface ActiveWorkstreamsSummaryProps {
    activeWorkstreams: WorkstreamInfo[];
    onSelectWorkstream?: (workstreamId: string) => void;
    className?: string;
}

const COLLAPSED_WORKSTREAM_COUNT = 3;

export function ActiveWorkstreamsSummary({
    activeWorkstreams,
    onSelectWorkstream,
    className,
}: ActiveWorkstreamsSummaryProps) {
    const { t } = useUITranslation();
    const [isExpanded, setIsExpanded] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const listId = useId();
    const runningWorkstreams = useMemo(
        () => activeWorkstreams.filter((ws) => ws.status === 'running' || ws.status === 'canceling'),
        [activeWorkstreams],
    );
    const visibleRunningWorkstreams = isExpanded
        ? runningWorkstreams
        : runningWorkstreams.slice(0, COLLAPSED_WORKSTREAM_COUNT);
    const hiddenRunningWorkstreamCount = Math.max(0, runningWorkstreams.length - visibleRunningWorkstreams.length);
    const canExpand = runningWorkstreams.length > COLLAPSED_WORKSTREAM_COUNT;

    useEffect(() => {
        if (!canExpand) {
            setIsExpanded(false);
        }
    }, [canExpand]);

    if (runningWorkstreams.length === 0) return null;

    return (
        <div className={cn('mx-auto mb-2 w-full max-w-3xl px-1', className)} data-agent-active-workstreams>
            <output
                className="flex flex-col gap-1.5 rounded-2xl border border-border/70 bg-background/95 p-2 text-xs text-muted shadow-lg shadow-black/5"
                aria-live="polite"
            >
                <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2 px-1 font-medium">
                        <Bot className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
                        <span className="truncate">
                            {t('agent.activeWorkstreams', { count: runningWorkstreams.length })}
                        </span>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        title={isCollapsed ? t('agent.showActiveWorkstreams') : t('agent.hideActiveWorkstreams')}
                    >
                        {isCollapsed ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                        {isCollapsed ? t('agent.showActiveWorkstreams') : t('agent.hideActiveWorkstreams')}
                    </Button>
                </div>
                {isCollapsed ? null : (
                    <>
                        <div id={listId} className="flex flex-col gap-0.5">
                            {visibleRunningWorkstreams.map((workstream) => {
                                const workstreamName = getWorkstreamDisplayName(
                                    workstream.workstream_id,
                                    workstream.interaction,
                                );
                                const content = (
                                    <>
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
                                    </>
                                );

                                return onSelectWorkstream ? (
                                    <Button
                                        key={workstream.launch_id || workstream.workstream_id}
                                        type="button"
                                        variant="ghost"
                                        className="h-auto min-w-0 justify-start gap-2 rounded-lg px-1 py-1 text-sm text-foreground/80"
                                        title={workstreamName}
                                        onClick={() => {
                                            setIsExpanded(false);
                                            onSelectWorkstream(workstream.workstream_id);
                                        }}
                                    >
                                        {content}
                                        <ChevronRight
                                            className="ms-auto size-3.5 shrink-0 rtl:rotate-180"
                                            aria-hidden="true"
                                        />
                                    </Button>
                                ) : (
                                    <div
                                        key={workstream.launch_id || workstream.workstream_id}
                                        className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 text-sm text-foreground/80"
                                        title={workstreamName}
                                    >
                                        {content}
                                    </div>
                                );
                            })}
                        </div>
                        {canExpand && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-fit shrink-0 gap-1 rounded-xl px-2.5 text-xs text-muted"
                                aria-expanded={isExpanded}
                                aria-controls={listId}
                                onClick={() => setIsExpanded((expanded) => !expanded)}
                            >
                                {!isExpanded && <span>+{hiddenRunningWorkstreamCount}</span>}
                                {isExpanded ? t('agent.showLess') : t('agent.showMore')}
                                <ChevronDown
                                    className={cn('size-3.5 transition-transform', isExpanded && 'rotate-180')}
                                    aria-hidden="true"
                                />
                            </Button>
                        )}
                    </>
                )}
            </output>
        </div>
    );
}
