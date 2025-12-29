import { AgentMessage, AgentMessageType } from "@vertesia/common";
import { Badge, Button, useToast } from "@vertesia/ui/core";
import dayjs from "dayjs";
import { AlertCircle, Bot, CheckCircle, Clock, CopyIcon, Info, MessageSquare, User } from "lucide-react";
import React, { useState } from "react";
import { AnimatedThinkingDots, PulsatingCircle } from "../AnimatedThinkingDots";
import { ThinkingMessages } from "../WaitingMessages";
import MessageContent from "./MessageContent";
import { getWorkstreamId } from "./utils";

interface MessageItemProps {
    message: AgentMessage;
    showPulsatingCircle?: boolean;
}

export default function MessageItem({ message, showPulsatingCircle = false }: MessageItemProps) {
    const [showDetails, setShowDetails] = useState(false);
    const toast = useToast();

    // Simplified message styling with minimal distinction between different types
    const getMessageStyles = () => {
        // Common styling for all messages with subtle type indication
        const baseStyle = {
            containerClass: "bg-white border-l-4 border-l-muted/30 shadow-sm",
            iconComponent: <Bot className="size-4 text-muted" />,
            sender: "",
        };

        // Just add minimal type indicators
        switch (message.type) {
            case AgentMessageType.ANSWER:
                return {
                    ...baseStyle,
                    containerClass: "bg-white border-l-4 border-l-muted/30 shadow-sm",
                    iconComponent: <Bot className="size-4 text-muted" />,
                    sender: "Agent",
                };
            case AgentMessageType.COMPLETE:
                return {
                    ...baseStyle,
                    containerClass: "bg-white border-l-4 border-l-success shadow-sm",
                    iconComponent: <CheckCircle className="size-4 text-success" />,
                    sender: "Completed",
                };
            case AgentMessageType.TERMINATED:
                return {
                    ...baseStyle,
                    containerClass: "bg-white border-l-4 border-l-attention shadow-sm",
                    iconComponent: <CheckCircle className="size-4 text-attention" />,
                    sender: "Terminated",
                };
            case AgentMessageType.QUESTION:
                return {
                    ...baseStyle,
                    iconComponent: <User className="size-4 text-muted" />,
                    sender: "User",
                };
            case AgentMessageType.THOUGHT:
                return {
                    ...baseStyle,
                    iconComponent: showPulsatingCircle ? (
                        <PulsatingCircle size="sm" color="blue" />
                    ) : (
                        <Bot className="size-4 text-muted" />
                    ),
                    sender: "Agent",
                };
            case AgentMessageType.ERROR:
                return {
                    ...baseStyle,
                    iconComponent: <AlertCircle className="size-4 text-muted" />,
                    sender: "System",
                };
            case AgentMessageType.UPDATE:
                return {
                    ...baseStyle,
                    containerClass: "bg-white border-l-4 border-success shadow-sm",
                    iconComponent: <Info className="size-4 text-success" />,
                    sender: "Update",
                };
            case AgentMessageType.PLAN:
                return {
                    ...baseStyle,
                    iconComponent: <MessageSquare className="size-4 text-muted" />,
                    sender: "Agent",
                };
            default:
                return {
                    ...baseStyle,
                    sender: `Agent`,
                };
        }
    };

    const messageStyles = getMessageStyles();

    // Get message content as text for clipboard
    const getMessageTextForClipboard = () => {
        if (!message.message) return "";
        if (typeof message.message === "object") {
            return JSON.stringify(message.message, null, 2);
        }
        return String(message.message).trim();
    };

    // Copy message content to clipboard
    const copyToClipboard = () => {
        const messageContent = getMessageTextForClipboard();
        const detailsContent =
            typeof message.details === "string"
                ? message.details
                : message.details
                    ? JSON.stringify(message.details, null, 2)
                    : "";

        const textToCopy = [messageContent, detailsContent ? "\n\nDetails:\n" + detailsContent : ""].join("").trim();

        navigator.clipboard.writeText(textToCopy).then(() => {
            toast({
                status: "success",
                title: "Copied to clipboard",
                duration: 2000,
            });
        });
    };

    const workstreamId = getWorkstreamId(message);

    // Different styling based on message type
    const getMessageTypeStyles = () => {
        switch (message.type) {
            case AgentMessageType.ANSWER:
                return "border-l-info bg-info";
            case AgentMessageType.COMPLETE:
                return "border-l-success bg-success";
            case AgentMessageType.IDLE:
                return "border-l-muted bg-muted";
            case AgentMessageType.REQUEST_INPUT:
                return "border-l-attention bg-attention";
            case AgentMessageType.QUESTION:
                return "border-l-muted bg-muted";
            case AgentMessageType.THOUGHT:
                return "border-l-accent dark:border-l-purple-500 bg-purple-50/50 dark:bg-purple-900/10";
            case AgentMessageType.ERROR:
                return "border-l-destructive bg-destructive";
            case AgentMessageType.UPDATE:
                return "border-l-success bg-success";
            case AgentMessageType.PLAN:
                return "border-l-attention bg-attention";
            case AgentMessageType.TERMINATED:
                return "border-l-muted bg-muted";
            default:
                return "border-l-indigo-500 dark:border-l-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10";
        }
    };

    const messageTypeStyles = getMessageTypeStyles();

    // Get the color for the icon based on message type
    const getIconColor = () => {
        switch (message.type) {
            case AgentMessageType.ANSWER:
                return "text-info";
            case AgentMessageType.COMPLETE:
                return "text-success";
            case AgentMessageType.IDLE:
                return "text-muted";
            case AgentMessageType.REQUEST_INPUT:
                return "text-attention";
            case AgentMessageType.QUESTION:
                return "text-muted";
            case AgentMessageType.THOUGHT:
                return "text-purple-600 dark:text-purple-400";
            case AgentMessageType.ERROR:
                return "text-destructive";
            case AgentMessageType.UPDATE:
                return "text-success";
            case AgentMessageType.PLAN:
                return "text-attention";
            default:
                return "text-muted";
        }
    };

    // Get an icon for the message type with enhanced animations
    const getMessageIcon = () => {
        const iconColor = getIconColor();

        // Choose an animation style for thinking messages
        const getThinkingAnimation = (color: 'blue' | 'purple' | 'teal' | 'green' | 'amber') => {
            // Generate a deterministic but varying number based on the message timestamp
            // This ensures the same message always gets the same animation style
            const timestampNum = typeof message.timestamp === 'number'
                ? message.timestamp
                : new Date(message.timestamp).getTime();

            // Use only PulsatingCircle and AnimatedThinkingDots
            return (timestampNum % 2 === 0)
                ? <PulsatingCircle size="sm" color={color} />
                : <AnimatedThinkingDots color={color} />;
        };

        switch (message.type) {
            case AgentMessageType.ANSWER:
                return showPulsatingCircle ? (
                    getThinkingAnimation('blue')
                ) : (
                    <Bot className={`size-4 ${iconColor}`} />
                );
            case AgentMessageType.COMPLETE:
                return <CheckCircle className={`size-4 ${iconColor}`} />;
            case AgentMessageType.TERMINATED:
                return <CheckCircle className={`size-4 ${iconColor}`} />;
            case AgentMessageType.IDLE:
                return <Clock className={`size-4 ${iconColor}`} />;
            case AgentMessageType.REQUEST_INPUT:
                return <User className={`size-4 ${iconColor}`} />;
            case AgentMessageType.QUESTION:
                return <User className={`size-4 ${iconColor}`} />;
            case AgentMessageType.THOUGHT:
                return showPulsatingCircle ? (
                    getThinkingAnimation('purple')
                ) : (
                    <Bot className={`size-4 ${iconColor}`} />
                );
            case AgentMessageType.ERROR:
                return <AlertCircle className={`size-4 ${iconColor}`} />;
            case AgentMessageType.UPDATE:
                return showPulsatingCircle ? (
                    getThinkingAnimation('green')
                ) : (
                    <Info className={`size-4 ${iconColor}`} />
                );
            case AgentMessageType.PLAN:
                return showPulsatingCircle ? (
                    getThinkingAnimation('amber')
                ) : (
                    <MessageSquare className={`size-4 ${iconColor}`} />
                );
            default:
                return showPulsatingCircle ? (
                    getThinkingAnimation('blue')
                ) : (
                    <Bot className={`size-4 ${iconColor}`} />
                );
        }
    };

    return (
        <div
            className={`border-l-4 shadow-md overflow-hidden bg-white dark:bg-gray-900 mb-5 ${messageTypeStyles}`}
            data-workstream-id={workstreamId}
        >
            {/* Enhanced header with icon and timestamp */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100/80 dark:border-gray-800/80 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                    <div className={showPulsatingCircle ? "animate-fadeIn" : ""}>
                        {getMessageIcon()}
                    </div>
                    <span className="text-xs font-medium text-muted ">{messageStyles.sender}</span>

                    {/* Show workstream badge next to sender for better organization */}
                    {workstreamId !== "main" && workstreamId !== "all" && (
                        <Badge variant="default" className="text-xs text-muted">
                            {workstreamId}
                        </Badge>
                    )}
                </div>

                <div className="flex items-center gap-2 print:hidden">
                    <span className="text-xs text-muted">
                        {dayjs(message.timestamp).format("HH:mm:ss")}
                    </span>
                    <Button
                        variant="ghost" size="xs"
                        onClick={copyToClipboard}
                        className="text-muted"
                        title="Copy message"
                    >
                        <CopyIcon className="size-3" />
                    </Button>
                </div>
            </div>

            {/* Message content - uses MessageContent for rendering */}
            <div className="px-4 py-3 bg-white dark:bg-gray-900">
                <MessageContent message={message} />

                {/* Optional details section */}
                {message.details && (
                    <div className="mt-2 print:hidden">
                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            className="text-xs text-muted flex items-center"
                        >
                            {showDetails ? "Hide" : "Show"} details
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className={`h-3 w-3 ml-1 transition-transform ${showDetails ? "rotate-180" : ""}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {showDetails && (
                            <div className="mt-2 p-2 bg-muted border border-mixer-muted/40 rounded text-sm">
                                <pre className="text-xs font-mono whitespace-pre-wrap overflow-x-auto bg-muted p-2 rounded text-muted">
                                    {typeof message.details === "string"
                                        ? message.details
                                        : JSON.stringify(message.details, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
