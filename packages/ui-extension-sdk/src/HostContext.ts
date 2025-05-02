import { VertesiaClient, ZenoClient } from "@vertesia/client";
import { AccountRef, AuthTokenPayload, ProjectRef } from "@vertesia/common";

export const HOST_CONTEXT_VAR = '__vetesia_host_context__';

export interface UserSession {
    isLoading: boolean;
    client: VertesiaClient;
    authError?: Error;
    authToken?: AuthTokenPayload;
    lastSelectedAccount?: string | null;
    lastSelectedProject?: string | null;
    onboardingComplete?: boolean;
    store: ZenoClient;
    user?: AuthTokenPayload;
    account?: AccountRef;
    accounts?: AccountRef[];
    project?: ProjectRef;
    rawAuthToken: Promise<string>
}
export interface NavigateOptions {
    replace?: boolean;
    state?: any;
    /**
     * if defined prepend the basePath to the `to` argument
     */
    basePath?: string;
}

export interface RouterContext {
    location: Location,
    // route: Route,
    // router: BaseRouter,
    params: Record<string, string>,
    state: any,
    /**
     * The path that matched the route. For widlcard `/*` paths this doens;t include the wildcard part.
     * You can get the wildcard path from `remainingPath`.
     */
    matchedRoutePath: string,
    remainingPath?: string,
    navigate: (path: string, options?: NavigateOptions) => void;
}
type LazyImportFn = () => Promise<any>;
interface ComponentRoute {
    path: string;
    Component: React.ComponentType<any>;
}
interface LazyComponentRoute {
    path: string;
    LazyComponent: LazyImportFn;
}
type Route = ComponentRoute | LazyComponentRoute;
export interface MultiPagePluginProps {
    title: string;
    routes: Route[],
    /**
     * The path to use for the root resource. Defaults to '/'. Cannot contains path vairables or wildcards
     */
    index?: string;
    children?: React.ReactNode;
    fixLinks?: boolean;
}
export interface HostContext {
    useUserSession: () => UserSession;
    useRouterContext: () => RouterContext;
    useNavigate: () => (path: string, options?: NavigateOptions) => void;
    useLocation: () => Location;
    MultiPagePlugin: React.ComponentType<MultiPagePluginProps>;
}