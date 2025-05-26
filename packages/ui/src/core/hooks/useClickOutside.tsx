import { useEffect, useRef } from "react";

/**
 *
 * @param callback
 * @param skipFn an optional function to skip the callback if the event matches some condition. Return true to skip
 * @returns
 */
export function useClickOutside<T extends HTMLElement>(callback: (e: MouseEvent) => void, skipFn?: (e: MouseEvent) => boolean) {
    const ref = useRef<T>(null);
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                if (!skipFn || !skipFn(e)) {
                    callback(e);
                }
            }
        }
        // add te listener just after the render to avoid the callback to be called on the current click
        // if you are in a click context
        window.setTimeout(() => {
            document.addEventListener('click', handleClick);
        }, 0);
        return () => {
            document.removeEventListener('click', handleClick);
        }
    }, [])
    return ref;
}
