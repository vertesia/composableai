import React, { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@vertesia/ui/core";
import { PulsatingCircle } from "../AnimatedThinkingDots";

interface StreamingMessageProps {
    text: string;
    workstreamId?: string;
    /** Characters per second for reveal animation (default: 300) */
    revealSpeed?: number;
    /** Whether streaming has completed (triggers fast catch-up) */
    isComplete?: boolean;
}

/**
 * Displays a streaming message with a fast, smooth reveal effect.
 * Text is revealed in chunks with a subtle fade-in animation for natural feel.
 */
function StreamingMessageComponent({
    text,
    workstreamId,
    revealSpeed = 300,
    isComplete = false,
}: StreamingMessageProps) {
    const [displayedLength, setDisplayedLength] = useState(0);
    const [recentlyAddedStart, setRecentlyAddedStart] = useState(0);
    const animationRef = useRef<number | null>(null);
    const targetLengthRef = useRef(text.length);
    const displayedLengthRef = useRef(0);
    const lastRevealRef = useRef(0);

    // Keep refs in sync
    targetLengthRef.current = text.length;

    const animate = useCallback(() => {
        let lastTime = performance.now();

        const step = (currentTime: number) => {
            const elapsed = currentTime - lastTime;
            const behindBy = targetLengthRef.current - displayedLengthRef.current;

            // Fast adaptive speed - quickly catch up when behind
            const baseSpeed = isComplete ? revealSpeed * 3 : revealSpeed;
            const speedBoost = Math.min(5, 1 + behindBy / 50);
            const currentSpeed = baseSpeed * speedBoost;
            const msPerChar = 1000 / currentSpeed;

            // Reveal in chunks of ~5-15 chars for smoother appearance
            const minChunk = 5;
            const charsToAdd = Math.max(minChunk, Math.floor(elapsed / msPerChar));

            if (elapsed >= msPerChar * minChunk) {
                const prevLength = displayedLengthRef.current;
                displayedLengthRef.current = Math.min(
                    displayedLengthRef.current + charsToAdd,
                    targetLengthRef.current
                );

                // Track where new text starts for fade effect
                if (currentTime - lastRevealRef.current > 50) {
                    setRecentlyAddedStart(prevLength);
                    lastRevealRef.current = currentTime;
                }

                setDisplayedLength(displayedLengthRef.current);
                lastTime = currentTime;
            }

            // Continue if not caught up
            if (displayedLengthRef.current < targetLengthRef.current) {
                animationRef.current = requestAnimationFrame(step);
            } else {
                animationRef.current = null;
                // Clear the "recently added" highlight after catching up
                setRecentlyAddedStart(displayedLengthRef.current);
            }
        };

        animationRef.current = requestAnimationFrame(step);
    }, [revealSpeed, isComplete]);

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

    // When streaming completes, ensure we finish displaying quickly
    useEffect(() => {
        if (isComplete && displayedLengthRef.current < text.length) {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
            animate();
        }
    }, [isComplete, text.length, animate]);

    if (!text) return null;

    const stableText = text.slice(0, recentlyAddedStart);
    const newText = text.slice(recentlyAddedStart, displayedLength);
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
                    {stableText}
                    <span
                        key={recentlyAddedStart}
                        className="transition-opacity duration-150"
                        style={{ animation: 'fadeIn 0.15s ease-out' }}
                    >
                        {newText}
                    </span>
                    <span
                        className={cn(
                            "inline-block w-0.5 h-4 ml-0.5 rounded-sm",
                            "bg-blue-500 dark:bg-blue-400",
                            isTyping ? "animate-pulse" : "opacity-0"
                        )}
                    />
                    <style>{`
                        @keyframes fadeIn {
                            from { opacity: 0.4; }
                            to { opacity: 1; }
                        }
                    `}</style>
                </div>
            </div>
        </div>
    );
}

const StreamingMessage = React.memo(StreamingMessageComponent);

export default StreamingMessage;
