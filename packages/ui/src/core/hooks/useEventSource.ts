import { useEffect, useRef } from 'react';

function startSse<T>(url: string, onMessage: (content: string) => void, onCompleted: (payload: T) => void) {
    const chunks: string[] = [];
    const sse = new EventSource(url);
    sse.addEventListener('message', (ev) => {
        const data = JSON.parse(ev.data);
        if (data) {
            chunks.push(data);
            onMessage(chunks.join(''));
        }
    });
    sse.addEventListener('close', (ev) => {
        sse.close();
        const msg = JSON.parse(ev.data);
        onCompleted(msg);
    });
    return () => {
        sse.close();
    };
}

/**
 * Opens an EventSource to `url` and routes events to `onMessage` / `onCompleted`.
 *
 * Callbacks are read through refs, so callers don't have to memoize them —
 * the EventSource is only re-created when the URL itself changes. Previously,
 * an inline `onMessage` that called `setState` would trigger a re-render →
 * new callback identity → effect re-fire → close-and-reopen the EventSource
 * after every chunk, which the server side sees as a torn-down response.
 */
export function useEventSource<T>(
    url: string | (() => Promise<string>),
    onMessage: (content: string) => void,
    onCompleted: (payload: T) => void,
) {
    const onMessageRef = useRef(onMessage);
    const onCompletedRef = useRef(onCompleted);
    onMessageRef.current = onMessage;
    onCompletedRef.current = onCompleted;

    useEffect(() => {
        let stop: (() => void) | undefined;
        let cancelled = false;
        const dispatchMessage = (content: string) => onMessageRef.current(content);
        const dispatchCompleted = (payload: T) => onCompletedRef.current(payload);
        if (typeof url === 'function') {
            void url().then((resolvedUrl) => {
                if (!cancelled) {
                    stop = startSse(resolvedUrl, dispatchMessage, dispatchCompleted);
                }
            });
        } else {
            stop = startSse(url, dispatchMessage, dispatchCompleted);
        }
        return () => {
            cancelled = true;
            stop?.();
        };
    }, [url]);
}
