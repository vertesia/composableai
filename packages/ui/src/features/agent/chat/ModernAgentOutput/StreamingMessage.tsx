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

    // Track model's generation rate for adaptive speed using exponential moving average
    const lastTextLengthRef = useRef(0);
    const lastTextTimeRef = useRef(performance.now());
    const modelRateRef = useRef(revealSpeed); // chars per second from model (EMA smoothed)
    const fractionalCharsRef = useRef(0); // sub-character accumulation for smooth reveal

    // Update model rate when new text arrives using EMA for smoother tracking
    useEffect(() => {
        const now = performance.now();
        const newChars = text.length - lastTextLengthRef.current;
        const elapsed = now - lastTextTimeRef.current;

        // Only update rate if meaningful time has passed (avoid divide-by-tiny-number issues)
        if (newChars > 0 && elapsed > 30) {
            const instantRate = (newChars / elapsed) * 1000; // chars per second

            // Exponential moving average - 20% weight to new sample
            // This creates smoother rate transitions than simple averaging
            const alpha = 0.2;
            modelRateRef.current = modelRateRef.current * (1 - alpha) + instantRate * alpha;

            // Clamp to reasonable range
            modelRateRef.current = Math.max(50, Math.min(2000, modelRateRef.current));
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
            lastTime = currentTime;

            const buffer = targetLengthRef.current - displayedLengthRef.current;

            // Nothing to reveal - keep animation running to catch new chunks
            if (buffer <= 0) {
                fractionalCharsRef.current = 0;
                animationRef.current = requestAnimationFrame(step);
                return;
            }

            // Smooth adaptive speed based on buffer size
            // Key insight: maintain a small buffer intentionally to smooth out arrival jitter
            let targetRate: number;

            if (isComplete) {
                // Streaming done - finish smoothly but not instant
                // Use 2x baseline or minimum 500 chars/sec for responsive feel
                targetRate = Math.max(500, modelRateRef.current * 2);
            } else if (buffer < 20) {
                // Nearly caught up - slow down slightly to maintain buffer
                // This prevents the "catch up then pause" jerkiness
                targetRate = modelRateRef.current * 0.85;
            } else if (buffer < 100) {
                // Healthy buffer - match model rate exactly
                targetRate = modelRateRef.current;
            } else if (buffer < 500) {
                // Buffer growing - gently speed up using continuous curve (1x to 1.5x)
                // Smoother than discrete steps
                const t = (buffer - 100) / 400; // 0 to 1
                targetRate = modelRateRef.current * (1 + t * 0.5);
            } else {
                // Large buffer - cap at 2x (not 10x like before)
                // This prevents jarring "catch up" bursts
                targetRate = modelRateRef.current * 2;
            }

            // Calculate chars to reveal with fractional accumulation for sub-char precision
            // This allows smoother reveal even at low rates
            const charsFloat = (targetRate * elapsed / 1000) + fractionalCharsRef.current;
            const charsToAdd = Math.floor(charsFloat);
            fractionalCharsRef.current = charsFloat - charsToAdd;

            if (charsToAdd > 0) {
                displayedLengthRef.current = Math.min(
                    displayedLengthRef.current + charsToAdd,
                    targetLengthRef.current
                );
                setDisplayedLength(displayedLengthRef.current);
            }

            // Continue animation loop
            animationRef.current = requestAnimationFrame(step);
        };

        animationRef.current = requestAnimationFrame(step);
    }, [isComplete]);

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

    // Throttle markdown updates for performance (reduced from 100ms to 33ms for responsiveness)
    useEffect(() => {
        // Update immediately if caught up or complete
        if (displayedLength >= text.length || isComplete) {
            setThrottledText(text.slice(0, displayedLength));
            return;
        }

        // Throttle during active streaming (~30fps markdown updates)
        const timer = setTimeout(() => {
            setThrottledText(text.slice(0, displayedLengthRef.current));
        }, 33);

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
