import type { Plan } from '@vertesia/common';
import { Button, Center, cn } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { CheckCircle, ChevronLeft, ChevronRight, Circle, ClipboardList, Clock } from 'lucide-react';
import React from 'react';

interface InlinePlanPanelProps {
    plan: Plan;
    workstreamStatus: Map<string, 'pending' | 'in_progress' | 'completed'>;
    isOpen: boolean;
    onClose: () => void;
    plans?: Array<{ plan: Plan; timestamp: number }>;
    activePlanIndex?: number;
    onChangePlan?: (index: number) => void;
}

function InlineSlidingPlanPanelComponent({
    plan,
    workstreamStatus,
    isOpen,
    onClose: _onClose,
    plans = [],
    activePlanIndex = 0,
    onChangePlan = () => {},
}: InlinePlanPanelProps) {
    const { t } = useUITranslation();

    // Don't render if panel is closed
    if (!isOpen) {
        return null;
    }

    const planTasks = plan.plan || [];
    const totalTasks = planTasks.length;
    const completedTasks = planTasks.reduce((count, task) => {
        if (!task?.id) return count;
        return workstreamStatus.get(task.id.toString()) === 'completed' || task.status === 'completed'
            ? count + 1
            : count;
    }, 0);
    const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const activeRevisionNumber = plans.length > 0 ? plans.length - activePlanIndex : 1;
    const activeRevisionTimestamp = plans[activePlanIndex]?.timestamp;

    if (planTasks.length === 0) {
        return (
            <div className="h-full overflow-hidden">
                <Center className="h-full min-h-[240px] flex-col text-center text-muted">
                    <ClipboardList className="mb-2 size-8" />
                    <span className="text-sm">{t('agent.noPlanAvailable')}</span>
                </Center>
            </div>
        );
    }

    // Render the normal panel
    return (
        <div className="h-full overflow-hidden">
            <div className="flex h-full flex-col gap-4 overflow-y-auto px-2 py-3">
                <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="text-sm font-medium text-foreground">{t('agent.taskProgress')}</div>
                            <div className="text-xs text-muted">
                                {t('agent.tasksCompleted', { completed: completedTasks, total: totalTasks })}
                            </div>
                        </div>

                        {plans.length > 1 && (
                            <div className="flex shrink-0 items-center gap-1 text-xs text-muted">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-7"
                                    onClick={() => onChangePlan(Math.min(plans.length - 1, activePlanIndex + 1))}
                                    disabled={activePlanIndex >= plans.length - 1}
                                    aria-label={t('agent.olderPlan')}
                                    title={t('agent.olderPlan')}
                                >
                                    <ChevronLeft className="size-4" aria-hidden="true" />
                                </Button>
                                <div className="min-w-20 text-center">
                                    <div className="font-medium text-foreground">
                                        {activeRevisionNumber}/{plans.length}
                                    </div>
                                    <div className="truncate">
                                        {activeRevisionTimestamp
                                            ? new Date(activeRevisionTimestamp).toLocaleTimeString()
                                            : t('agent.unknownTime')}
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-7"
                                    onClick={() => onChangePlan(Math.max(0, activePlanIndex - 1))}
                                    disabled={activePlanIndex <= 0}
                                    aria-label={t('agent.newerPlan')}
                                    title={t('agent.newerPlan')}
                                >
                                    <ChevronRight className="size-4" aria-hidden="true" />
                                </Button>
                            </div>
                        )}
                    </div>
                    <div
                        className="h-2 overflow-hidden rounded-full bg-mixer-muted/20"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={totalTasks}
                        aria-valuenow={completedTasks}
                        aria-label={t('agent.taskProgress')}
                    >
                        <div
                            className="h-full rounded-full bg-success transition-all duration-300"
                            style={{ width: `${progressPercentage}%` }}
                        />
                    </div>
                </div>

                <ol className="divide-y divide-border/60">
                    {planTasks.map((task, index) => {
                        const taskId = task.id ? task.id.toString() : `task-${index}`;
                        const taskGoal = task.goal || `Task ${index + 1}`;
                        const taskKey = task.id
                            ? `task-${task.id.toString()}`
                            : `task-${taskGoal}-${task.status || 'pending'}`;

                        let status: 'pending' | 'in_progress' | 'completed' | 'skipped' = task.status || 'pending';
                        if (workstreamStatus.has(taskId)) {
                            // biome-ignore lint/style/noNonNullAssertion: intentional non-null assertion; TS can't prove narrowing here
                            status = workstreamStatus.get(taskId)!;
                        }

                        let StatusIcon = Circle;
                        let statusColor = 'text-muted';
                        if (status === 'in_progress') {
                            StatusIcon = Clock;
                            statusColor = 'text-info';
                        } else if (status === 'completed') {
                            StatusIcon = CheckCircle;
                            statusColor = 'text-success';
                        }

                        const statusLabel =
                            status === 'completed'
                                ? t('agent.completed')
                                : status === 'in_progress'
                                  ? t('agent.inProgress')
                                  : t('agent.pending');

                        return (
                            <li
                                key={taskKey}
                                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-1 py-3"
                            >
                                <span className="mt-0.5 min-w-5 text-center text-xs font-medium tabular-nums text-muted/80">
                                    {taskId}
                                </span>
                                <span className="min-w-0 text-sm leading-5 text-foreground/85">{taskGoal}</span>
                                <span className={cn('flex items-center gap-1.5 text-xs font-medium', statusColor)}>
                                    <StatusIcon className="size-3.5 shrink-0" aria-hidden="true" />
                                    <span>{statusLabel}</span>
                                </span>
                            </li>
                        );
                    })}
                </ol>

                {(() => {
                    const planTaskIds = new Set(planTasks.filter((task) => task?.id).map((task) => task.id.toString()));
                    const workstreamEntries = Array.from(workstreamStatus.entries()).filter(
                        ([id]) => id !== 'main' && !planTaskIds.has(id),
                    );

                    return workstreamEntries.length > 0 ? (
                        <div className="mt-1 px-1 py-2">
                            <div className="mb-2 text-xs font-medium text-muted">{t('agent.workstreams')}</div>
                            <div className="divide-y divide-border/60">
                                {workstreamEntries.map(([id, status]) => {
                                    let StatusIcon = Circle;
                                    let statusColor = 'text-muted';
                                    let statusText = t('agent.pending');

                                    if (status === 'in_progress') {
                                        StatusIcon = Clock;
                                        statusColor = 'text-info';
                                        statusText = t('agent.inProgress');
                                    } else if (status === 'completed') {
                                        StatusIcon = CheckCircle;
                                        statusColor = 'text-success';
                                        statusText = t('agent.completed');
                                    }

                                    return (
                                        <div key={id} className="flex items-center gap-2 py-2">
                                            <StatusIcon className={cn('size-3.5 shrink-0', statusColor)} />
                                            <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground/80">
                                                {id}
                                            </span>
                                            <span className="text-xs font-medium text-muted">{statusText}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : null;
                })()}
            </div>
        </div>
    );
}

const InlineSlidingPlanPanel = React.memo(InlineSlidingPlanPanelComponent);

export default InlineSlidingPlanPanel;
