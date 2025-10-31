import { Plan } from "@vertesia/common";
import { AlertCircle, CheckCircle, Circle, Clock } from "lucide-react";
import SlideInPanel from "./SlideInPanel";

interface PlanPanelProps {
    plan?: Plan;
    workstreamStatus: Map<string, "pending" | "in_progress" | "completed">;
    isOpen: boolean;
    onClose: () => void;
}

export default function SlidingPlanPanel({ plan, workstreamStatus, isOpen, onClose }: PlanPanelProps) {
    return (
        plan && (
            <SlideInPanel isOpen={isOpen} onClose={onClose} title="Agent Plan">
                {/* Plan Summary */}
                <div className="mb-4 p-3 bg-info rounded-md border border-info">
                    <div className="text-sm font-medium text-info mb-1">Plan Progress</div>
                    <div className="flex items-center gap-2">
                        <div className="w-full bg-muted rounded-full h-2.5">
                            <div
                                className="bg-info h-2.5 rounded-full"
                                style={{
                                    width: `${plan.plan && plan.plan.length
                                        ? Math.round(
                                            (Array.from(workstreamStatus.values()).filter(
                                                (status) => status === "completed",
                                            ).length /
                                                Math.max(1, workstreamStatus.size)) *
                                            100,
                                        )
                                        : 0
                                        }%`,
                                }}
                            />
                        </div>
                        <span className="text-xs text-muted">
                            {plan.plan && plan.plan.length
                                ? `${Array.from(workstreamStatus.values()).filter((status) => status === "completed").length}/${workstreamStatus.size}`
                                : "0/0"}
                        </span>
                    </div>
                </div>

                {/* Detailed Plan Steps */}
                <div className="rounded-md border border-muted">
                    <div className="p-3 border-b border-muted bg-muted/50">
                        <div className="font-medium text-sm">Step-by-Step Plan</div>
                    </div>

                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {plan.plan && plan.plan.length > 0 ? (
                            plan.plan.map((task, index) => {
                                // Extract task info with null checks
                                const taskId = task.id ? task.id.toString() : `task-${index}`;
                                const taskGoal = task.goal || `Task ${index + 1}`;

                                // Determine task status - use task.status if available or lookup from workstream
                                let status: "pending" | "in_progress" | "completed" | "skipped" =
                                    task.status || "pending";
                                if (workstreamStatus.has(taskId)) {
                                    status = workstreamStatus.get(taskId)!;
                                }

                                // Determine status icon and style
                                let StatusIcon = Circle;
                                let statusColor = "text-gray-400";
                                let bgColor = "";

                                if (status === "in_progress") {
                                    StatusIcon = Clock;
                                    statusColor = "text-blue-500";
                                    bgColor = "bg-blue-50/50 dark:bg-blue-900/10";
                                } else if (status === "completed") {
                                    StatusIcon = CheckCircle;
                                    statusColor = "text-green-500";
                                }

                                return (
                                    <div key={index} className={`flex p-3 ${bgColor}`}>
                                        <div className={`mr-3 mt-0.5 flex-shrink-0 ${statusColor}`}>
                                            <StatusIcon className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <div className="text-sm text-gray-800 dark:text-gray-200">{taskGoal}</div>
                                            <div className="mt-1">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                                    {taskId}
                                                </span>
                                                <span
                                                    className={`ml-2 text-xs ${status === "completed"
                                                        ? "text-green-600 dark:text-green-400"
                                                        : status === "in_progress"
                                                            ? "text-blue-600 dark:text-blue-400"
                                                            : "text-gray-500 dark:text-gray-400"
                                                        }`}
                                                >
                                                    {status === "completed"
                                                        ? "Completed"
                                                        : status === "in_progress"
                                                            ? "In Progress"
                                                            : "Pending"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="p-4 text-center text-gray-500 dark:text-gray-400 italic">
                                <AlertCircle className="h-5 w-5 mx-auto mb-2 text-amber-500" />
                                <p>No plan has been detected yet</p>
                                <p className="text-xs mt-1">Plans will appear here when the agent creates one</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Workstream Status Summary */}
                {workstreamStatus.size > 1 && (
                    <div className="mt-4 rounded-md border border-gray-200 dark:border-gray-800">
                        <div className="p-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                            <div className="font-medium text-sm">Workstreams</div>
                        </div>
                        <div className="p-3">
                            <div className="grid grid-cols-1 gap-2">
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
                                        let statusBg = "bg-gray-100 dark:bg-gray-800";
                                        let statusText = "Pending";

                                        if (status === "in_progress") {
                                            StatusIcon = Clock;
                                            statusColor = "text-blue-500";
                                            statusBg = "bg-blue-100 dark:bg-blue-800/30";
                                            statusText = "In Progress";
                                        } else if (status === "completed") {
                                            StatusIcon = CheckCircle;
                                            statusColor = "text-green-500";
                                            statusBg = "bg-green-100 dark:bg-green-800/30";
                                            statusText = "Completed";
                                        }

                                        // Format workstream IDs for better display
                                        const displayId = id === "main" ? "Main Workstream" : id;

                                        return (
                                            <div key={id} className={`flex items-center p-2 rounded ${statusBg}`}>
                                                <div className={`mr-2 ${statusColor}`}>
                                                    <StatusIcon className="h-4 w-4" />
                                                </div>
                                                <div className="flex-1">
                                                    <span className="text-sm font-medium text-gray-800 dark:text-gray-300">
                                                        {displayId}
                                                    </span>
                                                </div>
                                                <span className="text-xs font-medium">{statusText}</span>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    </div>
                )}
            </SlideInPanel>
        )
    );
}
