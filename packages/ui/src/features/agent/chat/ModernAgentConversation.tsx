import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Cpu, SendIcon, XIcon } from "lucide-react";
import { useUserSession } from "@vertesia/ui/session";
import { AsyncExecutionResult, VertesiaClient } from "@vertesia/client";
import { AgentMessage, AgentMessageType, Plan, UserInputSignal } from "@vertesia/common";
import { Button, MessageBox, Spinner, useToast } from "@vertesia/ui/core";

import { AnimatedThinkingDots, PulsatingCircle } from "./AnimatedThinkingDots";
import AllMessagesMixed from "./ModernAgentOutput/AllMessagesMixed";
import Header from "./ModernAgentOutput/Header";
import MessageInput from "./ModernAgentOutput/MessageInput";
import { getWorkstreamId, insertMessageInTimeline, isInProgress } from "./ModernAgentOutput/utils";
import { ThinkingMessages } from "./WaitingMessages";
import InlineSlidingPlanPanel from "./ModernAgentOutput/InlineSlidingPlanPanel";

type StartWorkflowFn = (
    initialMessage?: string,
) => Promise<{ run_id: string; workflow_id: string } | undefined>;

interface ModernAgentConversationProps {
    run?: AsyncExecutionResult | { workflow_id: string; run_id: string };
    title?: string;
    interactive?: boolean;
    onClose?: () => void;
    isModal?: boolean;
    initialMessage?: string;
    startWorkflow?: StartWorkflowFn;
    startButtonText?: string;
    placeholder?: string;
    hideUserInput?: boolean;
    resetWorkflow?: () => void;
}

export function ModernAgentConversation(
    props: ModernAgentConversationProps,
) {
    const { run, startWorkflow } = props;

    if (run) {
        // If we have a run, convert it to AsyncExecutionResult format if needed
        const execRun: AsyncExecutionResult =
            "runId" in run
                ? run
                : {
                    runId: run.run_id,
                    workflowId: run.workflow_id,
                };
        return <ModernAgentConversationInner {...props} run={execRun} />;
    } else if (startWorkflow) {
        // If we have startWorkflow capability but no run yet
        return <StartWorkflowView {...props} />;
    } else {
        // Empty state
        return <EmptyState />;
    }
}

// Empty state when no agent is running
function EmptyState() {
    return (
        <MessageBox
            status="info"
            icon={<Bot className="size-16 text-muted mb-4" />}
        >
            <div className="text-base font-medium text-muted">
                No agent currently running
            </div>
            <div className="mt-3 text-sm text-muted">
                Select an interaction and click Start to start an agent
            </div>
        </MessageBox>
    );
}

// Start workflow view - allows initiating a new agent conversation
function StartWorkflowView({
    initialMessage,
    startWorkflow,
    onClose,
    isModal = false,
    placeholder = "Type your message...",
    startButtonText = "Start Agent",
    title = "Start New Conversation",
}: ModernAgentConversationProps) {
    const [inputValue, setInputValue] = useState<string>("");
    const [isSending, setIsSending] = useState(false);
    const [run, setRun] = useState<AsyncExecutionResult>();
    const toast = useToast();
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Focus the input field when component mounts
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    // Start a new workflow with the message
    const startWorkflowWithMessage = async () => {
        if (!startWorkflow) return;

        const message = inputValue.trim();
        if (!message || isSending) return;

        setIsSending(true);
        try {
            // Reset plan panel state when starting a new agent
            sessionStorage.removeItem("plan-panel-shown");

            toast({
                title: "Starting agent...",
                status: "info",
                duration: 3000,
            });
            const newRun = await startWorkflow(message);
            if (newRun) {
                setRun({
                    runId: newRun.run_id,
                    workflowId: newRun.workflow_id,
                });
                setInputValue("");
                toast({
                    title: "Agent started",
                    status: "success",
                    duration: 3000,
                });
            }
        } catch (err: any) {
            toast({
                title: "Error starting workflow",
                status: "error",
                duration: 3000,
                description: err instanceof Error ? err.message : "Unknown error",
            });
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            startWorkflowWithMessage();
        }
    };

    // If a run has been started, show the conversation
    if (run) {
        return (
            <ModernAgentConversationInner
                {...{ onClose, isModal, initialMessage, placeholder }}
                run={run}
                title={title}
            />
        );
    }

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 overflow-hidden border-0">
            {/* Header */}
            <div className="flex items-center justify-between py-2 px-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                <div className="flex items-center space-x-2">
                    <div className="p-1">
                        <Cpu className="size-3.5 text-muted" />
                    </div>
                    <span className="font-medium text-sm text-gray-700 dark:text-gray-300">
                        {title}
                    </span>
                </div>

                {/* Close button if needed */}
                {onClose && !isModal && (
                    <Button
                        size="xs"
                        variant="ghost"
                        onClick={onClose}
                        title="Close"
                        className="text-slate-500 hover:text-slate-700"
                    >
                        <XIcon className="size-4" />
                    </Button>
                )}
            </div>

            {/* Empty conversation area with instructions */}
            <div className="flex-1 overflow-y-auto px-4 py-6 bg-white dark:bg-gray-900 flex flex-col items-center justify-center">
                {initialMessage && (
                    <div className="px-4 py-3 mb-4 bg-blue-50/80 dark:bg-blue-900/30 border-l-2 border-blue-400 dark:border-blue-500 text-blue-700 dark:text-blue-300 max-w-md">
                        {initialMessage}
                    </div>
                )}

                <div className="bg-white dark:bg-slate-800 p-4 max-w-md border-l-2 border-blue-400 dark:border-blue-500">
                    <div className="text-base text-slate-600 dark:text-slate-300 font-medium">
                        Enter a message to start a conversation
                    </div>
                    <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                        Type your question below and press Enter or click {startButtonText}{" "}
                        to begin
                    </div>
                </div>
            </div>

            {/* Input Area */}
            <div className="py-3 px-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                <div className="flex items-center gap-2">
                    <div className="flex-1">
                        <input
                            ref={inputRef}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={placeholder}
                            disabled={isSending}
                            className="w-full py-2 px-3 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-gray-300 dark:focus:border-gray-600 focus:ring-0 rounded-md"
                        />
                    </div>
                    <Button
                        onClick={startWorkflowWithMessage}
                        disabled={!inputValue.trim() || isSending}
                        className="px-3 py-2 bg-gray-800 dark:bg-gray-700 hover:bg-gray-700 dark:hover:bg-gray-600 text-white text-xs rounded-md transition-colors"
                    >
                        {isSending ? (
                            <Spinner size="sm" className="mr-1.5" />
                        ) : (
                            <SendIcon className="size-3.5 mr-1.5" />
                        )}
                        {startButtonText}
                    </Button>
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
                    Type a message to start the conversation
                </div>
            </div>
        </div>
    );
}

// Inner component that handles the agent conversation - similar to ModernAgentOutput
function ModernAgentConversationInner({
    run,
    title,
    interactive = true,
    onClose,
    isModal = false,
    placeholder = "Type your message...",
    resetWorkflow,
}: ModernAgentConversationProps & { run: AsyncExecutionResult }) {
    const { client } = useUserSession();
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const [messages, setMessages] = useState<AgentMessage[]>([]);
    const [isCompleted, setIsCompleted] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [viewMode, setViewMode] = useState<"stacked" | "sliding">("sliding");
    const [showSlidingPanel, setShowSlidingPanel] = useState<boolean>(!isModal);
    // Keep track of multiple plans and their timestamps
    const [plans, setPlans] = useState<Array<{ plan: Plan; timestamp: number }>>(
        [],
    );
    // Track which plan is currently active in the UI
    const [activePlanIndex, setActivePlanIndex] = useState<number>(0);
    // Store workstream status for each plan separately
    const [workstreamStatusMap, setWorkstreamStatusMap] = useState<
        Map<
            number,
            Map<string, "pending" | "in_progress" | "completed" | "skipped">
        >
    >(new Map());
    const [thinkingMessageIndex, setThinkingMessageIndex] = useState(0);
    const toast = useToast();
    const [showInput, setShowInput] = useState(interactive);
    const [workflowStatus, setWorkflowStatus] = useState<string | null>(null);

    // Helper function to get the current active plan and its workstream status
    const getActivePlan = useMemo(() => {
        const currentPlanData = plans[activePlanIndex] || {
            plan: { plan: [] },
            timestamp: 0,
        };
        const currentWorkstreamStatus =
            workstreamStatusMap.get(currentPlanData.timestamp) || new Map();
        return {
            plan: currentPlanData.plan,
            workstreamStatus: currentWorkstreamStatus,
        };
    }, [plans, activePlanIndex, workstreamStatusMap]);

    // Show rotating thinking messages
    useEffect(() => {
        if (!isCompleted) {
            const interval = setInterval(() => {
                setThinkingMessageIndex(() =>
                    Math.floor(Math.random() * (ThinkingMessages.length - 1)),
                );
            }, 4000);
            return () => clearInterval(interval);
        }
    }, [isCompleted]);

    const checkWorkflowStatus = async () => {
        try {
            const statusResult = await client.store.workflows.getRunDetails(run.runId, run.workflowId);
            setWorkflowStatus(statusResult.status as string);
        } catch (error) {
            console.error('Failed to check workflow status:', error);
        }
    }

    // Stream messages from the agent
    useEffect(() => {
        // Reset all state when runId changes (new agent)
        setMessages([]);
        setPlans([]);
        setActivePlanIndex(0);
        setWorkstreamStatusMap(new Map());
        setShowSlidingPanel(false);
        setWorkflowStatus(null);

        checkWorkflowStatus();
        client.store.workflows.streamMessages(run.workflowId, run.runId, (message) => {
            if (message.message) {
                setMessages((prev_messages) => {
                    if (!prev_messages.find((m) => m.timestamp === message.timestamp)) {
                        insertMessageInTimeline(prev_messages, message);
                        return [...prev_messages];
                    } else {
                        return prev_messages;
                    }
                });
            }
        });

        // Clear messages and unsubscribe when component unmounts or runId changes
        return () => {
            setMessages([]);
            // Client handles unsubscribing from the message stream internally
        };
    }, [run.runId, client.store.workflows]);

    // Update completion status when messages change
    // This now accounts for multiple workstreams
    useEffect(() => {
        setIsCompleted(!isInProgress(messages));

        // Only automatically hide the panel when there are no plans
        // But don't auto-show it when plans appear
        if (plans.length === 0) {
            // If there are no plans, make sure the plan panel is hidden
            setShowSlidingPanel(false);
        }
        // We removed the auto-show functionality to allow users to keep the panel closed if they want
    }, [messages, plans.length]);

    // Update plans and workstream status based on incoming messages
    useEffect(() => {
        // Only show the sliding panel for the very first plan and only once
        if (
            plans.length === 1 &&
            !showSlidingPanel &&
            !sessionStorage.getItem("plan-panel-shown")
        ) {
            // For first-time plan detection only, show the panel with a delay
            const notificationTimeout = setTimeout(() => {
                setShowSlidingPanel(true);
                // Mark that we've shown the panel once
                sessionStorage.setItem("plan-panel-shown", "true");
            }, 500); // Short delay to ensure the UI has fully rendered

            return () => clearTimeout(notificationTimeout);
        }

        // Process messages to extract plan information
        messages.forEach((message) => {
            if (message.type === AgentMessageType.PLAN) {
                try {
                    // Log message details for debugging
                    console.log("PLAN message received:", message.type);

                    let newPlanDetails: Plan | null = null;

                    // Extract the plan from the message details object
                    if (message.details && typeof message.details === "object") {
                        // For a PLAN type message like the example you provided
                        if (message.details.plan && Array.isArray(message.details.plan)) {
                            console.log("Valid plan array found in message.details.plan");
                            newPlanDetails = { plan: message.details.plan } as Plan;
                        }
                    }

                    // Only proceed if we have a valid plan
                    if (newPlanDetails) {
                        const timestamp =
                            typeof message.timestamp === "number"
                                ? message.timestamp
                                : new Date(message.timestamp).getTime();

                        // Check if we already have this plan
                        const existingPlanIndex = plans.findIndex(
                            (p) => p.timestamp === timestamp,
                        );

                        if (existingPlanIndex === -1 && newPlanDetails) {
                            console.log("Adding new plan to plans array");
                            // This is a new plan - add it to our plans array
                            const newPlan = {
                                plan: newPlanDetails,
                                timestamp,
                            };

                            // Add new plan to the beginning of the array (newest first)
                            console.log("Adding plan to plans array:", newPlan);
                            setPlans((prev) => {
                                const newPlans = [newPlan, ...prev];
                                console.log("New plans array:", newPlans);
                                return newPlans;
                            });
                            // Set this as the active plan
                            setActivePlanIndex(0);

                            // Automatically show sliding plan panel when a plan is detected
                            console.log("Setting showSlidingPanel to true");
                            setShowSlidingPanel(true);

                            // Initialize workstreams as pending based on the plan tasks
                            const newWorkstreamStatus = new Map<
                                string,
                                "pending" | "in_progress" | "completed" | "skipped"
                            >();

                            // Always initialize main workstream
                            newWorkstreamStatus.set("main", "in_progress");

                            // Initialize each task in the plan with its status
                            if (Array.isArray(newPlanDetails.plan)) {
                                newPlanDetails.plan.forEach((task) => {
                                    if (task && typeof task === "object" && task.id) {
                                        const taskId = task.id.toString();
                                        // Use the task's status if available, otherwise default to pending
                                        newWorkstreamStatus.set(taskId, task.status || "pending");
                                    }
                                });
                            }

                            // Update the workstream status map with the new status for this plan
                            setWorkstreamStatusMap((prev) => {
                                const newMap = new Map(prev);
                                newMap.set(timestamp, newWorkstreamStatus);
                                return newMap;
                            });
                        }
                    }
                } catch (error) {
                    console.error("Failed to parse plan from message:", error);
                }
            }

            // Handle UPDATE type messages with plan updates
            if (message.type === AgentMessageType.UPDATE && message.details) {
                // We no longer process UPDATE messages with details.updates
                // Instead, we rely on the PLAN message that follows with the complete plan
                if (message.details.updates && Array.isArray(message.details.updates)) {
                    console.log(
                        "Ignoring UPDATE message with details.updates - waiting for PLAN message with full plan",
                    );
                    // This is an initial update notification, but we'll wait for the PLAN message that follows
                    // with the complete updated plan before making any UI changes
                }
            }
        });

        const lastMessage = messages[messages.length - 1];
        if (lastMessage) {
            if (lastMessage.type === AgentMessageType.TERMINATED) {
                setShowInput(false);
                setWorkflowStatus("TERMINATED");
            }
            else {
                if (interactive) {
                    setShowInput(true);
                } else {
                    setShowInput(lastMessage.type === AgentMessageType.REQUEST_INPUT);
                }
            }
        }
    }, [messages, plans, activePlanIndex]);

    // Send a message to the agent
    const handleSendMessage = (message: string) => {
        const trimmed = message.trim();
        if (!trimmed || isSending) return;

        setIsSending(true);

        client.store.workflows
            .sendSignal(run.workflowId, run.runId, "UserInput", {
                message: trimmed,
            } as UserInputSignal)
            .then(() => {
                setIsCompleted(false);
                toast({
                    status: "success",
                    title: "Message Sent",
                    duration: 2000,
                });
            })
            .catch((err) => {
                toast({
                    status: "error",
                    title: "Failed to Send Message",
                    description: err instanceof Error ? err.message : "Unknown error",
                    duration: 3000,
                });
            })
            .finally(() => {
                setIsSending(false);
            });
    };

    // Calculate number of active tasks for the status indicator
    const getActiveTaskCount = (): number => {
        if (!messages.length) return 0;

        // Group messages by workstream
        const workstreamMessages = new Map<string, AgentMessage[]>();

        messages.forEach((message) => {
            const workstreamId = getWorkstreamId(message);
            if (workstreamId !== "main" && workstreamId !== "all") {
                if (!workstreamMessages.has(workstreamId)) {
                    workstreamMessages.set(workstreamId, []);
                }
                workstreamMessages.get(workstreamId)!.push(message);
            }
        });

        // Count workstreams that don't have completion messages
        let activeCount = 0;

        for (const [_, msgs] of workstreamMessages.entries()) {
            if (msgs.length > 0) {
                const lastMessage = msgs[msgs.length - 1];
                // If the last message isn't a completion message, the workstream is active
                if (
                    ![AgentMessageType.COMPLETE, AgentMessageType.IDLE].includes(
                        lastMessage.type,
                    )
                ) {
                    activeCount++;
                }
            }
        }

        return activeCount;
    };

    const actualTitle =
        title || run.workflowId.split(":")[2] || "Agent Conversation";

    // Handle downloading conversation
    const downloadConversation = async () => {
        try {
            const url = await getConversationUrl(client, run.runId);
            if (url) window.open(url, "_blank");
        } catch (err) {
            console.error("Failed to download conversation", err);
            toast({
                status: "error",
                title: "Failed to download conversation",
                duration: 3000,
            });
        }
    };

    // Handle copying run ID
    const copyRunId = () => {
        navigator.clipboard.writeText(run.runId);
        toast({
            status: "success",
            title: "Run ID copied",
            duration: 2000,
        });
    };

    return (
        <div className="flex gap-2 h-full">
            {/* Conversation Area - responsive width based on panel visibility */}
            <div className={`flex flex-col h-full min-h-0 border-0 ${
                showSlidingPanel ? 'lg:w-2/3 flex-1' : `flex-1 mx-auto ${!isModal ? 'max-w-4xl' : ''}`
            }`}>
                <Header
                    title={actualTitle}
                    isCompleted={isCompleted}
                    onClose={onClose}
                    isModal={isModal}
                    run={run}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    showPlanPanel={showSlidingPanel}
                    hasPlan={plans.length > 0}
                    onTogglePlanPanel={() => {
                        setShowSlidingPanel(!showSlidingPanel);
                        // When opening the plan panel, mark that we've shown it
                        if (!showSlidingPanel) {
                            sessionStorage.setItem("plan-panel-shown", "true");
                        }
                    }}
                    onDownload={downloadConversation}
                    onCopyRunId={copyRunId}
                    resetWorkflow={resetWorkflow}
                />

                {messages.length === 0 && !isCompleted ? (
                    <div className="flex-1 flex flex-col items-center justify-center h-full text-center py-6">
                        <div className="p-5 max-w-md border border-info rounded-lg shadow-sm">
                            <div className="flex items-center space-x-3 mb-3">
                                <PulsatingCircle size="sm" color="blue" />
                                <div className="text-sm text-muted font-medium">
                                    {ThinkingMessages[thinkingMessageIndex]}
                                </div>
                            </div>
                            <div className="mt-4 flex justify-center">
                                <AnimatedThinkingDots color="blue" className="mt-1" />
                            </div>
                        </div>
                    </div>
                ) : (
                    <AllMessagesMixed
                        messages={messages}
                        bottomRef={bottomRef as React.RefObject<HTMLDivElement>}
                        viewMode={viewMode}
                        isCompleted={isCompleted}
                        plan={getActivePlan.plan}
                        workstreamStatus={getActivePlan.workstreamStatus}
                        showPlanPanel={showSlidingPanel}
                        onTogglePlanPanel={() => {
                            console.log(
                                "Toggle plan panel called, current state:",
                                showSlidingPanel,
                            );
                            setShowSlidingPanel(!showSlidingPanel);
                        }}
                        plans={plans}
                        activePlanIndex={activePlanIndex}
                        onChangePlan={(index) => setActivePlanIndex(index)}
                        taskLabels={getActivePlan.plan.plan?.reduce((acc, task) => {
                            if (task.id && task.goal) {
                                acc.set(task.id.toString(), task.goal);
                            }
                            return acc;
                        }, new Map<string, string>())}
                    />
                )}

                {workflowStatus && (
                    workflowStatus !== "RUNNING" ? (
                        <MessageBox
                            status={workflowStatus === "COMPLETED" ? 'success' : 'done'}
                            icon={null}
                            className="flex-shrink-0 m-2"
                        >
                            This Workflow is {workflowStatus}
                        </MessageBox>
                    ) : showInput && (
                        <MessageInput
                            onSend={handleSendMessage}
                            disabled={false}
                            isSending={isSending}
                            isCompleted={isCompleted}
                            activeTaskCount={getActiveTaskCount()}
                            placeholder={placeholder}
                        />
                    ))}
            </div>

            {/* Plan Panel Area - only rendered when panel should be shown */}
            {showSlidingPanel && (
                <div className="h-full lg:w-1/3 border-l">
                    <InlineSlidingPlanPanel
                        plan={getActivePlan.plan}
                        workstreamStatus={getActivePlan.workstreamStatus}
                        isOpen={showSlidingPanel}
                        onClose={() => setShowSlidingPanel(false)}
                        plans={plans}
                        activePlanIndex={activePlanIndex}
                        onChangePlan={setActivePlanIndex}
                    />
                </div>
            )}
        </div>
    );
}

// Helper function to get conversation URL - used by other components
export async function getConversationUrl(
    vertesia: VertesiaClient,
    workflowRunId: string,
): Promise<string> {
    return vertesia.files
        .getDownloadUrl(`agents/${workflowRunId}/conversation.json`)
        .then((r) => r.url);
}
