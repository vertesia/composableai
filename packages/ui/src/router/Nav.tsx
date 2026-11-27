import type { MouseEvent, SyntheticEvent } from 'react';
import { withMountBasename } from './path';
import { useNavigate, useRouterContext } from './Router';

/**
 * True when the click carries a modifier the browser uses for alternate link behavior
 * (open in new tab/window, download) or is not a primary-button click. Such clicks must fall
 * through to the native anchor so the browser can handle them instead of the SPA router.
 */
function isModifiedClick(ev: MouseEvent): boolean {
    return ev.metaKey || ev.altKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0;
}

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
     * If true, use replaceState instead of pushState (no new browser history entry). Either way the breadcrumbs
     * start over: `Nav` is top-level navigation (the sidebar), so Back returns to the previous page while the
     * breadcrumbs of that page no longer apply.
     */
    replace?: boolean;
}
export function Nav({ children, to, onClick, replace = false }: NavProps) {
    const navigate = useNavigate();
    const _onClick = (ev: SyntheticEvent) => {
        const link = (ev.target as HTMLElement).closest('a');
        const rawHref = link?.getAttribute('href');
        const target = to ?? rawHref;
        if (link && target) {
            ev.stopPropagation();
            ev.preventDefault();
            navigate(target, { replace, clearHistoryChain: true });
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
 * An anchor that navigates via the router. Internal paths are intercepted and carry the active
 * tenant sticky params (a/p); external URLs and `_blank` targets fall through to the browser.
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
    replace?: boolean; //If true, replace the current history entry instead of pushing (defaults to clearBreadcrumbs)
    skipStickyParams?: boolean; //If true, do not append the account (a) & project (p) sticky params to the href
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
    const ctx = useRouterContext();
    const { router } = ctx;
    // Resolve internal URLs even when a target makes navigation native. New-tab links still need
    // the mount path and tenant sticky params, but must not be intercepted by the SPA router.
    const isAnchorOrEmpty = !href || href.startsWith('#');
    const isExternalUrl = /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//');
    const isInternalUrl = !isAnchorOrEmpty && !isExternalUrl;
    const isNativeNavigation = !!target && target !== '_self';
    // Render the href the click navigates to, so middle-click, hover and open-in-new-tab agree with
    // it: the nested routers' base paths (the click navigates through `router`, which adds them) and
    // the served `<base href>` mount (no-op when origin-served, as in the Studio UI). The click
    // handler below passes the raw `href`, and navigate() applies the same rules. A link with a
    // target never goes through the router, so its href is already app-absolute.
    const topRouter = router.getTopRouter();
    // The top router navigates to `href` as given, so only a nested navigation needs resolving.
    const routedHref =
        isInternalUrl && !isNativeNavigation && !topLevelNav
            ? (ctx.resolvePath?.(href) ?? router.resolvePath(href))
            : href;
    const resolvedHref = isInternalUrl
        ? withMountBasename(!skipStickyParams ? topRouter.navigator.addStickyParams(routedHref) : routedHref)
        : href;
    const _onClick = (ev: MouseEvent) => {
        if (ev.defaultPrevented || isAnchorOrEmpty) {
            return;
        }
        if (isExternalUrl || isNativeNavigation || isModifiedClick(ev)) {
            // The browser opens the link natively (new tab, window or another site). Keep the click
            // from reaching a clickable ancestor, such as a table row, which would also navigate.
            ev.stopPropagation();
            return;
        }
        ev.stopPropagation();
        ev.preventDefault();
        const options = { replace: replace ?? clearBreadcrumbs };
        if (topLevelNav) {
            topRouter.navigate(href, options);
        } else {
            ctx.navigate(href, options);
        }
    };
    return (
        <a href={resolvedHref} className={className} target={target} onClick={_onClick}>
            {children}
        </a>
    );
}
