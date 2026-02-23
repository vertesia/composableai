import { AgentMessage, BatchProgressDetails, BatchItemStatus } from "@vertesia/common";
import { Button, cn, useToast } from "@vertesia/ui/core";
import dayjs from "dayjs";
import {
    CheckCircle,
    AlertCircle,
    ChevronDown,
    ChevronRight,
    CopyIcon,
    Layers,
    Loader2,
} from "lucide-react";
import { useState, memo } from "react";
import { PulsatingCircle } from "../AnimatedThinkingDots";

export interface BatchProgressPanelProps {
    message: AgentMessage;
    batchData: BatchProgressDetails;
    isRunning?: boolean;
    /** Additional className for the root container */
    className?: string;
    /** Additional className for the header row */
    headerClassName?: string;
    /** Additional className for the sender label */
    senderClassName?: string;
    /** Additional className for the progress bar section */
    progressBarClassName?: string;
    /** Additional className for the expanded item list */
    itemListClassName?: string;
    /** Additional className for individual item rows */
    itemClassName?: string;
    /** Additional className for the collapsed summary */
    summaryClassName?: string;
}

/** className overrides for BatchProgressPanel — subset of BatchProgressPanelProps containing only className props. */
export type BatchProgressPanelClassNames = Partial<Pick<BatchProgressPanelProps,
    'className' | 'headerClassName' | 'senderClassName' | 'progressBarClassName' |
    'itemListClassName' | 'itemClassName' | 'summaryClassName'>>;

function BatchProgressPanelComponent({
    message,
    batchData,
    isRunning = false,
    className,
    headerClassName,
    senderClassName,
    progressBarClassName,
    itemListClassName,
    itemClassName,
    summaryClassName,
}: BatchProgressPanelProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const toast = useToast();

    const { tool_name, total, completed, succeeded, failed, items, started_at, completed_at } = batchData;

    const progress = total > 0 ? (completed / total) * 100 : 0;
    const hasErrors = failed > 0;
    const isComplete = completed === total && !isRunning;

    // Determine overall status
    const getOverallStatus = () => {
        if (isRunning || !isComplete) return "running";
        if (failed === total) return "error";
        if (failed > 0) return "warning";
        return "completed";
    };

    const overallStatus = getOverallStatus();

    // Status indicator
    const renderStatusIndicator = () => {
        if (isRunning || !isComplete) {
            return <PulsatingCircle size="sm" color="blue" />;
        }
        if (overallStatus === "completed") {
            return <CheckCircle className="size-4 text-success" />;
        }
        if (overallStatus === "error" || overallStatus === "warning") {
            return <AlertCircle className="size-4 text-destructive" />;
        }
        return <Layers className="size-4 text-purple-600" />;
    };

    // Border color based on status
    const getBorderColor = () => {
        if (overallStatus === "completed") return "border-l-success";
        if (overallStatus === "error") return "border-l-destructive";
        if (overallStatus === "warning") return "border-l-attention";
        return "border-l-blue-500";
    };

    // Progress bar color
    const getProgressColor = () => {
        if (hasErrors) return "bg-attention";
        if (isComplete) return "bg-success";
        return "bg-blue-500";
    };

    const copyToClipboard = () => {
        const content = JSON.stringify(batchData, null, 2);
        navigator.clipboard.writeText(content).then(() => {
            toast({
                status: "success",
                title: "Copied batch details to clipboard",
                duration: 2000,
            });
        });
    };

    const duration = completed_at
        ? completed_at - started_at
        : Date.now() - started_at;
    const durationSec = (duration / 1000).toFixed(1);

    return (
        <div className={cn("border-l-4 shadow-md overflow-hidden bg-white dark:bg-gray-900 mb-5", getBorderColor(), className)}>
            {/* Header */}
            <div
                className={cn("flex items-center justify-between px-4 py-2 border-b border-gray-100/80 dark:border-gray-800/80 bg-blue-50/50 dark:bg-blue-900/10 cursor-pointer", headerClassName)}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2">
                    {renderStatusIndicator()}
                    <span className={cn("text-xs font-medium text-muted", senderClassName)}>Batch</span>
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                        {tool_name}
                    </span>
                    <span className="text-xs text-muted">
                        {completed}/{total}
                    </span>
                    {isExpanded ? (
                        <ChevronDown className="size-3 text-muted" />
                    ) : (
                        <ChevronRight className="size-3 text-muted" />
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">
                        {durationSec}s
                    </span>
                    <span className="text-xs text-muted">
                        {dayjs(started_at).format("HH:mm:ss")}
                    </span>
                    <Button
                        variant="ghost"
                        size="xs"
                        onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard();
                        }}
                        className="text-muted"
                        title="Copy batch details"
                    >
                        <CopyIcon className="size-3" />
                    </Button>
                </div>
            </div>

            {/* Progress bar */}
            <div className={cn("px-4 py-2 bg-gray-50/50 dark:bg-gray-800/30", progressBarClassName)}>
                <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className={`h-full ${getProgressColor()} transition-all duration-300 ease-out`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        {succeeded > 0 && (
                            <span className="text-success flex items-center gap-1">
                                <CheckCircle className="size-3" />
                                {succeeded}
                            </span>
                        )}
                        {failed > 0 && (
                            <span className="text-destructive flex items-center gap-1">
                                <AlertCircle className="size-3" />
                                {failed}
                            </span>
                        )}
                        {isRunning && completed < total && (
                            <span className="text-blue-500 flex items-center gap-1">
                                <Loader2 className="size-3 animate-spin" />
                                {total - completed}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Expanded item list */}
            {isExpanded && items.length > 0 && (
                <div className={cn("max-h-64 overflow-y-auto", itemListClassName)}>
                    {items.map((item: BatchItemStatus) => (
                        <div
                            key={item.id}
                            className={cn("flex items-center gap-2 px-4 py-1.5 text-xs border-b border-gray-100 dark:border-gray-800 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800/50", itemClassName)}
                        >
                            {/* Status icon */}
                            <div className="w-4 flex-shrink-0">
                                {item.status === "success" && (
                                    <CheckCircle className="size-3 text-success" />
                                )}
                                {item.status === "error" && (
                                    <AlertCircle className="size-3 text-destructive" />
                                )}
                                {item.status === "running" && (
                                    <Loader2 className="size-3 text-blue-500 animate-spin" />
                                )}
                                {item.status === "pending" && (
                                    <div className="size-3 rounded-full border border-gray-300 dark:border-gray-600" />
                                )}
                            </div>

                            {/* Item ID */}
                            <span className="font-mono text-muted w-24 truncate flex-shrink-0" title={item.id}>
                                {item.id}
                            </span>

                            {/* Message */}
                            <span className="text-muted truncate flex-1" title={item.message}>
                                {item.message || (item.status === "pending" ? "Waiting..." : "")}
                            </span>

                            {/* Duration */}
                            {item.duration_ms !== undefined && (
                                <span className="text-muted flex-shrink-0">
                                    {(item.duration_ms / 1000).toFixed(1)}s
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Summary message if collapsed and has message */}
            {!isExpanded && message.message && (
                <div className={cn("px-4 py-2 text-xs text-muted", summaryClassName)}>
                    {message.message}
                </div>
            )}
        </div>
    );
}

// Memoize to prevent unnecessary re-renders
const BatchProgressPanel = memo(BatchProgressPanelComponent, (prevProps, nextProps) => {
    if (prevProps.isRunning !== nextProps.isRunning) return false;
    if (prevProps.batchData.completed !== nextProps.batchData.completed) return false;
    if (prevProps.batchData.succeeded !== nextProps.batchData.succeeded) return false;
    if (prevProps.batchData.failed !== nextProps.batchData.failed) return false;
    return true;
});

export default BatchProgressPanel;
