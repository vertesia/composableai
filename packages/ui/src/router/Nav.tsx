import { SyntheticEvent } from "react";
import { useNavigate, useRouterContext } from "./Router";

/**
 * Wraps a <a href="..."> and perform the navigation to href through the router.
 */
interface NavProps {
    children: React.ReactNode | React.ReactNode[];
    /**
     * A click was intercepted
     * @param ev
     * @returns
     */
    onClick?: (ev: SyntheticEvent) => void;
    /**
     * If true, use replaceState instead of pushState (no new browser history entry).
     * Defaults to true for backward compatibility.
     */
    replace?: boolean;
}
export function Nav({ children, onClick, replace = true }: NavProps) {
    const navigate = useNavigate();
    const _onClick = (ev: SyntheticEvent) => {
        const link = (ev.target as HTMLElement).closest('a');
        if (link && link.href) {
            ev.stopPropagation();
            ev.preventDefault();
            navigate(link.href, { replace });
            onClick?.(ev);
        }
    }
    return (
        <span onClick={_onClick}>{children}</span>
    )
}

/**
 * A anchor tag that performs navigation through the router.
 */
interface NavLinkProps {
    children: React.ReactNode | React.ReactNode[];
    href: string;
    className?: string;
    /**
     * use the root router to navigate
     */
    topLevelNav?: boolean;
    clearBreadcrumbs?: boolean;
}
export function NavLink({ children, href, className, topLevelNav, clearBreadcrumbs = false }: NavLinkProps) {
    const { router } = useRouterContext();
    const _onClick = (ev: SyntheticEvent) => {
        ev.stopPropagation();
        ev.preventDefault();
        const actualRouter = topLevelNav ? router.getTopRouter() : router;
        actualRouter.navigate(href, { replace: clearBreadcrumbs  });
    }
    return (
        <a href={href} className={className} onClick={_onClick}>{children}</a>
    )
}
