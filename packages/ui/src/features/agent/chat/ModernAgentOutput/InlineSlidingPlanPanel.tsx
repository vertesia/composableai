import { Plan } from "@vertesia/common";
import { Badge, Button, cn } from "@vertesia/ui/core";
import { AlertCircle, CheckCircle, Circle, Clock, X } from "lucide-react";
import React from "react";

interface InlinePlanPanelProps {
  plan: Plan;
  workstreamStatus: Map<string, "pending" | "in_progress" | "completed">;
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
  onClose,
  plans = [],
  activePlanIndex = 0,
  onChangePlan = () => { },
}: InlinePlanPanelProps) {
  // Don't render if panel is closed
  if (!isOpen) {
    return null;
  }

  // Render the normal panel
  return (
    <div className="h-full shadow-xl border border-muted/20 overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-muted/20">
        <h3 className="font-bold text-base">
          Plan
        </h3>
        <Button variant={"ghost"} onClick={onClose} >
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </Button>
      </div>
      <div
        className="p-3 overflow-y-auto"
        style={{
          height: "calc(100% - 44px)",
          maxHeight: "calc(100vh - 150px)",
        }}
      >
        {/* Plan Summary - count only tasks, excluding main workstream */}
        <div className="mb-3 p-2 bg-info rounded-md border border-info">
          <div className="text-xs font-medium text-info mb-1">
            Task Progress
          </div>
          <div className="flex items-center gap-2">
            {/* Calculate progress based on plan tasks, regardless of workstream */}
            {(() => {
              // Get all tasks from the plan itself
              const planTasks = plan.plan || [];
              const totalTasks = planTasks.length;

              // Count completed tasks by checking their status in workstreamStatus
              let completedTasks = 0;

              if (totalTasks > 0) {
                // Count each completed task from the plan
                planTasks.forEach((task) => {
                  if (task && task.id) {
                    const taskId = task.id.toString();
                    const taskStatus = workstreamStatus.get(taskId);

                    if (taskStatus === "completed") {
                      completedTasks++;
                    }
                  }
                });
              }

              // Calculate percentage
              const progressPercentage =
                totalTasks > 0
                  ? Math.round((completedTasks / totalTasks) * 100)
                  : 0;

              return (
                <>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div
                      className="bg-info h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-foreground font-medium whitespace-nowrap">
                    {totalTasks > 0 ? `${completedTasks}/${totalTasks}` : "0/0"}
                  </span>
                </>
              );
            })()}
          </div>
        </div>

        {/* Plan selector - only shown when multiple plans exist */}
        {plans.length > 1 && (
          <div className="mb-3 flex items-center justify-between">
            <Button variant={"ghost"}
              onClick={() =>
                onChangePlan(Math.min(plans.length - 1, activePlanIndex + 1))
              }
              disabled={activePlanIndex >= plans.length - 1}
            >
              Older Plan
            </Button>
            <div className="text-xs text-muted">
              {plans[activePlanIndex]?.timestamp
                ? new Date(
                  plans[activePlanIndex].timestamp,
                ).toLocaleTimeString()
                : "Unknown time"}
            </div>
            <Button variant={"ghost"}
              onClick={() => onChangePlan(Math.max(0, activePlanIndex - 1))}
              disabled={activePlanIndex <= 0}
            >
              Newer Plan
            </Button>
          </div>
        )}

        {/* Detailed Plan Steps */}
        <div className="rounded-md border border-muted/30">
          <div className="p-2 border-b border-muted/30 bg-muted">
            <div className="font-medium text-xs">Step-by-Step Plan</div>
          </div>

          <div className="divide-y divide-muted/20 max-h-[calc(100vh-350px)] overflow-y-auto">
            {plan.plan && plan.plan.length > 0 ? (
              plan.plan.map((task, index) => {
                // Extract task info with null checks
                const taskId = task.id ? task.id.toString() : `task-${index}`;
                const taskGoal = task.goal || `Task ${index + 1}`;

                // Determine task status - use task.status if available or lookup from workstream
                let status:
                  | "pending"
                  | "in_progress"
                  | "completed"
                  | "skipped" = task.status || "pending";
                if (workstreamStatus.has(taskId)) {
                  status = workstreamStatus.get(taskId)!;
                }

                // Determine status icon and style
                let StatusIcon = Circle;
                let statusColor = "text-muted";

                if (status === "in_progress") {
                  StatusIcon = Clock;
                  statusColor = "text-info";
                } else if (status === "completed") {
                  StatusIcon = CheckCircle;
                  statusColor = "text-success";
                }

                return (
                  <div key={index} className="flex p-3 my-1">
                    <div className={`mr-2 mt-0.5 flex-shrink-0 text-muted`}>
                      {taskId}
                    </div>
                    <div className="w-full">
                      <div className="text-sm font-medium mb-2 text-muted">
                        {taskGoal}
                      </div>
                      <div className="mt-1 flex justify-end items-center">
                        <div className={`mr-2 mt-0.5 flex-shrink-0 ${statusColor}`}>
                          <StatusIcon className="size-3.5" />
                        </div>
                        <Badge variant={status === "completed" ? "success" : status === "in_progress" ? "info" : "default"}>
                          {status === "completed"
                            ? "Completed"
                            : status === "in_progress"
                              ? "In Progress"
                              : "Pending"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-3 text-center text-muted italic">
                <AlertCircle className="size-4 mx-auto mb-2 text-attention" />
                <p className="text-xs">No plan has been detected yet</p>
                <p className="text-xs mt-1">
                  Plans will appear here when the agent creates one
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Workstream Status Summary - excluding main and task IDs from the plan */}
        {(() => {
          // Get all task IDs from the plan for filtering
          const planTaskIds = new Set(
            (plan.plan || [])
              .filter((task) => task && task.id)
              .map((task) => task.id.toString()),
          );

          // Filter out 'main' workstream and any IDs that are tasks in the plan
          const workstreamEntries = Array.from(
            workstreamStatus.entries(),
          ).filter(([id]) => id !== "main" && !planTaskIds.has(id));

          // Only show the section if there are actual workstreams (not tasks or main)
          return workstreamEntries.length > 0 ? (
            <div className="mt-3 rounded-md border border-gray-200 dark:border-gray-800">
              <div className="p-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                <div className="font-medium text-xs">Workstreams</div>
              </div>
              <div className="p-3">
                <div className="grid grid-cols-1 gap-2">
                  {workstreamEntries.map(([id, status]) => {
                    let StatusIcon = Circle;
                    let statusColor = "text-gray-400";
                    let statusBg = "bg-gray-100 dark:bg-gray-800";
                    let statusText = "Pending";

                    if (status === "in_progress") {
                      StatusIcon = Clock;
                      statusColor = "text-info";
                      statusBg = "bg-info/20";
                      statusText = "In Progress";
                    } else if (status === "completed") {
                      StatusIcon = CheckCircle;
                      statusColor = "text-success";
                      statusBg = "bg-success/20";
                      statusText = "Completed";
                    }

                    return (
                      <div
                        key={id}
                        className={cn("flex items-center p-1.5 rounded", statusBg)}
                      >
                        <div className={`mr-1.5 ${statusColor}`}>
                          <StatusIcon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1">
                          <span className="text-xs font-medium text-gray-800 dark:text-gray-300">
                            {id}
                          </span>
                        </div>
                        <span className="text-xs font-medium">
                          {statusText}
                        </span>
                      </div>
                    );
                  })}
                </div>
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
