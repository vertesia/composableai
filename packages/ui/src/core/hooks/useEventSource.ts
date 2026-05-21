import { useEffect } from "react";

function startSse<T>(url: string, onMessage: (content: string) => void,
    onCompleted: (payload: T) => void) {
    const chunks: string[] = [];
    const sse = new EventSource(url);
    sse.addEventListener("message", ev => {
        const data = JSON.parse(ev.data);
        if (data) {
            chunks.push(data);
            onMessage(chunks.join(''))
        }
    });
    sse.addEventListener("close", (ev) => {
        sse.close();
        const msg = JSON.parse(ev.data)
        onCompleted(msg);
    });
    return () => {
        sse.close();
    }

}

export function useEventSource<T>(url: string | (() => Promise<string>),
    onMessage: (content: string) => void,
    onCompleted: (payload: T) => void) {
    useEffect(() => {
        let stop: (() => void) | undefined;
        let cancelled = false;
        if (typeof url === 'function') {
            void url().then(url => {
                if (!cancelled) {
                    stop = startSse(url, onMessage, onCompleted);
                }
            });
        } else {
            stop = startSse(url, onMessage, onCompleted);
        }
        return () => {
            cancelled = true;
            stop?.();
        }
    }, [onCompleted, onMessage, url])
}
