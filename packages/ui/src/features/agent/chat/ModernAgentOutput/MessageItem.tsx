import { AgentMessage, AgentMessageType, AskUserMessageDetails, MarkdownRenditionFormat } from "@vertesia/common";
import { Badge, Button, cn, Dropdown, MenuItem, useToast } from "@vertesia/ui/core";
import { NavLink } from "@vertesia/ui/router";
import { useUserSession } from "@vertesia/ui/session";
import { MarkdownRenderer } from "@vertesia/ui/widgets";
import dayjs from "dayjs";
import { AlertCircle, Bot, CheckCircle, Clock, CopyIcon, Download, Info, Layers, type LucideIcon, MessageSquare, RefreshCcw, User } from "lucide-react";
import React, { useEffect, useState, useMemo, memo, useRef } from "react";
import { PulsatingCircle } from "../AnimatedThinkingDots";
import { AskUserWidget } from "../AskUserWidget";
import { useImageLightbox } from "../ImageLightbox";
import { ThinkingMessages } from "../WaitingMessages";
import { getWorkstreamId } from "./utils";
import { useArtifactUrlCache, getArtifactCacheKey } from "../useArtifactUrlCache.js";
import { useDownloadFile } from "../../../store/index.js";

// PERFORMANCE: Move pure function outside component to avoid recreation on every render
// Process content to enhance markdown detection for lists and thinking messages
function processContentForMarkdown(content: string | object, messageType: AgentMessageType, originalMessage?: string): string | object {
    // If content is not a string, return it as is
    if (typeof content !== "string") {
        return content;
    }

    // Special handling for thought messages to ensure proper markdown formatting
    if (
        messageType === AgentMessageType.THOUGHT ||
        (typeof originalMessage === "string" &&
            (originalMessage.toLowerCase().includes("thinking about") ||
                originalMessage.toLowerCase().includes("i'm thinking") ||
                originalMessage.toLowerCase().includes("💭")))
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
}

/** className overrides for MessageItem — single source of truth for all className overrides. */
export interface MessageItemClassNames {
    /** Additional className for the outer container */
    className?: string;
    /** Additional className for the card wrapper */
    cardClassName?: string;
    /** Additional className for the header section */
    headerClassName?: string;
    /** Additional className for the content section */
    contentClassName?: string;
    /** Additional className for the timestamp */
    timestampClassName?: string;
    /** Additional className for the sender label */
    senderClassName?: string;
    /** Additional className for the icon wrapper */
    iconClassName?: string;
    /** Additional className for the details section */
    detailsClassName?: string;
    /** Additional className for the artifacts section */
    artifactsClassName?: string;
    /** Additional className for the prose/markdown wrapper */
    proseClassName?: string;
}

/** Keys of {@link MessageItemClassNames} — drives className merging and memo comparison. */
const MESSAGE_ITEM_CLASS_NAME_KEYS: (keyof MessageItemClassNames)[] = [
    'className', 'cardClassName', 'headerClassName', 'contentClassName',
    'timestampClassName', 'senderClassName', 'iconClassName',
    'detailsClassName', 'artifactsClassName', 'proseClassName',
];

/** Merge className slots across base, prop, and override layers with consistent priority. */
function mergeClassNames(
    base: MessageItemClassNames,
    props: MessageItemClassNames,
    ...overrides: (Partial<MessageItemClassNames> | undefined)[]
): MessageItemClassNames {
    const result: Record<string, string | undefined> = {};
    for (const key of MESSAGE_ITEM_CLASS_NAME_KEYS) {
        result[key] = cn(base[key], props[key], ...overrides.map(o => o?.[key]));
    }
    return result as MessageItemClassNames;
}

/** Per-message-type visual config (border, bg, icon color, sender label, icon component, optional className overrides). */
export interface MessageStyleConfig extends MessageItemClassNames {
    borderColor: string;
    iconColor: string;
    sender: string;
    Icon: LucideIcon;
}

export interface MessageItemProps extends MessageItemClassNames {
    message: AgentMessage;
    showPulsatingCircle?: boolean;
    /** Callback when user sends a message (e.g., from proposal selection) */
    onSendMessage?: (message: string) => void;
    /** Sparse per-type overrides for MESSAGE_STYLES (deep-merged with defaults) */
    messageStyleOverrides?: Partial<Record<AgentMessageType | 'default', Partial<MessageStyleConfig>>>;
    /** Custom component to render store/document links instead of default NavLink navigation */
    StoreLinkComponent?: React.ComponentType<{ href: string; documentId: string; children: React.ReactNode }>;
    /** Custom component to render store/collection links instead of default NavLink navigation */
    CollectionLinkComponent?: React.ComponentType<{ href: string; collectionId: string; children: React.ReactNode }>;
}

// Consolidated Studio/default message styling - single source of truth
export const MESSAGE_STYLES: Record<AgentMessageType | 'default', MessageStyleConfig> = {
    [AgentMessageType.ANSWER]: { borderColor: 'border-l-info', iconColor: 'text-info', sender: 'Agent', Icon: Bot },
    [AgentMessageType.COMPLETE]: { borderColor: 'border-l-success', iconColor: 'text-success', sender: 'Completed', Icon: CheckCircle },
    [AgentMessageType.IDLE]: { borderColor: 'border-l-info', iconColor: 'text-info', sender: 'Ready', Icon: Clock },
    [AgentMessageType.REQUEST_INPUT]: { borderColor: 'border-l-attention', iconColor: 'text-attention', sender: 'Input', Icon: User },
    [AgentMessageType.QUESTION]: { borderColor: 'border-l-muted', iconColor: 'text-muted', sender: 'User', Icon: User },
    [AgentMessageType.THOUGHT]: { borderColor: 'border-l-purple-500', iconColor: 'text-purple-600 dark:text-purple-400', sender: 'Agent', Icon: Bot },
    [AgentMessageType.ERROR]: { borderColor: 'border-l-destructive', iconColor: 'text-destructive', sender: 'Error', Icon: AlertCircle },
    [AgentMessageType.UPDATE]: { borderColor: 'border-l-success', iconColor: 'text-success', sender: 'Update', Icon: Info },
    [AgentMessageType.PLAN]: { borderColor: 'border-l-attention', iconColor: 'text-attention', sender: 'Plan', Icon: MessageSquare },
    [AgentMessageType.TERMINATED]: { borderColor: 'border-l-muted', iconColor: 'text-muted', sender: 'Terminated', Icon: CheckCircle },
    [AgentMessageType.WARNING]: { borderColor: 'border-l-attention', iconColor: 'text-attention', sender: 'Warning', Icon: AlertCircle },
    [AgentMessageType.SYSTEM]: { borderColor: 'border-l-muted', iconColor: 'text-muted', sender: 'System', Icon: Info },
    [AgentMessageType.STREAMING_CHUNK]: { borderColor: 'border-l-info', iconColor: 'text-info', sender: 'Agent', Icon: Bot },
    [AgentMessageType.BATCH_PROGRESS]: { borderColor: 'border-l-blue-500', iconColor: 'text-blue-600 dark:text-blue-400', sender: 'Batch', Icon: Layers },
    [AgentMessageType.RESTARTING]: { borderColor: 'border-l-attention', iconColor: 'text-attention', sender: 'Restarting', Icon: RefreshCcw },
    default: { borderColor: 'border-l-muted', iconColor: 'text-muted', sender: 'Agent', Icon: Bot },
};

function MessageItemComponent({
    message,
    showPulsatingCircle = false,
    onSendMessage,
    className,
    cardClassName,
    headerClassName,
    contentClassName,
    timestampClassName,
    senderClassName,
    iconClassName,
    detailsClassName,
    artifactsClassName,
    proseClassName,
    messageStyleOverrides,
    StoreLinkComponent,
    CollectionLinkComponent,
}: MessageItemProps) {
    const [showDetails, setShowDetails] = useState(false);
    const { client } = useUserSession();
    const toast = useToast();
    const urlCache = useArtifactUrlCache();
    const { openImage } = useImageLightbox();
    // Use refs to avoid triggering effect re-runs when these stable values are accessed
    const clientRef = useRef(client);
    clientRef.current = client;
    const urlCacheRef = useRef(urlCache);
    urlCacheRef.current = urlCache;
    const { renderContent: exportContent, isDownloading: isExportingFile } = useDownloadFile({ client, toast });

    // Unified style resolution: merge MESSAGE_STYLES base, flat className props, and per-type overrides.
    // Priority (lowest → highest): base MESSAGE_STYLES → flat props → overrides.default → overrides[type]
    const resolvedStyle = useMemo(() => {
        const base = MESSAGE_STYLES[message.type] || MESSAGE_STYLES.default;
        const defaultOverrides = messageStyleOverrides?.default;
        const typeOverrides = messageStyleOverrides?.[message.type];

        return {
            ...base, ...defaultOverrides, ...typeOverrides,
            ...mergeClassNames(base, {
                className, cardClassName, headerClassName, contentClassName,
                timestampClassName, senderClassName, iconClassName,
                detailsClassName, artifactsClassName, proseClassName,
            }, defaultOverrides, typeOverrides),
        };
    }, [message.type, messageStyleOverrides,
        className, cardClassName, headerClassName, contentClassName,
        timestampClassName, senderClassName, iconClassName,
        detailsClassName, artifactsClassName, proseClassName]);

    // PERFORMANCE: Memoize message content extraction - only recalculates when message changes
    const messageContent = useMemo(() => {
        let content = "";

        if (message.message) {
            // Check if message.message is an object
            if (typeof message.message === "object") {
                // Use JSONView for objects - we'll need to stringify it for now
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
    }, [message.message]);

    // PERFORMANCE: Memoize processed content - expensive regex operations only run when messageContent changes
    const processedContent = useMemo(() => {
        if (!messageContent) return "";
        return processContentForMarkdown(
            messageContent,
            message.type,
            typeof message.message === "string" ? message.message : undefined
        );
    }, [messageContent, message.type, message.message]);

    // Copy message content to clipboard
    const copyToClipboard = () => {
        const content = messageContent || "";
        const detailsContent =
            typeof message.details === "string"
                ? message.details
                : message.details
                    ? JSON.stringify(message.details, null, 2)
                    : "";

        const textToCopy = [content, detailsContent ? "\n\nDetails:\n" + detailsContent : ""].join("").trim();

        navigator.clipboard.writeText(textToCopy).then(() => {
            toast({
                status: "success",
                title: "Copied to clipboard",
                duration: 2000,
            });
        });
    };

    // Export message content to PDF or DOCX
    const exportToFormat = async (format: MarkdownRenditionFormat) => {
        const content = typeof messageContent === 'string' ? messageContent : '';

        if (!content.trim()) {
            toast({
                status: "error",
                title: "No content to export",
                duration: 2000,
            });
            return;
        }

        const title = `Message ${dayjs(message.timestamp).format("YYYY-MM-DD HH-mm-ss")}`;
        await exportContent(content, {
            format,
            title,
            artifactRunId: runId,
        });
    };

    // Check if message has exportable content (markdown text)
    const hasExportableContent = typeof messageContent === 'string' && messageContent.trim().length > 0;

    // PERFORMANCE: Memoize markdown components to prevent MarkdownRenderer remounts
    const markdownComponents = useMemo(() => ({
        a: ({ node, ref, ...props }: { node?: any; ref?: any; href?: string; children?: React.ReactNode }) => {
            const href = props.href || "";
            if (href.includes("/store/objects")) {
                if (StoreLinkComponent) {
                    const documentId = href.split("/store/objects/")[1] || "";
                    return <StoreLinkComponent href={href} documentId={documentId}>{props.children}</StoreLinkComponent>;
                }
                return (
                    <NavLink
                        href={href}
                        topLevelNav
                    >
                        {props.children}
                    </NavLink>
                );
            }
            if (href.includes("/store/collections")) {
                if (CollectionLinkComponent) {
                    const collectionId = href.split("/store/collections/")[1] || "";
                    return <CollectionLinkComponent href={href} collectionId={collectionId}>{props.children}</CollectionLinkComponent>;
                }
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
                    onClick={() => props.src && openImage(props.src, props.alt)}
                />
            );
        },
    }), [openImage, StoreLinkComponent, CollectionLinkComponent]);

    // Render content with markdown support - all messages now rendered as markdown
    const renderContent = (content: string | object) => {
        // Handle object content (JSON)
        if (typeof content === "object") {
            return (
                <pre className="text-xs font-mono whitespace-pre-wrap overflow-x-auto bg-gray-100 dark:bg-gray-800 p-2 rounded text-gray-700">
                    {JSON.stringify(content, null, 2)}
                </pre>
            );
        }

        // Handle string content with markdown - content is already processed
        const runId = (message as any).workflow_run_id as string | undefined;

        if (!runId && typeof content === 'string' && content.includes('artifact:')) {
            console.warn('[MessageItem] message contains artifact references but workflow_run_id is missing!', {
                type: message.type,
                workflow_run_id: (message as any).workflow_run_id,
                hasArtifact: content.includes('artifact:'),
            });
        }

        return (
            <div className={cn("vprose prose prose-slate dark:prose-invert prose-p:leading-relaxed prose-p:my-3 prose-headings:font-semibold prose-headings:tracking-normal prose-headings:mt-6 prose-headings:mb-3 prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-li:my-1 prose-ul:my-3 prose-ol:my-3 prose-table:my-5 prose-pre:my-4 prose-hr:my-6 max-w-none text-[15px] break-words", resolvedStyle.proseClassName)} style={{ overflowWrap: 'anywhere' }}>
                <MarkdownRenderer
                    artifactRunId={runId}
                    onProposalSelect={(optionId) => onSendMessage?.(optionId)}
                    onProposalSubmit={(text) => onSendMessage?.(text)}
                    components={markdownComponents}
                >
                    {content as string}
                </MarkdownRenderer>
            </div>
        );
    };

    // Resolve artifacts from tool details (e.g. execute_shell.outputFiles)
    const [artifactLinks, setArtifactLinks] = useState<
        { displayName: string; artifactPath: string; url: string; isImage: boolean }[]
    >([]);

    // Create stable key from message for dependency tracking
    const runId = (message as any).workflow_run_id as string | undefined;
    const details = message.details as any;
    // Check both outputFiles (from execute_shell) and files (from tool results like dashboard tools)
    const outputFiles: unknown = details?.outputFiles ?? details?.files;
    const outputFilesKey = Array.isArray(outputFiles) ? outputFiles.join(",") : "";

    useEffect(() => {
        const loadArtifacts = async () => {
            if (!runId || !Array.isArray(outputFiles) || outputFiles.length === 0) {
                setArtifactLinks([]);
                return;
            }

            const currentClient = clientRef.current;
            const currentUrlCache = urlCacheRef.current;

            try {
                const entries = await Promise.all(
                    outputFiles.map(async (name: unknown) => {
                        if (typeof name !== "string" || !name.trim()) return null;
                        const trimmed = name.trim();
                        // Strip artifact: protocol prefix to get the artifact-relative path
                        const artifactPath = trimmed.startsWith("artifact:") ? trimmed.slice(9) : trimmed;

                        const ext = artifactPath.split(".").pop()?.toLowerCase() || "";
                        const imageExtensions = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"]);
                        const isImage = imageExtensions.has(ext);
                        const disposition = isImage ? "inline" : "attachment";

                        try {
                            // Use cache if available
                            const cacheKey = getArtifactCacheKey(runId, artifactPath, disposition);
                            let url: string;

                            if (currentUrlCache) {
                                url = await currentUrlCache.getOrFetch(cacheKey, async () => {
                                    const result = await currentClient.files.getArtifactDownloadUrl(runId, artifactPath, disposition);
                                    return result.url;
                                });
                            } else {
                                const result = await currentClient.files.getArtifactDownloadUrl(runId, artifactPath, disposition);
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
    }, [runId, outputFilesKey]);

    const workstreamId = getWorkstreamId(message);
    const { Icon } = resolvedStyle;

    // Render icon - show pulsating animation for active messages
    const renderIcon = () => {
        if (showPulsatingCircle) {
            return <PulsatingCircle size="sm" color="blue" />;
        }
        return <Icon className={`size-4 ${resolvedStyle.iconColor}`} />;
    };

    return (
        <div className={cn("w-full max-w-full", resolvedStyle.className)}>
            <div
                className={cn("border-l-4 bg-white dark:bg-gray-900 mb-4 w-full max-w-full overflow-hidden", resolvedStyle.borderColor, resolvedStyle.cardClassName)}
                data-workstream-id={workstreamId}
            >
                {/* Compact header */}
                <div className={cn("flex items-center justify-between px-4 py-1.5", resolvedStyle.headerClassName)}>
                    <div className="flex items-center gap-1.5">
                        <div className={cn(showPulsatingCircle ? "animate-fadeIn" : "", resolvedStyle.iconClassName)}>
                            {renderIcon()}
                        </div>
                        <span className={cn("text-xs font-medium text-muted", resolvedStyle.senderClassName)}>{resolvedStyle.sender}</span>
                        {workstreamId !== "main" && workstreamId !== "all" && (
                            <Badge variant="default" className="text-xs text-muted ml-1">
                                {workstreamId}
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 print:hidden">
                        <span className={cn("text-[11px] text-muted/70", resolvedStyle.timestampClassName)}>
                            {dayjs(message.timestamp).format("HH:mm:ss")}
                        </span>
                        <Button
                            variant="ghost" size="xs"
                            onClick={copyToClipboard}
                            className="text-muted/50 hover:text-muted h-5 w-5 p-0"
                            title="Copy message"
                        >
                            <CopyIcon className="size-3" />
                        </Button>
                        {hasExportableContent && (
                            <Dropdown
                                trigger={
                                    <Button
                                        variant="ghost" size="xs"
                                        className="text-muted/50 hover:text-muted h-5 w-5 p-0"
                                        title="Export message"
                                        disabled={isExportingFile}
                                    >
                                        <Download className={`size-3 ${isExportingFile ? 'animate-pulse' : ''}`} />
                                    </Button>
                                }
                            >
                                <MenuItem onClick={() => exportToFormat(MarkdownRenditionFormat.pdf)}>
                                    Export as PDF
                                </MenuItem>
                                <MenuItem onClick={() => exportToFormat(MarkdownRenditionFormat.docx)}>
                                    Export as Word
                                </MenuItem>
                            </Dropdown>
                        )}
                    </div>
                </div>

                {/* Message content */}
                <div className={cn("px-4 pb-3 bg-white dark:bg-gray-900 overflow-hidden", resolvedStyle.contentClassName)}>
                {/* Check for REQUEST_INPUT with UX config - render AskUserWidget instead of plain text */}
                {message.type === AgentMessageType.REQUEST_INPUT && (message.details as AskUserMessageDetails)?.ux ? (
                    (() => {
                        const uxConfig = (message.details as AskUserMessageDetails).ux!;
                        return (
                            <AskUserWidget
                                question={typeof messageContent === 'string' ? messageContent : ''}
                                options={uxConfig.options}
                                variant={uxConfig.variant}
                                multiSelect={uxConfig.multiSelect}
                                allowFreeResponse={uxConfig.allowFreeResponse}
                                placeholder={uxConfig.placeholder}
                                onSelect={(optionId) => onSendMessage?.(optionId)}
                                onMultiSelect={(optionIds) => onSendMessage?.(optionIds.join(", "))}
                                onSubmit={(text) => onSendMessage?.(text)}
                                hideBorder
                            />
                        );
                    })()
                ) : messageContent && (
                    <div className="message-content break-words w-full" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                        {renderContent(processedContent || messageContent)}
                    </div>
                )}

                {/* Auto-surfaced artifacts from tool details (e.g. execute_shell.outputFiles) */}
                {artifactLinks.length > 0 && (
                    <div className={cn("mt-3 text-xs", resolvedStyle.artifactsClassName)}>
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
                                            onClick={() => openImage(url, displayName)}
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
                    <div className={cn("mt-2 print:hidden", resolvedStyle.detailsClassName)}>
                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            className="text-[11px] text-muted flex items-center"
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
                            <div className="mt-1 p-1.5 bg-muted border border-mixer-muted/40 rounded text-sm">
                                {typeof message.details === "string" ? (
                                    renderContent(message.details)
                                ) : (
                                    <pre className="text-xs font-mono whitespace-pre-wrap overflow-x-auto bg-muted p-2 rounded text-muted">
                                        {JSON.stringify(message.details, null, 2)}
                                    </pre>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
            </div>
        </div>
    );
}

// Memoize the component to prevent unnecessary re-renders
// Only re-render when message timestamp, showPulsatingCircle, or className props change
const MessageItem = memo(MessageItemComponent, (prevProps, nextProps) => {
    return (
        prevProps.message.timestamp === nextProps.message.timestamp &&
        prevProps.showPulsatingCircle === nextProps.showPulsatingCircle &&
        prevProps.onSendMessage === nextProps.onSendMessage &&
        prevProps.messageStyleOverrides === nextProps.messageStyleOverrides &&
        MESSAGE_ITEM_CLASS_NAME_KEYS.every(key => prevProps[key] === nextProps[key])
    );
});

export default MessageItem;
