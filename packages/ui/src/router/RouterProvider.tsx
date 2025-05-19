import { useSafeLayoutEffect } from "@vertesia/ui/core";
//import { useSafeLayoutEffect } from "../core";
import React, { useMemo, useState } from "react";
import { RouteComponent } from "./RouteComponent";
import { ReactRouterContext, Route, Router, RouterContext } from "./Router";
import { createRoute404 } from "./Route404";
import { LocationChangeEvent, NavigateOptions } from "./HistoryNavigator";


interface RouterProviderProps {
    routes: Route[],
    /**
     * The path to use for the root resource. Defaults to '/'. Cannot contains path variables or wildcards
     */
    index?: string;
    children?: React.ReactNode
    onChange?: (event: LocationChangeEvent) => void;
}
export function RouterProvider({ routes, index, onChange, children }: RouterProviderProps) {
    const [state, setState] = useState<RouterContext | undefined>(undefined);
    const router = useMemo(() => {
        if (typeof window === 'undefined') return null;
        const router = new Router(routes, (match) => {
            if (match === null) {
                match = createRoute404();
            }
            setState({
                location: window.location,
                route: match.value,
                params: match.params,
                state: match.state,
                router: router,
                matchedRoutePath: '/' + match.matchedSegments.join('/'),
                remainingPath: match.remainingSegments ? '/' + match.remainingSegments.join('/') : undefined,
                navigate: (to: string, options?: NavigateOptions) => {
                    return router.navigate(to, options);
                }
            });
        }).withObserver(onChange);
        router.index = index;
        return router;
    }, []);
    useSafeLayoutEffect(() => {
        router && router.start();
        return () => {
            router && router.stop();
        }
    }, []);

    return state && (
        <ReactRouterContext.Provider value={state}>
            {children ? children : <RouteComponent />}
        </ReactRouterContext.Provider>
    )
}
