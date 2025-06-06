import { RefObject, useEffect } from "react";

interface ResizeOnDragOptions {
    handler: RefObject<HTMLElement | null | undefined>;
    left: RefObject<HTMLElement | null | undefined>;
    right: RefObject<HTMLElement | null | undefined>;
}

export function useResizeEW(opts: ResizeOnDragOptions) {

    useEffect(() => {
        if (opts.handler.current && opts.left.current && opts.right.current) {
            const handler = opts.handler.current;
            const left = opts.left.current;
            const right = opts.right.current;
            const onMouseDown = (e: MouseEvent) => {
                let x = e.clientX;
                let baseLW = left.offsetWidth;
                let baseRL = right.offsetLeft;
                const onMouseMove = (e: MouseEvent) => {
                    const dx = e.clientX - x;
                    left.style.width = `${baseLW + dx}px`;
                    right.style.left = `${baseRL + dx}px`;
                    (e.target as HTMLDivElement).classList.add('resizing');
                }
                const onMouseUp = (e: MouseEvent) => {
                    (e.target as HTMLDivElement).classList.remove('resizing');
                    onMouseMove(e);
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                }
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            }
            handler.addEventListener('mousedown', onMouseDown);
            return () => {
                handler.removeEventListener('mousedown', onMouseDown);
            }
        }
    }, [opts.handler.current, opts.left.current, opts.right.current]);

}