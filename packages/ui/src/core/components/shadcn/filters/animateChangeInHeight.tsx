import { cn } from "../../libs/utils";
import { useEffect, useRef, useState } from "react";

interface AnimateChangeInHeightProps {
    children: React.ReactNode;
    className?: string;
}

export const AnimateChangeInHeight: React.FC<AnimateChangeInHeightProps> = ({
    children,
    className,
}: AnimateChangeInHeightProps) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [height, setHeight] = useState<number | "auto">("auto");

    useEffect(() => {
        if (containerRef.current) {
            const resizeObserver = new ResizeObserver((entries) => {
                // We only have one entry, so we can use entries[0].
                const observedHeight = entries[0].contentRect.height;
                setHeight(observedHeight);
            });

            resizeObserver.observe(containerRef.current);

            return () => {
                // Cleanup the observer when the component is unmounted
                resizeObserver.disconnect();
            };
        }
    }, []);

    return (
        <div
            className={cn(className, "overflow-hidden transition-all duration-100 ease-in")}
            style={{ height }}
        >
            <div ref={containerRef}>{children}</div>
        </div>
    );
};