import clsx from 'clsx';
import { ReactElement, ReactNode } from 'react';

import { ChevronRight, Info } from 'lucide-react';
import { VTooltip } from '@vertesia/ui/core';

interface GenericPageNavHeaderProps {
    title: string | ReactElement;
    description?: string | ReactElement;
    actions?: ReactNode | ReactNode[];
    breadcrumbs?: ReactElement[]
    isCompact?: boolean
    children?: ReactNode
    className?: string
}

export function GenericPageNavHeader({ className, children, title, description, actions, breadcrumbs, isCompact = false }: GenericPageNavHeaderProps) {
    return (
        <div className={clsx(isCompact ? 'pb-0' : 'pb-2', 'p-4 flex flex-col', className)}>
            <div className='flex items-start gap-4'>
                <div className="w-full flex place-content-between h-auto min-h-8 flex-col items-start">
                    <nav className="flex-1 flex justify-start text-xs">
                        {breadcrumbs?.map((breadcrumb, index) => {
                            return (
                                <div className="flex items-center text-muted" key={index}>
                                    {breadcrumb}
                                    {index < breadcrumbs.length - 1 && <ChevronRight className="w-3.5 h-3.5" />}
                                </div>
                            )
                        })}
                    </nav>
                    <div className='flex gap-2 items-center'>
                        <h1 className="text-xl font-semibold break-all">{title}</h1>
                        {
                            description &&
                            <VTooltip
                                description={description}>
                                <Info className="size-4 text-muted" />
                            </VTooltip>
                        }
                    </div>
                </div>
                <div className="flex gap-x-4 shrink-0">{actions}</div>
            </div>
            {children && <div className="w-full flex items-center">{children}</div>}
        </div>
    )
}