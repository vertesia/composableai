import { AgentMessage } from "@vertesia/common";
import { useMemo } from "react";
import { ToolCallItem } from "./ToolCallItem";
import { ToolMetricsSummary } from "./ToolMetricsSummary";
import { calculateToolMetrics, extractToolCalls } from "./utils";
import { MessageBox } from "@vertesia/ui/core";
import { Wrench } from "lucide-react";

interface ToolCallTimelineProps {
    messages: AgentMessage[];
}

export function ToolCallTimeline({ messages }: ToolCallTimelineProps) {
    // Extract tool calls and calculate metrics
    const toolCalls = useMemo(() => extractToolCalls(messages), [messages]);
    const metrics = useMemo(() => calculateToolMetrics(toolCalls), [toolCalls]);

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

    return (
        <div className="flex-1 overflow-y-auto px-4 py-4">
            {/* Metrics Summary */}
            <ToolMetricsSummary metrics={metrics} />

            {/* Tool Call List */}
            <div className="space-y-0">
                {toolCalls.map((toolCall, index) => (
                    <ToolCallItem
                        key={`${toolCall.timestamp}-${toolCall.toolName}-${index}`}
                        toolCall={toolCall}
                    />
                ))}
            </div>
        </div>
    );
}
