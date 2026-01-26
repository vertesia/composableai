/**
 * Fusion Application Renderer
 *
 * Main component for rendering a complete fusion application.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { FusionPage, ActionSpec } from '@vertesia/common';
import type { FusionApplicationRendererProps, MatchedRoute } from './types.js';
import type { ResolutionContext, PageDataResult } from '../data-binding/types.js';
import { matchRoute, applyParamDefaults, checkRoutePermission, getUnauthorizedRedirect } from './routing.js';
import { ApplicationProvider } from './ApplicationContext.js';
import { ApplicationShell } from './ApplicationShell.js';
import { ApplicationRouter } from './ApplicationRouter.js';
import { DataBindingResolverContext } from '../data-binding/hooks.js';
import { FusionPageRenderer } from '../fusion-page/FusionPageRenderer.js';

/**
 * Default loading component.
 */
function DefaultLoading() {
    return (
        <div className="fusion-app-loading">
            <div className="fusion-app-loading-spinner" />
            <span>Loading application...</span>
        </div>
    );
}

/**
 * Default error component.
 */
function DefaultError({ message }: { message: string }) {
    return (
        <div className="fusion-app-error">
            <span className="fusion-app-error-icon">⚠</span>
            <h2>Application Error</h2>
            <p>{message}</p>
        </div>
    );
}

/**
 * Main fusion application renderer.
 *
 * Renders a complete fusion application with:
 * - Navigation (sidebar, topbar, footer)
 * - Routing (matching paths to pages)
 * - Global data sources (shared across pages)
 * - Theme (colors, logo, styling)
 *
 * @example
 * ```tsx
 * <FusionApplicationRenderer
 *   application={app}
 *   currentPath={router.pathname}
 *   loadPage={(pageId) => client.fusion.pages.retrieve(pageId)}
 *   resolver={resolver}
 *   user={{ id: '123', roles: ['admin'] }}
 *   onNavigate={(href) => router.push(href)}
 * />
 * ```
 */
export function FusionApplicationRenderer({
    application,
    currentPath,
    loadPage,
    resolver,
    user,
    settings: settingsOverride,
    onNavigate,
    onAction,
    onError,
    loadingComponent,
    errorComponent,
    notFoundComponent,
    className,
}: FusionApplicationRendererProps) {
    const [globalData, setGlobalData] = useState<Record<string, unknown>>({});
    const [globalLoading, setGlobalLoading] = useState(true);
    const [globalError, setGlobalError] = useState<string | null>(null);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(
        application.navigation.settings?.sidebarDefaultCollapsed ?? false
    );
    const [currentPage] = useState<FusionPage | null>(null);

    // Merge settings
    const settings = useMemo(
        () => ({ ...application.settings, ...settingsOverride }),
        [application.settings, settingsOverride]
    );

    // Match current route
    const matchedRoute: MatchedRoute | null = useMemo(() => {
        const match = matchRoute(currentPath, application.routes);
        return match;
    }, [currentPath, application.routes]);

    // Build base resolution context (without globalData to avoid circular dependency)
    const baseContext: ResolutionContext = useMemo(
        () => ({
            route: matchedRoute
                ? applyParamDefaults(matchedRoute.params, matchedRoute.route)
                : {},
            settings,
            user: user || undefined,
        }),
        [matchedRoute, settings, user]
    );

    // Build full resolution context (includes resolved globalData for page rendering)
    const context: ResolutionContext = useMemo(
        () => ({
            ...baseContext,
            resolved: globalData,
        }),
        [baseContext, globalData]
    );

    // Check route permissions
    useEffect(() => {
        if (matchedRoute) {
            const hasPermission = checkRoutePermission(matchedRoute.route, user || null);

            if (!hasPermission) {
                const redirect = getUnauthorizedRedirect(matchedRoute.route, user || null);
                if (redirect && onNavigate) {
                    onNavigate(redirect);
                }
            }
        }
    }, [matchedRoute, user, onNavigate]);

    // Load global data sources
    const loadGlobalData = useCallback(async () => {
        if (!application.globalDataSources || application.globalDataSources.length === 0) {
            setGlobalData({});
            setGlobalLoading(false);
            return;
        }

        if (!resolver) {
            setGlobalData({});
            setGlobalLoading(false);
            return;
        }

        setGlobalLoading(true);
        setGlobalError(null);

        try {
            // Filter to prefetch sources only
            const prefetchSources = application.globalDataSources.filter(
                (source) => source.prefetch !== false
            );

            if (prefetchSources.length === 0) {
                setGlobalData({});
                setGlobalLoading(false);
                return;
            }

            // Resolve all bindings using baseContext to avoid circular dependency
            // (baseContext doesn't include globalData)
            const bindings = prefetchSources.map((source) => source.binding);
            const result: PageDataResult = await resolver.resolveAll(bindings, baseContext);

            if (!result.success && result.errors.length > 0) {
                // Log errors but still set partial data
                const errorMessages = result.errors.map((e) => `${e.key}: ${e.error}`);
                console.error('Global data errors:', errorMessages);
            }

            setGlobalData(result.data);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load global data';
            setGlobalError(errorMessage);

            if (onError) {
                onError(err instanceof Error ? err : new Error(errorMessage));
            }
        } finally {
            setGlobalLoading(false);
        }
    }, [application.globalDataSources, resolver, baseContext, onError]);

    // Load global data on mount
    useEffect(() => {
        loadGlobalData();
    }, [loadGlobalData]);

    // Refresh global data handler
    const refreshGlobalData = useCallback(async () => {
        await loadGlobalData();
    }, [loadGlobalData]);

    // Toggle sidebar
    const toggleSidebar = useCallback(() => {
        setSidebarCollapsed((prev) => !prev);
    }, []);

    // Handle navigation
    const handleNavigate = useCallback(
        (href: string, newTab?: boolean) => {
            if (onNavigate) {
                onNavigate(href, newTab);
            }
        },
        [onNavigate]
    );

    // Handle action
    const handleAction = useCallback(
        (action: string, config?: Record<string, unknown>) => {
            if (onAction) {
                onAction(action, config);
            }
        },
        [onAction]
    );

    // Show loading while global data loads
    if (globalLoading) {
        return <>{loadingComponent || <DefaultLoading />}</>;
    }

    // Show error if global data failed
    if (globalError) {
        const errorNode = errorComponent
            ? errorComponent(globalError)
            : <DefaultError message={globalError} />;
        return <>{errorNode}</>;
    }

    // Build the content
    const content = (
        <ApplicationProvider
            application={application}
            currentRoute={matchedRoute}
            currentPage={currentPage}
            globalData={globalData}
            context={context}
            user={user}
            initialSidebarCollapsed={sidebarCollapsed}
            onNavigate={handleNavigate}
            onAction={handleAction}
            onRefreshGlobalData={refreshGlobalData}
        >
            <ApplicationShell
                application={application}
                currentPath={currentPath}
                globalData={globalData}
                context={context}
                sidebarCollapsed={sidebarCollapsed}
                onToggleSidebar={toggleSidebar}
                onNavigate={handleNavigate}
                onAction={handleAction}
                className={className}
            >
                <ApplicationRouter
                    routes={application.routes}
                    currentPath={currentPath}
                    defaultRoute={application.defaultRoute}
                    loadPage={loadPage}
                    globalData={globalData}
                    context={context}
                    onNavigate={handleNavigate}
                    onAction={handleAction}
                    loadingComponent={loadingComponent}
                    errorComponent={errorComponent}
                    notFoundComponent={notFoundComponent}
                />
            </ApplicationShell>
        </ApplicationProvider>
    );

    // Wrap with resolver context if provided
    if (resolver) {
        return (
            <DataBindingResolverContext.Provider value={resolver}>
                {content}
            </DataBindingResolverContext.Provider>
        );
    }

    return content;
}

/**
 * Standalone page renderer (without application shell).
 *
 * Use this when you want to render a single page without
 * the full application navigation and chrome.
 */
export function StandalonePageRenderer({
    page,
    resolver,
    context,
    onNavigate,
    onAction,
    loadingComponent,
    errorComponent,
    className,
}: {
    page: FusionPage;
    resolver?: FusionApplicationRendererProps['resolver'];
    context?: ResolutionContext;
    onNavigate?: (href: string, newTab?: boolean) => void;
    onAction?: (action: string, config?: Record<string, unknown>) => void;
    loadingComponent?: React.ReactNode;
    errorComponent?: (error: string) => React.ReactNode;
    className?: string;
}) {
    const pageContext: ResolutionContext = context || { route: {} };

    // Wrap the action handler to adapt between standalone and page action formats
    const handlePageAction = useCallback(
        (action: ActionSpec, _data?: Record<string, unknown>) => {
            if (onAction) {
                onAction(action.type, { action });
            }
        },
        [onAction]
    );

    const content = (
        <FusionPageRenderer
            page={page}
            context={pageContext}
            autoLoadData={true}
            loadingComponent={loadingComponent}
            errorComponent={errorComponent}
            onAction={onAction ? handlePageAction : undefined}
            onNavigate={onNavigate}
            className={className}
        />
    );

    if (resolver) {
        return (
            <DataBindingResolverContext.Provider value={resolver}>
                {content}
            </DataBindingResolverContext.Provider>
        );
    }

    return content;
}
