import { AgentMessage, AgentMessageType } from "@vertesia/common";
import { Button, cn, useToast } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";
import { MarkdownRenderer } from "@vertesia/ui/widgets";
import dayjs from "dayjs";
import { Bot, ChevronDown, ChevronRight, CopyIcon, CheckCircle, AlertCircle, AlertTriangle } from "lucide-react";
import { useState, memo, useEffect, useRef } from "react";
import { PulsatingCircle } from "../AnimatedThinkingDots";
import { useImageLightbox } from "../ImageLightbox";
import { useArtifactUrlCache, getArtifactCacheKey } from "../useArtifactUrlCache.js";
import { ToolExecutionStatus } from "./utils";

/** Keys that are internal metadata and not interesting to display */
const META_KEYS = new Set([
    'tool', 'tool_run_id', 'activity_group_id', 'event_class',
    'tool_iteration', 'tool_status', 'tools', 'streamed',
    'files', 'outputFiles', 'display_role', 'observation',
]);

/** Filter out internal metadata keys, return user-facing detail entries */
function extractInterestingDetails(
    details: Record<string, unknown> | undefined
): Array<[string, unknown]> {
    if (!details) return [];
    return Object.entries(details).filter(
        ([key, value]) => !META_KEYS.has(key) && value !== undefined && value !== null && value !== ''
    );
}

/** Convert snake_case or camelCase key to a readable label */
function formatDetailKey(key: string): string {
    return key
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/^./, c => c.toUpperCase());
}

/** Badge color per status */
function statusBadgeClass(status?: ToolExecutionStatus): string {
    switch (status) {
        case 'completed':
            return 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800';
        case 'running':
            return 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
        case 'error':
            return 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';
        case 'warning':
            return 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
        default:
            return '';
    }
}

export interface ToolCallGroupProps {
    messages: AgentMessage[];
    showPulsatingCircle?: boolean;
    toolRunId?: string;
    toolStatus?: ToolExecutionStatus;
    /** LLM reasoning text from the preceding message, shown as the group header */
    preambleText?: string;
    /** The preceding AgentMessage that was consumed as preamble (for key/timestamp) */
    preambleMessage?: AgentMessage;
    /** Additional className for the root container */
    rootClassName?: string;
    /** Additional className for the header row */
    headerClassName?: string;
    /** Additional className for the sender label */
    senderClassName?: string;
    /** Additional className for the tool summary text */
    toolSummaryClassName?: string;
    /** Additional className for the tool name badge */
    toolBadgeClassName?: string;
    /** Additional className for individual item wrappers */
    itemClassName?: string;
    /** Additional className for item header rows */
    itemHeaderClassName?: string;
    /** Additional className for expanded item content */
    itemContentClassName?: string;
}

/** className overrides for ToolCallGroup — subset of ToolCallGroupProps containing only className props. */
export type ToolCallGroupClassNames = Partial<Pick<ToolCallGroupProps,
    'rootClassName' | 'headerClassName' | 'senderClassName' | 'toolSummaryClassName' |
    'toolBadgeClassName' | 'itemClassName' | 'itemHeaderClassName' | 'itemContentClassName'>>;

/**
 * Merge messages within a tool group by tool_run_id.
 * Running + completed messages for the same tool_run_id are collapsed into
 * a single visual item: the running message provides display text (message_to_human),
 * while the completed message provides status, files, and observation.
 */
function mergeByToolRunId(messages: AgentMessage[]): AgentMessage[] {
    const byRunId = new Map<string, AgentMessage[]>();
    const result: AgentMessage[] = [];

    for (const msg of messages) {
        const runId = msg.details?.tool_run_id as string | undefined;
        if (runId) {
            if (!byRunId.has(runId)) {
                byRunId.set(runId, []);
            }
            byRunId.get(runId)!.push(msg);
        } else {
            result.push(msg);
        }
    }

    // For each tool_run_id group, merge into one message
    for (const [_runId, msgs] of byRunId) {
        if (msgs.length <= 1) {
            result.push(...msgs);
            continue;
        }

        // Sort by timestamp: earliest first
        msgs.sort((a, b) => {
            const ta = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime();
            const tb = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime();
            return ta - tb;
        });

        // Take the last message as the base (has final status), but prefer
        // message text from the running message (message_to_human) if the
        // completed message has no text or empty text.
        const base = msgs[msgs.length - 1];
        const runningMsg = msgs.find(m => (m.details as any)?.tool_status === 'running');

        if (runningMsg && (!base.message || base.message.trim() === '') && runningMsg.message) {
            // Merge: use running message text with completed message details
            const merged: AgentMessage = {
                ...base,
                message: runningMsg.message,
            };
            result.push(merged);
        } else {
            result.push(base);
        }
    }

    // Re-sort by timestamp to maintain chronological order
    result.sort((a, b) => {
        const ta = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime();
        const tb = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime();
        return ta - tb;
    });

    return result;
}

interface ToolCallItemClassNames {
    toolBadgeClassName?: string;
    itemClassName?: string;
    itemHeaderClassName?: string;
    itemContentClassName?: string;
}

interface ToolCallItemProps {
    message: AgentMessage;
    isExpanded: boolean;
    onToggle: () => void;
    artifactRunId?: string;
    classNames?: ToolCallItemClassNames;
}

// Helper to check if URL is an image
const isImageUrl = (url: string) => /\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i.test(url);

// Component to render files (images inline, others as links)
function FileDisplay({ files, className: fileClassName }: { files: string[]; className?: string }) {
    const { openImage } = useImageLightbox();

    if (!files || files.length === 0) return null;

    return (
        <div className={cn("mt-2 flex flex-wrap gap-2", fileClassName)}>
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

// Helper to get files from tool details (checks both files and outputFiles)
const getFilesFromDetails = (details: { files?: string[]; outputFiles?: string[]; [key: string]: unknown } | undefined): string[] | undefined => {
    if (!details) return undefined;
    const files = details.files ?? details.outputFiles;
    return Array.isArray(files) ? files : undefined;
};

const TOOL_BADGE_CLASS = "text-[10px] px-1.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-medium";
const ASSISTANT_BADGE_CLASS = "text-[10px] px-1.5 py-0.5 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 font-medium";

const isToolPreambleMessage = (message: AgentMessage): boolean => {
    const details = message.details as { display_role?: string } | undefined;
    return message.type === AgentMessageType.THOUGHT && details?.display_role === "tool_preamble";
};

const getMessageActivityLabel = (message: AgentMessage): string => {
    const details = message.details as { tool?: string } | undefined;
    if (isToolPreambleMessage(message)) return "assistant";
    if (details?.tool) return details.tool;

    switch (message.type) {
        case AgentMessageType.UPDATE:
            return "update";
        case AgentMessageType.WARNING:
            return "warning";
        case AgentMessageType.ERROR:
            return "error";
        case AgentMessageType.SYSTEM:
            return "system";
        default:
            return "activity";
    }
};

const getMessageBadgeClass = (message: AgentMessage): string => {
    return isToolPreambleMessage(message) ? ASSISTANT_BADGE_CLASS : TOOL_BADGE_CLASS;
};

function ToolCallItem({ message, isExpanded, onToggle, artifactRunId, classNames = {} }: ToolCallItemProps) {
    const [resolvedFiles, setResolvedFiles] = useState<string[]>([]);
    const toast = useToast();
    const { client } = useUserSession();
    const urlCache = useArtifactUrlCache();
    // PERFORMANCE: Use refs to avoid triggering effect re-runs when these stable values change identity
    const clientRef = useRef(client);
    clientRef.current = client;
    const urlCacheRef = useRef(urlCache);
    urlCacheRef.current = urlCache;

    const details = message.details as { tool?: string; files?: string[]; outputFiles?: string[]; [key: string]: unknown } | undefined;
    const toolName = getMessageActivityLabel(message);
    const badgeClass = getMessageBadgeClass(message);
    const files = getFilesFromDetails(details);
    const messageContent = typeof message.message === "string" ? message.message : "";

    // Resolve artifact paths to signed URLs
    useEffect(() => {
        if (!files || files.length === 0 || !artifactRunId) {
            setResolvedFiles([]);
            return;
        }

        let cancelled = false;
        const resolveFiles = async () => {
            const currentClient = clientRef.current;
            const currentUrlCache = urlCacheRef.current;
            const resolved = await Promise.all(
                files.map(async (file) => {
                    if (!file || typeof file !== "string") return null;
                    // If it's already a full URL, return as-is
                    if (file.startsWith("http://") || file.startsWith("https://")) {
                        return file;
                    }
                    // Strip artifact: protocol prefix to get the artifact-relative path
                    const artifactPath = file.startsWith("artifact:") ? file.slice(9) : file;
                    const ext = artifactPath.split(".").pop()?.toLowerCase() || "";
                    const imageExtensions = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"]);
                    const isImage = imageExtensions.has(ext);
                    const disposition = isImage ? "inline" : "attachment";

                    try {
                        const cacheKey = getArtifactCacheKey(artifactRunId, artifactPath, disposition);
                        if (currentUrlCache) {
                            return await currentUrlCache.getOrFetch(cacheKey, async () => {
                                const result = await currentClient.files.getArtifactDownloadUrl(artifactRunId, artifactPath, disposition);
                                return result.url;
                            });
                        } else {
                            const result = await currentClient.files.getArtifactDownloadUrl(artifactRunId, artifactPath, disposition);
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
    }, [files, artifactRunId]);

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
        <div className={cn("border-b border-gray-100 dark:border-gray-800 last:border-b-0", classNames.itemClassName)}>
            {/* Collapsed header - always visible */}
            <div
                className={cn("flex items-start justify-between px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors", classNames.itemHeaderClassName)}
                onClick={onToggle}
            >
                <div className="flex items-start gap-2 flex-1 min-w-0">
                    <div className="flex-shrink-0 pt-0.5">
                        {isExpanded ? (
                            <ChevronDown className="size-3 text-muted" />
                        ) : (
                            <ChevronRight className="size-3 text-muted" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        {/* Primary: Message text */}
                        {messageContent ? (
                            <span className="text-xs text-foreground line-clamp-2">
                                {messageContent}
                            </span>
                        ) : (
                            <span className="text-xs text-muted italic">Activity: {toolName}</span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Tool name badge on the right */}
                    {!isExpanded && (
                        <span className={cn(badgeClass, classNames.toolBadgeClassName)}>
                            {toolName}
                        </span>
                    )}
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
                <div className="px-3 pb-1.5">
                    <FileDisplay files={imageFiles} />
                </div>
            )}

            {/* Expanded content — shows tool metadata, key params, then raw details */}
            {isExpanded && (() => {
                const toolStatusValue = (details as Record<string, unknown> | undefined)?.tool_status as ToolExecutionStatus | undefined;
                const interestingDetails = extractInterestingDetails(details as Record<string, unknown> | undefined);
                return (
                    <div className={cn("px-4 py-2 bg-gray-50/50 dark:bg-gray-800/30", classNames.itemContentClassName)}>
                        {/* Badges row: tool name + status + timestamp */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className={cn(badgeClass, classNames.toolBadgeClassName)}>
                                {toolName}
                            </span>
                            {toolStatusValue && (
                                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-md border font-medium", statusBadgeClass(toolStatusValue))}>
                                    {toolStatusValue}
                                </span>
                            )}
                            <span className="text-[10px] text-muted/70">{dayjs(message.timestamp).format("HH:mm:ss")}</span>
                        </div>

                        {/* Key parameters */}
                        {interestingDetails.length > 0 && (
                            <div className="mb-2 space-y-0.5">
                                {interestingDetails.map(([key, value]) => (
                                    <div key={key} className="flex gap-1.5 text-xs">
                                        <span className="text-muted font-medium flex-shrink-0">{formatDetailKey(key)}:</span>
                                        <span className="text-foreground break-all">
                                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Show observation from details if available and different from header text */}
                        {(() => {
                            const observation = (details as any)?.observation as string | undefined;
                            if (observation && observation !== messageContent) {
                                return (
                                    <div className="vprose prose prose-slate dark:prose-invert prose-p:leading-relaxed prose-p:my-1.5 max-w-none text-sm">
                                        <MarkdownRenderer artifactRunId={artifactRunId}>{observation}</MarkdownRenderer>
                                    </div>
                                );
                            }
                            return null;
                        })()}

                        {/* Non-image files display */}
                        {nonImageFiles.length > 0 && <FileDisplay files={nonImageFiles} />}
                    </div>
                );
            })()}
        </div>
    );
}

// Component for resolving and displaying non-image files from a collapsed tool message
// Note: Images are shown at the group level by GroupImageDisplay, so this only shows other files
function CollapsedItemFiles({ files, artifactRunId }: { files: string[] | undefined; artifactRunId?: string }) {
    const [resolvedFiles, setResolvedFiles] = useState<string[]>([]);
    const { client } = useUserSession();
    const urlCache = useArtifactUrlCache();
    const clientRef = useRef(client);
    clientRef.current = client;
    const urlCacheRef = useRef(urlCache);
    urlCacheRef.current = urlCache;

    useEffect(() => {
        if (!files || files.length === 0 || !artifactRunId) {
            setResolvedFiles([]);
            return;
        }

        let cancelled = false;
        const resolveFiles = async () => {
            const currentClient = clientRef.current;
            const currentUrlCache = urlCacheRef.current;
            const resolved = await Promise.all(
                files.map(async (file) => {
                    if (!file || typeof file !== "string") return null;

                    // Strip artifact: protocol prefix to get the artifact-relative path
                    const artifactPath = file.startsWith("artifact:") ? file.slice(9) : file;

                    // Skip image files - they're shown at the group level
                    const ext = artifactPath.split(".").pop()?.toLowerCase() || "";
                    const imageExtensions = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"]);
                    if (imageExtensions.has(ext)) return null;

                    if (artifactPath.startsWith("http://") || artifactPath.startsWith("https://")) {
                        return artifactPath;
                    }

                    try {
                        const cacheKey = getArtifactCacheKey(artifactRunId, artifactPath, "attachment");
                        if (currentUrlCache) {
                            return await currentUrlCache.getOrFetch(cacheKey, async () => {
                                const result = await currentClient.files.getArtifactDownloadUrl(artifactRunId, artifactPath, "attachment");
                                return result.url;
                            });
                        } else {
                            const result = await currentClient.files.getArtifactDownloadUrl(artifactRunId, artifactPath, "attachment");
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
    }, [files, artifactRunId]);

    // Only show non-image files (images are shown at group level)
    if (resolvedFiles.length === 0) return null;

    return (
        <div className="pl-4 pr-2 pb-1.5">
            <FileDisplay files={resolvedFiles} />
        </div>
    );
}

// Component to show images from the most recent tool call prominently at the top
function GroupImageDisplay({ messages, artifactRunId }: { messages: AgentMessage[]; artifactRunId?: string }) {
    const [resolvedImages, setResolvedImages] = useState<string[]>([]);
    const { client } = useUserSession();
    const urlCache = useArtifactUrlCache();
    const clientRef = useRef(client);
    clientRef.current = client;
    const urlCacheRef = useRef(urlCache);
    urlCacheRef.current = urlCache;

    // Only show files from the last (most recent) message in the group
    useEffect(() => {
        if (!artifactRunId || messages.length === 0) {
            setResolvedImages([]);
            return;
        }

        // Get files from only the last message (most recent tool output)
        const lastMessage = messages[messages.length - 1];
        const details = lastMessage.details as { files?: string[]; outputFiles?: string[] } | undefined;
        const files = getFilesFromDetails(details);

        if (!files || files.length === 0) {
            setResolvedImages([]);
            return;
        }

        let cancelled = false;
        const resolveFiles = async () => {
            const currentClient = clientRef.current;
            const currentUrlCache = urlCacheRef.current;
            const resolved = await Promise.all(
                files.map(async (file) => {
                    if (!file || typeof file !== "string") return null;

                    // Strip artifact: protocol prefix to get the artifact-relative path
                    const artifactPath = file.startsWith("artifact:") ? file.slice(9) : file;

                    // Check if it's an image file
                    const ext = artifactPath.split(".").pop()?.toLowerCase() || "";
                    const imageExtensions = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"]);
                    if (!imageExtensions.has(ext)) return null;

                    // If it's already a full URL, return as-is
                    if (artifactPath.startsWith("http://") || artifactPath.startsWith("https://")) {
                        return artifactPath;
                    }

                    try {
                        const cacheKey = getArtifactCacheKey(artifactRunId, artifactPath, "inline");
                        if (currentUrlCache) {
                            return await currentUrlCache.getOrFetch(cacheKey, async () => {
                                const result = await currentClient.files.getArtifactDownloadUrl(artifactRunId, artifactPath, "inline");
                                return result.url;
                            });
                        } else {
                            const result = await currentClient.files.getArtifactDownloadUrl(artifactRunId, artifactPath, "inline");
                            return result.url;
                        }
                    } catch (err) {
                        console.error(`Failed to resolve artifact URL for ${artifactPath}`, err);
                        return null;
                    }
                })
            );
            if (!cancelled) {
                setResolvedImages(resolved.filter((f): f is string => !!f));
            }
        };
        resolveFiles();
        return () => { cancelled = true; };
    }, [messages, artifactRunId]);

    if (resolvedImages.length === 0) return null;

    return (
        <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-800">
            <FileDisplay files={resolvedImages} />
        </div>
    );
}

function ToolCallGroupComponent({
    messages: rawMessages,
    showPulsatingCircle = false,
    toolRunId: _toolRunId,
    toolStatus,
    preambleText,
    preambleMessage: _preambleMessage,
    rootClassName,
    headerClassName,
    senderClassName,
    toolSummaryClassName,
    toolBadgeClassName,
    itemClassName,
    itemHeaderClassName,
    itemContentClassName,
}: ToolCallGroupProps) {
    // Merge messages sharing the same tool_run_id into single visual items
    const messages = mergeByToolRunId(rawMessages);

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
        // Only pulse for the currently active/latest group
        if (showPulsatingCircle) {
            return <PulsatingCircle size="sm" color="blue" />;
        }
        if (toolStatus === "running") {
            return <span className="size-2 rounded-full bg-blue-500 inline-block" />;
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
    const toolNames = messages.map((m) => getMessageActivityLabel(m));

    const uniqueToolCount = new Set(toolNames).size;
    const toolSummary = uniqueToolCount === 1
        ? `${messages.length}× ${toolNames[0]}`
        : `${messages.length} activity updates`;

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
            return `[${getMessageActivityLabel(m)}] ${m.message || ""}\n${details ? JSON.stringify(details, null, 2) : ""}`;
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
            className={cn("border-l-4 overflow-hidden bg-white dark:bg-gray-900 mb-4", getBorderColor(), rootClassName)}
        >
            {/* Compact header */}
            <div
                className={cn("flex items-center justify-between px-4 py-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors", headerClassName)}
                onClick={() => setIsCollapsed(!isCollapsed)}
            >
                <div className="flex items-center gap-1 flex-1 min-w-0">
                    {renderStatusIndicator()}
                    {preambleText ? (
                        <span className={cn("text-xs text-foreground line-clamp-2 flex-1 min-w-0", toolSummaryClassName)}>
                            {preambleText}
                        </span>
                    ) : (
                        <>
                            <span className={cn("text-xs font-medium text-muted", senderClassName)}>Agent</span>
                            <span className={cn("text-xs text-purple-600 dark:text-purple-400 font-medium", toolSummaryClassName)}>
                                {toolSummary}
                            </span>
                        </>
                    )}
                    {isCollapsed ? (
                        <ChevronRight className="size-3 text-muted flex-shrink-0" />
                    ) : (
                        <ChevronDown className="size-3 text-muted flex-shrink-0" />
                    )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                    {preambleText && (
                        <span className={cn("text-[10px] text-purple-600 dark:text-purple-400 font-medium", toolSummaryClassName)}>
                            {toolSummary}
                        </span>
                    )}
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

            {/* Show all images from the group prominently at the top */}
            <GroupImageDisplay messages={messages} artifactRunId={artifactRunId} />

            {/* Collapsed summary - show tool calls as single-line rows with expand option */}
            {isCollapsed && (
                <div className="px-3 py-0.5 space-y-0">
                    {messages.map((m, idx) => {
                        const details = m.details as { tool?: string; files?: string[]; outputFiles?: string[] } | undefined;
                        const toolName = getMessageActivityLabel(m);
                        const badgeClass = getMessageBadgeClass(m);
                        const fullMessage = typeof m.message === "string" ? m.message : "";
                        const isAnimating = animatingIndices.has(idx);
                        const isItemExpanded = expandedItems.has(idx);
                        const files = getFilesFromDetails(details);

                        return (
                            <div
                                key={`${m.timestamp}-${idx}`}
                                className={cn("border-b border-gray-100 dark:border-gray-800 last:border-b-0", itemClassName)}
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
                                    className={cn("flex items-start gap-2 py-1.5 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50", itemHeaderClassName)}
                                    onClick={() => toggleItem(idx)}
                                    title={fullMessage}
                                >
                                    <div className="flex-shrink-0 pt-0.5">
                                        {isItemExpanded ? (
                                            <ChevronDown className="size-3 text-muted" />
                                        ) : (
                                            <ChevronRight className="size-3 text-muted" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        {/* Primary: Message text */}
                                        {fullMessage ? (
                                            <span className="text-foreground line-clamp-2">
                                                {fullMessage}
                                            </span>
                                        ) : (
                                            <span className="text-muted italic">Activity: {toolName}</span>
                                        )}
                                    </div>
                                    {/* Tool name badge on the right */}
                                    {!isItemExpanded && (
                                        <span className={cn(badgeClass, "flex-shrink-0", toolBadgeClassName)}>
                                            {toolName}
                                        </span>
                                    )}
                                </div>
                                {/* Always show images inline with resolved URLs */}
                                <CollapsedItemFiles files={files} artifactRunId={artifactRunId} />
                                {/* Expanded content — tool metadata + key params + raw details */}
                                {isItemExpanded && (() => {
                                    const toolStatusValue = (details as Record<string, unknown> | undefined)?.tool_status as ToolExecutionStatus | undefined;
                                    const interestingDetails = extractInterestingDetails(details as Record<string, unknown> | undefined);
                                    return (
                                        <div className={cn("pl-5 pr-3 pb-2 text-sm", itemContentClassName)}>
                                            {/* Badges row: tool name + status + timestamp */}
                                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                <span className={cn(badgeClass, toolBadgeClassName)}>
                                                    {toolName}
                                                </span>
                                                {toolStatusValue && (
                                                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-md border font-medium", statusBadgeClass(toolStatusValue))}>
                                                        {toolStatusValue}
                                                    </span>
                                                )}
                                                <span className="text-[10px] text-muted/70">{dayjs(m.timestamp).format("HH:mm:ss")}</span>
                                            </div>

                                            {/* Key parameters */}
                                            {interestingDetails.length > 0 && (
                                                <div className="mb-1.5 space-y-0.5">
                                                    {interestingDetails.map(([key, value]) => (
                                                        <div key={key} className="flex gap-1.5 text-xs">
                                                            <span className="text-muted font-medium flex-shrink-0">{formatDetailKey(key)}:</span>
                                                            <span className="text-foreground break-all">
                                                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Show observation from details if different from header text */}
                                            {(() => {
                                                const observation = (details as any)?.observation as string | undefined;
                                                if (observation && observation !== fullMessage) {
                                                    return (
                                                        <div className="vprose prose prose-slate dark:prose-invert prose-p:leading-relaxed prose-p:my-1.5 max-w-none text-sm">
                                                            <MarkdownRenderer artifactRunId={artifactRunId}>{observation}</MarkdownRenderer>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>
                                    );
                                })()}
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
                            classNames={{ toolBadgeClassName, itemClassName, itemHeaderClassName, itemContentClassName }}
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
    if (prevProps.preambleText !== nextProps.preambleText) return false;
    if (prevProps.rootClassName !== nextProps.rootClassName) return false;
    if (prevProps.headerClassName !== nextProps.headerClassName) return false;
    if (prevProps.senderClassName !== nextProps.senderClassName) return false;
    if (prevProps.toolSummaryClassName !== nextProps.toolSummaryClassName) return false;
    if (prevProps.toolBadgeClassName !== nextProps.toolBadgeClassName) return false;
    if (prevProps.itemClassName !== nextProps.itemClassName) return false;
    if (prevProps.itemHeaderClassName !== nextProps.itemHeaderClassName) return false;
    if (prevProps.itemContentClassName !== nextProps.itemContentClassName) return false;
    // Compare first and last timestamps as a proxy for content changes
    return (
        prevProps.messages[0]?.timestamp === nextProps.messages[0]?.timestamp &&
        prevProps.messages[prevProps.messages.length - 1]?.timestamp ===
            nextProps.messages[nextProps.messages.length - 1]?.timestamp
    );
});

export default ToolCallGroup;
