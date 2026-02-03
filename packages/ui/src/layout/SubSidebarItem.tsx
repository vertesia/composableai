import clsx from 'clsx';
import { useSidebarToggle } from './SidebarContext';
import { SidebarTooltip } from './Sidebar';

/**
 * SubSidebarItem - A sidebar item for nested navigation (like tabs)
 * that doesn't use the router and preserves historyChain.
 *
 * This component just updates the URL hash and calls onClick,
 * without triggering router navigation that would clear breadcrumbs.
 */
export interface SubSidebarItemProps {
    href?: string; // Optional hash href (e.g., "#configuration")
    current?: boolean;
    onClick?: (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
    children: React.ReactNode | React.ReactNode[];
    className?: string;
    id?: string;
}

export function SubSidebarItem({ className, children, href, current, onClick, id }: SubSidebarItemProps) {
    const { toggleMobile } = useSidebarToggle();

    const _closeSideBar = () => {
        setTimeout(() => {
            toggleMobile(false);
        }, 100);
    };

    const onClickWrapper = (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
        // Prevent default navigation
        event.preventDefault();
        event.stopPropagation();

        // Close mobile sidebar
        _closeSideBar();

        // Call custom onClick handler
        if (onClick) {
            onClick(event);
        }
    };

    return (
        <li>
            <SidebarTooltip text={children as string}>
                <a
                    id={id}
                    href={href || '#'}
                    onClick={onClickWrapper}
                    className={clsx(
                        current
                            ? 'bg-sidebar'
                            : 'bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar hover:text-sidebar-foreground',
                        'group flex gap-x-3 rounded-md px-2 py-1.5 text-sm items-center h-8',

                        className
                    )}
                >
                    <span className="truncate">{children}</span>
                </a>
            </SidebarTooltip>
        </li>
    );
}
