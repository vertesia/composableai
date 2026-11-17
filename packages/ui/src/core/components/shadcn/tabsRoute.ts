import * as React from 'react';

/**
 * What a `Tabs updatePath` needs from the router. `@vertesia/ui/router` imports `@vertesia/ui/core`, so `Tabs`
 * cannot import the router without a cycle between the two sub-path bundles: the router provides this context
 * instead (`RouterProvider` and `NestedRouterProvider`), filled from the route context it already builds.
 *
 * Every path is relative to the router level that provides it, which is also what `navigate` expects.
 */
export interface TabsRoute {
    /** Parameters of the matched route, e.g. `{ tab: 'keys' }` for `/settings/:tab`. */
    params: Record<string, string>;
    /** Pattern of the matched route, e.g. `/settings/:tab`. */
    routePath: string;
    /** Path that matched the route, e.g. `/settings/keys`. */
    matchedRoutePath: string;
    navigate: (to: string, options?: { replace?: boolean; keepHistoryChain?: boolean }) => void;
}

export const TabsRouteContext = React.createContext<TabsRoute | undefined>(undefined);

function segments(path: string): string[] {
    return path.split('/').filter((segment) => segment.length > 0);
}

/**
 * The tab named by `route`: its `:pathParam` parameter, or, when the route has no such parameter, its last path
 * segment if that segment is one of `tabNames`. The second form serves pages whose tab level is already taken by
 * an id parameter (`/store/agents/:agentRunnerId`): each tab gets a literal route (`/store/agents/configuration`),
 * which the router prefers over the parameter.
 */
export function readTabFromRoute(route: TabsRoute, pathParam: string, tabNames: readonly string[]) {
    if (segments(route.routePath).includes(`:${pathParam}`)) return route.params[pathParam];
    const last = segments(route.matchedRoutePath).at(-1);
    const tab = last === undefined ? undefined : safeDecode(last);
    return tab !== undefined && tabNames.includes(tab) ? tab : undefined;
}

function safeDecode(segment: string) {
    try {
        return decodeURIComponent(segment);
    } catch {
        return segment;
    }
}

/**
 * The path of `route` with its tab set to `tab`: the `:pathParam` segment is replaced; without that parameter,
 * a last segment naming one of `tabNames` (a literal tab route) is replaced, and otherwise the tab is appended
 * (the bare `/settings/projects` of `/settings/projects/:tab`).
 */
export function buildTabPath(
    route: Pick<TabsRoute, 'routePath' | 'matchedRoutePath'>,
    pathParam: string,
    tab: string,
    tabNames: readonly string[] = [],
) {
    const matched = segments(route.matchedRoutePath);
    const index = segments(route.routePath).indexOf(`:${pathParam}`);
    const encoded = encodeURIComponent(tab);
    const last = matched.at(-1);
    if (index >= 0 && index < matched.length) {
        matched[index] = encoded;
    } else if (index < 0 && last !== undefined && tabNames.includes(safeDecode(last))) {
        matched[matched.length - 1] = encoded;
    } else {
        matched.push(encoded);
    }
    return `/${matched.join('/')}`;
}
