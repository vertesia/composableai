import { AgentMessage, AgentMessageType } from "@vertesia/common";
import { Button, cn } from "@vertesia/ui/core";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { AnimatedThinkingDots, PulsatingCircle, PulsingMessageLoader } from "./AnimatedThinkingDots";
import MessageItem from "./ModernAgentOutput/MessageItem";
import { ThinkingMessages } from "./WaitingMessages";

interface SlidingThinkingIndicatorProps {
    messages: AgentMessage[];
    isCompleted: boolean;
    thinkingMessageIndex: number;
    className?: string;
    renderMessage?: (message: AgentMessage) => React.ReactNode;
    // Optional props to control showDetails from parent
    showDetails?: boolean;
    onShowDetailsChange?: (show: boolean) => void;
}

type ViewMode = "sliding" | "stacked";

export function SlidingThinkingIndicator({
    messages,
    isCompleted,
    thinkingMessageIndex,
    className,
    renderMessage,
    showDetails: externalShowDetails,
    onShowDetailsChange,
}: SlidingThinkingIndicatorProps) {
    // Use external state if provided, otherwise use internal state
    const [internalShowDetails, setInternalShowDetails] = useState(false);

    // Use external state if provided, otherwise use internal state
    const showDetails = externalShowDetails !== undefined ? externalShowDetails : internalShowDetails;

    // Function to update showDetails state (internal or external)
    const setShowDetails = (value: boolean) => {
        if (onShowDetailsChange) {
            onShowDetailsChange(value);
        } else {
            setInternalShowDetails(value);
        }
    };

    const [viewMode, setViewMode] = useState<ViewMode>(() => {
        // Initialize from localStorage if available
        if (typeof window !== "undefined") {
            const savedMode = window.localStorage.getItem("agent-view-mode");
            return (savedMode === "stacked" ? "stacked" : "sliding") as ViewMode;
        }
        return "sliding";
    });
    const [visibleMessage, setVisibleMessage] = useState<AgentMessage | null>(null);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Listen for view mode changes from the top bar
    useEffect(() => {
        const handleViewModeChange = () => {
            if (typeof window !== "undefined") {
                const newMode = window.localStorage.getItem("agent-view-mode");
                setViewMode(newMode === "stacked" ? "stacked" : "sliding");
            }
        };

        window.addEventListener("agent-view-mode-changed", handleViewModeChange);
        return () => {
            window.removeEventListener("agent-view-mode-changed", handleViewModeChange);
        };
    }, []);

    // Filter for thinking-type messages
    const thinkingMessages = messages.filter(
        (msg) =>
            msg.type === AgentMessageType.THOUGHT ||
            msg.type === AgentMessageType.UPDATE ||
            msg.type === AgentMessageType.PLAN,
    );

    // Track recent messages for cascading display
    const [recentMessages, setRecentMessages] = useState<AgentMessage[]>([]);

    // Keep track of the previous permanent message count
    const [prevPermanentCount, setPrevPermanentCount] = useState(0);

    // Update messages to display when thinking messages change
    useEffect(() => {
        // Show details is enabled - don't need to manage sliding messages
        if (showDetails) {
            return;
        }

        // Get permanent messages to detect when a new permanent message arrives
        const permanentMessages = getPermanentMessages(messages);

        // Check if we received a new permanent message
        const receivedNewPermanentMessage = permanentMessages.length > prevPermanentCount;

        // Update previous permanent message count for next check
        if (permanentMessages.length !== prevPermanentCount) {
            setPrevPermanentCount(permanentMessages.length);
        }

        if (thinkingMessages.length > 0 && !isCompleted) {
            // Get sorted recent messages (latest 3)
            const sortedMessages = [...thinkingMessages]
                .sort((a, b) => {
                    const timeA = typeof a.timestamp === "number" ? a.timestamp : new Date(a.timestamp).getTime();
                    const timeB = typeof b.timestamp === "number" ? b.timestamp : new Date(b.timestamp).getTime();
                    return timeB - timeA;
                })
                .slice(0, 3);

            // Get the latest message
            const latestMessage = sortedMessages[0];

            // Clear messages when we get a new permanent message (e.g., after a pause)
            if (receivedNewPermanentMessage) {
                setVisibleMessage(null);
                setRecentMessages([]);
                setIsTransitioning(false);

                // If there are new thinking messages after the permanent message, show them
                if (latestMessage) {
                    setTimeout(() => {
                        setVisibleMessage(latestMessage);
                        setRecentMessages(sortedMessages);
                    }, 500); // Small delay to ensure UI updates correctly
                }
                return;
            }

            // Check if we have new messages
            const hasNewMessage =
                !visibleMessage ||
                (latestMessage &&
                    // Compare timestamps properly accounting for different formats
                    (typeof latestMessage.timestamp === "number" || typeof visibleMessage.timestamp === "number"
                        ? // If either is a number, convert both to numbers for comparison
                        (typeof latestMessage.timestamp === "number"
                            ? latestMessage.timestamp
                            : new Date(latestMessage.timestamp).getTime()) !==
                        (typeof visibleMessage.timestamp === "number"
                            ? visibleMessage.timestamp
                            : new Date(visibleMessage.timestamp).getTime())
                        : latestMessage.timestamp !== visibleMessage.timestamp));

            if (hasNewMessage) {
                // If we already have a message, transition it out before showing the new one
                if (visibleMessage) {
                    setIsTransitioning(true);

                    // Clear any existing timeout
                    if (timeoutRef.current) {
                        clearTimeout(timeoutRef.current);
                    }

                    // Set timeout to switch to the new messages after transition
                    timeoutRef.current = setTimeout(() => {
                        setVisibleMessage(latestMessage);
                        setRecentMessages(sortedMessages);

                        // Small delay before showing the new message (for better visual effect)
                        setTimeout(() => {
                            setIsTransitioning(false);
                        }, 50);
                    }, 400); // Match with our animation duration
                } else {
                    // No current message, just show the new ones
                    setVisibleMessage(latestMessage);
                    setRecentMessages(sortedMessages);

                    // Add a small delay for animation to start from the correct state
                    setTimeout(() => {
                        setIsTransitioning(false);
                    }, 10);
                }
            } else if (recentMessages.length === 0) {
                // Initial setup - populate recent messages
                setRecentMessages(sortedMessages);
            }
        } else if (isCompleted && !showDetails) {
            // When completed, don't remove messages if showDetails is true
            // Only fade out the message if we're completed and not showing details
            if (visibleMessage) {
                setIsTransitioning(true);

                // Clear any existing timeout
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                }

                // Set timeout to remove the message after transition
                timeoutRef.current = setTimeout(() => {
                    setVisibleMessage(null);
                    setRecentMessages([]);
                }, 400); // Match with our animation duration
            }
        }

        // Cleanup timeout on unmount
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [messages, isCompleted, showDetails, prevPermanentCount]);

    // Choose the color based on message type (using valid color values)
    const getThinkingColor = (message: AgentMessage | null): "blue" | "purple" | "teal" | "green" => {
        if (!message) return "blue";

        switch (message.type) {
            case AgentMessageType.THOUGHT:
                return "purple";
            case AgentMessageType.PLAN:
                return "teal";
            case AgentMessageType.UPDATE:
            default:
                return "blue";
        }
    };

    // Get the messageText with thinking message replacement
    const getMessageText = (message: AgentMessage | null): string => {
        if (!message) return ThinkingMessages[thinkingMessageIndex];

        let messageText = message.message || ThinkingMessages[thinkingMessageIndex];

        // Replace %thinking_message% placeholder with a thinking message
        if (messageText.includes("%thinking_message%")) {
            messageText = messageText.replace(/%thinking_message%/g, ThinkingMessages[thinkingMessageIndex]);
        }

        return messageText;
    };

    // Using the modernized MessageItem component to render thinking messages
    const ThinkingMessageItem = React.memo(({ message }: { message: AgentMessage }) => {
        // Replace the textContent with the thinking message text if needed
        const modifiedMessage = {
            ...message,
            message: getMessageText(message),
        };

        // Simple implementation with just MessageItem and PulsatingCircle
        return (
            <div className="message-item-container">
                <MessageItem
                    message={modifiedMessage}
                    showPulsatingCircle={true}
                />
            </div>
        );
    });

    // Use provided render function or our component
    const renderThinkingMessage =
        renderMessage || ((message: AgentMessage) => <ThinkingMessageItem message={message} />);

    // Sort thinking messages by timestamp (reverse order - newest first)
    const sortedThinkingMessages = [...thinkingMessages].sort((a, b) => {
        const timeA = typeof a.timestamp === "number" ? a.timestamp : new Date(a.timestamp).getTime();
        const timeB = typeof b.timestamp === "number" ? b.timestamp : new Date(b.timestamp).getTime();
        return timeB - timeA; // Reversed order - newest first
    });

    return (
        <div className={cn("relative w-full p-0 m-0", className)}>
            {thinkingMessages.length > 0 && (
                <div className="flex justify-end items-center mb-2">
                    <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setShowDetails(!showDetails)}
                        className="text-slate-500 hover:text-slate-700 flex items-center gap-1 text-xs"
                        title={showDetails ? "Hide thinking details" : "Show all messages"}
                    >
                        {showDetails ? (
                            <>
                                <EyeOffIcon className="h-3 w-3" /> Hide details
                            </>
                        ) : (
                            <>
                                <EyeIcon className="h-3 w-3" /> Show details
                            </>
                        )}
                    </Button>
                </div>
            )}

            {/* Render based on view mode */}
            {
                (showDetails || thinkingMessages.length > 0) &&
                (showDetails ? (
                    // Show details view - always show all thinking messages regardless of completion state
                    <div className="space-y-1 space-y-reverse max-h-[300px] overflow-y-auto pr-1 flex flex-col-reverse">
                        {sortedThinkingMessages.map((message, index) => (
                            <div
                                key={`${message.timestamp}-${index}`}
                                className="animate-slide-in-bottom"
                                data-workstream-id={message.workstream_id || "main"}
                            >
                                {renderThinkingMessage(message)}
                            </div>
                        ))}
                    </div>
                ) : !isCompleted ? (
                    // Not showing details and not completed - use sliding/stacked view
                    viewMode === "sliding" ? (
                        // Progressive Fading View - Show recent messages with fading effect
                        <div
                            className={cn(
                                "relative overflow-hidden flex flex-col-reverse space-y-reverse space-y-2 p-0 m-0 w-full",
                                { hidden: recentMessages.length === 0 },
                            )}
                        >
                            {/* For each recent message, render with different opacity based on recency */}
                            {recentMessages.map((message, index) => (
                                <div
                                    key={`${message.timestamp}-${index}`}
                                    className={cn(
                                        "flex items-center", // Align items horizontally on same line
                                        // Use the new animations for smoother transitions
                                        {
                                            // Latest message (index 0) animated with slide in/out from bottom
                                            "animate-slide-in-bottom": index === 0 && !isTransitioning,
                                            "animate-slide-out-bottom": index === 0 && isTransitioning,

                                            // Older messages with progressively lower opacity and subtle animations
                                            "opacity-70": index === 1,
                                            "opacity-40": index === 2,
                                        },
                                    )}
                                    style={{
                                        zIndex: recentMessages.length - index,
                                        transform: `scale(${1 - index * 0.03})`, // Slightly smaller for older messages
                                        // No indentation - keep all messages aligned on the left
                                    }}
                                    data-workstream-id={message.workstream_id || "main"}
                                >
                                    {/* Only show pulsating circle for the most recent message */}
                                    {index === 0 ? (
                                        renderThinkingMessage(message)
                                    ) : (
                                        <div
                                            className={cn(
                                                "py-2 px-3 border-l-2 bg-white dark:bg-slate-800 flex items-center w-full",
                                                "transition-all duration-200 ease-in-out rounded-r-md",
                                                // Set border color based on message type
                                                {
                                                    "border-blue-400 dark:border-blue-500":
                                                        getThinkingColor(message) === "blue",
                                                    "border-purple-400 dark:border-purple-500":
                                                        getThinkingColor(message) === "purple",
                                                    "border-teal-400 dark:border-teal-500":
                                                        getThinkingColor(message) === "teal",
                                                },
                                            )}
                                        >
                                            {/* Add an indicator based on message type */}
                                            <div className="mr-2">
                                                {getThinkingColor(message) === "blue" && (
                                                    <div className="w-4">
                                                        <PulsingMessageLoader
                                                            message=""
                                                            color="blue"
                                                            className="scale-75 transform-gpu origin-left"
                                                        />
                                                    </div>
                                                )}
                                                {getThinkingColor(message) === "purple" && (
                                                    <PulsatingCircle
                                                        size="sm"
                                                        color="purple"
                                                        className="scale-75"
                                                    />
                                                )}
                                                {getThinkingColor(message) === "teal" && (
                                                    <AnimatedThinkingDots
                                                        color="teal"
                                                        className="scale-75 transform-gpu origin-left"
                                                    />
                                                )}
                                            </div>

                                            <div
                                                className={cn(
                                                    "text-sm font-medium flex-1 overflow-hidden text-ellipsis mr-3",
                                                    {
                                                        "text-blue-700 dark:text-blue-300":
                                                            getThinkingColor(message) === "blue",
                                                        "text-purple-700 dark:text-purple-300":
                                                            getThinkingColor(message) === "purple",
                                                        "text-teal-700 dark:text-teal-300":
                                                            getThinkingColor(message) === "teal",
                                                    },
                                                )}
                                            >
                                                {getMessageText(message)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        // Stacked View - Show all thinking messages
                        <div className="space-y-1 space-y-reverse max-h-[300px] overflow-y-auto pr-1 flex flex-col-reverse">
                            {sortedThinkingMessages.map((message, index) => (
                                <div
                                    key={`${message.timestamp}-${index}`}
                                    className="animate-slide-in-bottom"
                                    data-workstream-id={message.workstream_id || "main"}
                                >
                                    {renderThinkingMessage(message)}
                                </div>
                            ))}
                        </div>
                    )
                ) : null) // When completed and not showing details, don't show anything
            }
        </div>
    );
}

// Helper function to determine if a message is a thinking message (transient)
export function isThinkingMessage(message: AgentMessage): boolean {
    return (
        message.type === AgentMessageType.THOUGHT ||
        message.type === AgentMessageType.UPDATE ||
        message.type === AgentMessageType.PLAN ||
        message.type === AgentMessageType.ERROR ||
        message.type === AgentMessageType.WARNING ||
        message.type === AgentMessageType.SYSTEM
    );
}

// Helper function to determine if a message is a permanent message (always displayed)
export function isPermanentMessage(message: AgentMessage): boolean {
    return (
        message.type === AgentMessageType.ANSWER ||
        message.type === AgentMessageType.QUESTION ||
        message.type === AgentMessageType.COMPLETE ||
        message.type === AgentMessageType.IDLE ||
        message.type === AgentMessageType.REQUEST_INPUT
    );
}

// Helper function to get all thinking messages
export function getThinkingMessages(messages: AgentMessage[]): AgentMessage[] {
    return messages.filter(isThinkingMessage);
}

// Helper function to get all permanent messages
export function getPermanentMessages(messages: AgentMessage[]): AgentMessage[] {
    return messages.filter(isPermanentMessage);
}
