import { type RefObject, useEffect, useRef } from 'react';

/**
 * if leave option is true then callback will be called when the target leaves the viewport
 * otherwise when it enters the viewport
 * @param target
 * @param cb
 * @param opts
 */
export function useIntersectionObserver(
    target: RefObject<HTMLElement | null | undefined>,
    cb: (entry: IntersectionObserverEntry) => void,
    opts: { leave?: boolean; threshold?: number; deps?: unknown[] } = {},
) {
    const cbRef = useRef(cb);
    cbRef.current = cb;
    const optsRef = useRef(opts);
    optsRef.current = opts;
    const threshold = opts.threshold || 1;

    useEffect(() => {
        const element = target.current;
        const observer = new IntersectionObserver(
            (entries) => {
                const isEntering = entries[0].isIntersecting;
                if (optsRef.current.leave) {
                    if (!isEntering) {
                        cbRef.current(entries[0]);
                    }
                } else {
                    if (isEntering) {
                        cbRef.current(entries[0]);
                    }
                }
            },
            { threshold },
        );

        if (element) {
            observer.observe(element);
        }

        return () => {
            if (element) {
                observer.unobserve(element);
            }
        };
        // opts.deps let callers re-attach the observer once the target element mounts
        // (e.g. an infinite-scroll sentinel that renders only after the first page loads).
    }, [target, threshold, ...(opts.deps ?? [])]);
}
