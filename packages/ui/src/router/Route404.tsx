import { RouteMatch, useRouterContext } from "./Router";

export function Route404Component() {
    const ctx = useRouterContext();
    return <div>Route not found for path {ctx.matchedRoutePath}</div>
}

export function createRoute404(): RouteMatch {
    return {
        params: {},
        matchedSegments: [],
        state: null,
        value: {
            path: 'virtual:404',
            Component: () => <Route404Component />
        }
    }
}