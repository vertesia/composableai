import { Plan } from "@vertesia/common";
import { AlertCircle, CheckCircle, Circle, Clock } from "lucide-react";

interface PlanPanelProps {
    plan: Plan;
    workstreamStatus: Map<string, "pending" | "in_progress" | "completed">;
    isVisible: boolean;
}

// todo: remove this file
export default function PlanPanel({ plan, workstreamStatus, isVisible }: PlanPanelProps) {
    if (!isVisible) return null;

    return (
        <div className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-3 shadow-sm transition-all duration-300 ease-in-out transform">
            <div className="text-xs font-medium mb-2 text-gray-800 dark:text-gray-200">Agent Plan</div>

            {/* Plan Steps */}
            {plan.plan && plan.plan.length > 0 ? (
                <div className="space-y-1.5">
                    {plan.plan.map((task, index) => {
                        // Extract task info
                        const taskId = task.id.toString();
                        const taskGoal = task.goal;

                        // Determine task status - use task.status if available or lookup from workstream
                        let status: "pending" | "in_progress" | "completed" | "skipped" = task.status || "pending";
                        if (workstreamStatus.has(taskId)) {
                            status = workstreamStatus.get(taskId)!;
                        }

                        // Determine status icon and style
                        let StatusIcon = Circle;
                        let statusColor = "text-gray-400";

                        if (status === "in_progress") {
                            StatusIcon = Clock;
                            statusColor = "text-blue-500";
                        } else if (status === "completed") {
                            StatusIcon = CheckCircle;
                            statusColor = "text-green-500";
                        }

                        return (
                            <div key={index} className="flex items-start">
                                <div className={`mr-1.5 mt-0.5 ${statusColor}`}>
                                    <StatusIcon className="h-3.5 w-3.5" />
                                </div>
                                <div className="text-xs">
                                    <span className="text-gray-700 dark:text-gray-300">{taskGoal}</span>
                                    <span className="ml-1 bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-[10px] font-mono">
                                        {taskId}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-xs text-gray-500 dark:text-gray-400 italic flex items-center">
                    <AlertCircle className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
                    No plan detected yet
                </div>
            )}

            {/* Workstream Status Summary */}
            {workstreamStatus.size > 1 && (
                <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-xs font-medium mb-1.5 text-gray-800 dark:text-gray-200">Workstreams</div>
                    <div className="grid grid-cols-2 gap-1.5">
                        {Array.from(workstreamStatus.entries())
                            // Filter to only show real workstreams (main or those with valid names - not numeric IDs)
                            .filter(([id, _]) => {
                                // Always show 'main' workstream
                                if (id === "main") return true;

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
                                let statusColor = "text-gray-400";
                                let statusText = "Pending";

                                if (status === "in_progress") {
                                    StatusIcon = Clock;
                                    statusColor = "text-blue-500";
                                    statusText = "In Progress";
                                } else if (status === "completed") {
                                    StatusIcon = CheckCircle;
                                    statusColor = "text-green-500";
                                    statusText = "Completed";
                                }

                                // Format workstream IDs for better display
                                const displayId = id === "main" ? "Main" : id;

                                return (
                                    <div key={id} className="flex items-center">
                                        <div className={`mr-1.5 ${statusColor}`}>
                                            <StatusIcon className="h-3 w-3" />
                                        </div>
                                        <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">
                                            {displayId}
                                        </span>
                                        <span className="text-[10px] text-gray-500 dark:text-gray-500 ml-1">
                                            {statusText}
                                        </span>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}
        </div>
    );
}
