import { AgentMessage, AgentMessageType, BatchProgressDetails, Plan } from "@vertesia/common";
import React, { useEffect, useMemo, useState, useRef, useCallback, Component, ReactNode } from "react";
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
        if (this.state.hasError) {
            // Show error indicator instead of silently failing
            return (
                <div className="border-l-4 border-l-destructive bg-destructive/10 px-4 py-2 my-2 rounded-r">
                    <p className="text-sm text-destructive font-medium">Failed to render message</p>
                    <p className="text-xs text-muted mt-1 truncate">
                        {this.state.error?.message || 'Unknown error'}
                    </p>
                </div>
            );
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

// PERFORMANCE: Throttle interval for auto-scroll (ms)
const SCROLL_THROTTLE_MS = 100; // Max 10 scrolls per second

function AllMessagesMixedComponent({
    messages,
    bottomRef,
    viewMode = 'stacked',
    isCompleted = false,
    streamingMessages = new Map(),
    onSendMessage,
    thinkingMessageIndex = 0,
}: AllMessagesMixedProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [activeWorkstream, setActiveWorkstream] = useState<string>("all");

    // PERFORMANCE: Throttle auto-scroll to prevent layout thrashing
    // During streaming, scrollIntoView was being called 30+ times/sec
    const lastScrollTimeRef = useRef<number>(0);
    const scrollScheduledRef = useRef<number | null>(null);

    const isStreaming = streamingMessages.size > 0;

    // Compute bucketed streaming content length for scroll dependency
    // Changes every ~200 chars to trigger scroll without excessive updates
    const streamingContentBucket = useMemo(() => {
        let total = 0;
        streamingMessages.forEach((data) => {
            total += data.text?.length || 0;
        });
        return Math.floor(total / 200); // Bucket by 200 chars
    }, [streamingMessages]);

    // Throttled scroll function
    const performScroll = useCallback(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: isStreaming ? "instant" : "smooth" });
            lastScrollTimeRef.current = Date.now();
        }
        scrollScheduledRef.current = null;
    }, [bottomRef, isStreaming]);

    // Auto-scroll to bottom when messages or streaming messages change
    // Throttled to max 10 scrolls/sec to prevent layout thrashing
    useEffect(() => {
        const now = Date.now();
        const timeSinceLastScroll = now - lastScrollTimeRef.current;

        // If we haven't scrolled recently, scroll immediately
        if (timeSinceLastScroll >= SCROLL_THROTTLE_MS) {
            performScroll();
        } else if (scrollScheduledRef.current === null) {
            // Schedule a scroll for later if not already scheduled
            const delay = SCROLL_THROTTLE_MS - timeSinceLastScroll;
            scrollScheduledRef.current = window.setTimeout(performScroll, delay);
        }

        // Cleanup scheduled scroll on unmount or before next effect
        return () => {
            if (scrollScheduledRef.current !== null) {
                clearTimeout(scrollScheduledRef.current);
                scrollScheduledRef.current = null;
            }
        };
    }, [messages.length, streamingMessages.size, streamingContentBucket, performScroll]);

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
            // Include THOUGHT messages that have tool details (progress from message_to_human or streamed content)
            (msg.type === AgentMessageType.THOUGHT && (msg.details?.tool || msg.details?.tools || msg.details?.streamed)) ||
            // Include toolkit_ready SYSTEM message (shows at conversation start)
            (msg.type === AgentMessageType.SYSTEM && msg.details?.system_type === 'toolkit_ready')
        );

        // Latest thinking: show only the most recent generic thinking message (UPDATE/PLAN or THOUGHT without tool)
        // Tool progress is already in important messages
        const thinkingMessages = !isCompleted && !hasStreaming
            ? displayMessages
                .filter(msg =>
                    msg.type === AgentMessageType.UPDATE ||
                    msg.type === AgentMessageType.PLAN ||
                    (msg.type === AgentMessageType.THOUGHT && !msg.details?.tool && !msg.details?.tools && !msg.details?.streamed))
                .slice(-1) // Show only the latest thinking message
            : [];

        return { importantMessages: important, recentThinking: thinkingMessages };
    }, [displayMessages, isCompleted, streamingMessages.size]);

    // Split streaming messages: complete ones get interleaved, incomplete ones render at end
    // This prevents re-grouping all messages when incomplete streaming updates
    const { completeStreaming, incompleteStreaming } = React.useMemo(() => {
        const complete = new Map<string, StreamingData>();
        const incomplete: Array<{ id: string; data: StreamingData }> = [];

        streamingMessages.forEach((data, id) => {
            // Filter by workstream if specified
            if (activeWorkstream && activeWorkstream !== "all") {
                const streamWorkstream = data.workstreamId || "main";
                if (activeWorkstream !== streamWorkstream) return;
            }

            if (data.isComplete) {
                complete.set(id, data);
            } else if (data.text) {
                incomplete.push({ id, data });
            }
        });

        return { completeStreaming: complete, incompleteStreaming: incomplete };
    }, [streamingMessages, activeWorkstream]);

    // Group messages with ONLY complete streaming interleaved for stacked view
    // Incomplete streaming is rendered separately at the end (avoids re-grouping on every chunk)
    const groupedMessages = React.useMemo(
        () => groupMessagesWithStreaming(displayMessages, completeStreaming, activeWorkstream),
        [displayMessages, completeStreaming, activeWorkstream]
    );

    // Group important messages with ONLY complete streaming interleaved for sliding view
    const groupedImportantMessages = React.useMemo(
        () => groupMessagesWithStreaming(importantMessages, completeStreaming, activeWorkstream),
        [importantMessages, completeStreaming, activeWorkstream]
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
            tabIndex={0}
            className="flex-1 min-h-0 h-full w-full max-w-full overflow-y-auto overflow-x-hidden px-2 sm:px-3 lg:px-4 flex flex-col relative focus:outline-none"
            data-testid="all-messages-mixed"
        >
            {/* Global styles for vprose markdown content */}
            <style>{`
                /* Better vertical rhythm for markdown */
                .vprose > * + * {
                    margin-top: 0.875rem;
                }
                .vprose > h1 + *,
                .vprose > h2 + *,
                .vprose > h3 + * {
                    margin-top: 0.5rem;
                }
                /* Tables need more separation and better styling */
                .vprose table {
                    margin-top: 1.25rem;
                    margin-bottom: 1.25rem;
                    border-collapse: collapse;
                    width: 100%;
                }
                .vprose th,
                .vprose td {
                    padding: 0.625rem 0.875rem;
                    border: 1px solid var(--gray-6, #e5e7eb);
                    text-align: left;
                }
                .vprose thead th {
                    background-color: var(--gray-3, #f3f4f6);
                    font-weight: 600;
                    color: var(--gray-11, #6b7280);
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .vprose tbody tr:hover {
                    background-color: var(--gray-2, #f9fafb);
                }
                /* Dark mode table styles */
                .dark .vprose th,
                .dark .vprose td {
                    border-color: var(--gray-7, #374151);
                }
                .dark .vprose thead th {
                    background-color: var(--gray-4, #1f2937);
                    color: var(--gray-11, #9ca3af);
                }
                .dark .vprose tbody tr:hover {
                    background-color: var(--gray-3, #111827);
                }
                /* Horizontal rules as section dividers */
                .vprose hr {
                    margin-top: 1.5rem;
                    margin-bottom: 1.5rem;
                    border-color: var(--gray-5, #d1d5db);
                }
                /* Better blockquote styling */
                .vprose blockquote {
                    margin-top: 1.25rem;
                    margin-bottom: 1.25rem;
                    padding-left: 1rem;
                    border-left-width: 3px;
                    border-left-color: var(--gray-6, #d1d5db);
                    color: var(--gray-11, #6b7280);
                }
                /* Code blocks */
                .vprose pre {
                    margin-top: 1rem;
                    margin-bottom: 1rem;
                    padding: 1rem;
                    border-radius: 0.5rem;
                    overflow-x: auto;
                }
            `}</style>

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
                <div className="flex-1 flex flex-col justify-start pb-4 space-y-2 w-full max-w-full">
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
                                    // Render streaming message with reveal animation
                                    return (
                                        <MessageErrorBoundary key={`streaming-${group.streamingId}-${groupIndex}`}>
                                            <StreamingMessage
                                                text={group.text}
                                                workstreamId={group.workstreamId}
                                                isComplete={group.isComplete}
                                                timestamp={group.startTimestamp}
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
                            {/* Incomplete streaming - uses StreamingMessage for reveal animation */}
                            {incompleteStreaming.map(({ id, data }) => (
                                <MessageErrorBoundary key={`streaming-incomplete-${id}`}>
                                    <StreamingMessage
                                        text={data.text}
                                        workstreamId={data.workstreamId}
                                        isComplete={false}
                                        timestamp={data.startTimestamp}
                                    />
                                </MessageErrorBoundary>
                            ))}
                            {/* Working indicator - shows agent is actively processing */}
                            {isAgentWorking && incompleteStreaming.length === 0 && (
                                <div className="flex items-center gap-3 pl-4 py-2 border-l-2 border-l-purple-500">
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
                                    // Render streaming message with reveal animation
                                    return (
                                        <MessageErrorBoundary key={`streaming-${group.streamingId}-${groupIndex}`}>
                                            <StreamingMessage
                                                text={group.text}
                                                workstreamId={group.workstreamId}
                                                isComplete={group.isComplete}
                                                timestamp={group.startTimestamp}
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
                            {/* Recent thinking messages - displayed with streaming reveal */}
                            {recentThinking.map((thinking, idx) => (
                                <MessageErrorBoundary key={`thinking-${thinking.timestamp}-${idx}`}>
                                    <StreamingMessage
                                        text={processThinkingPlaceholder(thinking.message || '', thinkingMessageIndex)}
                                        workstreamId={getWorkstreamId(thinking)}
                                        isComplete={idx < recentThinking.length - 1} // Only latest is still "streaming"
                                        timestamp={thinking.timestamp}
                                    />
                                </MessageErrorBoundary>
                            ))}
                            {/* Incomplete streaming - uses StreamingMessage for reveal animation */}
                            {incompleteStreaming.map(({ id, data }) => (
                                <MessageErrorBoundary key={`streaming-incomplete-${id}`}>
                                    <StreamingMessage
                                        text={data.text}
                                        workstreamId={data.workstreamId}
                                        isComplete={false}
                                        timestamp={data.startTimestamp}
                                    />
                                </MessageErrorBoundary>
                            ))}
                            {/* Working indicator - shows agent is actively processing */}
                            {isAgentWorking && recentThinking.length === 0 && incompleteStreaming.length === 0 && (
                                <div className="flex items-center gap-3 pl-4 py-2 border-l-2 border-l-purple-500">
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
