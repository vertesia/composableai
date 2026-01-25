import { WorkflowRunEvent } from "@vertesia/common";
import { useMemo, useState } from "react";
import { ToolMetricsSummary } from "./ToolMetricsSummary";
import { calculateToolMetrics, extractToolCallsFromHistory, ToolCallInfo } from "./utils";
import { Button, MessageBox } from "@vertesia/ui/core";
import { RefreshCw, Wrench, AlertCircle, CheckCircle2, Clock, AlertTriangle, X, Loader2 } from "lucide-react";
import dayjs from "dayjs";
import { MarkdownRenderer } from "@vertesia/ui/widgets";
import SyntaxHighlighter from 'react-syntax-highlighter/dist/esm/prism-async-light';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

SyntaxHighlighter.registerLanguage('json', json);

interface ToolCallTimelineProps {
    history: WorkflowRunEvent[];
    onRefresh?: () => void;
    isWorkflowComplete?: boolean;
    isLoading?: boolean;
}

export function ToolCallTimeline({ history, onRefresh, isWorkflowComplete, isLoading = false }: ToolCallTimelineProps) {
    console.log('[ToolCallTimeline] Rendering with history length:', history?.length || 0);

    // Extract tool calls and calculate metrics
    const toolCalls = useMemo(() => extractToolCallsFromHistory(history), [history]);
    const metrics = useMemo(() => calculateToolMetrics(toolCalls), [toolCalls]);

    // Selected tool for drawer
    const [selectedTool, setSelectedTool] = useState<ToolCallInfo | null>(null);

    // Dark mode detection for syntax highlighting
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

    console.log('[ToolCallTimeline] Tool calls count:', toolCalls.length);

    // Loading state
    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center p-6">
                <MessageBox
                    status="info"
                    icon={<Loader2 className="size-16 text-info animate-spin mb-4" />}
                >
                    <div className="text-base font-medium">
                        Loading tool history...
                    </div>
                    <div className="mt-3 text-sm text-muted">
                        Fetching workflow execution details
                    </div>
                </MessageBox>
            </div>
        );
    }

    // Empty state
    if (toolCalls.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center p-6">
                <MessageBox
                    status="info"
                    icon={<Wrench className="size-16 text-muted mb-4" />}
                >
                    <div className="text-base font-medium text-muted">
                        No tool calls yet
                    </div>
                    <div className="mt-3 text-sm text-muted">
                        Tool calls will appear here as the agent executes them
                    </div>
                </MessageBox>
            </div>
        );
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-success/10 text-success">
                    <CheckCircle2 className="size-3" />
                    completed
                </span>;
            case 'error':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-destructive/10 text-destructive">
                    <AlertCircle className="size-3" />
                    failed
                </span>;
            case 'warning':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-attention/10 text-attention">
                    <AlertTriangle className="size-3" />
                    warning
                </span>;
            case 'running':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-info/10 text-info">
                    <Clock className="size-3" />
                    running
                </span>;
        }
    };

    const formatDuration = (ms?: number) => {
        if (ms === undefined) return 'N/A';
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    };

    const formatTimestamp = (timestamp: number) => {
        return dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss');
    };

    return (
        <div className="flex-1 flex overflow-hidden">
            {/* Main content */}
            <div className={`flex-1 flex flex-col overflow-hidden ${selectedTool ? 'mr-[500px]' : ''}`}>
                <div className="flex-1 overflow-y-auto">
                    {/* Metrics Summary with Refresh Button */}
                    <div className="flex items-center justify-between px-4 py-4 border-b">
                        <ToolMetricsSummary metrics={metrics} />
                        {!isWorkflowComplete && onRefresh && (
                            <Button
                                onClick={onRefresh}
                                variant="outline"
                                size="sm"
                            >
                                <RefreshCw className="size-4 mr-2" />
                                Refresh
                            </Button>
                        )}
                    </div>

                    {/* Table */}
                    <table className="w-full">
                        <thead className="border-b sticky top-0 z-10 bg-background">
                            <tr>
                                <th className="text-left px-4 py-3 text-xs font-medium text-muted">ID</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-muted">Type</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-muted">Name</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-muted">Status</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-muted">Duration</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-muted">Started</th>
                            </tr>
                        </thead>
                        <tbody>
                            {toolCalls.map((toolCall, index) => (
                                <tr
                                    key={`${toolCall.timestamp}-${toolCall.toolName}-${index}`}
                                    onClick={() => setSelectedTool(toolCall)}
                                    className={`border-b cursor-pointer hover:bg-muted/20 ${selectedTool === toolCall ? 'bg-muted/30' : ''}`}
                                >
                                    <td className="px-4 py-3 text-sm">{index + 1}</td>
                                    <td className="px-4 py-3 text-sm">
                                        {toolCall.toolType && (
                                            <span className="px-2 py-0.5 rounded text-xs bg-muted text-muted">
                                                {toolCall.toolType}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm font-medium">{toolCall.toolName}</td>
                                    <td className="px-4 py-3 text-sm">{getStatusBadge(toolCall.status)}</td>
                                    <td className="px-4 py-3 text-sm text-muted">{formatDuration(toolCall.durationMs)}</td>
                                    <td className="px-4 py-3 text-sm text-muted">{formatTimestamp(toolCall.timestamp)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Drawer */}
            {selectedTool && (
                <div className="fixed right-0 top-0 bottom-0 w-[500px] bg-background border-l shadow-lg overflow-hidden flex flex-col z-50">
                    {/* Drawer Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b">
                        <h2 className="text-lg font-semibold">Tool Call Details</h2>
                        <button
                            onClick={() => setSelectedTool(null)}
                            className="p-1 hover:bg-muted rounded"
                        >
                            <X className="size-4" />
                        </button>
                    </div>

                    {/* Drawer Content */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {/* Tool Information */}
                        <div>
                            <h3 className="text-sm font-semibold mb-2">Tool Information</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted">Name:</span>
                                    <span className="font-medium">{selectedTool.toolName}</span>
                                </div>
                                {selectedTool.toolType && (
                                    <div className="flex justify-between">
                                        <span className="text-muted">Type:</span>
                                        <span className="px-2 py-0.5 rounded text-xs bg-muted">{selectedTool.toolType}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-muted">Status:</span>
                                    <span>{getStatusBadge(selectedTool.status)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted">Started:</span>
                                    <span>{formatTimestamp(selectedTool.timestamp)}</span>
                                </div>
                                {selectedTool.durationMs !== undefined && (
                                    <div className="flex justify-between">
                                        <span className="text-muted">Duration:</span>
                                        <span>{formatDuration(selectedTool.durationMs)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Error */}
                        {selectedTool.error && (
                            <div>
                                <h3 className="text-sm font-semibold mb-2">Error</h3>
                                <div className="p-3 bg-destructive/10 border border-destructive rounded-md">
                                    <div className="text-sm font-medium text-destructive">{selectedTool.error.type}</div>
                                    <div className="text-sm text-destructive/80 mt-1">{selectedTool.error.message}</div>
                                </div>
                            </div>
                        )}

                        {/* Parameters */}
                        {selectedTool.parameters && Object.keys(selectedTool.parameters).length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold mb-2">Tool Parameters</h3>
                                <div className="rounded-md border max-h-96 overflow-auto">
                                    <SyntaxHighlighter
                                        language="json"
                                        style={isDarkMode ? oneDark : oneLight}
                                        customStyle={{
                                            fontSize: '12px',
                                            margin: 0,
                                            borderRadius: '0.375rem'
                                        }}
                                    >
                                        {JSON.stringify(selectedTool.parameters, null, 2)}
                                    </SyntaxHighlighter>
                                </div>
                            </div>
                        )}

                        {/* Output */}
                        {selectedTool.result && selectedTool.result.trim().length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold mb-2">Output</h3>
                                <div className="p-3 bg-muted/30 rounded-md prose prose-sm max-w-none dark:prose-invert">
                                    <MarkdownRenderer>{selectedTool.result}</MarkdownRenderer>
                                </div>
                            </div>
                        )}

                        {/* Activity Parameters (Metrics) */}
                        <div>
                            <h3 className="text-sm font-semibold mb-2">Activity Parameters</h3>
                            <div className="space-y-1 text-xs">
                                {selectedTool.toolUseId && (
                                    <div className="flex justify-between gap-2">
                                        <span className="text-muted">Tool Use ID:</span>
                                        <span className="font-mono break-all text-right">{selectedTool.toolUseId}</span>
                                    </div>
                                )}
                                {selectedTool.toolRunId && (
                                    <div className="flex justify-between gap-2">
                                        <span className="text-muted">Activity ID:</span>
                                        <span className="font-mono break-all text-right">{selectedTool.toolRunId}</span>
                                    </div>
                                )}
                                {selectedTool.iteration !== undefined && (
                                    <div className="flex justify-between">
                                        <span className="text-muted">Iteration:</span>
                                        <span>{selectedTool.iteration}</span>
                                    </div>
                                )}
                                {selectedTool.workstreamId && (
                                    <div className="flex justify-between">
                                        <span className="text-muted">Workstream:</span>
                                        <span>{selectedTool.workstreamId}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
