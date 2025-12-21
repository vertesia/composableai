import React from "react";
import { cn } from "@vertesia/ui/core";
import { PulsatingCircle } from "../AnimatedThinkingDots";

interface StreamingMessageProps {
    text: string;
    workstreamId?: string;
}

/**
 * Displays a streaming message that is being received in real-time.
 * Shows a pulsating indicator and renders the accumulated text with a typing cursor effect.
 */
function StreamingMessageComponent({ text, workstreamId }: StreamingMessageProps) {
    if (!text) return null;

    return (
        <div
            className={cn(
                "flex items-start gap-2 p-3 rounded-lg",
                "bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30"
            )}
        >
            <div className="flex-shrink-0 mt-1">
                <PulsatingCircle size="sm" color="blue" />
            </div>
            <div className="flex-1 min-w-0">
                {workstreamId && workstreamId !== "main" && (
                    <div className="text-xs text-blue-600 dark:text-blue-400 mb-1 font-medium">
                        Task: {workstreamId}
                    </div>
                )}
                <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                    {text}
                    <span className="inline-block w-2 h-4 ml-0.5 bg-blue-500 dark:bg-blue-400 animate-pulse" />
                </div>
            </div>
        </div>
    );
}

const StreamingMessage = React.memo(StreamingMessageComponent);

export default StreamingMessage;
