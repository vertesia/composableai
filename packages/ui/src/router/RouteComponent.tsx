import { useEffect, useState } from 'react';
import {
    type ComponentRoute,
    type LazyComponentRoute,
    type LazyRouteModule,
    type Route,
    useRouterContext,
} from './Router';

// Resolved lazy modules, keyed by the route's LazyComponent function (a stable identity: route
// tables are declared once). A revisited lazy route renders synchronously from this cache instead
// of unmounting to the spinner for the async import() round-trip — without it, every navigation
// between two lazy routes blanks the page for at least a frame, even when the module is loaded.
const resolvedComponents = new Map<LazyComponentRoute['LazyComponent'], LazyRouteModule['default']>();

function resolveLazyRoute(route: LazyComponentRoute): Promise<LazyRouteModule['default']> {
    return route.LazyComponent().then((module) => {
        if (!module.default) {
            throw new Error(`Lazy module for ${route.path} does not have a default export`);
        }
        resolvedComponents.set(route.LazyComponent, module.default);
        return module.default;
    });
}

/**
 * Start loading the given routes' lazy modules ahead of navigation (non-lazy routes are ignored).
 * Call it during idle time after first paint: the first navigation to a prefetched route then
 * renders synchronously instead of flashing the spinner while its chunk downloads. Failures are
 * swallowed — navigation retries the import and reports the error the normal way.
 */
export function prefetchLazyRoutes(routes: Route[]): Promise<unknown> {
    return Promise.allSettled(
        routes
            .filter((route): route is LazyComponentRoute => !!(route as LazyComponentRoute).LazyComponent)
            .map((route) => resolveLazyRoute(route)),
    );
}

interface RouteComponentProps {
    spinner?: React.ReactNode;
}
export function RouteComponent({ spinner }: RouteComponentProps) {
    const ctx = useRouterContext();
    const route = ctx.route;

    if ((route as ComponentRoute).Component) {
        const Component = (route as ComponentRoute).Component;
        return <Component {...ctx.params} />;
    } else if ((route as LazyComponentRoute).LazyComponent) {
        // Keyed per path so navigating between two lazy routes remounts: a reused instance would
        // keep rendering the previous route's component while the next import resolves.
        return <LazyRouteComponent key={route.path} route={route as LazyComponentRoute} spinner={spinner} />;
    } else {
        throw new Error(`Invalid route for ${route.path}. Either Component or LazyCOmponent must be specified.`);
    }
}

interface LazyRouteComponentProps {
    route: LazyComponentRoute;
    spinner?: React.ReactNode;
}
function LazyRouteComponent({ route, spinner }: LazyRouteComponentProps) {
    const [Component, setComponent] = useState<LazyRouteModule['default'] | null>(
        () => resolvedComponents.get(route.LazyComponent) ?? null,
    );
    useEffect(() => {
        // A slow import must not land after this instance moved on (unmount, or a route object
        // swap without a path change): the stale module would overwrite the current one.
        let stale = false;
        void resolveLazyRoute(route).then((component) => {
            if (!stale) {
                // we need to wrap the component type in an arrow function
                // otherwise the setState function will execute the function as a state update function
                setComponent(() => component);
            }
        });
        return () => {
            stale = true;
        };
    }, [route]);

    return Component ? <Component /> : spinner || null;
}
