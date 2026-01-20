import { AgentMessage } from "@vertesia/common";
import { Button, useToast } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";
import { MarkdownRenderer } from "@vertesia/ui/widgets";
import dayjs from "dayjs";
import { Bot, ChevronDown, ChevronRight, CopyIcon, CheckCircle, AlertCircle, AlertTriangle } from "lucide-react";
import { useState, memo, useEffect, useRef } from "react";
import { PulsatingCircle } from "../AnimatedThinkingDots";
import { useImageLightbox } from "../ImageLightbox";
import { useArtifactUrlCache, getArtifactCacheKey } from "../useArtifactUrlCache.js";
import { ToolExecutionStatus } from "./utils";

interface ToolCallGroupProps {
    messages: AgentMessage[];
    showPulsatingCircle?: boolean;
    toolRunId?: string;
    toolStatus?: ToolExecutionStatus;
}

interface ToolCallItemProps {
    message: AgentMessage;
    isExpanded: boolean;
    onToggle: () => void;
    artifactRunId?: string;
}

// Helper to check if URL is an image
const isImageUrl = (url: string) => /\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i.test(url);

// Component to render files (images inline, others as links)
function FileDisplay({ files }: { files: string[] }) {
    const { openImage } = useImageLightbox();

    if (!files || files.length === 0) return null;

    return (
        <div className="mt-2 flex flex-wrap gap-2">
            {files.map((file, idx) => {
                const fileName = file.split('/').pop()?.split('?')[0] || 'file';
                if (isImageUrl(file)) {
                    return (
                        <div
                            key={idx}
                            className="cursor-pointer"
                            onClick={() => openImage(file, fileName)}
                            title="Click to enlarge"
                        >
                            <img
                                src={file}
                                alt={fileName}
                                className="max-w-[300px] max-h-[200px] rounded border hover:opacity-80 transition-opacity hover:shadow-lg"
                            />
                        </div>
                    );
                }
                return (
                    <a
                        key={idx}
                        href={file}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs hover:bg-muted/80"
                    >
                        📎 {fileName}
                    </a>
                );
            })}
        </div>
    );
}

function ToolCallItem({ message, isExpanded, onToggle, artifactRunId }: ToolCallItemProps) {
    const [showDetails, setShowDetails] = useState(false);
    const [resolvedFiles, setResolvedFiles] = useState<string[]>([]);
    const toast = useToast();
    const { client } = useUserSession();
    const urlCache = useArtifactUrlCache();

    const details = message.details as { tool?: string; files?: string[]; [key: string]: unknown } | undefined;
    const toolName = details?.tool || "Tool";
    const files = details?.files as string[] | undefined;
    const messageContent = typeof message.message === "string" ? message.message : "";

    // Resolve artifact paths to signed URLs
    useEffect(() => {
        if (!files || files.length === 0 || !artifactRunId) {
            setResolvedFiles([]);
            return;
        }

        let cancelled = false;
        const resolveFiles = async () => {
            const resolved = await Promise.all(
                files.map(async (file) => {
                    if (!file || typeof file !== "string") return null;
                    // If it's already a full URL, return as-is
                    if (file.startsWith("http://") || file.startsWith("https://")) {
                        return file;
                    }
                    // Resolve artifact path to signed URL
                    const artifactPath = file.startsWith("out/") || file.startsWith("files/") || file.startsWith("scripts/")
                        ? file
                        : `out/${file}`;
                    const ext = artifactPath.split(".").pop()?.toLowerCase() || "";
                    const imageExtensions = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"]);
                    const isImage = imageExtensions.has(ext);
                    const disposition = isImage ? "inline" : "attachment";

                    try {
                        const cacheKey = getArtifactCacheKey(artifactRunId, artifactPath, disposition);
                        if (urlCache) {
                            return await urlCache.getOrFetch(cacheKey, async () => {
                                const result = await client.files.getArtifactDownloadUrl(artifactRunId, artifactPath, disposition);
                                return result.url;
                            });
                        } else {
                            const result = await client.files.getArtifactDownloadUrl(artifactRunId, artifactPath, disposition);
                            return result.url;
                        }
                    } catch (err) {
                        console.error(`Failed to resolve artifact URL for ${artifactPath}`, err);
                        return null;
                    }
                })
            );
            if (!cancelled) {
                setResolvedFiles(resolved.filter((f): f is string => !!f));
            }
        };
        resolveFiles();
        return () => { cancelled = true; };
    }, [files, artifactRunId, client, urlCache]);

    // Separate image files from other files for inline preview
    const imageFiles = resolvedFiles.filter(f => isImageUrl(f));
    const nonImageFiles = resolvedFiles.filter(f => !isImageUrl(f));

    const copyToClipboard = () => {
        const textToCopy = [
            messageContent,
            details ? "\n\nDetails:\n" + JSON.stringify(details, null, 2) : ""
        ].join("").trim();

        navigator.clipboard.writeText(textToCopy).then(() => {
            toast({
                status: "success",
                title: "Copied to clipboard",
                duration: 2000,
            });
        });
    };

    return (
        <div className="border-b border-gray-100 dark:border-gray-800 last:border-b-0">
            {/* Collapsed header - always visible */}
            <div
                className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                onClick={onToggle}
            >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    {isExpanded ? (
                        <ChevronDown className="size-3 text-muted flex-shrink-0" />
                    ) : (
                        <ChevronRight className="size-3 text-muted flex-shrink-0" />
                    )}
                    <span className="text-xs font-medium text-purple-600 dark:text-purple-400 flex-shrink-0">
                        {toolName}
                    </span>
                    {!isExpanded && messageContent && (
                        <span className="text-xs text-muted flex-1">
                            {messageContent}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-muted">
                        {dayjs(message.timestamp).format("HH:mm:ss")}
                    </span>
                    <Button
                        variant="ghost"
                        size="xs"
                        onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard();
                        }}
                        className="text-muted opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Copy message"
                    >
                        <CopyIcon className="size-3" />
                    </Button>
                </div>
            </div>

            {/* Always show images inline, regardless of expanded state */}
            {imageFiles.length > 0 && (
                <div className="px-4 pb-2">
                    <FileDisplay files={imageFiles} />
                </div>
            )}

            {/* Expanded content */}
            {isExpanded && (
                <div className="px-4 py-2 bg-gray-50/50 dark:bg-gray-800/30">
                    {messageContent && (
                        <div className="vprose prose prose-slate dark:prose-invert prose-p:leading-relaxed prose-p:my-1.5 max-w-none text-sm">
                            <MarkdownRenderer artifactRunId={artifactRunId}>{messageContent}</MarkdownRenderer>
                        </div>
                    )}

                    {/* Non-image files display */}
                    {nonImageFiles.length > 0 && <FileDisplay files={nonImageFiles} />}

                    {/* Details toggle */}
                    {details && (
                        <div className="mt-2">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowDetails(!showDetails);
                                }}
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
                                    <pre className="text-xs font-mono whitespace-pre-wrap overflow-x-auto">
                                        {JSON.stringify(details, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// Component for resolving and displaying files from a collapsed tool message
function CollapsedItemFiles({ files, artifactRunId }: { files: string[] | undefined; artifactRunId?: string }) {
    const [resolvedFiles, setResolvedFiles] = useState<string[]>([]);
    const { client } = useUserSession();
    const urlCache = useArtifactUrlCache();

    useEffect(() => {
        if (!files || files.length === 0 || !artifactRunId) {
            setResolvedFiles([]);
            return;
        }

        let cancelled = false;
        const resolveFiles = async () => {
            const resolved = await Promise.all(
                files.map(async (file) => {
                    if (!file || typeof file !== "string") return null;
                    if (file.startsWith("http://") || file.startsWith("https://")) {
                        return file;
                    }
                    const artifactPath = file.startsWith("out/") || file.startsWith("files/") || file.startsWith("scripts/")
                        ? file
                        : `out/${file}`;
                    const ext = artifactPath.split(".").pop()?.toLowerCase() || "";
                    const imageExtensions = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"]);
                    const isImage = imageExtensions.has(ext);
                    const disposition = isImage ? "inline" : "attachment";

                    try {
                        const cacheKey = getArtifactCacheKey(artifactRunId, artifactPath, disposition);
                        if (urlCache) {
                            return await urlCache.getOrFetch(cacheKey, async () => {
                                const result = await client.files.getArtifactDownloadUrl(artifactRunId, artifactPath, disposition);
                                return result.url;
                            });
                        } else {
                            const result = await client.files.getArtifactDownloadUrl(artifactRunId, artifactPath, disposition);
                            return result.url;
                        }
                    } catch (err) {
                        console.error(`Failed to resolve artifact URL for ${artifactPath}`, err);
                        return null;
                    }
                })
            );
            if (!cancelled) {
                setResolvedFiles(resolved.filter((f): f is string => !!f));
            }
        };
        resolveFiles();
        return () => { cancelled = true; };
    }, [files, artifactRunId, client, urlCache]);

    const imageFiles = resolvedFiles.filter(f => isImageUrl(f));
    const nonImageFiles = resolvedFiles.filter(f => !isImageUrl(f));

    return (
        <>
            {imageFiles.length > 0 && (
                <div className="pl-5 pr-3 pb-2">
                    <FileDisplay files={imageFiles} />
                </div>
            )}
            {nonImageFiles.length > 0 && (
                <div className="pl-5 pr-3 pb-2">
                    <FileDisplay files={nonImageFiles} />
                </div>
            )}
        </>
    );
}

function ToolCallGroupComponent({ messages, showPulsatingCircle = false, toolRunId: _toolRunId, toolStatus }: ToolCallGroupProps) {
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
    const [animatingIndices, setAnimatingIndices] = useState<Set<number>>(new Set());
    const prevCountRef = useRef(messages.length);
    const toast = useToast();

    // Extract workflow_run_id from messages (any message in the group should have it)
    const artifactRunId = messages.find(m => (m as any).workflow_run_id)?.workflow_run_id as string | undefined
        ?? (messages[0] as any)?.workflow_run_id;

    // Render status indicator based on tool execution status
    const renderStatusIndicator = () => {
        if (showPulsatingCircle || toolStatus === "running") {
            return <PulsatingCircle size="sm" color="blue" />;
        }
        if (toolStatus === "completed") {
            return <CheckCircle className="size-4 text-success" />;
        }
        if (toolStatus === "error") {
            return <AlertCircle className="size-4 text-destructive" />;
        }
        if (toolStatus === "warning") {
            return <AlertTriangle className="size-4 text-attention" />;
        }
        return <Bot className="size-4 text-purple-600 dark:text-purple-400" />;
    };

    // Get border color based on status
    const getBorderColor = () => {
        if (toolStatus === "completed") return "border-l-success";
        if (toolStatus === "error") return "border-l-destructive";
        if (toolStatus === "warning") return "border-l-attention";
        return "border-l-purple-500";
    };

    // Animate new messages when they're added
    useEffect(() => {
        const prevCount = prevCountRef.current;
        const currentCount = messages.length;

        if (currentCount > prevCount) {
            // New messages added - animate them
            const newIndices = new Set<number>();
            for (let i = prevCount; i < currentCount; i++) {
                newIndices.add(i);
            }
            setAnimatingIndices(newIndices);

            // Clear animation after it completes
            const timer = setTimeout(() => {
                setAnimatingIndices(new Set());
            }, 500);

            prevCountRef.current = currentCount;
            return () => clearTimeout(timer);
        }

        prevCountRef.current = currentCount;
    }, [messages.length]);

    const firstMessage = messages[0];
    const lastMessage = messages[messages.length - 1];
    const firstTimestamp = firstMessage.timestamp;
    const lastTimestamp = lastMessage.timestamp;

    // Get tool names for summary
    const toolNames = messages.map(m => {
        const details = m.details as { tool?: string } | undefined;
        return details?.tool || "tool";
    });

    const uniqueToolCount = new Set(toolNames).size;
    const toolSummary = uniqueToolCount === 1
        ? `${messages.length}× ${toolNames[0]}`
        : `${messages.length} tool calls`;

    const toggleItem = (index: number) => {
        setExpandedItems(prev => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });
    };

    const copyAllToClipboard = () => {
        const allContent = messages.map(m => {
            const details = m.details as { tool?: string; [key: string]: unknown } | undefined;
            return `[${details?.tool || "tool"}] ${m.message || ""}\n${details ? JSON.stringify(details, null, 2) : ""}`;
        }).join("\n\n---\n\n");

        navigator.clipboard.writeText(allContent).then(() => {
            toast({
                status: "success",
                title: "Copied all tool calls to clipboard",
                duration: 2000,
            });
        });
    };

    return (
        <div
            className={`border-l-4 ${getBorderColor()} overflow-hidden bg-white dark:bg-gray-900 mb-4`}
        >
            {/* Compact header */}
            <div
                className="flex items-center justify-between px-4 py-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                onClick={() => setIsCollapsed(!isCollapsed)}
            >
                <div className="flex items-center gap-1.5">
                    {renderStatusIndicator()}
                    <span className="text-xs font-medium text-muted">Agent</span>
                    <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                        {toolSummary}
                    </span>
                    {isCollapsed ? (
                        <ChevronRight className="size-3 text-muted" />
                    ) : (
                        <ChevronDown className="size-3 text-muted" />
                    )}
                </div>

                <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-muted/70">
                        {dayjs(firstTimestamp).format("HH:mm:ss")}
                        {messages.length > 1 && ` - ${dayjs(lastTimestamp).format("HH:mm:ss")}`}
                    </span>
                    <Button
                        variant="ghost"
                        size="xs"
                        onClick={(e) => {
                            e.stopPropagation();
                            copyAllToClipboard();
                        }}
                        className="text-muted/50 hover:text-muted h-5 w-5 p-0"
                        title="Copy all tool calls"
                    >
                        <CopyIcon className="size-3" />
                    </Button>
                </div>
            </div>

            {/* Collapsed summary - show tool calls as single-line rows with expand option */}
            {isCollapsed && (
                <div className="px-4 py-1 space-y-0">
                    {messages.map((m, idx) => {
                        const details = m.details as { tool?: string; files?: string[] } | undefined;
                        const toolName = details?.tool || "tool";
                        const fullMessage = typeof m.message === "string" ? m.message : "";
                        const isAnimating = animatingIndices.has(idx);
                        const isItemExpanded = expandedItems.has(idx);
                        const files = details?.files as string[] | undefined;

                        return (
                            <div
                                key={`${m.timestamp}-${idx}`}
                                className="border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                                style={{
                                    opacity: isAnimating ? 0 : 1,
                                    transform: isAnimating ? 'translateX(-10px)' : 'translateX(0)',
                                    transition: 'opacity 0.3s ease-out, transform 0.3s ease-out',
                                    transitionDelay: `${(idx - (messages.length - animatingIndices.size)) * 100}ms`,
                                    animation: isAnimating ? 'slideInFade 0.4s ease-out forwards' : 'none',
                                    animationDelay: `${(idx - (messages.length - animatingIndices.size)) * 100}ms`,
                                }}
                            >
                                {/* Row header - clickable to expand */}
                                <div
                                    className="flex items-center gap-2 py-1.5 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                    onClick={() => toggleItem(idx)}
                                    title={fullMessage}
                                >
                                    {isItemExpanded ? (
                                        <ChevronDown className="size-3 text-muted flex-shrink-0" />
                                    ) : (
                                        <ChevronRight className="size-3 text-muted flex-shrink-0" />
                                    )}
                                    <span className="font-medium text-purple-700 dark:text-purple-300 flex-shrink-0 min-w-[100px]">
                                        {toolName}
                                    </span>
                                    {!isItemExpanded && (
                                        <span className="text-muted truncate flex-1">
                                            {fullMessage}
                                        </span>
                                    )}
                                </div>
                                {/* Always show images inline with resolved URLs */}
                                <CollapsedItemFiles files={files} artifactRunId={artifactRunId} />
                                {/* Expanded content - show full message */}
                                {isItemExpanded && (
                                    <div className="pl-5 pr-3 pb-2 text-sm">
                                        <div className="vprose prose prose-slate dark:prose-invert prose-p:leading-relaxed prose-p:my-1.5 max-w-none text-sm">
                                            <MarkdownRenderer artifactRunId={artifactRunId}>{fullMessage}</MarkdownRenderer>
                                        </div>
                                        {/* Show details if available */}
                                        {details && Object.keys(details).length > 1 && (
                                            <details className="mt-2 text-xs">
                                                <summary className="text-muted cursor-pointer">Show details</summary>
                                                <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
                                                    {JSON.stringify(details, null, 2)}
                                                </pre>
                                            </details>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Keyframes for slide-in animation */}
            <style>{`
                @keyframes slideInFade {
                    from {
                        opacity: 0;
                        transform: translateX(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
            `}</style>

            {/* Expanded view - individual tool calls */}
            {!isCollapsed && (
                <div className="group">
                    {messages.map((message, index) => (
                        <ToolCallItem
                            key={`${message.timestamp}-${index}`}
                            message={message}
                            isExpanded={expandedItems.has(index)}
                            onToggle={() => toggleItem(index)}
                            artifactRunId={artifactRunId}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// Memoize to prevent unnecessary re-renders
const ToolCallGroup = memo(ToolCallGroupComponent, (prevProps, nextProps) => {
    if (prevProps.messages.length !== nextProps.messages.length) return false;
    if (prevProps.showPulsatingCircle !== nextProps.showPulsatingCircle) return false;
    if (prevProps.toolRunId !== nextProps.toolRunId) return false;
    if (prevProps.toolStatus !== nextProps.toolStatus) return false;
    // Compare first and last timestamps as a proxy for content changes
    return (
        prevProps.messages[0]?.timestamp === nextProps.messages[0]?.timestamp &&
        prevProps.messages[prevProps.messages.length - 1]?.timestamp ===
            nextProps.messages[nextProps.messages.length - 1]?.timestamp
    );
});

export default ToolCallGroup;
