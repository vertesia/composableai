import React, { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@vertesia/ui/core";
import { PulsatingCircle } from "../AnimatedThinkingDots";

interface StreamingMessageProps {
    text: string;
    workstreamId?: string;
    /** Characters per second for typing animation (default: 100) */
    typingSpeed?: number;
}

/**
 * Displays a streaming message that is being received in real-time.
 * Shows a pulsating indicator and renders the accumulated text with a smooth typing effect.
 */
function StreamingMessageComponent({ text, workstreamId, typingSpeed = 100 }: StreamingMessageProps) {
    const [displayedLength, setDisplayedLength] = useState(0);
    const animationRef = useRef<number | null>(null);
    const targetLengthRef = useRef(text.length);
    const displayedLengthRef = useRef(0);

    // Keep refs in sync
    targetLengthRef.current = text.length;

    const animate = useCallback(() => {
        const msPerChar = 1000 / typingSpeed;
        let lastTime = performance.now();

        const step = (currentTime: number) => {
            const elapsed = currentTime - lastTime;
            const charsToAdd = Math.max(1, Math.floor(elapsed / msPerChar));

            if (elapsed >= msPerChar) {
                displayedLengthRef.current = Math.min(
                    displayedLengthRef.current + charsToAdd,
                    targetLengthRef.current
                );
                setDisplayedLength(displayedLengthRef.current);
                lastTime = currentTime;
            }

            // Continue if not caught up
            if (displayedLengthRef.current < targetLengthRef.current) {
                animationRef.current = requestAnimationFrame(step);
            } else {
                animationRef.current = null;
            }
        };

        animationRef.current = requestAnimationFrame(step);
    }, [typingSpeed]);

    // Start/continue animation when text grows
    useEffect(() => {
        if (text.length > displayedLengthRef.current && !animationRef.current) {
            animate();
        }

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
        };
    }, [text.length, animate]);

    if (!text) return null;

    const displayedText = text.slice(0, displayedLength);
    const isTyping = displayedLength < text.length;

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
                    {displayedText}
                    <span
                        className={cn(
                            "inline-block w-2 h-4 ml-0.5 bg-blue-500 dark:bg-blue-400",
                            isTyping ? "animate-none" : "animate-pulse"
                        )}
                    />
                </div>
            </div>
        </div>
    );
}

const StreamingMessage = React.memo(StreamingMessageComponent);

export default StreamingMessage;
