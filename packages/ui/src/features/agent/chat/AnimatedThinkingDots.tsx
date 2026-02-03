import { cn } from "@vertesia/ui/core";
import { useEffect, useRef, useState } from "react";

interface AnimatedThinkingDotsProps {
    className?: string;
    inline?: boolean;
    color?: 'blue' | 'purple' | 'teal' | 'green' | 'amber';
}

export function AnimatedThinkingDots({ className, inline = false, color = 'blue' }: AnimatedThinkingDotsProps) {
    // Enhanced gradient colors based on the color prop
    const gradientColors = {
        blue: "from-blue-400 to-indigo-500 dark:from-blue-500 dark:to-indigo-400",
        purple: "from-purple-400 to-violet-500 dark:from-purple-500 dark:to-violet-400",
        teal: "from-teal-400 to-emerald-500 dark:from-teal-500 dark:to-emerald-400",
        green: "from-green-400 to-emerald-500 dark:from-green-500 dark:to-emerald-400",
        amber: "from-amber-400 to-orange-500 dark:from-amber-500 dark:to-orange-400"
    };

    const gradientClass = gradientColors[color];

    return (
        <div className={cn("flex items-center gap-1.5", inline ? "inline-flex" : "", className)}>
            <div className={`w-2 h-2 bg-gradient-to-r ${gradientClass} rounded-full animate-[bounce_1.2s_ease-in-out_infinite]`} />
            <div className={`w-2 h-2 bg-gradient-to-r ${gradientClass} rounded-full animate-[bounce_1.2s_ease-in-out_0.2s_infinite]`} />
            <div className={`w-2 h-2 bg-gradient-to-r ${gradientClass} rounded-full animate-[bounce_1.2s_ease-in-out_0.4s_infinite]`} />
        </div>
    );
}

interface PulsatingCircleProps {
    className?: string;
    size?: 'sm' | 'md' | 'lg';
    color?: 'blue' | 'purple' | 'teal' | 'green' | 'amber';
}

export function PulsatingCircle({ className, size = 'md', color = 'blue' }: PulsatingCircleProps) {
    // Enhanced size classes
    const sizeClasses = {
        sm: 'w-3 h-3',
        md: 'w-5 h-5',
        lg: 'w-7 h-7'
    };

    // Enhanced color mapping with gradients
    const colorClasses = {
        blue: 'bg-blue-500 dark:bg-blue-400',
        purple: 'bg-purple-500 dark:bg-purple-400',
        teal: 'bg-teal-500 dark:bg-teal-400',
        green: 'bg-green-500 dark:bg-green-400',
        amber: 'bg-amber-500 dark:bg-amber-400'
    };

    // Return enhanced implementation using smoother animations
    return (
        <span className={cn("relative flex", className)}>
            {/* Outer ripple effect */}
            <span className={cn(
                "animate-ping absolute inline-flex h-full w-full rounded-full opacity-60",
                colorClasses[color]
            )}></span>

            {/* Middle pulse */}
            <span className={cn(
                "animate-pulse absolute inline-flex h-[80%] w-[80%] rounded-full opacity-80",
                colorClasses[color]
            )} style={{
                left: '10%',
                top: '10%',
                animationDuration: '2s'
            }}></span>

            {/* Core circle */}
            <span className={cn(
                "relative inline-flex rounded-full",
                colorClasses[color],
                sizeClasses[size]
            )}></span>
        </span>
    );
}

interface TypedDotsProps {
    className?: string;
    color?: 'blue' | 'purple' | 'teal' | 'green' | 'amber';
}

export function TypedDots({ className, color = 'blue' }: TypedDotsProps) {
    const [dots, setDots] = useState('.');
    const colorClasses = {
        blue: 'text-blue-600 dark:text-blue-400',
        purple: 'text-purple-600 dark:text-purple-400',
        teal: 'text-teal-600 dark:text-teal-400',
        green: 'text-green-600 dark:text-green-400',
        amber: 'text-amber-600 dark:text-amber-400'
    };

    useEffect(() => {
        const intervalId = setInterval(() => {
            setDots(prev =>
                prev === '.' ? '..' :
                    prev === '..' ? '...' : '.'
            );
        }, 500);

        return () => clearInterval(intervalId);
    }, []);

    return <span className={cn(colorClasses[color], "font-bold", className)}>{dots}</span>;
}

interface PulsingMessageLoaderProps {
    message: string;
    className?: string;
    color?: 'blue' | 'purple' | 'teal' | 'green' | 'amber';
}

export function PulsingMessageLoader({ message, className, color = 'blue' }: PulsingMessageLoaderProps) {
    const colorClasses = {
        blue: {
            dot: 'bg-blue-500 dark:bg-blue-400',
            text: 'text-blue-700 dark:text-blue-300'
        },
        purple: {
            dot: 'bg-purple-500 dark:bg-purple-400',
            text: 'text-purple-700 dark:text-purple-300'
        },
        teal: {
            dot: 'bg-teal-500 dark:bg-teal-400',
            text: 'text-teal-700 dark:text-teal-300'
        },
        green: {
            dot: 'bg-green-500 dark:bg-green-400',
            text: 'text-green-700 dark:text-green-300'
        },
        amber: {
            dot: 'bg-amber-500 dark:bg-amber-400',
            text: 'text-amber-700 dark:text-amber-300'
        }
    };

    return (
        <div className={cn("flex items-center gap-2 py-1", className)}>
            <div className="flex space-x-1">
                <div className={`w-1.5 h-1.5 ${colorClasses[color].dot} rounded-full animate-bounce`} />
                <div className={`w-1.5 h-1.5 ${colorClasses[color].dot} rounded-full animate-bounce`} style={{ animationDelay: '0.2s' }} />
                <div className={`w-1.5 h-1.5 ${colorClasses[color].dot} rounded-full animate-bounce`} style={{ animationDelay: '0.4s' }} />
            </div>
            <div className={`${colorClasses[color].text} font-medium text-xs`}>{message}</div>
        </div>
    );
}

interface ThinkingBarProps {
    className?: string;
    color?: 'blue' | 'purple' | 'teal' | 'green' | 'amber';
    width?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    message?: string;
}

export function ThinkingBar({ className, color = 'blue', width = 'md', message }: ThinkingBarProps) {
    const [progress, setProgress] = useState(15);
    const [direction, setDirection] = useState<'increasing' | 'decreasing'>('increasing');
    const [speed, setSpeed] = useState(0.4); // Lower initial speed for smoother motion
    const containerRef = useRef<HTMLDivElement>(null);
    const isVisibleRef = useRef(true);

    // Track visibility to pause animation when off-screen
    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                isVisibleRef.current = entry.isIntersecting;
            },
            { threshold: 0 }
        );
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    // Width classes
    const widthClasses = {
        sm: 'w-24',
        md: 'w-32',
        lg: 'w-48',
        xl: 'w-64',
        full: 'w-full'
    };

    // Color classes
    const colorClasses = {
        blue: 'bg-blue-200 dark:bg-blue-900/30',
        purple: 'bg-purple-200 dark:bg-purple-900/30',
        teal: 'bg-teal-200 dark:bg-teal-900/30',
        green: 'bg-green-200 dark:bg-green-900/30',
        amber: 'bg-amber-200 dark:bg-amber-900/30'
    };

    const barColorClasses = {
        blue: 'bg-gradient-to-r from-blue-400 to-blue-500 dark:from-blue-500 dark:to-blue-400',
        purple: 'bg-gradient-to-r from-purple-400 to-purple-500 dark:from-purple-500 dark:to-purple-400',
        teal: 'bg-gradient-to-r from-teal-400 to-teal-500 dark:from-teal-500 dark:to-teal-400',
        green: 'bg-gradient-to-r from-green-400 to-green-500 dark:from-green-500 dark:to-green-400',
        amber: 'bg-gradient-to-r from-amber-400 to-amber-500 dark:from-amber-500 dark:to-amber-400'
    };

    const textColorClasses = {
        blue: 'text-blue-700 dark:text-blue-300',
        purple: 'text-purple-700 dark:text-purple-300',
        teal: 'text-teal-700 dark:text-teal-300',
        green: 'text-green-700 dark:text-green-300',
        amber: 'text-amber-700 dark:text-amber-300'
    };

    // Using requestAnimationFrame for smoother animation
    useEffect(() => {
        let animationFrameId: number;
        let lastUpdateTime = Date.now();

        const updateProgressBar = () => {
            // Skip updates when not visible to save CPU
            if (!isVisibleRef.current) {
                animationFrameId = requestAnimationFrame(updateProgressBar);
                return;
            }

            const now = Date.now();
            const deltaTime = now - lastUpdateTime;
            lastUpdateTime = now;

            setProgress(prev => {
                // Calculate movement based on time delta for consistent animation speed
                // regardless of frame rate
                const timeBasedChange = speed * (deltaTime / 16); // Normalize to 60fps

                // Calculate next progress based on direction
                let next = direction === 'increasing'
                    ? prev + timeBasedChange
                    : prev - timeBasedChange;

                // Handle direction changes at boundaries with easing
                if (next >= 85) {
                    setDirection('decreasing');
                    // Randomize speed slightly, but keep it low for smoothness
                    setSpeed(0.3 + Math.random() * 0.2);
                    return 85; // Cap at exactly 85%
                } else if (next <= 15) {
                    setDirection('increasing');
                    // Randomize speed slightly, but keep it low for smoothness
                    setSpeed(0.3 + Math.random() * 0.2);
                    return 15; // Cap at exactly 15%
                }

                // Occasionally adjust speed slightly (less frequently) for subtle natural feeling
                if (Math.random() > 0.99) {
                    setSpeed(prev => Math.max(0.2, Math.min(0.5, prev + (Math.random() * 0.1 - 0.05))));
                }

                return next;
            });

            animationFrameId = requestAnimationFrame(updateProgressBar);
        };

        animationFrameId = requestAnimationFrame(updateProgressBar);

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [direction, speed]);

    return (
        <div ref={containerRef} className={cn("flex flex-col gap-1", className)}>
            {message && (
                <div className={`text-xs font-medium ${textColorClasses[color]} mb-1`}>
                    {message}
                </div>
            )}
            <div className={cn("h-1.5 rounded-full overflow-hidden shadow-inner", colorClasses[color], widthClasses[width])}>
                <div
                    className={cn("h-full rounded-full", barColorClasses[color])}
                    style={{
                        width: `${progress}%`,
                        transition: 'width 150ms cubic-bezier(0.4, 0.0, 0.2, 1)' // Material Design easing for smoothness
                    }}
                ></div>
            </div>
        </div>
    );
}

interface WavyThinkingProps {
    className?: string;
    color?: 'blue' | 'purple' | 'teal' | 'green' | 'amber';
    size?: 'sm' | 'md' | 'lg';
}

export function WavyThinking({ className, color = 'blue', size = 'md' }: WavyThinkingProps) {
    // State to store and update heights of bars
    const [barHeights, setBarHeights] = useState<number[]>(Array(7).fill(50));
    const containerRef = useRef<HTMLDivElement>(null);
    const isVisibleRef = useRef(true);

    // Track visibility to pause animation when off-screen
    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                isVisibleRef.current = entry.isIntersecting;
            },
            { threshold: 0 }
        );
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    // Size classes
    const sizeClasses = {
        sm: { width: 'w-16', height: 'h-4', barWidth: 'w-0.5', gap: 'gap-[2px]' },
        md: { width: 'w-20', height: 'h-5', barWidth: 'w-1', gap: 'gap-[3px]' },
        lg: { width: 'w-24', height: 'h-6', barWidth: 'w-1.5', gap: 'gap-1' }
    };

    // Enhanced color classes with gradients for more visual appeal
    const colorClasses = {
        blue: 'bg-gradient-to-b from-blue-400 to-blue-500 dark:from-blue-400 dark:to-blue-500',
        purple: 'bg-gradient-to-b from-purple-400 to-purple-500 dark:from-purple-400 dark:to-purple-500',
        teal: 'bg-gradient-to-b from-teal-400 to-teal-500 dark:from-teal-400 dark:to-teal-500',
        green: 'bg-gradient-to-b from-green-400 to-green-500 dark:from-green-400 dark:to-green-500',
        amber: 'bg-gradient-to-b from-amber-400 to-amber-500 dark:from-amber-400 dark:to-amber-500'
    };

    // Use requestAnimationFrame for smooth animation
    useEffect(() => {
        let animationFrameId: number;
        const speeds = [1.2, 1.0, 1.5, 0.8, 1.3, 0.9, 1.1]; // Different speeds for each bar
        const phases = [0, 0.5, 1, 1.5, 2, 2.5, 3]; // Different starting phases for each bar
        let time = 0;

        const animateBars = () => {
            // Skip updates when not visible to save CPU
            if (!isVisibleRef.current) {
                animationFrameId = requestAnimationFrame(animateBars);
                return;
            }

            time += 0.02; // Increment time for animation

            // Update each bar's height with smooth sine wave
            const newHeights = Array(7).fill(0).map((_, index) => {
                // Calculate height using smooth sine wave with individual phase and speed
                // Scale to make sure it stays within 10% to 90% range
                return 10 + (Math.sin(time * speeds[index] + phases[index]) + 1) * 40;
            });

            setBarHeights(newHeights);
            animationFrameId = requestAnimationFrame(animateBars);
        };

        animationFrameId = requestAnimationFrame(animateBars);

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, []); // Empty dependency array means this runs once on mount

    return (
        <div
            ref={containerRef}
            className={cn(
                "flex items-end justify-center",
                sizeClasses[size].width,
                sizeClasses[size].height,
                sizeClasses[size].gap,
                className
            )}
        >
            {barHeights.map((height, i) => (
                <div
                    key={i}
                    className={cn(
                        sizeClasses[size].barWidth,
                        "rounded-full transform-gpu",
                        colorClasses[color]
                    )}
                    style={{
                        height: `${height}%`,
                        transition: 'height 100ms cubic-bezier(0.4, 0.0, 0.2, 1)', // Smooth transition
                        opacity: 0.9
                    }}
                ></div>
            ))}
        </div>
    );
}