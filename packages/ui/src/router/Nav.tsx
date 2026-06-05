import type { SyntheticEvent } from 'react';
import { useNavigate, useRouterContext } from './Router';

/**
 * Wraps a <a href="..."> and perform the navigation to href through the router.
 */
interface NavProps {
    children: React.ReactNode | React.ReactNode[];
    /**
     * Optional router navigation target. If omitted, the wrapped anchor href is used.
     */
    to?: string;
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
export function Nav({ children, to, onClick, replace = true }: NavProps) {
    const navigate = useNavigate();
    const _onClick = (ev: SyntheticEvent) => {
        const link = (ev.target as HTMLElement).closest('a');
        const rawHref = link?.getAttribute('href');
        const target = to ?? rawHref;
        if (link && target) {
            ev.stopPropagation();
            ev.preventDefault();
            navigate(target, { replace });
            onClick?.(ev);
        }
    };
    return (
        // biome-ignore lint/a11y/noStaticElementInteractions: span intercepts clicks on inner <a>; keyboard a11y comes from the anchor (Enter triggers click natively).
        // biome-ignore lint/a11y/useKeyWithClickEvents: same — the inner <a> provides keyboard activation natively.
        <span onClick={_onClick}>{children}</span>
    );
}

/**
 * A anchor tag that performs navigation through the router.
 *
 * Internal paths (href starting with `/`, no `_blank` target) are intercepted and routed, and the
 * rendered href carries the active tenant sticky params (account `a` + project `p`) so that opening
 * the link in a new tab or copying its address preserves the current account/project. External links
 * and explicit new-tab targets render as a plain anchor and are left to the browser.
 */
interface NavLinkProps {
    children: React.ReactNode | React.ReactNode[];
    href: string;
    className?: string;
    target?: string;
    /**
     * use the root router to navigate
     */
    topLevelNav?: boolean;
    clearBreadcrumbs?: boolean;
    /** replace the current history entry instead of pushing a new one (defaults to clearBreadcrumbs) */
    replace?: boolean;
    /** if true, do not append the account (a) & project (p) sticky params to the href */
    skipStickyParams?: boolean;
}
export function NavLink({
    children,
    href,
    className,
    target,
    topLevelNav,
    clearBreadcrumbs = false,
    replace,
    skipStickyParams,
}: NavLinkProps) {
    const { router } = useRouterContext();
    // Resolve the href with the active tenant sticky params (account `a` + project `p`) the router
    // already holds, so opening the link in a new tab or copying its address preserves the current
    // account/project. Uses the router's own params (no session dependency); a no-op until they are
    // set, and for external / non-path hrefs.
    const resolvedHref =
        !skipStickyParams && href.startsWith('/') ? router.getTopRouter().navigator.addStickyParams(href) : href;
    // Only intercept same-origin path navigations; let the browser handle external links and
    // explicit new-tab targets so ctrl-click / docs / help links still work natively.
    const isInternal = href.startsWith('/') && (!target || target === '_self');
    const _onClick = (ev: SyntheticEvent) => {
        if (ev.defaultPrevented || !isInternal) {
            return;
        }
        ev.stopPropagation();
        ev.preventDefault();
        const actualRouter = topLevelNav ? router.getTopRouter() : router;
        actualRouter.navigate(href, { replace: replace ?? clearBreadcrumbs });
    };
    return (
        <a href={resolvedHref} className={className} target={target} onClick={_onClick}>
            {children}
        </a>
    );
}
