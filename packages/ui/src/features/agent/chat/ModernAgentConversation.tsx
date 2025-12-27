import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Cpu, SendIcon, UploadIcon, XIcon } from "lucide-react";
import { useUserSession } from "@vertesia/ui/session";
import { AsyncExecutionResult, VertesiaClient } from "@vertesia/client";
import { AgentMessage, AgentMessageType, Plan, StreamingChunkDetails, UserInputSignal } from "@vertesia/common";
import { Button, MessageBox, Spinner, useToast, VModal, VModalBody, VModalFooter, VModalTitle } from "@vertesia/ui/core";

import { AnimatedThinkingDots, PulsatingCircle } from "./AnimatedThinkingDots";
import AllMessagesMixed from "./ModernAgentOutput/AllMessagesMixed";
import Header from "./ModernAgentOutput/Header";
import MessageInput, { UploadedFile, SelectedDocument } from "./ModernAgentOutput/MessageInput";
import { getWorkstreamId, insertMessageInTimeline, isInProgress } from "./ModernAgentOutput/utils";
import { ThinkingMessages } from "./WaitingMessages";
import InlineSlidingPlanPanel from "./ModernAgentOutput/InlineSlidingPlanPanel";
import { ArtifactUrlCacheProvider } from "./useArtifactUrlCache.js";

type StartWorkflowFn = (
    initialMessage?: string,
) => Promise<{ run_id: string; workflow_id: string } | undefined>;

function printElementToPdf(sourceElement: HTMLElement, title: string): boolean {
    if (typeof window === "undefined" || typeof document === "undefined") {
        return false;
    }

    // Use a hidden iframe to avoid opening a new window
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.visibility = "hidden";
    document.body.appendChild(iframe);

    const iframeWindow = iframe.contentWindow;
    if (!iframeWindow) {
        iframe.parentNode?.removeChild(iframe);
        return false;
    }

    const doc = iframeWindow.document;
    doc.open();
    doc.write(`<!doctype html><html><head><title>${title}</title></head><body></body></html>`);
    doc.close();
    doc.title = title;

    const styles = document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>("link[rel=\"stylesheet\"], style");
    styles.forEach((node) => {
        doc.head.appendChild(node.cloneNode(true));
    });

    doc.body.innerHTML = sourceElement.innerHTML;
    iframeWindow.focus();
    iframeWindow.print();

    setTimeout(() => {
        iframe.parentNode?.removeChild(iframe);
    }, 1000);

    return true;
}

interface ModernAgentConversationProps {
    run?: AsyncExecutionResult | { workflow_id: string; run_id: string };
    title?: string;
    interactive?: boolean;
    onClose?: () => void;
    isModal?: boolean;
    fullWidth?: boolean;
    initialMessage?: string;
    startWorkflow?: StartWorkflowFn;
    startButtonText?: string;
    placeholder?: string;
    hideUserInput?: boolean;
    resetWorkflow?: () => void;

    // File upload props - passed through to MessageInput
    /** Called when files are dropped/pasted/selected */
    onFilesSelected?: (files: File[]) => void;
    /** Currently uploaded files to display */
    uploadedFiles?: UploadedFile[];
    /** Called when user removes an uploaded file */
    onRemoveFile?: (fileId: string) => void;
    /** Accepted file types (e.g., ".pdf,.doc,.png") */
    acceptedFileTypes?: string;
    /** Max number of files allowed */
    maxFiles?: number;

    // Document search props (render prop for custom search UI)
    /** Render custom document search UI - if provided, shows search button */
    renderDocumentSearch?: (props: {
        isOpen: boolean;
        onClose: () => void;
        onSelect: (doc: SelectedDocument) => void;
    }) => React.ReactNode;
    /** Currently selected documents from search */
    selectedDocuments?: SelectedDocument[];
    /** Called when user removes a selected document */
    onRemoveDocument?: (docId: string) => void;

    // Hide the default object linking (for apps that don't use it)
    hideObjectLinking?: boolean;

    // Styling props for Tailwind customization - passed through to MessageInput
    /** Additional className for the MessageInput container */
    inputContainerClassName?: string;
    /** Additional className for the input field */
    inputClassName?: string;
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
    fullWidth = false,
    placeholder = "Type your message...",
    startButtonText = "Start Agent",
    title = "Start New Conversation",
    // File upload props
    onFilesSelected,
}: ModernAgentConversationProps) {
    const [inputValue, setInputValue] = useState<string>("");
    const [isSending, setIsSending] = useState(false);
    const [run, setRun] = useState<AsyncExecutionResult>();
    const toast = useToast();
    const inputRef = useRef<HTMLInputElement>(null);

    // Drag and drop state
    const [isDragOver, setIsDragOver] = useState(false);
    const dragCounterRef = useRef(0);

    // Drag and drop handlers
    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current++;
        if (onFilesSelected && e.dataTransfer?.types?.includes('Files')) {
            setIsDragOver(true);
        }
    }, [onFilesSelected]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current--;
        if (dragCounterRef.current === 0) {
            setIsDragOver(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current = 0;
        setIsDragOver(false);

        if (onFilesSelected && e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
            const filesArray = Array.from(e.dataTransfer.files);
            onFilesSelected(filesArray);
        }
    }, [onFilesSelected]);

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
        <div
            className={`flex flex-col h-full bg-white dark:bg-gray-900 overflow-hidden border-0 relative ${isDragOver ? 'ring-2 ring-blue-400 ring-inset' : ''}`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Drag overlay for full-panel file drop */}
            {isDragOver && (
                <div className="absolute inset-0 flex items-center justify-center bg-blue-100/80 dark:bg-blue-900/40 z-50 pointer-events-none rounded-lg">
                    <div className="text-blue-600 dark:text-blue-400 font-medium flex items-center gap-2 text-lg">
                        <UploadIcon className="size-6" />
                        Drop files to upload
                    </div>
                </div>
            )}
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
            <div
                className={`flex-1 overflow-y-auto px-4 py-6 bg-white dark:bg-gray-900 flex flex-col ${
                    fullWidth ? 'items-start justify-start' : 'items-center justify-center'
                }`}
            >
                {initialMessage && (
                    <div
                        className={`px-4 py-3 mb-4 bg-blue-50/80 dark:bg-blue-900/30 border-l-2 border-blue-400 dark:border-blue-500 text-blue-700 dark:text-blue-300 ${
                            fullWidth ? 'w-full' : 'max-w-md'
                        }`}
                    >
                        {initialMessage}
                    </div>
                )}

                <div
                    className={`bg-white dark:bg-slate-800 p-4 border-l-2 border-blue-400 dark:border-blue-500 ${
                        fullWidth ? 'w-full' : 'max-w-md'
                    }`}
                >
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
    fullWidth = false,
    placeholder = "Type your message...",
    resetWorkflow,
    // File upload props
    onFilesSelected,
    uploadedFiles,
    onRemoveFile,
    acceptedFileTypes,
    maxFiles,
    // Document search props
    renderDocumentSearch,
    selectedDocuments,
    onRemoveDocument,
    // Object linking
    hideObjectLinking,
    // Styling props
    inputContainerClassName,
    inputClassName,
}: ModernAgentConversationProps & { run: AsyncExecutionResult }) {
    const { client } = useUserSession();
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const conversationRef = useRef<HTMLDivElement | null>(null);
    const [messages, setMessages] = useState<AgentMessage[]>([]);
    const [isCompleted, setIsCompleted] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [viewMode, setViewMode] = useState<"stacked" | "sliding">("sliding");
    const [showSlidingPanel, setShowSlidingPanel] = useState<boolean>(!isModal);
    const [isStopping, setIsStopping] = useState(false);
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
    // Track streaming messages by streaming_id for real-time chunk aggregation
    // Include startTimestamp to preserve chronological order when converting to regular messages
    const [streamingMessages, setStreamingMessages] = useState<Map<string, { text: string; workstreamId?: string; isComplete?: boolean; startTimestamp: number }>>(new Map());

    // Drag and drop state for full-panel file upload
    const [isDragOver, setIsDragOver] = useState(false);
    const dragCounterRef = useRef(0);

    // Drag and drop handlers for full-panel file upload
    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current++;
        if (onFilesSelected && e.dataTransfer?.types?.includes('Files')) {
            setIsDragOver(true);
        }
    }, [onFilesSelected]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current--;
        if (dragCounterRef.current === 0) {
            setIsDragOver(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current = 0;
        setIsDragOver(false);

        if (onFilesSelected && e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
            const filesArray = Array.from(e.dataTransfer.files);
            onFilesSelected(filesArray);
        }
    }, [onFilesSelected]);

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
        setStreamingMessages(new Map());

        checkWorkflowStatus();
        client.store.workflows.streamMessages(run.workflowId, run.runId, (message) => {
            // Handle streaming chunks separately for real-time aggregation
            if (message.type === AgentMessageType.STREAMING_CHUNK) {
                const details = message.details as StreamingChunkDetails;
                if (!details?.streaming_id) return;

                setStreamingMessages((prev) => {
                    const updated = new Map(prev);
                    const current = updated.get(details.streaming_id) || {
                        text: '',
                        workstreamId: message.workstream_id,
                        startTimestamp: Date.now() // Track when this streaming message started
                    };
                    const newText = current.text + (message.message || '');

                    // When streaming is done, mark as complete but keep displaying
                    // The message will be converted to THOUGHT and removed when COMPLETE arrives
                    updated.set(details.streaming_id, {
                        text: newText,
                        workstreamId: message.workstream_id,
                        isComplete: details.is_final,
                        startTimestamp: current.startTimestamp, // Preserve the original start timestamp
                    });
                    return updated;
                });
                return;
            }

            // When COMPLETE arrives, convert streaming messages to THOUGHT messages
            if (message.type === AgentMessageType.COMPLETE) {
                setStreamingMessages((prev) => {
                    // Convert any remaining streaming messages to THOUGHT messages
                    prev.forEach(({ text, workstreamId, startTimestamp }) => {
                        if (text) {
                            const thoughtMessage: AgentMessage = {
                                // Use the start timestamp to maintain chronological order
                                timestamp: startTimestamp || Date.now(),
                                workflow_run_id: run.runId,
                                type: AgentMessageType.THOUGHT,
                                message: text,
                                workstream_id: workstreamId,
                            };
                            setMessages((prev_messages) => {
                                insertMessageInTimeline(prev_messages, thoughtMessage);
                                return [...prev_messages];
                            });
                        }
                    });
                    // Clear all streaming messages
                    return new Map();
                });
            }

            if (message.message) {
                setMessages((prev_messages) => {
                    // Check for duplicate by timestamp
                    if (prev_messages.find((m) => m.timestamp === message.timestamp)) {
                        return prev_messages;
                    }

                    // For QUESTION messages from server, replace any optimistic version
                    if (message.type === AgentMessageType.QUESTION && !message.details?._optimistic) {
                        const withoutOptimistic = prev_messages.filter(
                            (m) => !(m.type === AgentMessageType.QUESTION &&
                                m.details?._optimistic &&
                                m.message === message.message)
                        );
                        insertMessageInTimeline(withoutOptimistic, message);
                        return [...withoutOptimistic];
                    }

                    insertMessageInTimeline(prev_messages, message);
                    return [...prev_messages];
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

        // Add optimistic QUESTION message immediately for better UX
        const optimisticTimestamp = Date.now();
        const optimisticMessage: AgentMessage = {
            timestamp: optimisticTimestamp,
            workflow_run_id: run.runId,
            type: AgentMessageType.QUESTION,
            message: trimmed,
            workstream_id: "main",
            details: { _optimistic: true },
        };

        console.log("[Optimistic] Adding user message:", trimmed);

        setMessages((prev) => {
            const newMessages = [...prev, optimisticMessage];
            // Sort by timestamp to maintain order
            newMessages.sort((a, b) => {
                const timeA = typeof a.timestamp === "number" ? a.timestamp : new Date(a.timestamp).getTime();
                const timeB = typeof b.timestamp === "number" ? b.timestamp : new Date(b.timestamp).getTime();
                return timeA - timeB;
            });
            console.log("[Optimistic] Messages after add:", newMessages.length, "messages");
            return newMessages;
        });

        client.store.workflows
            .sendSignal(run.workflowId, run.runId, "UserInput", {
                message: trimmed,
            } as UserInputSignal)
            .then(() => {
                setIsCompleted(false);
            })
            .catch((err) => {
                // Remove optimistic message on failure
                setMessages((prev) => prev.filter((m) => m.timestamp !== optimisticTimestamp));
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

    // Stop/interrupt the active workflow
    const handleStopWorkflow = async () => {
        if (isStopping) return;

        setIsStopping(true);
        try {
            await client.store.workflows.sendSignal(run.workflowId, run.runId, "Stop", {
                message: "User requested stop",
            });

            toast({
                status: "info",
                title: "Agent Interrupted",
                description: "Type your message to give new instructions",
                duration: 3000,
            });
            setIsCompleted(true);
        } catch (err) {
            toast({
                status: "error",
                title: "Failed to Interrupt",
                description: err instanceof Error ? err.message : "Unknown error",
                duration: 3000,
            });
        } finally {
            setIsStopping(false);
        }
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

    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

    const exportConversationPdf = () => {
        if (!conversationRef.current) {
            toast({
                status: "error",
                title: "PDF export failed",
                description: "No conversation content available to export",
                duration: 3000,
            });
            return;
        }
        setIsPdfModalOpen(true);
    };

    const handleConfirmExportPdf = () => {
        if (!conversationRef.current) {
            toast({
                status: "error",
                title: "PDF export failed",
                description: "No conversation content available to export",
                duration: 3000,
            });
            return;
        }

        const pdfTitle = `${actualTitle} - ${run.runId}`;
        const success = printElementToPdf(conversationRef.current, pdfTitle);

        if (!success) {
            toast({
                status: "error",
                title: "PDF export failed",
                description: "Unable to open print preview",
                duration: 4000,
            });
            return;
        }

        toast({
            status: "success",
            title: "PDF export ready",
            description: "Use your browser's Print dialog to save as PDF",
            duration: 4000,
        });
        setIsPdfModalOpen(false);
    };

    return (
        <ArtifactUrlCacheProvider>
        <div
            className={`flex gap-2 h-full relative ${isDragOver ? 'ring-2 ring-blue-400 ring-inset' : ''}`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Drag overlay for full-panel file drop */}
            {isDragOver && (
                <div className="absolute inset-0 flex items-center justify-center bg-blue-100/80 dark:bg-blue-900/40 z-50 pointer-events-none rounded-lg">
                    <div className="text-blue-600 dark:text-blue-400 font-medium flex items-center gap-2 text-lg">
                        <UploadIcon className="size-6" />
                        Drop files to upload
                    </div>
                </div>
            )}
            {/* Conversation Area - responsive width based on panel visibility */}
            <div
                ref={conversationRef}
                className={`flex flex-col h-full min-h-0 border-0 ${
                showSlidingPanel
                    ? 'lg:w-2/3 flex-1'
                    : fullWidth
                        ? 'flex-1 w-full'
                        : `flex-1 mx-auto ${!isModal ? 'max-w-4xl' : ''}`
            }`}
            >
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
                    onExportPdf={exportConversationPdf}
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
                        streamingMessages={streamingMessages}
                    />
                )}

                {/* Show workflow status message when not running, or show input when running/unknown */}
                {workflowStatus && workflowStatus !== "RUNNING" ? (
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
                        onStop={handleStopWorkflow}
                        disabled={false}
                        isSending={isSending}
                        isStopping={isStopping}
                        isStreaming={!isCompleted}
                        isCompleted={isCompleted}
                        activeTaskCount={getActiveTaskCount()}
                        placeholder={placeholder}
                        // File upload props
                        onFilesSelected={onFilesSelected}
                        uploadedFiles={uploadedFiles}
                        onRemoveFile={onRemoveFile}
                        acceptedFileTypes={acceptedFileTypes}
                        maxFiles={maxFiles}
                        // Document search props
                        renderDocumentSearch={renderDocumentSearch}
                        selectedDocuments={selectedDocuments}
                        onRemoveDocument={onRemoveDocument}
                        // Object linking
                        hideObjectLinking={hideObjectLinking}
                        // Styling props
                        className={inputContainerClassName}
                        inputClassName={inputClassName}
                    />
                )}
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
            <VModal isOpen={isPdfModalOpen} onClose={() => setIsPdfModalOpen(false)}>
                <VModalTitle>Export conversation as PDF</VModalTitle>
                <VModalBody>
                    <p className="mb-2">
                        This will open your browser&apos;s print dialog with the current conversation.
                    </p>
                    <p className="text-sm text-muted">
                        To save a PDF, choose &quot;Save as PDF&quot; or a similar option in the print dialog.
                    </p>
                </VModalBody>
                <VModalFooter align="right">
                    <Button variant="ghost" size="sm" onClick={() => setIsPdfModalOpen(false)}>
                        Cancel
                    </Button>
                    <Button size="sm" onClick={handleConfirmExportPdf}>
                        Open print dialog
                    </Button>
                </VModalFooter>
            </VModal>
        </div>
        </ArtifactUrlCacheProvider>
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
