import { useEffect, useRef } from "react";
import { BASE_PATH } from "./HistoryNavigator";

interface FixLinksProps {
    basePath: string;
    children: React.ReactNode | React.ReactNode[];
}
export function FixLinks({ basePath, children }: FixLinksProps) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (ref.current) {
            const divElem = ref.current;
            const listener = (ev: MouseEvent) => {
                const elem = ev.target as HTMLElement;
                if (elem.tagName.toLowerCase() === 'a') {
                    (ev as any)[BASE_PATH] = basePath;
                }
            }
            divElem.addEventListener('click', listener);
            return () => {
                divElem.removeEventListener('click', listener);
            }
        }
    }, [ref.current]);
    return (
        <div ref={ref} className="h-full w-full">{children}</div>
    )
}