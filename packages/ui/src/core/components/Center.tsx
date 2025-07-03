import clsx from "clsx";
import { ReactNode } from "react";

interface CenterProps {
    children: ReactNode | ReactNode[]
    className?: string;
}
export function Center({ className, children }: CenterProps) {
    return (
        <div className={clsx('flex items-ceter justify-center', className)}>{children}</div>
    )
}