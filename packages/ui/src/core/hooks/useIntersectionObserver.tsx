import { RefObject, useEffect } from "react";

/**
 * if leave option is true then callback will be called when the target leaves the viewport
 * otherwise when it enters the viewport
 * @param target
 * @param cb
 * @param opts
 */
export function useIntersectionObserver(target: RefObject<HTMLElement | null | undefined>, cb: (entry: IntersectionObserverEntry) => void, opts: { leave?: boolean, threshold?: number, deps?: any[] } = {}) {

    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                const isEntering = entries[0].isIntersecting;
                if (opts.leave) {
                    if (!isEntering) {
                        cb(entries[0]);
                    }
                } else {
                    if (isEntering) {
                        cb(entries[0]);
                    }
                }
            },
            { threshold: opts.threshold || 1 }
        );

        if (target.current) {
            observer.observe(target.current);
        }

        return () => {
            if (target.current) {
                observer.unobserve(target.current);
            }
        };
    }, opts.deps ? opts.deps.concat(target) : [target]);

}
