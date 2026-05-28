import { createContext, useContext, useEffect } from 'react';
import { HistoryNavigator, type LocationChangeEvent, type NavigateOptions } from './HistoryNavigator';
import { type PathMatch, PathMatcher } from './PathMatcher';
import { isRootPath, joinPath, type PathMatchParams } from './path';

export type RouteComponentProps = PathMatchParams;
export type LazyRouteModule = { default: React.ComponentType<Record<string, never>> };
export type LazyImportFn = () => Promise<LazyRouteModule>;
export interface ComponentRoute {
    path: string;
    Component: React.ComponentType<RouteComponentProps>;
}
export interface LazyComponentRoute {
    path: string;
    LazyComponent: LazyImportFn;
}
export type Route = ComponentRoute | LazyComponentRoute;

export interface RouteMatch extends PathMatch<Route> {
    state: unknown;
}

export interface NavigationPrompt {
    message: string;
    when?: boolean;
}

export abstract class BaseRouter {
    // the path to use when navigating to the root of the router
    index?: string;
    matcher: PathMatcher<Route> = new PathMatcher();
    constructor(routes: Route[], index?: string) {
        this.index = index;
        for (const route of routes) {
            this.matcher.addPath(route.path, route);
        }
    }

    abstract getTopRouter(): Router;

    match(path: string): PathMatch<Route> | null {
        const useIndex = isRootPath(path) && this.index;
        // biome-ignore lint/style/noNonNullAssertion: intentional non-null assertion; TS can't prove narrowing here
        return this.matcher.match(useIndex ? this.index! : path);
    }

    abstract navigate(path: string, options?: NavigateOptions): void;
}

export class Router extends BaseRouter {
    prompt?: NavigationPrompt;
    observer?: (event: LocationChangeEvent) => void;
    navigator: HistoryNavigator = new HistoryNavigator();
    constructor(routes: Route[], updateState: (route: RouteMatch | null) => void) {
        super(routes);
        this.navigator.addListener((event: LocationChangeEvent) => {
            if (event.isCancelable && this.prompt?.when) {
                if (!window.confirm(this.prompt.message)) return;
            }
            if (this.observer) {
                this.observer(event);
            }
            // only process afterChange events
            if (event.name === 'afterChange') {
                const match = this.match(event.location.pathname);
                if (match?.value) {
                    updateState({
                        ...match,
                        state: event.state,
                    });
                } else {
                    updateState(null);
                }
            }
        });
    }

    getTopRouter(): Router {
        return this;
    }

    /**
     * Subsequent navigations will preserve the given params in the query string.
     * Use null to clear the sticky params.
     * @param params
     */
    setStickyParams(params: Record<string, string> | null) {
        this.navigator.stickyParams = params != null ? params : undefined;
    }

    withObserver(observer?: ((event: LocationChangeEvent) => void) | undefined) {
        this.observer = observer;
        return this;
    }

    start() {
        this.navigator.start();
        // initialize with the current location
        this.navigator.firePageLoad();
    }

    stop() {
        this.navigator.stop();
    }

    navigate(path: string, options?: NavigateOptions) {
        this.navigator.navigate(path, options);
    }
}

export class NestedRouter extends BaseRouter {
    constructor(
        public parent: BaseRouter,
        public basePath: string,
        routes: Route[],
    ) {
        super(routes);
    }

    getTopRouter(): Router {
        if (this.parent instanceof Router) {
            return this.parent;
        } else {
            return (this.parent as NestedRouter).getTopRouter();
        }
    }

    navigate(path: string, options?: NavigateOptions | undefined): void {
        // base path is nested by default in a NestedRouter unless explicitly set to false by caller
        const isBasePathNested = options?.isBasePathNested ?? true;
        let basePath: string;

        if (isBasePathNested) {
            const childBasePath = options?.basePath;
            // e.g. "/store" + "/objects/123" => "/store/objects/123"
            basePath = childBasePath ? joinPath(this.basePath, childBasePath) : this.basePath;
            this.parent.navigate(path, {
                ...options,
                basePath,
            });
        } else {
            // isBasePathNested === false: navigate to an absolute path without adding this router's basePath
            // Pass through to parent without adding our basePath prefix
            this.parent.navigate(path, {
                ...options,
                basePath: options?.basePath,
            });
        }
    }
}

export interface RouterContext {
    location: Location;
    route: Route;
    router: BaseRouter;
    params: Record<string, string>;
    state: unknown;
    /**
     * The path that matched the route. For wildcard `/*` paths this does not include the wildcard part.
     * You can get the wildcard path from `remainingPath`.
     */
    matchedRoutePath: string;
    remainingPath?: string;
    navigate: (path: string, options?: NavigateOptions) => void;
}

const ReactRouterContext = createContext<RouterContext | undefined>(undefined);

export { ReactRouterContext };

export function useRouterContext() {
    const ctx = useContext(ReactRouterContext);
    if (!ctx) {
        throw new Error('useRouter must be used within a RouterProvider');
    }
    return ctx;
}

export function useNavigate() {
    const { navigate } = useRouterContext();
    return navigate;
}

export function useRouterBasePath() {
    const { matchedRoutePath, router } = useRouterContext();
    return router instanceof NestedRouter ? router.basePath : matchedRoutePath;
}

type UseParamsReturn<T> = T extends string ? string : Record<string, string>;
export function useParams<T>(arg?: T): UseParamsReturn<T> {
    const { params } = useRouterContext();
    if (arg) {
        return params[arg as string] as UseParamsReturn<T>;
    } else {
        return params as UseParamsReturn<T>;
    }
}

export function useLocation() {
    const { location } = useRouterContext();
    return location;
}

export function usePageTitle(title: string) {
    useEffect(() => {
        const prev = document.title;
        document.title = title;
        return () => {
            document.title = prev;
        };
    }, [title]);
}

export function useNavigationPrompt(prompt: NavigationPrompt) {
    const { router } = useRouterContext();
    const topRouter = router.getTopRouter();
    useEffect(() => {
        topRouter.prompt = prompt;
        return () => {
            topRouter.prompt = undefined;
        };
    }, [prompt, topRouter]);

    useEffect(() => {
        if (prompt.when) {
            const doBlock = prompt.when;
            const listener = (ev: Event) => {
                if (doBlock) {
                    ev.preventDefault();
                    (ev as BeforeUnloadEvent).returnValue = '';
                }
            };
            window.addEventListener('beforeunload', listener);
            return () => {
                window.removeEventListener('beforeunload', listener);
            };
        }
    }, [prompt.when]);
}
