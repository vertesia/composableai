import { join as joinPath, resolve as resolvePath } from 'node:path';
import type { Context, Middleware, Next } from 'koa';
import compose from 'koa-compose';
import send from 'koa-send';

import { type ErrorHandlerOpts, errorHandler } from './error.js';
import {
    createPathMatcherUnsafe,
    createPathPrefixMatcherUnsafe,
    createSimplePrefixMatcher,
    normalizePath,
    type PathMatcher,
    type PrefixMatcher,
} from './path-matchers.js';
import { ServerError } from './ServerError.js';
import { ApiVersion, EndpointVersions, type VersionedEndpointRoute } from './version.js';

declare module 'koa' {
    interface BaseContext {
        $router: RouterContext;
    }
}

export type EndpointInterceptorFn = (this: any, ctx: Context, endpoint: (ctx: Context) => Promise<any>) => Promise<any>;

export type RouteTarget = (ctx: Context) => Promise<any>;
export type RouterGuard = (ctx: Context) => boolean;

export interface Route {
    match(ctx: Context, path: string): boolean;
    dispatch(ctx: Context): Promise<unknown>;
}

export interface EndpointRouteOptions {
    version?: string | number;
}

export class RouterContext {
    params: any = {};
    path: string;
    matchedPattern?: string;
    matchedVersion?: number; // the matched endpoint version if any
    // used internally to indicate that the path matched at least an endpoint but the method does not
    // in case of a 405 the value is the endpoint pattern
    _maybe405?: string;

    constructor(ctx: Context) {
        this.path = normalizePath(ctx.path);
        ctx.$router = this;
    }

    // used by the parent router prefix matcher
    update(params?: object) {
        if (params) Object.assign(this.params, params);
    }

    // called on an endpoint match to update matching info
    onMatch(matchedPattern: string, params?: object) {
        this.matchedPattern = matchedPattern;
        if (params) Object.assign(this.params, params);
    }
}
export class EndpointRoute implements Route {
    router: Router;
    pathPattern: string;
    method: string | null | undefined;
    matcher: PathMatcher;
    target: RouteTarget;
    thisArg: any;
    // an endpoint version if a version was set. A version is a date number like: 20250921
    version?: number;
    _absPathPattern?: string;
    // a unique key for the route in his router. Can be used as a local identifier
    key: string;

    constructor(
        router: Router,
        method: string | null | undefined,
        pathPattern: string,
        target: RouteTarget,
        thisArg?: any,
    ) {
        this.router = router;
        this.pathPattern = normalizePath(pathPattern);
        this.method = method ? method.toUpperCase() : null;
        this.matcher = createPathMatcherUnsafe(this.pathPattern);
        this.thisArg = thisArg;
        this.target = target.bind(thisArg);
        this.key = `${this.method || 'ALL'}:${this.pathPattern}`;
    }

    withVersion(version: string | number) {
        this.version = typeof version === 'string' ? parseVersion(version) : version;
        return this;
    }

    get absPathPattern() {
        if (this._absPathPattern == null) {
            this._absPathPattern = this.router.getAbsPath(this.pathPattern);
        }
        return this._absPathPattern;
    }

    match(ctx: Context, path: string): boolean {
        const match = this.matcher(path);
        if (!match) {
            return false;
        }
        // path matches
        if (this.method && this.method !== ctx.method) {
            ctx.$router._maybe405 = this.absPathPattern;
            return false;
        }
        // path and method matches
        if (match === true) {
            ctx.$router.onMatch(this.absPathPattern);
            return true;
        } else if (match) {
            ctx.$router.onMatch(this.absPathPattern, match.params);
            return true;
        } else {
            // should never happens
            return false;
        }
    }

    dispatch(ctx: Context) {
        try {
            return Promise.resolve(
                this.router.interceptor
                    ? this.router.interceptor.call(this.thisArg, ctx, this.target)
                    : this.target(ctx),
            ).then((r) => {
                if (r !== undefined) {
                    ctx.body = r;
                }
                return r;
            });
        } catch (err) {
            return Promise.reject(err);
        }
    }
}

/**
 * A route which serve static files given a path mapping
 */
class ServeRoute implements Route {
    matcher: PrefixMatcher;
    target: string;
    opts: send.SendOptions;

    constructor(prefix: string, target: string, opts: send.SendOptions = {}) {
        this.matcher = createSimplePrefixMatcher(normalizePath(prefix));
        this.target = target;
        this.opts = opts;
    }
    match(ctx: Context, path: string): boolean {
        switch (ctx.method) {
            case 'GET':
            case 'HEAD':
                return this.matcher(ctx, path);
            default:
                return false;
        }
    }
    async dispatch(ctx: Context): Promise<any> {
        let path = ctx.$router.path || '/'; // trailing path
        if (path === '/') {
            // exact match
            path = this.target; // rewrite exact path
        } else {
            path = this.target + path;
        }
        try {
            await send(ctx, path.startsWith('/') ? `.${path}` : path, this.opts);
        } catch (err) {
            if ((err as any).code === 'ENOENT') {
                ctx.throw(404, `File not found: ${ctx.path}`);
            } else {
                ctx.throw(500, `Failed to fetch file: ${ctx.path}`);
            }
        }
    }
}

type RouterOpts = {
    webRoot?: string;
    errorHandlers?: ErrorHandlerOpts;
};

export abstract class AbstractRouter<T extends AbstractRouter<T>> implements Route {
    parent?: AbstractRouter<T>;
    _absPrefix?: string;
    prefix: string;
    prefixMatcher: PrefixMatcher;
    guard?: RouterGuard;
    routes: Route[] = [];
    /**
     * Versioned routes. The key is endpoint key property
     * All the versions of the same endpoint must have the same key (i.e. METHOD and path_pattern)
     * The value is a list of routes sorted by the version number (ASC)
     */
    route_versions: Record<string, EndpointVersions> = {};
    filters: Middleware[] = [];
    filtersFn?: Middleware;
    webRoot: string;
    errorHandlerOpts?: ErrorHandlerOpts;
    interceptor: EndpointInterceptorFn | null = null;
    // used to select versioned endpoints when defined
    versionHeader?: string;

    constructor(prefix: string = '/', opts: RouterOpts = {}, parent?: AbstractRouter<T>) {
        this.prefix = normalizePath(prefix);
        this.webRoot = opts.webRoot || process.cwd();
        this.errorHandlerOpts = opts.errorHandlers;
        this.prefixMatcher = createPathPrefixMatcherUnsafe(this.prefix);
        this.parent = parent;
        this.interceptor = parent ? parent.interceptor : null;
        this.versionHeader = parent?.versionHeader;
    }

    get absPrefix(): string {
        if (this._absPrefix == null) {
            this._absPrefix = this.parent ? this.parent.getAbsPath(this.prefix) : this.prefix;
        }
        return this._absPrefix;
    }

    getAbsPath(path?: string) {
        const abspath = path ? joinPath(this.absPrefix, path) : this.prefix;
        return normalizePath(abspath);
    }

    match(ctx: Context, path: string) {
        return this.prefixMatcher(ctx, path);
    }

    getIncommingApiVersion(ctx: Context): ApiVersion | undefined {
        if (this.versionHeader) {
            const value = ctx.headers[this.versionHeader] as string;
            return value ? new ApiVersion(value) : undefined;
        }
        return undefined;
    }

    async _dispatch(ctx: Context): Promise<unknown> {
        if (this.guard) {
            if (!(await this.guard(ctx))) {
                ctx.throw(401);
            }
        }

        const apiVersion = this.getIncommingApiVersion(ctx);

        const path = ctx.$router.path;
        for (let route of this.routes) {
            if (route.match(ctx, path)) {
                if (apiVersion && route instanceof EndpointRoute) {
                    const endpointVersions = this.route_versions[route.key];
                    if (endpointVersions) {
                        const versionedRoute = apiVersion.match(route, endpointVersions);
                        if (versionedRoute) {
                            route = versionedRoute;
                            ctx.$router.matchedVersion = versionedRoute.version;
                        } else {
                            ctx.throw(
                                406,
                                'No endpoint version found for version ' +
                                    (apiVersion.exact ? '' : '~') +
                                    apiVersion.version +
                                    ' on endpoint ' +
                                    route.absPathPattern,
                            );
                        }
                    }
                }
                return await route.dispatch(ctx);
            }
        }
        //TODO add support for 405 method not allowed
        if (ctx.$router._maybe405) {
            throw new ServerError(405, `Method ${ctx.method} not allowed on endpoint ${ctx.$router._maybe405}`);
            //ctx.throw(405, 'Method ' + ctx.method + ' not allowed on endpoint ' + ctx.$router._maybe405);
        } else {
            ctx.throw(404);
        }
    }

    async dispatch(ctx: Context): Promise<unknown> {
        try {
            if (this.filters.length > 0) {
                // lazy build filters since we can add filter after registering the router
                if (!this.filtersFn) {
                    this.filtersFn = compose(this.filters);
                }
                return await this.filtersFn(ctx, () => {
                    try {
                        return Promise.resolve(this._dispatch(ctx));
                    } catch (err) {
                        return Promise.reject(err);
                    }
                });
            } else {
                return await this._dispatch(ctx);
            }
        } catch (err) {
            return await this.onError(ctx, err);
        }
    }

    middleware() {
        return (ctx: Context, next: Next) => {
            const $router = new RouterContext(ctx);
            ctx.$router = $router;
            if (this.match(ctx, $router.path)) {
                // we never call next since the router is an endpoint
                return this.dispatch(ctx);
            } else {
                return next();
            }
        };
    }

    onError(ctx: Context, err: any): void {
        errorHandler(ctx, err, { htmlRoot: joinPath(this.webRoot, '/errors'), ...this.errorHandlerOpts });
    }

    /**
     * Set a header name to be used as a version header to select versioned endpoints
     * The header value must be a date number like 20250921 and represent the build timesptamp of the client so it means:
     * I want the latest endpoint version which is less or equal with 20250921
     * The server will then pick for each endpoint the latest version which is <= with the requested version
     * If the header value starts with = like =20250921 it means that the client wants the exact version 20250921 for the endpoint
     * When using the exact match prefix, if no exact match is found a 406 will be returned.
     * The default version (the unversioned endpoint) will be used when no version header is set or when no specific version match the header.
     * @param header
     * @returns
     */
    withVersionHeader(header: string | null) {
        this.versionHeader = header ? header.toLocaleLowerCase() : undefined;
        return this;
    }

    withInterceptor(interceptor: EndpointInterceptorFn | null) {
        this.interceptor = interceptor;
        return this;
    }

    withGuard(guard: RouterGuard) {
        this.guard = guard;
        return this;
    }

    withErrorHandler(errorHandlerOpts: ErrorHandlerOpts) {
        this.errorHandlerOpts = errorHandlerOpts;
        return this;
    }

    withWebRoot(webRoot: string) {
        this.webRoot = webRoot;
        return this;
    }

    route(
        method: string | null | undefined,
        path: string,
        target: RouteTarget,
        thisArg?: any,
        opts?: EndpointRouteOptions,
    ) {
        const route = new EndpointRoute(this, method, path, target, thisArg);
        if (opts?.version) {
            route.withVersion(opts.version);
            // we push the route in a versioned routes list
            let list = this.route_versions[route.key];
            if (!list) {
                list = this.route_versions[route.key] = new EndpointVersions();
            }
            list.add(route as VersionedEndpointRoute);
        } else {
            this.routes.push(route);
        }
    }

    routeAll(path: string, target: RouteTarget) {
        this.route(null, path, target);
    }

    /**
     * The target can be a resource instance or resource ctor
     * @param prefix
     * @param target
     * @returns
     */
    mount(prefix: string, target?: any) {
        const router = new Router(prefix, { webRoot: this.webRoot }, this);
        // inherit error handling from parent router
        if (this.errorHandlerOpts) router.withErrorHandler(this.errorHandlerOpts);
        if (target) {
            if (target instanceof Resource) {
                target.setup(router);
            } else if (target.prototype instanceof Resource) {
                const resource = new target();
                resource.setup(router);
            } else {
                throw new Error(`Unsupported router resource: ${target}`);
            }
        }
        this.routes.push(router);
        return router;
    }

    use(middleware: Middleware) {
        this.filters.push(middleware);
    }

    serve(pattern: string, target: string, opts: send.SendOptions = {}) {
        if (!opts.root) opts.root = this.webRoot;
        this.routes.push(new ServeRoute(pattern, resolvePath(this.webRoot, target), opts));
    }

    redirect(method: string | null | undefined, pattern: string, target: string, alt?: string) {
        this.route(method, pattern, (ctx) => {
            ctx.redirect(target, alt);
            return Promise.resolve();
        });
    }

    get(pattern: string, target: RouteTarget, thisArg?: any) {
        this.route('GET', pattern, target, thisArg);
    }
    head(pattern: string, target: RouteTarget, thisArg?: any) {
        this.route('HED', pattern, target, thisArg);
    }
    options(pattern: string, target: RouteTarget, thisArg?: any) {
        this.route('OPTIONS', pattern, target, thisArg);
    }
    put(pattern: string, target: RouteTarget, thisArg?: any) {
        this.route('PUT', pattern, target, thisArg);
    }
    post(pattern: string, target: RouteTarget, thisArg?: any) {
        this.route('POST', pattern, target, thisArg);
    }
    delete(pattern: string, target: RouteTarget, thisArg?: any) {
        this.route('DELETE', pattern, target, thisArg);
    }
    patch(pattern: string, target: RouteTarget, thisArg?: any) {
        this.route('PATCH', pattern, target, thisArg);
    }
    trace(pattern: string, target: RouteTarget, thisArg?: any) {
        this.route('TRACE', pattern, target, thisArg);
    }
}
export class Router extends AbstractRouter<Router> {}

export type RouterSetup = (resource: any, router: Router) => void;
export abstract class Resource {
    /**
     * Setup the router coresponding to this resource.
     * When overwriting you must always call `super.setup(router);` otherwise
     * the decortators will not be applied to the resource
     * @param router
     */
    setup(router: Router) {
        let ctor = this.constructor as any;
        while (ctor && ctor !== Resource) {
            // setup decorators registered on ctor
            if (Array.isArray(ctor.$routerSetup)) {
                for (const setup of ctor.$routerSetup) {
                    setup(this, router);
                }
            }
            ctor = Object.getPrototypeOf(ctor);
        }
    }
}

function parseVersion(text: string) {
    const value = parseInt(text, 10);
    if (Number.isNaN(value)) {
        throw new Error(`Invalid version number: ${text}`);
    }
    return value;
}
