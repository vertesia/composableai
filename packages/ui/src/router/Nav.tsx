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
    const { router } = useRouterContext();
    // In-app route = not an external URL, `_blank` target, or bare hash. Relative paths count too —
    // they must be routed, else the global link listener re-applies the module base path (wrong URL).
    const isAnchorOrEmpty = !href || href.startsWith('#');
    const isExternal = /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//') || (!!target && target !== '_self');
    const isInternal = !isAnchorOrEmpty && !isExternal;
    // Keep the rendered href under the served `<base href>` mount (correct middle-click / hover /
    // open-in-new-tab); the onClick navigates via the router which applies the same rule. No-op when
    // origin-served (Studio UI). Click handler below passes the raw `href` — navigate() re-bases it.
    const resolvedHref = isInternal
        ? withMountBasename(!skipStickyParams ? router.getTopRouter().navigator.addStickyParams(href) : href)
        : href;
    const _onClick = (ev: MouseEvent) => {
        if (ev.defaultPrevented || !isInternal || isModifiedClick(ev)) {
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
