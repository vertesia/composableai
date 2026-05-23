import type React from "react";
import { useMemo, useRef } from "react";
import { FixLinks } from "./FixLinks";
import { createRoute404 } from "./Route404";
import { RouteComponent } from "./RouteComponent";
import { NestedRouter, ReactRouterContext, type Route, useRouterContext } from "./Router";
import type { NavigateOptions } from "./HistoryNavigator";


interface RouterProviderProps {
    routes: Route[],
    /**
     * The path to use for the root resource. Defaults to '/'. Cannot contains path variables or wildcards
     */
    index?: string;
    children?: React.ReactNode;
    fixLinks?: boolean;
}
export function NestedRouterProvider({ routes, index, children, fixLinks = false }: RouterProviderProps) {
    const ctx = useRouterContext();
    // Capture basePath once at mount. When the parent router switches to a different
    // top-level route (e.g. /store -> /studio), the lazy loader briefly keeps rendering
    // this (now-stale) module with a new ctx. Keeping basePath stable lets the
    // ctx.matchedRoutePath !== nestedRouter.basePath check below detect the mismatch and
    // skip rendering instead of running match() against the wrong route table.
    const basePathRef = useRef(ctx.matchedRoutePath);
    const nestedRouter = useMemo(() => {
        if (typeof window === 'undefined') return null;
        const nestedRouter = new NestedRouter(ctx.router, basePathRef.current, routes);
        nestedRouter.index = index;
        return nestedRouter;
    }, [ctx.router, index, routes]);

    const nestedRouteMatch = useMemo(() => {
        if (!nestedRouter) {
            return undefined;
        }
        if (ctx.matchedRoutePath !== nestedRouter.basePath) {
            // The change belongs to another router level and will be handled there.
            return undefined;
        }
        return nestedRouter.match(ctx.remainingPath || '/') || createRoute404();
    }, [ctx.matchedRoutePath, ctx.remainingPath, nestedRouter]);


    const wrapWithFixLinks = fixLinks ?
        (elem: React.ReactNode) => <FixLinks basePath={ctx.matchedRoutePath}>{elem}</FixLinks>
        : (elem: React.ReactNode) => elem;

    return nestedRouteMatch && (
        <ReactRouterContext.Provider value={{
            ...ctx,
            // biome-ignore lint/style/noNonNullAssertion: intentional non-null assertion; TS can't prove narrowing here
            router: nestedRouter!,
            route: nestedRouteMatch.value,
            params: nestedRouteMatch.params,
            matchedRoutePath: `/${nestedRouteMatch.matchedSegments.join('/')}`,
            remainingPath: nestedRouteMatch.remainingSegments ? `/${nestedRouteMatch.remainingSegments.join('/')}` : undefined,
            navigate: (to: string, options?: NavigateOptions) => {
                if (nestedRouter) {
                    return nestedRouter.navigate(to, options);
                }
            }

        }}>
            {wrapWithFixLinks(children ? children : <RouteComponent />)}
        </ReactRouterContext.Provider>
    )
}
