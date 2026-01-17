import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button, cn, useToast } from "@vertesia/ui/core";
import { MarkdownRenderer } from "@vertesia/ui/widgets";
import { CopyIcon } from "lucide-react";
import dayjs from "dayjs";

// PERFORMANCE: Unicode cursor character - rendered inline with text
// This avoids expensive DOM manipulation with TreeWalker on every update
const CURSOR_CHAR = "▋";

export interface StreamingMessageProps {
    text: string;
    workstreamId?: string;
    /** Characters per second for reveal animation (default: 300) */
    revealSpeed?: number;
    /** Whether streaming has completed (triggers fast catch-up) */
    isComplete?: boolean;
    /** Timestamp when streaming started */
    timestamp?: number | string;
    /** Additional className for the outer container */
    className?: string;
    /** Additional className for the header section */
    headerClassName?: string;
    /** Additional className for the content section */
    contentClassName?: string;
}

/**
 * Displays a streaming message with adaptive reveal effect.
 * Automatically adjusts speed to match the model's generation rate,
 * creating smooth continuous text flow without bursts and pauses.
 */
function StreamingMessageComponent({
    text,
    workstreamId,
    revealSpeed = 300,
    isComplete = false,
    timestamp,
    className,
    headerClassName,
    contentClassName,
}: StreamingMessageProps) {
    const [displayedLength, setDisplayedLength] = useState(0);
    const [throttledText, setThrottledText] = useState("");
    const animationRef = useRef<number | null>(null);
    const targetLengthRef = useRef(text.length);
    const displayedLengthRef = useRef(0);
    const startTime = useRef(timestamp || Date.now());

    // Track model's generation rate for adaptive speed
    const lastTextLengthRef = useRef(0);
    const lastTextTimeRef = useRef(performance.now());
    const modelRateRef = useRef(revealSpeed); // chars per second from model
    const rateHistoryRef = useRef<number[]>([]); // smoothed rate history

    // Update model rate when new text arrives
    useEffect(() => {
        const now = performance.now();
        const newChars = text.length - lastTextLengthRef.current;
        const elapsed = now - lastTextTimeRef.current;

        if (newChars > 0 && elapsed > 0) {
            const instantRate = (newChars / elapsed) * 1000; // chars per second

            // Add to history and compute smoothed rate (moving average)
            rateHistoryRef.current.push(instantRate);
            if (rateHistoryRef.current.length > 5) {
                rateHistoryRef.current.shift();
            }
            const avgRate = rateHistoryRef.current.reduce((a, b) => a + b, 0) / rateHistoryRef.current.length;

            // Update model rate with some smoothing
            modelRateRef.current = Math.max(50, avgRate); // minimum 50 chars/sec
        }

        lastTextLengthRef.current = text.length;
        lastTextTimeRef.current = now;
    }, [text.length]);

    // Keep refs in sync
    targetLengthRef.current = text.length;

    const animate = useCallback(() => {
        let lastTime = performance.now();

        const step = (currentTime: number) => {
            const elapsed = currentTime - lastTime;
            const behindBy = targetLengthRef.current - displayedLengthRef.current;

            // Adaptive speed based on model rate and buffer
            // When close to caught up (small buffer), match model rate
            // When far behind, speed up to catch up
            let targetSpeed: number;

            if (isComplete) {
                // Fast finish when streaming is done
                targetSpeed = revealSpeed * 5;
            } else if (behindBy < 30) {
                // Close to caught up - slow down to match model rate
                // This prevents the "catch up then pause" effect
                targetSpeed = modelRateRef.current * 0.9; // slightly slower than model
            } else if (behindBy < 100) {
                // Small buffer - match model rate
                targetSpeed = modelRateRef.current;
            } else if (behindBy < 300) {
                // Medium buffer - gradually speed up
                const speedup = 1 + (behindBy - 100) / 100; // 1x to 3x
                targetSpeed = modelRateRef.current * speedup;
            } else {
                // Large buffer - catch up fast
                targetSpeed = revealSpeed * 10;
            }

            const msPerChar = 1000 / targetSpeed;

            // Chunk size based on buffer
            const minChunk = behindBy > 200 ? 15 : behindBy > 50 ? 8 : 3;
            const charsToAdd = Math.max(minChunk, Math.floor(elapsed / msPerChar));

            if (elapsed >= msPerChar * minChunk) {
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

    // Throttle markdown updates to every 100ms for performance
    useEffect(() => {
        // Update immediately if caught up or complete
        if (displayedLength >= text.length || isComplete) {
            setThrottledText(text.slice(0, displayedLength));
            return;
        }

        // Throttle during active streaming
        const timer = setTimeout(() => {
            setThrottledText(text.slice(0, displayedLengthRef.current));
        }, 100);

        return () => clearTimeout(timer);
    }, [displayedLength, text.length, isComplete]);

    const toast = useToast();
    const formattedTime = useMemo(() =>
        dayjs(startTime.current).format("HH:mm:ss"),
        []
    );

    const isTyping = displayedLength < text.length;

    // PERFORMANCE: Append cursor character directly to text instead of DOM manipulation
    // This eliminates expensive TreeWalker traversal on every update
    const displayTextWithCursor = useMemo(() => {
        const baseText = throttledText || text.slice(0, displayedLength);
        return isTyping ? baseText + CURSOR_CHAR : baseText;
    }, [throttledText, text, displayedLength, isTyping]);

    if (!text) return null;

    const copyToClipboard = () => {
        navigator.clipboard.writeText(text).then(() => {
            toast({
                status: "success",
                title: "Copied to clipboard",
                duration: 2000,
            });
        });
    };

    return (
        <div
            className={cn(
                "flex flex-col gap-1 p-3 rounded-lg",
                "bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30",
                "min-h-[3rem]",
                className
            )}
        >
            {/* Header with task, timestamp and copy button */}
            <div className={cn("flex items-center justify-between", headerClassName)}>
                <div className="flex items-center gap-2">
                    {workstreamId && workstreamId !== "main" && (
                        <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                            Task: {workstreamId}
                        </span>
                    )}
                    {isTyping && (
                        <span className="text-xs text-muted">Streaming...</span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">{formattedTime}</span>
                    <Button
                        variant="ghost"
                        size="xs"
                        onClick={copyToClipboard}
                        className="text-muted opacity-50 hover:opacity-100"
                        title="Copy message"
                    >
                        <CopyIcon className="size-3" />
                    </Button>
                </div>
            </div>
            {/* Content - cursor character is appended directly to text (no DOM manipulation) */}
            <div
                className={cn(
                    "text-sm break-words leading-relaxed streaming-content prose prose-sm dark:prose-invert max-w-none",
                    isTyping && "streaming-active",
                    contentClassName
                )}
            >
                <MarkdownRenderer>
                    {displayTextWithCursor}
                </MarkdownRenderer>
                <style>{`
                    /* Ensure inline elements flow properly */
                    .streaming-content p:last-child,
                    .streaming-content li:last-child {
                        display: inline;
                    }

                    /* Style the cursor character when streaming */
                    .streaming-active {
                        /* The cursor character (▋) inherits text color by default */
                    }

                    /* Animate cursor with CSS - applies to the character via text-shadow */
                    @keyframes cursorPulse {
                        0%, 100% { opacity: 1; }
                        50% { opacity: 0.4; }
                    }

                    /* Make cursor character blink - targets last character when streaming */
                    .streaming-active code:last-child,
                    .streaming-active p:last-child,
                    .streaming-active li:last-child,
                    .streaming-active pre:last-child code {
                        /* Cursor character inherits this animation via the container */
                    }
                `}</style>
            </div>
        </div>
    );
}

const StreamingMessage = React.memo(StreamingMessageComponent);

export default StreamingMessage;
