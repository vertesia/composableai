import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

const SCROLL_THROTTLE_MS = 100;
const NEAR_BOTTOM_PX = 80;

/** Bounded live following mirrors the legacy log while history browsing preserves the reader's position. */
export function useCanonicalAgentScroll(
    enabled: boolean,
    sourceKey: string,
    liveVersion: string,
    historyVersion: string,
) {
    const containerRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const following = useRef(true);
    const lastScroll = useRef(0);
    const readingPosition = useRef<{ top: number; height: number } | undefined>(undefined);

    useEffect(() => {
        void sourceKey;
        following.current = true;
        readingPosition.current = undefined;
        lastScroll.current = 0;
        const container = containerRef.current;
        if (!enabled || !container) return;
        const onScroll = () => {
            following.current = container.scrollHeight - container.scrollTop - container.clientHeight <= NEAR_BOTTOM_PX;
        };
        container.addEventListener('scroll', onScroll, { passive: true });
        return () => container.removeEventListener('scroll', onScroll);
    }, [enabled, sourceKey]);

    useEffect(() => {
        void sourceKey;
        void liveVersion;
        if (!enabled || !following.current) return;
        const timer = window.setTimeout(
            () => {
                const container = containerRef.current;
                if (!following.current || !container || !bottomRef.current) return;
                // Move only this log, without scrolling the surrounding page or right panel.
                container.scrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
                lastScroll.current = Date.now();
            },
            Math.max(0, SCROLL_THROTTLE_MS - (Date.now() - lastScroll.current)),
        );
        return () => window.clearTimeout(timer);
    }, [enabled, sourceKey, liveVersion]);

    const preserveHistoryPosition = useCallback(() => {
        following.current = false;
        const container = containerRef.current;
        readingPosition.current = container ? { top: container.scrollTop, height: container.scrollHeight } : undefined;
    }, []);
    useLayoutEffect(() => {
        void historyVersion;
        if (readingPosition.current !== undefined && containerRef.current) {
            const container = containerRef.current;
            // Earlier pages appear above the current tail; offset their height so the same content stays in view.
            container.scrollTop = readingPosition.current.top + container.scrollHeight - readingPosition.current.height;
            readingPosition.current = undefined;
        }
    }, [historyVersion]);
    return { containerRef, bottomRef, preserveHistoryPosition };
}
