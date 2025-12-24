import { AgentMessage, AgentMessageType } from "@vertesia/common";
import { Badge, Button, useToast } from "@vertesia/ui/core";
import { NavLink } from "@vertesia/ui/router";
import { useUserSession } from "@vertesia/ui/session";
import { MarkdownRenderer } from "@vertesia/ui/widgets";
import dayjs from "dayjs";
import { AlertCircle, Bot, CheckCircle, Clock, CopyIcon, Info, Layers, MessageSquare, User } from "lucide-react";
import React, { useEffect, useState, memo } from "react";
import { PulsatingCircle } from "../AnimatedThinkingDots";
import { ThinkingMessages } from "../WaitingMessages";
import { getWorkstreamId } from "./utils";
import { useArtifactUrlCache, getArtifactCacheKey } from "../useArtifactUrlCache.js";

interface MessageItemProps {
    message: AgentMessage;
    showPulsatingCircle?: boolean;
}

// Consolidated message styling - single source of truth
const MESSAGE_STYLES: Record<AgentMessageType | 'default', {
    borderColor: string;
    bgColor: string;
    iconColor: string;
    sender: string;
    Icon: typeof Bot;
}> = {
    [AgentMessageType.ANSWER]: { borderColor: 'border-l-info', bgColor: 'bg-info', iconColor: 'text-info', sender: 'Agent', Icon: Bot },
    [AgentMessageType.COMPLETE]: { borderColor: 'border-l-success', bgColor: 'bg-success', iconColor: 'text-success', sender: 'Completed', Icon: CheckCircle },
    [AgentMessageType.IDLE]: { borderColor: 'border-l-muted', bgColor: 'bg-muted', iconColor: 'text-muted', sender: 'Idle', Icon: Clock },
    [AgentMessageType.REQUEST_INPUT]: { borderColor: 'border-l-attention', bgColor: 'bg-attention', iconColor: 'text-attention', sender: 'Input', Icon: User },
    [AgentMessageType.QUESTION]: { borderColor: 'border-l-muted', bgColor: 'bg-muted', iconColor: 'text-muted', sender: 'User', Icon: User },
    [AgentMessageType.THOUGHT]: { borderColor: 'border-l-purple-500', bgColor: 'bg-purple-50/50 dark:bg-purple-900/10', iconColor: 'text-purple-600 dark:text-purple-400', sender: 'Agent', Icon: Bot },
    [AgentMessageType.ERROR]: { borderColor: 'border-l-destructive', bgColor: 'bg-destructive', iconColor: 'text-destructive', sender: 'Error', Icon: AlertCircle },
    [AgentMessageType.UPDATE]: { borderColor: 'border-l-success', bgColor: 'bg-success', iconColor: 'text-success', sender: 'Update', Icon: Info },
    [AgentMessageType.PLAN]: { borderColor: 'border-l-attention', bgColor: 'bg-attention', iconColor: 'text-attention', sender: 'Plan', Icon: MessageSquare },
    [AgentMessageType.TERMINATED]: { borderColor: 'border-l-muted', bgColor: 'bg-muted', iconColor: 'text-muted', sender: 'Terminated', Icon: CheckCircle },
    [AgentMessageType.WARNING]: { borderColor: 'border-l-attention', bgColor: 'bg-attention', iconColor: 'text-attention', sender: 'Warning', Icon: AlertCircle },
    [AgentMessageType.SYSTEM]: { borderColor: 'border-l-muted', bgColor: 'bg-muted', iconColor: 'text-muted', sender: 'System', Icon: Info },
    [AgentMessageType.STREAMING_CHUNK]: { borderColor: 'border-l-info', bgColor: 'bg-info', iconColor: 'text-info', sender: 'Agent', Icon: Bot },
    [AgentMessageType.BATCH_PROGRESS]: { borderColor: 'border-l-blue-500', bgColor: 'bg-blue-50/50 dark:bg-blue-900/10', iconColor: 'text-blue-600 dark:text-blue-400', sender: 'Batch', Icon: Layers },
    default: { borderColor: 'border-l-muted', bgColor: 'bg-muted', iconColor: 'text-muted', sender: 'Agent', Icon: Bot },
};

function MessageItemComponent({ message, showPulsatingCircle = false }: MessageItemProps) {
    const [showDetails, setShowDetails] = useState(false);
    const [processedContent, setProcessedContent] = useState<string | object>("");
    const { client } = useUserSession();
    const toast = useToast();
    const urlCache = useArtifactUrlCache();

    // Get styles from consolidated config
    const styles = MESSAGE_STYLES[message.type] || MESSAGE_STYLES.default;

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
        const runId = (message as any).workflow_run_id as string | undefined;

        return (
            <div className="vprose prose-sm text-sm">
                <MarkdownRenderer
                    artifactRunId={runId}
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
                    }}
                >
                    {content as string}
                </MarkdownRenderer>
            </div>
        );
    };

    const messageContent = getMessageContent();

    // Resolve artifacts from tool details (e.g. execute_shell.outputFiles)
    const [artifactLinks, setArtifactLinks] = useState<
        { displayName: string; artifactPath: string; url: string; isImage: boolean }[]
    >([]);

    // Create stable key from message for dependency tracking
    const runId = (message as any).workflow_run_id as string | undefined;
    const details = message.details as any;
    const outputFiles: unknown = details && details.outputFiles;
    const outputFilesKey = Array.isArray(outputFiles) ? outputFiles.join(",") : "";

    useEffect(() => {
        const loadArtifacts = async () => {
            if (!runId || !Array.isArray(outputFiles) || outputFiles.length === 0) {
                setArtifactLinks([]);
                return;
            }

            try {
                const entries = await Promise.all(
                    outputFiles.map(async (name: unknown) => {
                        if (typeof name !== "string" || !name.trim()) return null;
                        const trimmed = name.trim();
                        // execute_shell returns relative paths like "result.csv" or "plots/chart.png"
                        // canonical artifact name is under out/
                        const artifactPath =
                            trimmed.startsWith("out/") || trimmed.startsWith("files/") || trimmed.startsWith("scripts/")
                                ? trimmed
                                : `out/${trimmed}`;

                        const ext = artifactPath.split(".").pop()?.toLowerCase() || "";
                        const imageExtensions = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"]);
                        const isImage = imageExtensions.has(ext);
                        const disposition = isImage ? "inline" : "attachment";

                        try {
                            // Use cache if available
                            const cacheKey = getArtifactCacheKey(runId, artifactPath, disposition);
                            let url: string;

                            if (urlCache) {
                                url = await urlCache.getOrFetch(cacheKey, async () => {
                                    const result = await client.files.getArtifactDownloadUrl(runId, artifactPath, disposition);
                                    return result.url;
                                });
                            } else {
                                const result = await client.files.getArtifactDownloadUrl(runId, artifactPath, disposition);
                                url = result.url;
                            }

                            return {
                                displayName: trimmed,
                                artifactPath,
                                url,
                                isImage,
                            };
                        } catch (err) {
                            console.error(`Failed to resolve artifact URL for ${artifactPath}`, err);
                            return null;
                        }
                    }),
                );

                setArtifactLinks(
                    entries.filter(
                        (e): e is { displayName: string; artifactPath: string; url: string; isImage: boolean } => !!e,
                    ),
                );
            } catch (error) {
                console.error("Error loading artifact URLs from message details", error);
                setArtifactLinks([]);
            }
        };

        loadArtifacts();
    }, [runId, outputFilesKey, client, urlCache]);

    // Process content for markdown formatting when message changes
    useEffect(() => {
        if (messageContent) {
            const processed = processContentForMarkdown(messageContent);
            setProcessedContent(processed);
        }
    }, [messageContent]);

    const workstreamId = getWorkstreamId(message);
    const { Icon } = styles;

    // Render icon - show pulsating animation for active messages
    const renderIcon = () => {
        if (showPulsatingCircle) {
            return <PulsatingCircle size="sm" color="blue" />;
        }
        return <Icon className={`size-4 ${styles.iconColor}`} />;
    };

    return (
        <div
            className={`border-l-4 shadow-md overflow-hidden bg-white dark:bg-gray-900 mb-5 ${styles.borderColor} ${styles.bgColor}`}
            data-workstream-id={workstreamId}
        >
            {/* Header with icon and timestamp */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100/80 dark:border-gray-800/80 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                    <div className={showPulsatingCircle ? "animate-fadeIn" : ""}>
                        {renderIcon()}
                    </div>
                    <span className="text-xs font-medium text-muted">{styles.sender}</span>

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

            {/* Message content */}
            <div className="px-4 py-3 bg-white dark:bg-gray-900">
                {messageContent && (
                    <div className="message-content">
                        {renderContent(processedContent || messageContent)}
                    </div>
                )}

                {/* Auto-surfaced artifacts from tool details (e.g. execute_shell.outputFiles) */}
                {artifactLinks.length > 0 && (
                    <div className="mt-3 text-xs">
                        <div className="font-medium text-muted mb-1">Artifacts</div>

                        {/* Inline previews for image artifacts */}
                        {artifactLinks.some(a => a.isImage) && (
                            <div className="mb-2 flex flex-wrap gap-3">
                                {artifactLinks
                                    .filter(a => a.isImage)
                                    .map(({ displayName, artifactPath, url }) => (
                                        <div
                                            key={`${artifactPath}-preview`}
                                            className="max-w-xs cursor-pointer"
                                            onClick={() => window.open(url, "_blank")}
                                        >
                                            <img
                                                src={url}
                                                alt={displayName}
                                                className="max-w-full h-auto rounded-lg shadow-sm hover:shadow-md transition-shadow"
                                            />
                                            <div className="mt-1 text-[11px] text-muted truncate">
                                                {displayName}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        )}

                        {/* Buttons for all artifacts (files and images) */}
                        <div className="flex flex-wrap gap-2 print:hidden">
                            {artifactLinks.map(({ displayName, artifactPath, url }) => (
                                <Button
                                    key={artifactPath + url}
                                    variant="outline"
                                    size="xs"
                                    className="px-2 py-1 text-xs"
                                    onClick={() => window.open(url, "_blank")}
                                    title={artifactPath}
                                >
                                    {displayName}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}

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

// Memoize the component to prevent unnecessary re-renders
// Only re-render when message timestamp or showPulsatingCircle changes
const MessageItem = memo(MessageItemComponent, (prevProps, nextProps) => {
    return (
        prevProps.message.timestamp === nextProps.message.timestamp &&
        prevProps.showPulsatingCircle === nextProps.showPulsatingCircle
    );
});

export default MessageItem;
