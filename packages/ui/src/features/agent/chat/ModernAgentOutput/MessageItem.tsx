import { AgentMessage, AgentMessageType } from "@vertesia/common";
import { Badge, Button, useToast } from "@vertesia/ui/core";
import { NavLink } from "@vertesia/ui/router";
import { useUserSession } from "@vertesia/ui/session";
import dayjs from "dayjs";
import { AlertCircle, Bot, CheckCircle, Clock, CopyIcon, Info, MessageSquare, User } from "lucide-react";
import React, { useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AnimatedThinkingDots, PulsatingCircle } from "../AnimatedThinkingDots";
import { ThinkingMessages } from "../WaitingMessages";
import { getWorkstreamId } from "./utils";

interface MessageItemProps {
    message: AgentMessage;
    showPulsatingCircle?: boolean;
}

export default function MessageItem({ message, showPulsatingCircle = false }: MessageItemProps) {
    const [showDetails, setShowDetails] = useState(false);
    const [processedContent, setProcessedContent] = useState<string | object>("");
    const [isProcessingImages, setIsProcessingImages] = useState(false);
    const { client } = useUserSession();
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

    // Convert links in the content (now async to handle image URLs)
    const convertLinks = async (content: string | object): Promise<string | object> => {
        // If content is not a string, return it as is
        if (typeof content !== "string") {
            return content;
        }

        let processedContent = content;

        // First, handle store and collection links
        processedContent = processedContent.replace(/\[([^\]]+)\]\((store|collection):([a-f\d]{24})\)/gi, (_, text, type, id) => {
            const path = type === 'store' ? 'objects' : 'collections';
            return `[${text}](/store/${path}/${id})`;
        });

        // Then, handle image links by finding all image:<gcspath> patterns
        const imageRegex = /!\[([^\]]*)\]\(image:([^)]+)\)/g;
        const imageMatches = Array.from(processedContent.matchAll(imageRegex));

        // Process all image URLs in parallel
        const imageReplacements = await Promise.all(
            imageMatches.map(async (match) => {
                const [fullMatch, altText, gcsPath] = match;
                try {
                    const response = await client.files.getDownloadUrl(gcsPath);
                    return { fullMatch, replacement: `![${altText}](${response.url})` };
                } catch (error) {
                    console.error(`Failed to get download URL for image: ${gcsPath}`, error);
                    // Return original on error
                    return { fullMatch, replacement: fullMatch };
                }
            })
        );

        // Apply all replacements
        for (const { fullMatch, replacement } of imageReplacements) {
            processedContent = processedContent.replace(fullMatch, replacement);
        }

        return processedContent;
    };

    // Get the message content to display with thinking message replacement
    const getMessageContent = () => {
        let content = "";

        if (message.message) {
            // Check if message.message is an object
            if (typeof message.message === "object") {
                // Use JSONView for objects - we'll need to stringify it for now
                // as we don't have direct access to JSONView
                content = JSON.stringify(message.message, null, 2);
            } else if (message.message.trim) {
                content = message.message.trim();
            } else {
                // Fallback for other non-string, non-object cases
                content = String(message.message);
            }
        }

        // Replace %thinking_message% placeholder with a thinking message
        if (typeof content === "string" && content.includes("%thinking_message%")) {
            // Get a random thinking message since we don't have access to thinkingMessageIndex here
            const randomIndex = Math.floor(Math.random() * ThinkingMessages.length);
            content = content.replace(/%thinking_message%/g, ThinkingMessages[randomIndex]);
        }

        return content;
    };

    // Copy message content to clipboard
    const copyToClipboard = () => {
        const messageContent = getMessageContent() || "";
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

    // Process content to enhance markdown detection for lists and thinking messages
    const processContentForMarkdown = (content: string | object) => {
        // If content is not a string, return it as is
        if (typeof content !== "string") {
            return content;
        }

        // Special handling for thought messages to ensure proper markdown formatting
        if (
            message.type === AgentMessageType.THOUGHT ||
            (typeof message.message === "string" &&
                (message.message.toLowerCase().includes("thinking about") ||
                    message.message.toLowerCase().includes("i'm thinking") ||
                    message.message.toLowerCase().includes("💭")))
        ) {
            let formattedContent = content;

            // Check for numbering patterns like "1. First item 2. Second item"
            if (/\d+\.\s+.+/.test(formattedContent)) {
                // Format numbered lists by adding newlines between items
                formattedContent = formattedContent.replace(/(\d+\.\s+.+?)(?=\s+\d+\.\s+|$)/g, "$1\n\n");

                // Make sure nested content under numbered items is properly indented
                formattedContent = formattedContent.replace(/(\d+\.\s+.+\n)([^\d\n][^:])/g, "$1  $2");
            }

            // Handle colon-prefixed items that should be on separate lines
            if (formattedContent.includes(":") && !formattedContent.includes("\n\n")) {
                formattedContent = formattedContent.replace(
                    /\b(First|Next|Then|Finally|Lastly|Additionally|Step \d+):\s+/gi,
                    "\n\n$&",
                );
            }

            // Handle thinking points or list-like structures even without numbers
            if (formattedContent.includes(" - ")) {
                formattedContent = formattedContent.replace(/\s+-\s+/g, "\n- ");
            }

            return formattedContent;
        }

        // Normal processing for non-thinking messages
        if (/\d+\.\s+.+/.test(content) && !content.includes("\n\n")) {
            // Add proper line breaks for numbered lists that aren't already properly formatted
            return content.replace(/(\d+\.\s+.+?)(?=\s+\d+\.\s+|$)/g, "$1\n\n");
        }

        return content;
    };

    // Render content with markdown support - all messages now rendered as markdown
    const renderContent = (content: string | object) => {
        // Handle object content (JSON)
        if (typeof content === "object") {
            return (
                <pre className="text-xs font-mono whitespace-pre-wrap overflow-x-auto bg-gray-100 dark:bg-gray-800 p-2 rounded text-gray-700 ">
                    {JSON.stringify(content, null, 2)}
                </pre>
            );
        }

        // Handle string content with markdown - content is already processed
        return (
            <div className="vprose prose-sm">
                <Markdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        a: ({ node, ref, ...props }: { node?: any; ref?: any; href?: string; children?: React.ReactNode }) => {
                            const href = props.href || "";
                            if (href.includes("/store/objects")) {
                                return (
                                    <NavLink
                                        href={href}
                                        topLevelNav
                                    >
                                        {props.children}
                                    </NavLink>
                                );
                            }
                            return (
                                <a
                                    {...props}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                />
                            );
                        },
                        img: ({ node, ref, ...props }: { node?: any; ref?: any; src?: string; alt?: string }) => {
                            return (
                                <img
                                    {...props}
                                    className="max-w-full h-auto rounded-lg shadow-md my-3 cursor-pointer hover:shadow-lg transition-shadow"
                                    loading="lazy"
                                    onClick={() => props.src && window.open(props.src, '_blank')}
                                />
                            );
                        },
                        code: ({
                            node,
                            ref,
                            className,
                            children,
                            ...props
                        }: {
                            node?: any;
                            ref?: any;
                            className?: string;
                            children?: React.ReactNode;
                        }) => {
                            const match = /language-(\w+)/.exec(className || "");
                            const isInline = !match;
                            const language = match ? match[1] : "";

                            // Keep only the language indicator logic here, styling moved to CSS
                            return (
                                <>
                                    {!isInline && language && (
                                        <div className="code-language-indicator">
                                            {language}
                                        </div>
                                    )}
                                    <code {...props}>
                                        {children}
                                    </code>
                                </>
                            );
                        },
                        // Remove 'node' and 'ref' from props
                        p: ({ node, ref, ...props }) => <p {...props} />, 
                        strong: ({ node, ref, ...props }) => <strong {...props} />,
                        em: ({ node, ref, ...props }) => <em {...props} />,
                        pre: ({ node, ref, ...props }) => <pre {...props} />,
                        h1: ({ node, ref, ...props }) => <h1 {...props} />,
                        h2: ({ node, ref, ...props }) => <h2 {...props} />,
                        h3: ({ node, ref, ...props }) => <h3 {...props} />,
                        li: ({ node, ref, ...props }) => <li {...props} />,
                        ul: ({ node, ref, ...props }) => <ul {...props} />,
                        ol: ({ node, ref, ...props }) => <ol {...props} />,
                        blockquote: ({ node, ref, ...props }) => <blockquote {...props} />,
                        hr: ({ node, ref, ...props }) => <hr {...props} />,
                        table: ({ node, ref, ...props }) => <div className="overflow-x-auto"><table {...props} /></div>,
                        th: ({ node, ref, ...props }) => <th {...props} />,
                        td: ({ node, ref, ...props }) => <td {...props} />,
                    }}
                >
                    {content as string}
                </Markdown>
            </div>
        );
    };

    const messageContent = getMessageContent();

    // Process content with image URL resolution when component mounts or message changes
    useEffect(() => {
        const processContent = async () => {
            if (messageContent) {
                setIsProcessingImages(true);
                try {
                    const processed = await convertLinks(processContentForMarkdown(messageContent));
                    setProcessedContent(processed);
                } catch (error) {
                    console.error('Error processing message content:', error);
                    setProcessedContent(messageContent);
                } finally {
                    setIsProcessingImages(false);
                }
            }
        };
        processContent();
    }, [messageContent, client]);

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

                <div className="flex items-center gap-2">
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

            {/* Message content */}
            <div className="px-4 py-3 bg-white dark:bg-gray-900">
                {messageContent && (
                    <div className="message-content">
                        {isProcessingImages ? (
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <AnimatedThinkingDots color="blue" />
                                <span>Loading images...</span>
                            </div>
                        ) : (
                            renderContent(processedContent || messageContent)
                        )}
                    </div>
                )}

                {/* Optional details section */}
                {message.details && (
                    <div className="mt-2">
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
                                {typeof message.details === "string" ? (
                                    renderContent(message.details)
                                ) : (
                                    <pre className="text-xs font-mono whitespace-pre-wrap overflow-x-auto bg-muted p-2 rounded text-muted ">
                                        {JSON.stringify(message.details, null, 2)}
                                    </pre>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
