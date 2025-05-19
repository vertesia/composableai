import clsx from 'clsx';
import { useSidebarToggle } from './SidebarContext';
import { Dot } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@vertesia/ui/core';
import { Nav } from "@vertesia/ui/router";


interface SidebarProps {
    children: React.ReactNode | React.ReactNode[]
    logo?: React.ReactNode
    className?: string
}

export function Sidebar({ children, logo, className }: SidebarProps) {
    return (
        <div className={clsx(className || "bg-indigo-600 dark:bg-indigo-950",
            "flex flex-col h-full"
        )}>
            {logo &&
                <div className="-mx-2 flex h-auto my-4 shrink-0 self-start">
                    {logo}
                </div>
            }
            <div className="flex-1 min-h-0 overflow-hidden px-2">
                <nav className="h-full flex flex-col">
                    <ul role="list" className="flex flex-col gap-y-2 overflow-y-auto h-full">
                        {children}
                    </ul>
                </nav>
            </div>
        </div>
    )
}

interface SidebarSectionProps {
    children: React.ReactNode | React.ReactNode[]
    title?: React.ReactNode
    action?: React.ReactNode
    isFooter?: boolean
}
export function SidebarSection({ children, title, action, isFooter = false }: SidebarSectionProps) {
    const { isOpen } = useSidebarToggle();

    let header = isOpen ? <>
        {title || ""}
        {action}
    </> : <Dot className='size-6' />

    return (
        <li className={isFooter ? 'mt-auto' : ''}>
            {title && <div className="text-xs font-medium h-8 flex items-center gap-x-2 px-2 text-sidebar-foreground/70">
                {header}
            </div>}
            <ul data-sidebar="menu" className="flex w-full min-w-0 flex-col gap-1">
                {children}
            </ul>
        </li>
    )
}

export function SidebarTooltip({ children, text }: { children: React.ReactNode, text?: string }) {
    const { isOpen } = useSidebarToggle();
    return (
        isOpen ? <>{children}</> :
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        {children}
                    </TooltipTrigger>
                    <TooltipContent side='right'>
                        {text}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
    )
}

export interface SidebarItemProps {
    href: string
    icon?: React.ComponentType<React.HTMLAttributes<Element>>
    current?: boolean
    onClick?: (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void
    children: React.ReactNode | React.ReactNode[]
    tools?: React.ReactNode
    className?: string;
    id?: string; //HTML ID of the element
}
export function SidebarItem({ className, tools, children, icon: Icon, href, current, onClick }: SidebarItemProps) {
    const { toggleMobile } = useSidebarToggle();
    const _closeSideBar = () => {
        setTimeout(() => {
            toggleMobile(false)
        }, 100);
    }
    return (
        <li>
            <Nav onClick={_closeSideBar}>
                <SidebarTooltip text={children as string}>
                    <a
                        href={href}
                        onClick={onClick}
                        className={clsx(
                            current
                                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                                : 'text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent',
                            'group flex gap-x-3 rounded-md px-2 py-1.5 text-sm items-center h-8',
                            className
                        )}
                    >
                        {Icon &&
                            <Icon
                                className={clsx(
                                    current
                                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                                        : 'text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent',
                                    'size-4 shrink-0'
                                )}
                                aria-hidden="true"
                            />
                        }
                        {children}
                        {tools && <div className='flex items-center ml-auto'>{tools}</div>}
                    </a>
                </SidebarTooltip>
            </Nav>
        </li>

    )
}