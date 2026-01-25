import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Clock, Loader2, Wrench } from "lucide-react";
import { useState } from "react";
import dayjs from "dayjs";
import { ToolCallInfo } from "./utils";
import { MarkdownRenderer } from "@vertesia/ui/widgets";

interface ToolCallItemProps {
    toolCall: ToolCallInfo;
}

export function ToolCallItem({ toolCall }: ToolCallItemProps) {
    const [showParameters, setShowParameters] = useState(false);
    const [showOutput, setShowOutput] = useState(false);
    const [showMetrics, setShowMetrics] = useState(false);

    // Status icon and color
    const getStatusIcon = () => {
        switch (toolCall.status) {
            case 'completed':
                return <CheckCircle2 className="size-4 text-success" />;
            case 'error':
                return <AlertCircle className="size-4 text-destructive" />;
            case 'warning':
                return <AlertTriangle className="size-4 text-attention" />;
            case 'running':
                return <Loader2 className="size-4 text-info animate-spin" />;
        }
    };

    const getBorderColor = () => {
        switch (toolCall.status) {
            case 'completed':
                return 'border-success';
            case 'error':
                return 'border-destructive';
            case 'warning':
                return 'border-attention';
            case 'running':
                return 'border-info';
        }
    };

    const getStatusLabel = () => {
        switch (toolCall.status) {
            case 'completed':
                return 'Success';
            case 'error':
                return 'Failed';
            case 'warning':
                return 'Warning';
            case 'running':
                return 'Running';
        }
    };

    const formatDuration = (ms?: number) => {
        if (ms === undefined) return 'N/A';
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    };

    const formatTimestamp = (timestamp: number) => {
        return dayjs(timestamp).format('HH:mm:ss');
    };

    const hasParameters = toolCall.parameters && Object.keys(toolCall.parameters).length > 0;
    const hasOutput = toolCall.result && toolCall.result.trim().length > 0;

    return (
        <div className={`border-l-4 ${getBorderColor()} bg-white dark:bg-gray-900 rounded-md shadow-sm mb-3 overflow-hidden`}>
            {/* Header */}
            <div className="px-4 py-3 bg-muted/20">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Wrench className="size-4 text-muted flex-shrink-0" />
                        <span
                            className="font-medium text-sm break-words"
                            style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                            title={toolCall.toolName}
                        >
                            {toolCall.toolName}
                        </span>
                        {toolCall.toolType && (
                            <span className="text-xs px-2 py-0.5 bg-muted rounded text-muted flex-shrink-0 whitespace-nowrap">
                                {toolCall.toolType}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-xs">
                            {getStatusIcon()}
                            <span className="font-medium">{getStatusLabel()}</span>
                        </div>
                        {toolCall.durationMs !== undefined && (
                            <div className="flex items-center gap-1 text-xs text-muted">
                                <Clock className="size-3" />
                                <span>{formatDuration(toolCall.durationMs)}</span>
                            </div>
                        )}
                        <span className="text-xs text-muted">
                            {formatTimestamp(toolCall.timestamp)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="px-4 py-3 space-y-2">
                {/* Error Display */}
                {toolCall.error && (
                    <div className="p-3 bg-destructive/10 border border-destructive rounded-md">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="size-4 text-destructive mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm text-destructive">
                                    {toolCall.error.type}
                                </div>
                                <div className="text-sm text-destructive/80 mt-1">
                                    {toolCall.error.message}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Parameters Section */}
                {hasParameters && (
                    <div>
                        <button
                            onClick={() => setShowParameters(!showParameters)}
                            className="flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground transition-colors"
                        >
                            {showParameters ? (
                                <ChevronDown className="size-4" />
                            ) : (
                                <ChevronRight className="size-4" />
                            )}
                            Parameters ({Object.keys(toolCall.parameters!).length})
                        </button>
                        {showParameters && (
                            <div className="mt-2 p-3 bg-muted/30 rounded-md">
                                <pre className="text-xs overflow-x-auto">
                                    {JSON.stringify(toolCall.parameters, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                )}

                {/* Output Section */}
                {hasOutput && (
                    <div>
                        <button
                            onClick={() => setShowOutput(!showOutput)}
                            className="flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground transition-colors"
                        >
                            {showOutput ? (
                                <ChevronDown className="size-4" />
                            ) : (
                                <ChevronRight className="size-4" />
                            )}
                            Output
                        </button>
                        {showOutput && (
                            <div className="mt-2 p-3 bg-muted/30 rounded-md prose prose-sm max-w-none dark:prose-invert">
                                <MarkdownRenderer>{toolCall.result!}</MarkdownRenderer>
                            </div>
                        )}
                    </div>
                )}

                {/* Metrics Section */}
                <div>
                    <button
                        onClick={() => setShowMetrics(!showMetrics)}
                        className="flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground transition-colors"
                    >
                        {showMetrics ? (
                            <ChevronDown className="size-4" />
                        ) : (
                            <ChevronRight className="size-4" />
                        )}
                        Metrics
                    </button>
                    {showMetrics && (
                        <div className="mt-2 p-3 bg-muted/30 rounded-md space-y-1 text-xs">
                            {toolCall.toolUseId && (
                                <div className="flex justify-between gap-2">
                                    <span className="text-muted flex-shrink-0">Tool Use ID:</span>
                                    <span className="font-mono break-all text-right" title={toolCall.toolUseId}>{toolCall.toolUseId}</span>
                                </div>
                            )}
                            {toolCall.iteration !== undefined && (
                                <div className="flex justify-between">
                                    <span className="text-muted">Iteration:</span>
                                    <span>{toolCall.iteration}</span>
                                </div>
                            )}
                            {toolCall.workstreamId && (
                                <div className="flex justify-between">
                                    <span className="text-muted">Workstream:</span>
                                    <span>{toolCall.workstreamId}</span>
                                </div>
                            )}
                            {toolCall.durationMs !== undefined && (
                                <div className="flex justify-between">
                                    <span className="text-muted">Duration:</span>
                                    <span>{formatDuration(toolCall.durationMs)}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
