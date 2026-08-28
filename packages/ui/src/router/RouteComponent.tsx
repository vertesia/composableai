import { useEffect, useState } from 'react';
import { type ComponentRoute, type LazyComponentRoute, type LazyRouteModule, useRouterContext } from './Router';

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
    const [Component, setComponent] = useState<LazyRouteModule['default'] | null>(null);
    useEffect(() => {
        // A slow import must not land after this instance moved on (unmount, or a route object
        // swap without a path change): the stale module would overwrite the current one.
        let stale = false;
        void route.LazyComponent().then((module) => {
            if (stale) {
                return;
            }
            if (!module.default) {
                throw new Error(`Lazy module for ${route.path} does not have a default export`);
            }
            // we need to wrap the component type in an arrow function
            // otherwise the setState function will execute the function as a state update function
            setComponent(() => module.default);
        });
        return () => {
            stale = true;
        };
    }, [route]);

    return Component ? <Component /> : spinner || null;
}
