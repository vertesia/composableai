import { AgentMessage, AgentMessageType, BatchProgressDetails, Plan } from "@vertesia/common";
import React, { useEffect, useMemo, useState, useRef, useCallback, Component, ReactNode } from "react";
import { cn } from "@vertesia/ui/core";
import { PulsatingCircle } from "../AnimatedThinkingDots";
export type AgentConversationViewMode = "stacked" | "sliding";
import BatchProgressPanel, { type BatchProgressPanelClassNames } from "./BatchProgressPanel";
import MessageItem, { type MessageItemClassNames, type MessageItemProps } from "./MessageItem";
import StreamingMessage, { type StreamingMessageClassNames } from "./StreamingMessage";
import ToolCallGroup, { type ToolCallGroupClassNames } from "./ToolCallGroup";
import WorkstreamTabs, { extractWorkstreams, filterMessagesByWorkstream } from "./WorkstreamTabs";
import { DONE_STATES, getWorkstreamId, groupMessagesWithStreaming, mergeConsecutiveToolGroups, RenderableGroup, StreamingData } from "./utils";
import { ThinkingMessages } from "../WaitingMessages";

/** Extended group that may carry preamble info (text from a preceding single/streaming message) */
type RenderableGroupWithPreamble = RenderableGroup & {
    preambleText?: string;
    preambleMessage?: AgentMessage;
    /** When true, this group was consumed as a preamble and should not render */
    _consumed?: boolean;
};

/** Message types that must never be consumed as preamble text */
const NON_PREAMBLE_TYPES = new Set([
    AgentMessageType.QUESTION,
    AgentMessageType.COMPLETE,
    AgentMessageType.IDLE,
    AgentMessageType.TERMINATED,
    AgentMessageType.ERROR,
    AgentMessageType.REQUEST_INPUT,
    AgentMessageType.BATCH_PROGRESS,
]);

/**
 * Scan grouped messages and attach preamble text to tool_groups.
 * When a single message (THOUGHT, UPDATE, ANSWER, etc.) immediately precedes
 * a tool_group, the text is attached as preamble and the single message is marked
 * as consumed so it doesn't render as a separate "Agent" box.
 */
function attachPreambles(groups: RenderableGroup[]): RenderableGroupWithPreamble[] {
    const result: RenderableGroupWithPreamble[] = groups.map(g => ({ ...g }));

    for (let i = 1; i < result.length; i++) {
        const current = result[i];
        const prev = result[i - 1];

        // Only attach preamble to tool_groups
        if (current.type !== 'tool_group') continue;
        // Previous must be a single message with text content
        if (prev.type !== 'single' || prev._consumed) continue;

        const msg = prev.message;
        const text = typeof msg.message === 'string' ? msg.message.trim() : '';
        if (!text) continue;

        // Skip messages that are tool activity themselves (already part of tool groups)
        const isToolActivity = msg.details?.tool || msg.details?.tools;
        if (isToolActivity) continue;

        // Skip terminal/interactive message types that should always render independently
        if (NON_PREAMBLE_TYPES.has(msg.type)) continue;

        // Attach as preamble
        current.preambleText = text;
        current.preambleMessage = msg;
        prev._consumed = true;
    }

    // Filter out consumed groups
    return result.filter(g => !g._consumed);
}

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

const shouldDedupeAdjacentMessage = (previous: AgentMessage, current: AgentMessage): boolean => {
    if (previous.type !== current.type) return false;
    if (previous.message !== current.message) return false;

    const prevDetails = previous.details as { tool_status?: string } | undefined;
    const currDetails = current.details as { tool_status?: string } | undefined;
    if (prevDetails?.tool_status !== "completed" || currDetails?.tool_status !== "completed") return false;

    const prevTs = typeof previous.timestamp === "number" ? previous.timestamp : new Date(previous.timestamp).getTime();
    const currTs = typeof current.timestamp === "number" ? current.timestamp : new Date(current.timestamp).getTime();
    return currTs - prevTs < 2000;
};

// Error boundary to catch and isolate errors in individual message components
// Note: Markdown parsing errors are handled internally by MarkdownRenderer,
// so this mainly catches other component errors (e.g., artifact loading, charts)
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

    componentDidUpdate(prevProps: { children: ReactNode }) {
        // Auto-reset error state when children change
        // This allows recovery from transient errors during streaming
        if (this.state.hasError && prevProps.children !== this.props.children) {
            this.setState({ hasError: false, error: undefined });
        }
    }

    render() {
        if (this.state.hasError) {
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
    /** className overrides passed to every MessageItem */
    messageItemClassNames?: MessageItemClassNames;
    /** Sparse MESSAGE_STYLES overrides passed to every MessageItem */
    messageStyleOverrides?: MessageItemProps['messageStyleOverrides'];
    toolCallGroupClassNames?: ToolCallGroupClassNames;
    /** Hide ToolCallGroup in this view mode */
    hideToolCallsInViewMode?: AgentConversationViewMode[];
    streamingMessageClassNames?: StreamingMessageClassNames;
    batchProgressPanelClassNames?: BatchProgressPanelClassNames;
    /** Run ID used to resolve artifact references in streaming chart specs */
    artifactRunId?: string;
    /** Hide the workstream tabs entirely */
    hideWorkstreamTabs?: boolean;
    /** className override for the working indicator container */
    workingIndicatorClassName?: string;
    /** className override for the message list container (spacing/layout) */
    messageListClassName?: string;
    /** Custom component to render store/document links instead of default NavLink navigation */
    StoreLinkComponent?: React.ComponentType<{ href: string; documentId: string; children: React.ReactNode }>;
    /** Custom component to render store/collection links instead of default NavLink navigation */
    CollectionLinkComponent?: React.ComponentType<{ href: string; collectionId: string; children: React.ReactNode }>;
    /** Optional message to display as the first user message in the conversation.
     *  Purely visual/UI — not sent to temporal. Renders as a QUESTION MessageItem before real messages. */
    prependFriendlyMessage?: string;
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
    messageItemClassNames,
    messageStyleOverrides,
    toolCallGroupClassNames,
    hideToolCallsInViewMode,
    streamingMessageClassNames,
    batchProgressPanelClassNames,
    artifactRunId,
    hideWorkstreamTabs,
    workingIndicatorClassName,
    messageListClassName,
    StoreLinkComponent,
    CollectionLinkComponent,
    prependFriendlyMessage,
}: AllMessagesMixedProps) {
    if (!artifactRunId) {
        console.warn('[AllMessagesMixed] artifactRunId prop is missing!');
    }

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

    // Sort all messages chronologically and dedupe adjacent identical messages
    // Low-signal messages are suppressed at the source (server-side) via shouldSuppressLowSignalMessage
    const sortedMessages = React.useMemo(
        () => {
            const sorted = [...messages].sort((a, b) => {
                const timeA = typeof a.timestamp === "number" ? a.timestamp : new Date(a.timestamp).getTime();
                const timeB = typeof b.timestamp === "number" ? b.timestamp : new Date(b.timestamp).getTime();
                return timeA - timeB;
            });

            const deduped: AgentMessage[] = [];
            for (const msg of sorted) {
                const previous = deduped[deduped.length - 1];
                if (previous && shouldDedupeAdjacentMessage(previous, msg)) {
                    continue;
                }
                deduped.push(msg);
            }
            return deduped;
        },
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
            (msg.type === AgentMessageType.THOUGHT && (msg.details?.tool || msg.details?.tools || msg.details?.streamed || msg.details?.display_role === "tool_preamble"))
        );

        // Latest thinking: show only the most recent generic thinking message (UPDATE/PLAN or THOUGHT without tool)
        // Tool progress is already in important messages
        const thinkingMessages = !isCompleted && !hasStreaming
            ? displayMessages
                .filter(msg =>
                    msg.type === AgentMessageType.UPDATE ||
                    msg.type === AgentMessageType.PLAN ||
                    (msg.type === AgentMessageType.THOUGHT &&
                        !msg.details?.tool &&
                        !msg.details?.tools &&
                        !msg.details?.streamed &&
                        msg.details?.display_role !== "tool_preamble"))
                .slice(-1) // Show only the latest thinking message
            : [];

        return { importantMessages: important, recentThinking: thinkingMessages };
    }, [displayMessages, isCompleted, streamingMessages.size]);

    // Split streaming messages:
    // - complete (or stale incomplete) ones are interleaved chronologically
    // - actively incomplete ones render at the end
    // This keeps live streaming performant while preventing old incomplete streams
    // from being pinned forever at the bottom.
    const { completeStreaming, incompleteStreaming } = React.useMemo(() => {
        const complete = new Map<string, StreamingData>();
        const incomplete: Array<{ id: string; data: StreamingData }> = [];
        const newestMessageTimestamp = displayMessages.length > 0
            ? Math.max(...displayMessages.map(msg =>
                typeof msg.timestamp === "number" ? msg.timestamp : new Date(msg.timestamp).getTime()
            ))
            : -Infinity;

        streamingMessages.forEach((data, id) => {
            // Filter by workstream if specified
            if (activeWorkstream && activeWorkstream !== "all") {
                const streamWorkstream = data.workstreamId || "main";
                if (activeWorkstream !== streamWorkstream) return;
            }

            // If a newer persisted message exists, this stream is stale and should be
            // treated as complete for ordering purposes.
            const isStale = data.startTimestamp <= newestMessageTimestamp;
            if (data.isComplete || isStale) {
                complete.set(id, data);
            } else if (data.text) {
                incomplete.push({ id, data });
            }
        });

        return { completeStreaming: complete, incompleteStreaming: incomplete };
    }, [streamingMessages, activeWorkstream, displayMessages]);

    // Group messages with ONLY complete streaming interleaved for stacked view
    // Incomplete streaming is rendered separately at the end (avoids re-grouping on every chunk)
    // Then attach preamble text from preceding reasoning messages to tool_groups
    const groupedMessages = React.useMemo(
        () => attachPreambles(mergeConsecutiveToolGroups(groupMessagesWithStreaming(displayMessages, completeStreaming, activeWorkstream))),
        [displayMessages, completeStreaming, activeWorkstream]
    );

    // Group important messages with ONLY complete streaming interleaved for sliding view
    const groupedImportantMessages = React.useMemo(
        () => attachPreambles(mergeConsecutiveToolGroups(groupMessagesWithStreaming(importantMessages, completeStreaming, activeWorkstream))),
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
            className="flex-1 min-h-0 h-full w-full max-w-full overflow-y-auto overflow-x-hidden px-1.5 sm:px-2.5 lg:px-3 flex flex-col relative focus:outline-none"
            data-testid="all-messages-mixed"
        >
            {/* Global styles for vprose markdown content */}
            <style>{`
                /* Better vertical rhythm for markdown */
                .vprose > * + * {
                    margin-top: 0.625rem;
                }
                .vprose > h1 + *,
                .vprose > h2 + *,
                .vprose > h3 + * {
                    margin-top: 0.375rem;
                }
                /* Tables need more separation and better styling */
                .vprose table {
                    margin-top: 0.875rem;
                    margin-bottom: 0.875rem;
                    border-collapse: collapse;
                    width: 100%;
                }
                .vprose th,
                .vprose td {
                    padding: 0.5rem 0.625rem;
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
                    margin-top: 1rem;
                    margin-bottom: 1rem;
                    border-color: var(--gray-5, #d1d5db);
                }
                /* Better blockquote styling */
                .vprose blockquote {
                    margin-top: 0.875rem;
                    margin-bottom: 0.875rem;
                    padding-left: 1rem;
                    border-left-width: 3px;
                    border-left-color: var(--gray-6, #d1d5db);
                    color: var(--gray-11, #6b7280);
                }
                /* Code blocks */
                .vprose pre {
                    margin-top: 0.75rem;
                    margin-bottom: 0.75rem;
                    padding: 0.75rem;
                    border-radius: 0.5rem;
                    overflow-x: auto;
                    background-color: var(--color-muted-background, #f3f4f6);
                    color: var(--color-foreground, #1f2937);
                }
                .vprose pre code {
                    color: inherit;
                }
                .dark .vprose pre {
                    color: var(--color-foreground, #f9fafb);
                }
            `}</style>

            {/* Workstream tabs with completion indicators */}
            <div className={cn("sticky top-0 z-10", hideWorkstreamTabs && "hidden")}>
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
                    <div className="flex items-center px-3 py-2 text-sm text-muted">
                        {activeWorkstream === "all"
                            ? "Waiting for agent response..."
                            : "No messages in this workstream yet..."}
                    </div>
                </div>
            ) : (
                <div className={cn("flex-1 flex flex-col justify-start pb-4 space-y-2 w-full max-w-full", messageListClassName)}>
                    {/* Friendly message — rendered outside the messages array to avoid memo issues/triggering autoscroll */}
                    {prependFriendlyMessage && (
                        <MessageItem
                            key={prependFriendlyMessage}
                            {...messageItemClassNames}
                            messageStyleOverrides={messageStyleOverrides}
                            message={{
                                type: AgentMessageType.QUESTION,
                                message: prependFriendlyMessage,
                                timestamp: displayMessages[0]?.timestamp ?? Date.now(),
                                workflow_run_id: "",
                                workstream_id: "main",
                            }}
                        />
                    )}
                    {/* Show either all messages or just sliding view depending on viewMode */}
                    {viewMode === 'stacked' ? (
                        // Details view - show ALL messages with streaming interleaved
                        <>
                            {groupedMessages.map((group, groupIndex) => {
                                const isLastGroup = groupIndex === groupedMessages.length - 1;

                                if (group.type === 'tool_group') {
                                    // Render grouped tool calls
                                    const lastMessage = group.messages[group.messages.length - 1];
                                    const isTerminalToolStatus =
                                        group.toolStatus === "completed" ||
                                        group.toolStatus === "error" ||
                                        group.toolStatus === "warning";
                                    const isLatest = !isCompleted &&
                                        isLastGroup &&
                                        !DONE_STATES.includes(lastMessage.type) &&
                                        !isTerminalToolStatus;

                                    if (hideToolCallsInViewMode?.includes(viewMode)) return null;
                                    return (
                                        <MessageErrorBoundary key={`group-${group.toolRunId || group.firstTimestamp}-${groupIndex}`}>
                                            <ToolCallGroup
                                                messages={group.messages}
                                                showPulsatingCircle={isLatest}
                                                toolRunId={group.toolRunId}
                                                toolStatus={group.toolStatus}
                                                preambleText={group.preambleText}
                                                preambleMessage={group.preambleMessage}
                                                {...toolCallGroupClassNames}
                                            />
                                        </MessageErrorBoundary>
                                    );
                                } else if (group.type === 'streaming') {
                                    // Render streaming message - no error boundary to avoid interrupting streaming
                                    return (
                                        <StreamingMessage
                                            key={`streaming-${group.streamingId}-${groupIndex}`}
                                            text={group.text}
                                            workstreamId={group.workstreamId}
                                            isComplete={group.isComplete}
                                            timestamp={group.startTimestamp}
                                            artifactRunId={artifactRunId}
                                            {...streamingMessageClassNames}
                                        />
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
                                                    {...batchProgressPanelClassNames}
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
                                                {...messageItemClassNames}
                                                messageStyleOverrides={messageStyleOverrides}
                                                StoreLinkComponent={StoreLinkComponent}
                                                CollectionLinkComponent={CollectionLinkComponent}
                                            />
                                        </MessageErrorBoundary>
                                    );
                                }
                            })}
                            {/* Incomplete streaming - no error boundary to avoid interrupting streaming */}
                            {incompleteStreaming.map(({ id, data }) => (
                                <StreamingMessage
                                    key={`streaming-incomplete-${id}`}
                                    text={data.text}
                                    workstreamId={data.workstreamId}
                                    isComplete={false}
                                    timestamp={data.startTimestamp}
                                    artifactRunId={artifactRunId}
                                    {...streamingMessageClassNames}
                                />
                            ))}
                            {/* Working indicator - shows agent is actively processing */}
                            {isAgentWorking && incompleteStreaming.length === 0 && (
                                <div className={cn("flex items-center gap-2 pl-3 py-1.5 border-l-2 border-l-purple-500", workingIndicatorClassName)}>
                                    <PulsatingCircle size="sm" color="blue" />
                                    <span className="text-xs text-muted">Working...</span>
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
                                    const isTerminalToolStatus =
                                        group.toolStatus === "completed" ||
                                        group.toolStatus === "error" ||
                                        group.toolStatus === "warning";
                                    const isLatest = !isCompleted &&
                                        recentThinking.length === 0 &&
                                        isLastGroup &&
                                        !DONE_STATES.includes(lastMessage.type) &&
                                        !isTerminalToolStatus;

                                    if (hideToolCallsInViewMode?.includes(viewMode)) return null;
                                    return (
                                        <MessageErrorBoundary key={`group-${group.toolRunId || group.firstTimestamp}-${groupIndex}`}>
                                            <ToolCallGroup
                                                messages={group.messages}
                                                showPulsatingCircle={isLatest}
                                                toolRunId={group.toolRunId}
                                                toolStatus={group.toolStatus}
                                                preambleText={group.preambleText}
                                                preambleMessage={group.preambleMessage}
                                                {...toolCallGroupClassNames}
                                            />
                                        </MessageErrorBoundary>
                                    );
                                } else if (group.type === 'streaming') {
                                    // Render streaming message - no error boundary to avoid interrupting streaming
                                    return (
                                        <StreamingMessage
                                            key={`streaming-${group.streamingId}-${groupIndex}`}
                                            text={group.text}
                                            workstreamId={group.workstreamId}
                                            isComplete={group.isComplete}
                                            timestamp={group.startTimestamp}
                                            artifactRunId={artifactRunId}
                                            {...streamingMessageClassNames}
                                        />
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
                                                    {...batchProgressPanelClassNames}
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
                                                {...messageItemClassNames}
                                                messageStyleOverrides={messageStyleOverrides}
                                                StoreLinkComponent={StoreLinkComponent}
                                                CollectionLinkComponent={CollectionLinkComponent}
                                            />
                                        </MessageErrorBoundary>
                                    );
                                }
                            })}
                            {/* Recent thinking messages - displayed with streaming reveal */}
                            {recentThinking.map((thinking, idx) => (
                                <StreamingMessage
                                    key={`thinking-${thinking.timestamp}-${idx}`}
                                    text={processThinkingPlaceholder(thinking.message || '', thinkingMessageIndex)}
                                    workstreamId={getWorkstreamId(thinking)}
                                    isComplete={idx < recentThinking.length - 1} // Only latest is still "streaming"
                                    timestamp={thinking.timestamp}
                                    artifactRunId={artifactRunId}
                                    {...streamingMessageClassNames}
                                />
                            ))}
                            {/* Incomplete streaming - no error boundary to avoid interrupting streaming */}
                            {incompleteStreaming.map(({ id, data }) => (
                                <StreamingMessage
                                    key={`streaming-incomplete-${id}`}
                                    text={data.text}
                                    workstreamId={data.workstreamId}
                                    isComplete={false}
                                    timestamp={data.startTimestamp}
                                    artifactRunId={artifactRunId}
                                    {...streamingMessageClassNames}
                                />
                            ))}
                            {/* Working indicator - shows agent is actively processing */}
                            {isAgentWorking && recentThinking.length === 0 && incompleteStreaming.length === 0 && (
                                <div className={cn("flex items-center gap-2 pl-3 py-1.5 border-l-2 border-l-purple-500", workingIndicatorClassName)}>
                                    <PulsatingCircle size="sm" color="blue" />
                                    <span className="text-xs text-muted">Working...</span>
                                </div>
                            )}
                        </>
                    )}
                    <div ref={bottomRef} className="h-2" />
                </div>
            )}
        </div>
    );
}

const AllMessagesMixed = React.memo(AllMessagesMixedComponent);

export default AllMessagesMixed;
