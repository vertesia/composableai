import type { Notification } from '@vertesia/common';
import { createContext, type ReactNode, type RefObject, useContext, useEffect, useMemo, useRef } from 'react';

/**
 * The exact item a notification is about, as the server names it (`{ type: 'task', id }`). The types a
 * client acknowledges by rendering are `agent_request` (`<agentRunId>:<request_id>`), `task`,
 * `agent_run_end` and `agent_turn` (agent run id) and `object` (content object id).
 */
export interface NotificationOccurrence {
    type: string;
    id: string;
}

/**
 * Implemented by the host application's notification store. A component reports while an
 * occurrence it renders is visible; the store marks the matching notification read.
 */
export interface NotificationAcknowledgementRegistry {
    /**
     * Reports that one rendered element showing `occurrence` became visible (`true`) or stopped being
     * visible (`false`). Calls are paired: every `true` is followed by exactly one `false`.
     */
    register(occurrence: NotificationOccurrence, visible: boolean): void;
    /**
     * Calls `listener` for each notification that arrives while the page is open, so a view can
     * refresh itself (a document whose intake finished). Returns the unsubscribe function.
     */
    onNotification?(listener: (notification: Notification) => void): () => void;
}

/**
 * Unset outside an application that keeps a notification inbox: acknowledgement is then a no-op and
 * {@link AcknowledgeOnRender} renders its children without a wrapper.
 */
export const NotificationAcknowledgementContext = createContext<NotificationAcknowledgementRegistry | null>(null);

export function useNotificationAcknowledgement(): NotificationAcknowledgementRegistry | null {
    return useContext(NotificationAcknowledgementContext);
}

export function notificationOccurrenceKey(occurrence: NotificationOccurrence): string {
    return `${occurrence.type}:${occurrence.id}`;
}

function toList(
    occurrences: NotificationOccurrence | readonly NotificationOccurrence[] | undefined,
): readonly NotificationOccurrence[] {
    if (!occurrences) return [];
    return Array.isArray(occurrences) ? occurrences : [occurrences as NotificationOccurrence];
}

function isDocumentVisible(): boolean {
    return typeof document === 'undefined' || document.visibilityState === 'visible';
}

/**
 * Reports `occurrences` to the notification store while the element behind `ref` intersects the
 * viewport and the tab is visible. Does nothing when no store is mounted, when there is nothing to
 * acknowledge, or when the browser has no IntersectionObserver.
 *
 * The element must be rendered when the component mounts: the observer attaches once per occurrence
 * set.
 */
export function useAcknowledgeOnRender(
    occurrences: NotificationOccurrence | readonly NotificationOccurrence[] | undefined,
    ref: RefObject<Element | null>,
): void {
    const registry = useContext(NotificationAcknowledgementContext);
    const list = toList(occurrences);
    const key = list.map(notificationOccurrenceKey).join('|');
    // Keyed by content, so a caller rebuilding the same occurrences each render does not re-observe.
    // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is the identity of `list`.
    const stableList = useMemo(() => list, [key]);

    useEffect(() => {
        if (!registry || stableList.length === 0) return;
        const element = ref.current;
        if (!element || typeof IntersectionObserver === 'undefined') return;

        let intersecting = false;
        let reported = false;
        const update = () => {
            const visible = intersecting && isDocumentVisible();
            if (visible === reported) return;
            reported = visible;
            for (const occurrence of stableList) registry.register(occurrence, visible);
        };
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) intersecting = entry.isIntersecting;
                update();
            },
            { threshold: 0 },
        );
        observer.observe(element);
        document.addEventListener('visibilitychange', update);
        return () => {
            observer.disconnect();
            document.removeEventListener('visibilitychange', update);
            if (reported) {
                reported = false;
                for (const occurrence of stableList) registry.register(occurrence, false);
            }
        };
    }, [registry, stableList, ref]);
}

export interface AcknowledgeOnRenderProps {
    occurrence: NotificationOccurrence | readonly NotificationOccurrence[] | undefined;
    children: ReactNode;
    className?: string;
}

/**
 * Wraps `children` in an observed `div` when a notification store is mounted, and renders them as
 * they are otherwise. Whether the wrapper exists depends only on the store, never on `occurrence`,
 * so an occurrence appearing later (a run going idle) does not remount the children.
 */
export function AcknowledgeOnRender({ occurrence, children, className }: AcknowledgeOnRenderProps) {
    const registry = useContext(NotificationAcknowledgementContext);
    const ref = useRef<HTMLDivElement>(null);
    useAcknowledgeOnRender(occurrence, ref);
    if (!registry) return <>{children}</>;
    return (
        <div ref={ref} className={className} data-notification-ack="">
            {children}
        </div>
    );
}

/** Subscribes to notifications that arrive while the component is mounted. No-op without a store. */
export function useOnNotification(listener: (notification: Notification) => void): void {
    const registry = useContext(NotificationAcknowledgementContext);
    const listenerRef = useRef(listener);
    listenerRef.current = listener;
    useEffect(() => {
        if (!registry?.onNotification) return;
        return registry.onNotification((notification) => listenerRef.current(notification));
    }, [registry]);
}
