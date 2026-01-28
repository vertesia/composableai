import { AgentMessage, AgentMessageType, Plan } from "@vertesia/common";
import React, { useEffect, useMemo, useState } from "react";
import MessageItem from "./MessageItem";
import WorkstreamTabs, { extractWorkstreams, filterMessagesByWorkstream } from "./WorkstreamTabs";
import { DONE_STATES, getWorkstreamId } from "./utils";

/**
 * Configuration passed to renderMessage callback
 */
export interface RenderMessageConfig {
    /** Whether this is the latest message in the list */
    isLatest: boolean;
    /** Whether to show the pulsating circle indicator */
    showPulsatingCircle: boolean;
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
    /**
     * Optional render prop for customizing message rendering.
     * If not provided, the default MessageItem component is used.
     * This allows consumers to provide their own styled message wrapper
     * while using MessageContent for the actual content rendering.
     */
    renderMessage?: (message: AgentMessage, config: RenderMessageConfig) => React.ReactNode;
}

function AllMessagesMixedComponent({
    messages,
    bottomRef,
    viewMode = 'stacked',
    isCompleted = false,
    renderMessage,
}: AllMessagesMixedProps) {
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const [activeWorkstream, setActiveWorkstream] = useState<string>("all");

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, bottomRef]);

    // Sort all messages chronologically
    const sortedMessages = React.useMemo(
        () =>
            [...messages].sort((a, b) => {
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
            className="flex-1 min-h-0 h-full overflow-y-auto px-4 sm:px-2 lg:px-4 flex flex-col relative"
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
                        // Stacked view - show all messages in the current workstream
                        // Add pulsating circle to the latest message if not completed
                        displayMessages.map((message, index) => {
                            // Find if this is the latest non-completion message
                            const isLatest = index === displayMessages.length - 1;
                            const showPulsatingCircle = !isCompleted &&
                                isLatest &&
                                !DONE_STATES.includes(message.type);

                            // Use renderMessage if provided, otherwise use default MessageItem
                            if (renderMessage) {
                                return (
                                    <React.Fragment key={`${message.timestamp}-${index}`}>
                                        {renderMessage(message, { isLatest, showPulsatingCircle })}
                                    </React.Fragment>
                                );
                            }

                            return (
                                <MessageItem
                                    key={`${message.timestamp}-${index}`}
                                    message={message}
                                    showPulsatingCircle={showPulsatingCircle}
                                />
                            );
                        })
                    ) : (
                        // Sliding view - only permanent messages and latest thinking from the current workstream
                        <>
                            {/* Get all messages to display in sliding view */}
                            {(() => {
                                // First get all permanent messages (ANSWER, QUESTION, COMPLETE, REQUEST_INPUT, IDLE, TERMINATED)
                                const permanentMessages = displayMessages.filter(msg =>
                                    msg.type === AgentMessageType.ANSWER ||
                                    msg.type === AgentMessageType.QUESTION ||
                                    msg.type === AgentMessageType.COMPLETE ||
                                    msg.type === AgentMessageType.IDLE ||
                                    msg.type === AgentMessageType.REQUEST_INPUT ||
                                    msg.type === AgentMessageType.TERMINATED
                                );

                                // Then get the latest thinking message if not completed
                                const latestThinkingMessage = !isCompleted ?
                                    displayMessages
                                        .filter(msg =>
                                            msg.type === AgentMessageType.THOUGHT ||
                                            msg.type === AgentMessageType.UPDATE ||
                                            msg.type === AgentMessageType.PLAN)
                                        .sort((a, b) => {
                                            const timeA = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime();
                                            const timeB = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime();
                                            return timeB - timeA; // Sort descending - newest first
                                        })[0]
                                    : null;

                                // Sort all messages by timestamp
                                const allMessages = [...permanentMessages];
                                if (latestThinkingMessage) {
                                    allMessages.push(latestThinkingMessage);
                                }

                                allMessages.sort((a, b) => {
                                    const timeA = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime();
                                    const timeB = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime();
                                    return timeA - timeB; // Sort ascending - oldest first
                                });

                                // Show pulsating circle only on the latest message if not completed
                                return allMessages.map((message, index) => {
                                    const isLatest = index === allMessages.length - 1;
                                    const showPulsatingCircle = !isCompleted &&
                                        isLatest &&
                                        !DONE_STATES.includes(message.type);

                                    // Use renderMessage if provided, otherwise use default MessageItem
                                    if (renderMessage) {
                                        return (
                                            <React.Fragment key={`${message.timestamp}-${index}`}>
                                                {renderMessage(message, { isLatest, showPulsatingCircle })}
                                            </React.Fragment>
                                        );
                                    }

                                    return (
                                        <MessageItem
                                            key={`${message.timestamp}-${index}`}
                                            message={message}
                                            showPulsatingCircle={showPulsatingCircle}
                                        />
                                    );
                                });
                            })()}

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
