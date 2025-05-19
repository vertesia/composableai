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
        if (typeof url === 'function') {
            url().then(url => startSse(url, onMessage, onCompleted));
        } else {
            startSse(url, onMessage, onCompleted);
        }
    }, [url])
}
