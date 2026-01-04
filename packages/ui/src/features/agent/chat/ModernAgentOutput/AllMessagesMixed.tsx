import { AgentMessage, AgentMessageType, BatchProgressDetails, Plan } from "@vertesia/common";
import React, { useEffect, useMemo, useState, Component, ReactNode } from "react";
import { PulsatingCircle } from "../AnimatedThinkingDots";
import BatchProgressPanel from "./BatchProgressPanel";
import MessageItem from "./MessageItem";
import StreamingMessage from "./StreamingMessage";
import ToolCallGroup from "./ToolCallGroup";
import WorkstreamTabs, { extractWorkstreams, filterMessagesByWorkstream } from "./WorkstreamTabs";
import { DONE_STATES, getWorkstreamId, groupMessagesWithStreaming, StreamingData } from "./utils";
import { ThinkingMessages } from "../WaitingMessages";

// Replace %thinking_message% placeholder with actual thinking message
const processThinkingPlaceholder = (text: string, thinkingMessageIndex: number): string => {
    if (text.includes('%thinking_message%')) {
        return text.replace(/%thinking_message%/g, ThinkingMessages[thinkingMessageIndex]);
    }
    return text;
};

// Check if message is a batch progress message
const isBatchProgressMessage = (message: AgentMessage): message is AgentMessage & { details: BatchProgressDetails } => {
    return message.type === AgentMessageType.BATCH_PROGRESS && !!message.details?.batch_id;
};

// Check if message is a system metadata message that should be hidden from users
const isSystemMetadataMessage = (message: AgentMessage): boolean => {
    if (message.type !== AgentMessageType.UPDATE) return false;
    const text = message.message?.toString() || '';
    // Hide "Tools enabled:" messages that list all available tools
    if (text.startsWith('Tools enabled:')) return true;
    // Hide "Starting work with interaction" messages
    if (text.startsWith('Starting work with interaction')) return true;
    return false;
};

// Error boundary to catch and isolate errors in individual message components
class MessageErrorBoundary extends Component<
    { children: ReactNode },
    { hasError: boolean; error?: Error }
> {
    constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error) {
        console.error('Message render error:', error);
        return { hasError: true, error };
    }

    render() {
        // Silent fail - just don't render the broken message
        if (this.state.hasError) {
            return null;
        }
        return this.props.children;
    }
}

interface AllMessagesMixedProps {
    messages: AgentMessage[];
    bottomRef: React.RefObject<HTMLDivElement>;
    viewMode?: 'stacked' | 'sliding';
    isCompleted?: boolean;
    plan?: Plan;
    workstreamStatus?: Map<string, 'pending' | 'in_progress' | 'completed'>;
    showPlanPanel?: boolean;
    onTogglePlanPanel?: () => void;
    plans?: Array<{ plan: Plan, timestamp: number }>;
    activePlanIndex?: number;
    onChangePlan?: (index: number) => void;
    taskLabels?: Map<string, string>; // Maps task IDs to more descriptive labels
    streamingMessages?: Map<string, StreamingData>; // Real-time streaming chunks
    /** Callback when user sends a message (e.g., from proposal selection) */
    onSendMessage?: (message: string) => void;
    /** Stable index for thinking messages (changes on 4s interval) */
    thinkingMessageIndex?: number;
}

function AllMessagesMixedComponent({
    messages,
    bottomRef,
    viewMode = 'stacked',
    isCompleted = false,
    streamingMessages = new Map(),
    onSendMessage,
    thinkingMessageIndex = 0,
}: AllMessagesMixedProps) {
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const [activeWorkstream, setActiveWorkstream] = useState<string>("all");

    // Auto-scroll to bottom when messages or streaming messages change
    // Use instant scroll during active streaming for better UX
    const isStreaming = streamingMessages.size > 0;
    useEffect(() => {
        if (bottomRef.current) {
            // Use instant scroll during streaming, smooth scroll otherwise
            bottomRef.current.scrollIntoView({ behavior: isStreaming ? "instant" : "smooth" });
        }
    }, [messages, streamingMessages, bottomRef, isStreaming]);

    // Sort all messages chronologically and filter out system metadata
    const sortedMessages = React.useMemo(
        () =>
            [...messages]
                .filter(msg => !isSystemMetadataMessage(msg))
                .sort((a, b) => {
                    const timeA = typeof a.timestamp === "number" ? a.timestamp : new Date(a.timestamp).getTime();
                    const timeB = typeof b.timestamp === "number" ? b.timestamp : new Date(b.timestamp).getTime();
                    return timeA - timeB;
                }),
        [messages],
    );

    // Get workstreams from messages - only from message.workstream_id
    const workstreams = React.useMemo(() => {
        // Just get the basic workstreams from the messages
        const extractedWorkstreams = extractWorkstreams(sortedMessages);

        // We'll keep taskLabels - they might be used for display purposes elsewhere
        // but we won't use them to create new workstream tabs

        return extractedWorkstreams;
    }, [sortedMessages]);

    // Count messages per workstream
    const workstreamCounts = React.useMemo(() => {
        const counts = new Map<string, number>();
        counts.set("all", sortedMessages.length);

        // Count main messages
        const mainMessages = filterMessagesByWorkstream(sortedMessages, "main");
        counts.set("main", mainMessages.length);

        // Count other workstreams
        sortedMessages.forEach((msg) => {
            const workstreamId = getWorkstreamId(msg);
            if (workstreamId !== "main") {
                counts.set(workstreamId, (counts.get(workstreamId) || 0) + 1);
            }
        });

        return counts;
    }, [sortedMessages]);

    // Filter messages based on active workstream
    const displayMessages = React.useMemo(() => {
        if (activeWorkstream === "all") {
            return sortedMessages;
        }
        return filterMessagesByWorkstream(sortedMessages, activeWorkstream);
    }, [sortedMessages, activeWorkstream]);

    // Pre-compute important messages and recent thinking for sliding view (avoid IIFE in render)
    const { importantMessages, recentThinking } = React.useMemo(() => {
        const hasStreaming = streamingMessages.size > 0;

        // Important messages include answers, questions, completion states, AND tool progress thoughts
        const important = displayMessages.filter(msg =>
            msg.type === AgentMessageType.ANSWER ||
            msg.type === AgentMessageType.QUESTION ||
            msg.type === AgentMessageType.COMPLETE ||
            msg.type === AgentMessageType.IDLE ||
            msg.type === AgentMessageType.REQUEST_INPUT ||
            msg.type === AgentMessageType.TERMINATED ||
            msg.type === AgentMessageType.ERROR ||
            // Include THOUGHT messages that have tool details (progress from message_to_human)
            (msg.type === AgentMessageType.THOUGHT && msg.details?.tool)
        );

        // Latest thinking: show only the most recent generic thinking message (UPDATE/PLAN or THOUGHT without tool)
        // Tool progress is already in important messages
        const thinkingMessages = !isCompleted && !hasStreaming
            ? displayMessages
                .filter(msg =>
                    msg.type === AgentMessageType.UPDATE ||
                    msg.type === AgentMessageType.PLAN ||
                    (msg.type === AgentMessageType.THOUGHT && !msg.details?.tool))
                .slice(-1) // Show only the latest thinking message
            : [];

        return { importantMessages: important, recentThinking: thinkingMessages };
    }, [displayMessages, isCompleted, streamingMessages.size]);

    // Group messages with streaming interleaved for stacked view
    const groupedMessages = React.useMemo(
        () => groupMessagesWithStreaming(displayMessages, streamingMessages, activeWorkstream),
        [displayMessages, streamingMessages, activeWorkstream]
    );

    // Group important messages with streaming interleaved for sliding view
    const groupedImportantMessages = React.useMemo(
        () => groupMessagesWithStreaming(importantMessages, streamingMessages, activeWorkstream),
        [importantMessages, streamingMessages, activeWorkstream]
    );

    // Show working indicator when agent is actively processing
    const isAgentWorking = useMemo(() => {
        if (isCompleted) return false;
        // Agent is working if there are streaming messages, recent thinking, or no final answer yet
        return streamingMessages.size > 0 || recentThinking.length > 0 || !displayMessages.some(msg =>
            msg.type === AgentMessageType.COMPLETE ||
            msg.type === AgentMessageType.IDLE ||
            msg.type === AgentMessageType.TERMINATED
        );
    }, [isCompleted, streamingMessages.size, recentThinking.length, displayMessages]);

    // Determine completion status for each workstream
    const workstreamCompletionStatus = useMemo(() => {
        const statusMap = new Map<string, boolean>();

        // Group messages by workstream
        const workstreamMessages = new Map<string, AgentMessage[]>();

        sortedMessages.forEach(message => {
            const workstreamId = getWorkstreamId(message);
            if (!workstreamMessages.has(workstreamId)) {
                workstreamMessages.set(workstreamId, []);
            }
            workstreamMessages.get(workstreamId)!.push(message);
        });

        // Check if each workstream is completed
        for (const [workstreamId, msgs] of workstreamMessages.entries()) {
            if (msgs.length > 0) {
                const lastMessage = msgs[msgs.length - 1];
                statusMap.set(workstreamId, [
                    AgentMessageType.COMPLETE,
                    AgentMessageType.IDLE,
                    AgentMessageType.REQUEST_INPUT,
                    AgentMessageType.TERMINATED
                ].includes(lastMessage.type));
            }
        }

        return statusMap;
    }, [sortedMessages]);

    return (
        <div
            ref={containerRef}
            className="flex-1 min-h-0 h-full overflow-y-auto overflow-x-hidden px-4 sm:px-2 lg:px-4 flex flex-col relative"
            data-testid="all-messages-mixed"
        >

            {/* Workstream tabs with completion indicators */}
            <div className="sticky top-0 z-10">
                <WorkstreamTabs
                    workstreams={workstreams}
                    activeWorkstream={activeWorkstream}
                    onSelectWorkstream={setActiveWorkstream}
                    count={workstreamCounts}
                    completionStatus={workstreamCompletionStatus}
                />
            </div>

            {displayMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-center py-8">
                    <div className="flex items-center px-4 py-3 text-muted">
                        {activeWorkstream === "all"
                            ? "Waiting for agent response..."
                            : "No messages in this workstream yet..."}
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col justify-start pb-4 space-y-2">
                    {/* Show either all messages or just sliding view depending on viewMode */}
                    {viewMode === 'stacked' ? (
                        // Details view - show ALL messages with streaming interleaved
                        <>
                            {groupedMessages.map((group, groupIndex) => {
                                const isLastGroup = groupIndex === groupedMessages.length - 1;

                                if (group.type === 'tool_group') {
                                    // Render grouped tool calls
                                    const lastMessage = group.messages[group.messages.length - 1];
                                    const isLatest = !isCompleted &&
                                        isLastGroup &&
                                        !DONE_STATES.includes(lastMessage.type) &&
                                        group.toolStatus !== "completed";

                                    return (
                                        <MessageErrorBoundary key={`group-${group.toolRunId || group.firstTimestamp}-${groupIndex}`}>
                                            <ToolCallGroup
                                                messages={group.messages}
                                                showPulsatingCircle={isLatest}
                                                toolRunId={group.toolRunId}
                                                toolStatus={group.toolStatus}
                                            />
                                        </MessageErrorBoundary>
                                    );
                                } else if (group.type === 'streaming') {
                                    // Render streaming message inline
                                    return (
                                        <MessageErrorBoundary key={`streaming-${group.streamingId}-${groupIndex}`}>
                                            <StreamingMessage
                                                text={group.text}
                                                workstreamId={group.workstreamId}
                                                isComplete={group.isComplete}
                                            />
                                        </MessageErrorBoundary>
                                    );
                                } else {
                                    // Render single message
                                    const message = group.message;
                                    const isLatestMessage = !isCompleted &&
                                        isLastGroup &&
                                        !DONE_STATES.includes(message.type);

                                    // Special handling for batch progress messages
                                    if (isBatchProgressMessage(message)) {
                                        return (
                                            <MessageErrorBoundary key={`batch-${message.details.batch_id}-${message.timestamp}-${groupIndex}`}>
                                                <BatchProgressPanel
                                                    message={message}
                                                    batchData={message.details}
                                                    isRunning={!message.details.completed_at}
                                                />
                                            </MessageErrorBoundary>
                                        );
                                    }

                                    return (
                                        <MessageErrorBoundary key={`${message.timestamp}-${groupIndex}`}>
                                            <MessageItem
                                                message={message}
                                                showPulsatingCircle={isLatestMessage}
                                                onSendMessage={onSendMessage}
                                            />
                                        </MessageErrorBoundary>
                                    );
                                }
                            })}
                            {/* Working indicator - shows agent is actively processing */}
                            {isAgentWorking && streamingMessages.size === 0 && (
                                <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30">
                                    <PulsatingCircle size="sm" color="blue" />
                                    <span className="text-sm text-muted">Working...</span>
                                </div>
                            )}
                        </>
                    ) : (
                        // Most Important view - main messages + streaming interleaved
                        <>
                            {groupedImportantMessages.map((group, groupIndex) => {
                                const isLastGroup = groupIndex === groupedImportantMessages.length - 1;

                                if (group.type === 'tool_group') {
                                    // Render grouped tool calls
                                    const lastMessage = group.messages[group.messages.length - 1];
                                    const isLatest = !isCompleted &&
                                        recentThinking.length === 0 &&
                                        isLastGroup &&
                                        !DONE_STATES.includes(lastMessage.type) &&
                                        group.toolStatus !== "completed";

                                    return (
                                        <MessageErrorBoundary key={`group-${group.toolRunId || group.firstTimestamp}-${groupIndex}`}>
                                            <ToolCallGroup
                                                messages={group.messages}
                                                showPulsatingCircle={isLatest}
                                                toolRunId={group.toolRunId}
                                                toolStatus={group.toolStatus}
                                            />
                                        </MessageErrorBoundary>
                                    );
                                } else if (group.type === 'streaming') {
                                    // Render streaming message inline
                                    return (
                                        <MessageErrorBoundary key={`streaming-${group.streamingId}-${groupIndex}`}>
                                            <StreamingMessage
                                                text={group.text}
                                                workstreamId={group.workstreamId}
                                                isComplete={group.isComplete}
                                            />
                                        </MessageErrorBoundary>
                                    );
                                } else {
                                    // Render single message
                                    const message = group.message;
                                    const isLatestMessage = !isCompleted &&
                                        recentThinking.length === 0 &&
                                        isLastGroup &&
                                        !DONE_STATES.includes(message.type);

                                    // Special handling for batch progress messages
                                    if (isBatchProgressMessage(message)) {
                                        return (
                                            <MessageErrorBoundary key={`batch-${message.details.batch_id}-${message.timestamp}-${groupIndex}`}>
                                                <BatchProgressPanel
                                                    message={message}
                                                    batchData={message.details}
                                                    isRunning={!message.details.completed_at}
                                                />
                                            </MessageErrorBoundary>
                                        );
                                    }

                                    return (
                                        <MessageErrorBoundary key={`${message.timestamp}-${groupIndex}`}>
                                            <MessageItem
                                                message={message}
                                                showPulsatingCircle={isLatestMessage}
                                                onSendMessage={onSendMessage}
                                            />
                                        </MessageErrorBoundary>
                                    );
                                }
                            })}
                            {/* Recent thinking messages - displayed like streaming */}
                            {recentThinking.map((thinking, idx) => (
                                <MessageErrorBoundary key={`thinking-${thinking.timestamp}-${idx}`}>
                                    <StreamingMessage
                                        text={processThinkingPlaceholder(thinking.message || '', thinkingMessageIndex)}
                                        workstreamId={getWorkstreamId(thinking)}
                                        isComplete={idx < recentThinking.length - 1} // Only latest is still "streaming"
                                    />
                                </MessageErrorBoundary>
                            ))}
                            {/* Working indicator - shows agent is actively processing */}
                            {isAgentWorking && recentThinking.length === 0 && streamingMessages.size === 0 && (
                                <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30">
                                    <PulsatingCircle size="sm" color="blue" />
                                    <span className="text-sm text-muted">Working...</span>
                                </div>
                            )}
                        </>
                    )}
                    <div ref={bottomRef} className="h-4" />
                </div>
            )}
        </div>
    );
}

const AllMessagesMixed = React.memo(AllMessagesMixedComponent);

export default AllMessagesMixed;
