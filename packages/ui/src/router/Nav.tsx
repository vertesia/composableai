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
}
export function Nav({ children, onClick }: NavProps) {
    const navigate = useNavigate();
    const _onClick = (ev: SyntheticEvent) => {
        const link = (ev.target as HTMLElement).closest('a');
        if (link && link.href) {
            ev.stopPropagation();
            ev.preventDefault();
            navigate(link.href);
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
}
export function NavLink({ children, href, className, topLevelNav }: NavLinkProps) {
    const { router } = useRouterContext();
    const _onClick = (ev: SyntheticEvent) => {
        ev.stopPropagation();
        ev.preventDefault();
        const actualRouter = topLevelNav ? router.getTopRouter() : router;
        actualRouter.navigate(href);
    }
    return (
        <a href={href} className={className} onClick={_onClick}>{children}</a>
    )
}
