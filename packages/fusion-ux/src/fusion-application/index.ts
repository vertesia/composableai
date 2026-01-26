/**
 * Fusion Application Module
 *
 * Components for rendering complete fusion applications.
 *
 * @example
 * ```tsx
 * import {
 *   FusionApplicationRenderer,
 *   createDataBindingResolver,
 * } from '@vertesia/fusion-ux';
 *
 * // Create a resolver with your Vertesia client
 * const resolver = createDataBindingResolver({
 *   fetchers: {
 *     fetchContentObject: (id) => client.objects.retrieve(id),
 *     queryObjects: (query) => client.objects.find(query),
 *     queryDataStore: (storeId, sql) => client.data.query(storeId, { sql }),
 *     fetchArtifact: (path) => client.files.download(path),
 *     fetchApi: (endpoint, opts) => fetch(endpoint, opts).then(r => r.json()),
 *   }
 * });
 *
 * // Render the complete application
 * function App() {
 *   const router = useRouter();
 *
 *   return (
 *     <FusionApplicationRenderer
 *       application={app}
 *       currentPath={router.pathname}
 *       loadPage={(pageId) => client.fusion.pages.retrieve(pageId)}
 *       resolver={resolver}
 *       user={currentUser}
 *       onNavigate={(href) => router.push(href)}
 *     />
 *   );
 * }
 * ```
 *
 * @packageDocumentation
 */

// Types
export type {
    MatchedRoute,
    FusionApplicationRendererProps,
    ApplicationShellProps,
    ApplicationRouterProps,
    ApplicationContextValue,
    ThemeProviderProps,
    RouteUtils,
} from './types.js';

// Context
export {
    ApplicationContext,
    ApplicationProvider,
    useApplicationContext,
    useApplicationContextSafe,
    useCurrentRoute,
    useCurrentPage,
    useGlobalData,
    useGlobalDataValue,
    useApplicationSettings,
    useNavigation,
    type ApplicationProviderProps,
} from './ApplicationContext.js';

// Main Renderer
export {
    FusionApplicationRenderer,
    StandalonePageRenderer,
} from './FusionApplicationRenderer.js';

// Application Shell
export {
    ApplicationShell,
    ThemeProvider,
} from './ApplicationShell.js';

// Application Router
export { ApplicationRouter } from './ApplicationRouter.js';

// Routing Utilities
export {
    matchPath,
    matchRoute,
    buildPath,
    extractParamNames,
    validateParams,
    applyParamDefaults,
    checkRoutePermission,
    getUnauthorizedRedirect,
} from './routing.js';
