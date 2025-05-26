import { useEffect, useState } from "react";
import { ComponentRoute, LazyComponentRoute, useRouterContext } from "./Router";

interface RouteComponentProps {
    spinner?: React.ReactNode;
}
export function RouteComponent({ spinner }: RouteComponentProps) {
    const ctx = useRouterContext();
    const route = ctx.route;

    if ((route as ComponentRoute).Component) {
        const Component = (route as ComponentRoute).Component;
        return <Component {...ctx.params} />
    } else if ((route as LazyComponentRoute).LazyComponent) {
        return <LazyRouteComponent route={route as LazyComponentRoute} spinner={spinner} />
    } else {
        throw new Error(`Invalid route for ${route.path}. Either Component or LazyCOmponent must be specified.`);
    }
}

interface LazyRouteComponentProps {
    route: LazyComponentRoute;
    spinner?: React.ReactNode;
}
function LazyRouteComponent({ route, spinner }: LazyRouteComponentProps) {
    const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
    useEffect(() => {
        route.LazyComponent().then(module => {
            if (!module.default) {
                throw new Error(`Lazy module for ${route.path} does not have a default export`);
            }
            // we need to wrap the component type in an arrow function
            // otherwise the setState function will execute the function as a state update function
            setComponent(() => module.default);
        });
    }, [route]);

    return Component ? (
        <Component />
    ) : spinner || null;
}
