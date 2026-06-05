import type { Context, Middleware } from 'koa';
import compose from 'koa-compose';
import type {
    DecoratedResourceClass,
    EndpointInterceptorFn,
    EndpointRouteOptions,
    Resource,
    Router,
    RouterGuard,
    RouterSetup,
    RouteTarget,
} from './router.js';

type ResourceMembers<T> = Resource & Record<string, T>;

function getOrCreateSetupChain(target: DecoratedResourceClass): RouterSetup[] {
    if (!Object.hasOwn(target, '$routerSetup')) {
        Object.defineProperty(target, '$routerSetup', {
            value: [],
            configurable: false,
            enumerable: false,
            writable: false,
        });
    }
    return target.$routerSetup as RouterSetup[];
}

type ClassDecoratorArgs = [DecoratedResourceClass];
type MethodDecoratorArgs = [object, string, PropertyDescriptor];

export function filters(...middlewares: Middleware[]) {
    return (...args: ClassDecoratorArgs | MethodDecoratorArgs) => {
        if (args.length === 1) {
            return resourceFilters(args[0], middlewares);
        }
        const [target, propertyKey, descriptor] = args;
        return endpointFilters(target, propertyKey, descriptor, middlewares);
    };
}

function resourceFilters(cls: DecoratedResourceClass, middlewares: Middleware[]) {
    const chain = getOrCreateSetupChain(cls);
    for (const middleware of middlewares) {
        chain.push((_resource: Resource, router: Router) => {
            router.use(middleware);
        });
    }
}
function endpointFilters(
    _target: object,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
    middlewares: Middleware[],
) {
    const endpoint = descriptor.value as (ctx: Context) => Promise<unknown>;
    const filterFn = compose(middlewares);

    descriptor.value = async function (ctx: Context) {
        // This is the correct `next` function type for compose
        await filterFn(ctx, async () => {
            const result = await endpoint.call(this, ctx);
            // Set ctx.body if endpoint returned something
            // the router will not set again the body since the new endpoint
            // always returns undefined
            if (result !== undefined) {
                ctx.body = result;
            }
        });
    };
}

export type ResourceConstructor<T extends Resource = Resource> = new () => T;

export function routes(map: Record<string, Resource | ResourceConstructor>) {
    return (cls: DecoratedResourceClass) => {
        const chain = getOrCreateSetupChain(cls);
        for (const key in map) {
            chain.push((_resource: Resource, router: Router) => {
                router.mount(key, map[key]);
            });
        }
    };
}

// deprecated decorators. Use @routes and @filters instead
// export function mount(path: string) {
//     return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
//         const isGetter = !!descriptor.get;
//         getOrCreateSetupChain(target.constructor).push((resource: Resource, router: Router) => {
//             const value = resource[propertyKey];
//             router.mount(path, isGetter ? value : value());
//         });
//     }
// }
// export function use(target: any, propertyKey: string, descriptor: PropertyDescriptor): void {
//     getOrCreateSetupChain(target.constructor).push((resource: Resource, router: Router) => {
//         router.use(resource[propertyKey].bind(resource));
//     });
// }

export function serve(path: string) {
    return (target: object, propertyKey: string, _descriptor: PropertyDescriptor) => {
        getOrCreateSetupChain(target.constructor as DecoratedResourceClass).push(
            (resource: Resource, router: Router) => {
                const value = (resource as ResourceMembers<string | (() => string)>)[propertyKey];
                router.serve(path, typeof value === 'string' ? value : value());
            },
        );
    };
}

export function guard(target: object, propertyKey: string, _descriptor: PropertyDescriptor): void {
    getOrCreateSetupChain(target.constructor as DecoratedResourceClass).push((resource: Resource, router: Router) => {
        // we only register it if not other guard was registered
        // this enables overwriting guards from derived classes
        if (!router.guard) {
            const guardFn = (resource as ResourceMembers<RouterGuard>)[propertyKey];
            router.withGuard(guardFn.bind(resource));
        }
    });
}
/**
 * The version parameter will select the endpoint which match the version requested by the client.
 * If no version is specified in the request headers the unversioned endpoint will be used
 *
 * @param method
 * @param path
 * @param version
 * @returns
 */
function _route(method: string, path: string, opts?: EndpointRouteOptions) {
    return (target: object, propertyKey: string, _descriptor: PropertyDescriptor) => {
        getOrCreateSetupChain(target.constructor as DecoratedResourceClass).push(
            (resource: Resource, router: Router) => {
                const handler = (resource as ResourceMembers<RouteTarget>)[propertyKey];
                router.route(method, path, handler, resource, opts);
            },
        );
    };
}
/**
 * The version parameter will select the endpoint which match the version requested by the client.
 * If no version is specified in the request headers the unversioned endpoint will be used
 * @param method
 * @param path
 * @param version
 * @returns
 */
export function route(method: string, path: string = '/', opts?: EndpointRouteOptions) {
    return _route(method, path, opts);
}
export function get(path: string = '/', opts?: EndpointRouteOptions) {
    return _route('GET', path, opts);
}
export function post(path: string = '/', opts?: EndpointRouteOptions) {
    return _route('POST', path, opts);
}
export function put(path: string = '/', opts?: EndpointRouteOptions) {
    return _route('PUT', path, opts);
}
export function del(path: string = '/', opts?: EndpointRouteOptions) {
    return _route('DELETE', path, opts);
}
export function options(path: string = '/', opts?: EndpointRouteOptions) {
    return _route('OPTIONS', path, opts);
}
export function head(path: string = '/', opts?: EndpointRouteOptions) {
    return _route('HEAD', path, opts);
}
export function patch(path: string = '/', opts?: EndpointRouteOptions) {
    return _route('PATCH', path, opts);
}
export function trace(path: string = '/', opts?: EndpointRouteOptions) {
    return _route('TRACE', path, opts);
}

/**
 * Decorator for intercepting endpoint calls
 * @param interceptor The interceptor function. If null is passed any inherited interceptor is removed
 */
export function intercept(interceptor: EndpointInterceptorFn | null) {
    return (cls: DecoratedResourceClass) => {
        const chain = getOrCreateSetupChain(cls);
        chain.push((_resource: Resource, router: Router) => {
            router.interceptor = interceptor;
        });
    };
}
