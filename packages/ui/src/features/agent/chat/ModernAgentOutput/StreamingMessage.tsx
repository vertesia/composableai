import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button, cn, useToast } from "@vertesia/ui/core";
import { MarkdownRenderer } from "@vertesia/ui/widgets";
import { CopyIcon } from "lucide-react";
import dayjs from "dayjs";

interface StreamingMessageProps {
    text: string;
    workstreamId?: string;
    /** Characters per second for reveal animation (default: 300) */
    revealSpeed?: number;
    /** Whether streaming has completed (triggers fast catch-up) */
    isComplete?: boolean;
    /** Timestamp when streaming started */
    timestamp?: number | string;
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

    if (!text) return null;

    const isTyping = displayedLength < text.length;

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
                "min-h-[3rem]"
            )}
        >
            {/* Header with task, timestamp and copy button */}
            <div className="flex items-center justify-between">
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
            {/* Content - uses throttled text for performance */}
            <div className="text-sm break-words leading-relaxed streaming-content prose prose-sm dark:prose-invert max-w-none">
                <MarkdownRenderer>
                    {throttledText || text.slice(0, displayedLength)}
                </MarkdownRenderer>
                {isTyping && (
                    <span className="streaming-cursor" />
                )}
                <style>{`
                    .streaming-content p:last-child {
                        display: inline;
                    }
                    .streaming-cursor {
                        display: inline-block;
                        width: 2px;
                        height: 1.1em;
                        margin-left: 2px;
                        vertical-align: text-bottom;
                        background: linear-gradient(180deg, #3b82f6 0%, #60a5fa 50%, #3b82f6 100%);
                        border-radius: 1px;
                        animation: cursorBlink 0.6s ease-in-out infinite, cursorGlow 1.2s ease-in-out infinite;
                        box-shadow: 0 0 4px rgba(59, 130, 246, 0.6);
                    }
                    @keyframes cursorBlink {
                        0%, 100% { opacity: 1; transform: scaleY(1); }
                        50% { opacity: 0.4; transform: scaleY(0.95); }
                    }
                    @keyframes cursorGlow {
                        0%, 100% { box-shadow: 0 0 4px rgba(59, 130, 246, 0.6); }
                        50% { box-shadow: 0 0 8px rgba(59, 130, 246, 0.9), 0 0 12px rgba(59, 130, 246, 0.4); }
                    }
                    @media (prefers-color-scheme: dark) {
                        .streaming-cursor {
                            background: linear-gradient(180deg, #60a5fa 0%, #93c5fd 50%, #60a5fa 100%);
                            box-shadow: 0 0 6px rgba(96, 165, 250, 0.8);
                        }
                    }
                `}</style>
            </div>
        </div>
    );
}

const StreamingMessage = React.memo(StreamingMessageComponent);

export default StreamingMessage;
