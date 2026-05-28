import clsx from 'clsx';
import type { ReactNode } from 'react';

interface CenterProps {
    children: ReactNode | ReactNode[];
    className?: string;
}
export function Center({ className, children }: CenterProps) {
    return <div className={clsx('flex items-center justify-center', className)}>{children}</div>;
}
