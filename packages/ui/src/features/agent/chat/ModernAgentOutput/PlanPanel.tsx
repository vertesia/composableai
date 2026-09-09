import type { Plan } from '@vertesia/common';
import { useUITranslation } from '@vertesia/ui/i18n';
import { AlertCircle, CheckCircle, Circle, Clock } from 'lucide-react';

interface PlanPanelProps {
    plan: Plan;
    workstreamStatus: Map<string, 'pending' | 'in_progress' | 'completed'>;
    isVisible: boolean;
}

// todo: remove this file
export default function PlanPanel({ plan, workstreamStatus, isVisible }: PlanPanelProps) {
    const { t } = useUITranslation();
    if (!isVisible) return null;

    return (
        <div className="border-b border-border bg-muted p-3 shadow-sm transition-all duration-300 ease-in-out transform">
            <div className="text-xs font-medium mb-2 text-foreground">{t('agent.agentPlan')}</div>

            {/* Plan Steps */}
            {plan.plan && plan.plan.length > 0 ? (
                <div className="space-y-1.5">
                    {plan.plan.map((task) => {
                        // Extract task info
                        const taskId = task.id.toString();
                        const taskGoal = task.goal;

                        // Determine task status - use task.status if available or lookup from workstream
                        let status: 'pending' | 'in_progress' | 'completed' | 'skipped' = task.status || 'pending';
                        const wsStatus = workstreamStatus.get(taskId);
                        if (wsStatus !== undefined) {
                            status = wsStatus;
                        }

                        // Determine status icon and style
                        let StatusIcon = Circle;
                        let statusColor = 'text-muted';

                        if (status === 'in_progress') {
                            StatusIcon = Clock;
                            statusColor = 'text-info';
                        } else if (status === 'completed') {
                            StatusIcon = CheckCircle;
                            statusColor = 'text-success';
                        }

                        return (
                            <div key={taskId} className="flex items-start">
                                <div className={`me-1.5 mt-0.5 ${statusColor}`}>
                                    <StatusIcon className="h-3.5 w-3.5" />
                                </div>
                                <div className="text-xs">
                                    <span className="text-foreground">{taskGoal}</span>
                                    <span className="ms-1 bg-muted px-1 py-0.5 rounded text-[10px] font-mono">
                                        {taskId}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-xs text-muted italic flex items-center">
                    <AlertCircle className="h-3.5 w-3.5 me-1.5 text-attention" />
                    {t('agent.noPlanDetected')}
                </div>
            )}

            {/* Workstream Status Summary */}
            {workstreamStatus.size > 1 && (
                <div className="mt-3 pt-2 border-t border-border">
                    <div className="text-xs font-medium mb-1.5 text-foreground">{t('agent.workstreams')}</div>
                    <div className="grid grid-cols-2 gap-1.5">
                        {Array.from(workstreamStatus.entries())
                            // Filter to only show real workstreams (main or those with valid names - not numeric IDs)
                            .filter(([id, _]) => {
                                // Always show 'main' workstream
                                if (id === 'main') return true;

                                // Don't show if it's a pure numeric ID (likely a task)
                                if (/^\d+$/.test(id)) return false;

                                // Don't show workstreams that are actually tasks (have matching IDs in plan)
                                if (plan?.plan) {
                                    const matchingTask = plan.plan.find((task) => task.id?.toString() === id);
                                    return !matchingTask; // Keep if no matching task found
                                }
                                return true;
                            })
                            .map(([id, status]) => {
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

                                // Format workstream IDs for better display
                                const displayId = id === 'main' ? t('agent.main') : id;

                                return (
                                    <div key={id} className="flex items-center">
                                        <div className={`me-1.5 ${statusColor}`}>
                                            <StatusIcon className="h-3 w-3" />
                                        </div>
                                        <span className="text-[10px] font-medium text-muted">{displayId}</span>
                                        <span className="text-[10px] text-muted ms-1">{statusText}</span>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}
        </div>
    );
}
