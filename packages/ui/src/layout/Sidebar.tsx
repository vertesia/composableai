import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@vertesia/ui/core';
import { Nav, useRouterContext } from '@vertesia/ui/router';
import clsx from 'clsx';
import { Dot } from 'lucide-react';
import { useSidebarToggle } from './SidebarContext';

interface SidebarProps {
    children: React.ReactNode | React.ReactNode[];
    logo?: React.ReactNode;
    className?: string;
}

export function Sidebar({ children, logo, className }: SidebarProps) {
    return (
        <div className={clsx(className || 'bg-indigo-600 dark:bg-indigo-950', 'flex flex-col h-full')}>
            {logo && <div className="-mx-2 flex h-auto my-4 shrink-0 self-start">{logo}</div>}
            <div className="flex-1 min-h-0 overflow-hidden px-0 lg:px-2">
                <nav className="h-full flex flex-col">
                    <ul className="flex flex-col gap-y-2 overflow-y-auto h-full">{children}</ul>
                </nav>
            </div>
        </div>
    );
}

interface SidebarSectionProps {
    children: React.ReactNode | React.ReactNode[];
    title?: React.ReactNode;
    action?: React.ReactNode;
    isFooter?: boolean;
    className?: string;
}
export function SidebarSection({ children, title, action, isFooter = false, className }: SidebarSectionProps) {
    const { isOpen } = useSidebarToggle();

    const header = isOpen ? (
        <>
            {title || ''}
            {action}
        </>
    ) : (
        <Dot className="size-6" />
    );

    return (
        <li className={isFooter ? 'mt-auto' : ''}>
            {title && (
                <div className="text-xs font-medium h-8 flex items-center gap-x-2 px-2 text-sidebar-foreground/70">
                    {header}
                </div>
            )}
            <ul data-sidebar="menu" className={clsx('flex w-full min-w-0 flex-col gap-1', className)}>
                {children}
            </ul>
        </li>
    );
}

export function SidebarTooltip({ children, text }: { children: React.ReactNode; text?: string }) {
    const { isOpen } = useSidebarToggle();
    return isOpen ? (
        children
    ) : (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>{children}</TooltipTrigger>
                <TooltipContent side="right">{text}</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

export interface SidebarItemIconProps {
    className?: string;
    'aria-hidden'?: boolean | 'true' | 'false';
}

export interface SidebarItemProps {
    href: string;
    to?: string;
    icon?: React.ComponentType<SidebarItemIconProps>;
    current?: boolean;
    onClick?: (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
    children: React.ReactNode | React.ReactNode[];
    tools?: React.ReactNode;
    className?: string;
    id?: string; //HTML ID of the element
    external?: boolean; //If true, the link will open in a new tab
    replace?: boolean; //If true, navigation replaces the current history entry instead of pushing
    skipStickyParams?: boolean; //If true, do not append the account (a) & project (p) sticky params to the href
}
export function SidebarItem({
    external,
    className,
    tools,
    children,
    icon: Icon,
    href,
    to,
    current,
    onClick,
    replace,
    skipStickyParams,
}: SidebarItemProps) {
    const { toggleMobile } = useSidebarToggle();
    const { router } = useRouterContext();
    // Append the active tenant sticky params (account `a` + project `p`) the router holds to internal
    // hrefs, so opening a nav item in a new tab or copying its address preserves the current
    // account/project.
    const resolvedHref =
        !skipStickyParams && href.startsWith('/') ? router.getTopRouter().navigator.addStickyParams(href) : href;
    const _closeSideBar = () => {
        setTimeout(() => {
            toggleMobile(false);
        }, 100);
    };
    const onClickWrapper = (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
        if (external) {
            window.open(resolvedHref, '_blank');
            event.preventDefault(); // Prevent default link behavior
            event.stopPropagation(); // Stop the event from propagating
        } else if (onClick) {
            onClick(event);
        }
    };
    return (
        <li>
            <Nav to={to} onClick={_closeSideBar} replace={replace}>
                <SidebarTooltip text={children as string}>
                    <a
                        href={resolvedHref}
                        onClick={onClickWrapper}
                        className={clsx(
                            current
                                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                                : 'text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent',
                            'group flex gap-x-3 rounded-md px-2 py-1.5 text-sm items-center h-8',
                            className,
                        )}
                    >
                        {Icon && (
                            <Icon
                                className={clsx(
                                    current
                                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                                        : 'text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent',
                                    'size-4 shrink-0',
                                )}
                                aria-hidden="true"
                            />
                        )}
                        {children}
                        {tools && <div className="flex items-center ms-auto">{tools}</div>}
                    </a>
                </SidebarTooltip>
            </Nav>
        </li>
    );
}
