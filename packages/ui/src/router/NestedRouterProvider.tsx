import React, { useMemo } from "react";
import { FixLinks } from "./FixLinks";
import { createRoute404 } from "./Route404";
import { RouteComponent } from "./RouteComponent";
import { NestedRouter, ReactRouterContext, Route, useRouterContext } from "./Router";
import { NavigateOptions } from "./HistoryNavigator";


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
    const nestedRouter = useMemo(() => {
        if (typeof window === 'undefined') return null;
        const basePath = ctx.matchedRoutePath;
        const nestedRouter = new NestedRouter(ctx.router, basePath, routes);
        nestedRouter.index = index;
        return nestedRouter;
    }, [ctx.matchedRoutePath, ctx.router, index, routes]);

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
            router: nestedRouter!,
            route: nestedRouteMatch.value,
            params: nestedRouteMatch.params,
            matchedRoutePath: '/' + nestedRouteMatch.matchedSegments.join('/'),
            remainingPath: nestedRouteMatch.remainingSegments ? '/' + nestedRouteMatch.remainingSegments.join('/') : undefined,
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
