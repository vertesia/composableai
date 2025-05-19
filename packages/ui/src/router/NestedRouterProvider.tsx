import React, { useEffect, useMemo, useState } from "react";
import { FixLinks } from "./FixLinks";
import { PathMatch } from "./PathMatcher";
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
    const [nestedRouteMatch, setNestedRouteMatch] = useState<PathMatch<Route> | undefined>(undefined);
    const nestedRouter = useMemo(() => {
        if (typeof window === 'undefined') return null;
        const basePath = ctx.matchedRoutePath;
        const nestedRouter = new NestedRouter(ctx.router, basePath, routes);
        nestedRouter.index = index;
        return nestedRouter;
    }, []);


    useEffect(() => {
        if (nestedRouter) {
            if (ctx.matchedRoutePath !== nestedRouter.basePath) {
                // the change doesn't belong to this nested router
                // it should be handled by the top level router which will change the page or the nested router
                return;
            }
            const route = nestedRouter.match(ctx.remainingPath || '/') || createRoute404();
            setNestedRouteMatch(route);
        }
    }, [nestedRouter, ctx.remainingPath]);


    const wrapWithFixLinks = fixLinks ?
        (elem: any) => <FixLinks basePath={ctx.matchedRoutePath}>{elem}</FixLinks>
        : (elem: any) => elem;

    return nestedRouteMatch && (
        <ReactRouterContext.Provider value={{
            ...ctx,
            router: nestedRouter!,
            route: nestedRouteMatch.value,
            params: nestedRouteMatch.params,
            matchedRoutePath: '/' + nestedRouteMatch.matchedSegments.join('/'),
            remainingPath: nestedRouteMatch.remainingSegments ? '/' + nestedRouteMatch.remainingSegments.join('/') : undefined,
            navigate: (to: string, options?: NavigateOptions) => {
                return nestedRouter!.navigate(to, options);
            }

        }}>
            {wrapWithFixLinks(children ? children : <RouteComponent />)}
        </ReactRouterContext.Provider>
    )
}
