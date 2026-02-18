import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button, cn, useToast } from "@vertesia/ui/core";
import { MarkdownRenderer } from "@vertesia/ui/widgets";
import { Bot, CopyIcon } from "lucide-react";
import dayjs from "dayjs";

// PERFORMANCE: Unicode cursor character - rendered inline with text
// This avoids expensive DOM manipulation with TreeWalker on every update
// Using thin pipe for softer visual appearance
const CURSOR_CHAR = "│";

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
    /** Additional className for the card wrapper */
    cardClassName?: string;
    /** Additional className for the header section */
    headerClassName?: string;
    /** Additional className for the content section */
    contentClassName?: string;
    /** Additional className for the prose/markdown container */
    proseClassName?: string;
    /** Additional className for the sender label */
    senderClassName?: string;
    /** Additional className for the icon wrapper */
    iconClassName?: string;
}

/** className overrides for StreamingMessage — subset of StreamingMessageProps containing only className props. */
export type StreamingMessageClassNames = Partial<Pick<StreamingMessageProps,
    'className' | 'cardClassName' | 'headerClassName' | 'contentClassName' |
    'proseClassName' | 'senderClassName' | 'iconClassName'>>;

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
    cardClassName,
    headerClassName,
    contentClassName,
    proseClassName,
    senderClassName,
    iconClassName,
}: StreamingMessageProps) {
    const [displayedLength, setDisplayedLength] = useState(0);
    const [throttledText, setThrottledText] = useState("");
    const animationRef = useRef<number | null>(null);
    const targetLengthRef = useRef(text.length);
    const displayedLengthRef = useRef(0);
    const startTime = useRef(timestamp || Date.now());
    const textRef = useRef(text); // Keep latest text for interval callback

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
    textRef.current = text;

    const animate = useCallback(() => {
        let lastTime = performance.now();

        const step = (currentTime: number) => {
            const elapsed = currentTime - lastTime;
            lastTime = currentTime;

            const buffer = targetLengthRef.current - displayedLengthRef.current;

            // Nothing to reveal - stop animation, it will restart when new text arrives
            if (buffer <= 0) {
                fractionalCharsRef.current = 0;
                animationRef.current = null;
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

    // Throttle markdown updates for performance using a consistent interval
    // This avoids the issue where timeout-based throttling gets cancelled on every displayedLength change
    const throttleIntervalRef = useRef<number | null>(null);
    const lastThrottledLengthRef = useRef(0);

    // Handle immediate updates when caught up or complete
    useEffect(() => {
        if (displayedLength >= targetLengthRef.current || isComplete) {
            setThrottledText(textRef.current.slice(0, displayedLength));
            lastThrottledLengthRef.current = displayedLength;
        }
    }, [displayedLength, isComplete]);

    // Manage the throttle interval - starts when streaming, stops when caught up
    const isStreaming = displayedLength < text.length && !isComplete;

    useEffect(() => {
        if (!isStreaming) {
            // Not streaming - clear interval
            if (throttleIntervalRef.current) {
                clearInterval(throttleIntervalRef.current);
                throttleIntervalRef.current = null;
            }
            return;
        }

        // Start interval if not already running (~30fps markdown updates)
        if (!throttleIntervalRef.current) {
            throttleIntervalRef.current = window.setInterval(() => {
                const currentLength = displayedLengthRef.current;
                // Only update if there's new content to show
                if (currentLength > lastThrottledLengthRef.current) {
                    setThrottledText(textRef.current.slice(0, currentLength));
                    lastThrottledLengthRef.current = currentLength;
                }
            }, 33);
        }

        return () => {
            if (throttleIntervalRef.current) {
                clearInterval(throttleIntervalRef.current);
                throttleIntervalRef.current = null;
            }
        };
    }, [isStreaming]);

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
        <div className={cn("w-full max-w-full", className)}>
            {/* Card wrapper matching MessageItem structure */}
            <div
                className={cn("border-l-4 bg-white dark:bg-gray-900 mb-4 border-l-purple-500 w-full max-w-full overflow-hidden", cardClassName)}
                data-workstream-id={workstreamId}
            >
                {/* Compact header */}
                <div className={cn("flex items-center justify-between px-4 py-1.5", headerClassName)}>
                    <div className="flex items-center gap-1.5">
                        <div className={cn("animate-fadeIn", iconClassName)}>
                            {isTyping ? (
                                <span className="size-2 rounded-full bg-blue-500 animate-pulse inline-block" />
                            ) : (
                                <Bot className="size-4 text-purple-600 dark:text-purple-400" />
                            )}
                        </div>
                        <span className={cn("text-xs font-medium text-muted", senderClassName)}>Agent</span>
                        {workstreamId && workstreamId !== "main" && (
                            <span className="text-xs text-muted">• Task {workstreamId}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-muted">
                        <span className="text-[11px]">{formattedTime}</span>
                        <Button
                            variant="ghost"
                            size="xs"
                            onClick={copyToClipboard}
                            className="size-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
                            title="Copy message"
                        >
                            <CopyIcon className="size-3" />
                        </Button>
                    </div>
                </div>

                {/* Content - cursor character is appended directly to text (no DOM manipulation) */}
                <div
                    className={cn(
                        "px-3 pb-2 streaming-content",
                        isTyping && "streaming-active",
                        contentClassName
                    )}
                >
                    <div className={cn("vprose prose prose-slate dark:prose-invert prose-p:leading-relaxed prose-p:my-3 prose-headings:font-semibold prose-headings:tracking-normal prose-headings:mt-6 prose-headings:mb-3 prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-li:my-1 prose-ul:my-3 prose-ol:my-3 prose-table:my-5 prose-pre:my-4 prose-hr:my-6 max-w-none text-[15px] break-words", proseClassName)} style={{ overflowWrap: 'anywhere' }}>
                        <MarkdownRenderer>
                            {displayTextWithCursor}
                        </MarkdownRenderer>
                    </div>
                    <style>{`
                        /* Ensure inline elements flow properly */
                        .streaming-content p:last-child,
                        .streaming-content li:last-child {
                            display: inline;
                        }
                        /* Soft fade at reveal edge */
                        .streaming-active .vprose {
                            mask-image: linear-gradient(to right, black 97%, transparent 100%);
                            -webkit-mask-image: linear-gradient(to right, black 97%, transparent 100%);
                        }
                    `}</style>
                </div>
            </div>
        </div>
    );
}

const StreamingMessage = React.memo(StreamingMessageComponent);

export default StreamingMessage;
