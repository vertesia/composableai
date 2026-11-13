import { type TabsRoute, TabsRouteContext } from '@vertesia/ui/core';
import type React from 'react';
import { useMemo } from 'react';
import type { RouterContext } from './Router';

/**
 * Hands `Tabs updatePath` the route of this router level. `@vertesia/ui/core` cannot import the router, so the
 * router provides this context next to its own (see `TabsRouteContext`).
 */
export function TabsRouteBridge({ ctx, children }: { ctx: RouterContext; children: React.ReactNode }) {
    const { params, route, matchedRoutePath, navigate } = ctx;
    const value = useMemo<TabsRoute>(
        () => ({ params, routePath: route.path, matchedRoutePath, navigate }),
        [params, route.path, matchedRoutePath, navigate],
    );
    return <TabsRouteContext.Provider value={value}>{children}</TabsRouteContext.Provider>;
}
