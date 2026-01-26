/**
 * Application Router
 *
 * Handles route matching and page rendering within a fusion application.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { FusionPage, ActionSpec } from '@vertesia/common';
import type { ApplicationRouterProps } from './types.js';
import { matchRoute, applyParamDefaults } from './routing.js';
import { FusionPageRenderer } from '../fusion-page/FusionPageRenderer.js';

/**
 * Default loading component.
 */
function DefaultLoading() {
    return (
        <div className="fusion-app-loading">
            <div className="fusion-app-loading-spinner" />
            <span>Loading page...</span>
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
            <h2>Error Loading Page</h2>
            <p>{message}</p>
        </div>
    );
}

/**
 * Default not found component.
 */
function DefaultNotFound() {
    return (
        <div className="fusion-app-not-found">
            <span className="fusion-app-not-found-icon">🔍</span>
            <h2>Page Not Found</h2>
            <p>The requested page could not be found.</p>
        </div>
    );
}

/**
 * Application router component.
 *
 * Matches the current path against routes and renders the appropriate page.
 *
 * @example
 * ```tsx
 * <ApplicationRouter
 *   routes={app.routes}
 *   currentPath="/products/123"
 *   defaultRoute="/dashboard"
 *   loadPage={(pageId) => client.fusion.pages.retrieve(pageId)}
 *   onNavigate={(href) => router.push(href)}
 * />
 * ```
 */
export function ApplicationRouter({
    routes,
    currentPath,
    defaultRoute,
    loadPage,
    globalData,
    context,
    onNavigate,
    onAction,
    loadingComponent,
    errorComponent,
    notFoundComponent,
}: ApplicationRouterProps) {
    const [page, setPage] = useState<FusionPage | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Use refs for callbacks to prevent unnecessary effect re-runs
    const loadPageRef = useRef(loadPage);
    const onNavigateRef = useRef(onNavigate);
    loadPageRef.current = loadPage;
    onNavigateRef.current = onNavigate;

    // Track current loading/loaded page to prevent duplicate loads
    const loadingPageRef = useRef<string | null>(null);
    const loadedPageIdRef = useRef<string | null>(null);

    // Match the current route (memoized to prevent unnecessary re-renders)
    const matchedRoute = useMemo(
        () => matchRoute(currentPath, routes),
        [currentPath, routes]
    );

    // Wrap the action handler to adapt between application and page action formats
    // Must be declared before any conditional returns to follow React hooks rules
    const handlePageAction = useCallback(
        (action: ActionSpec, _data?: Record<string, unknown>) => {
            if (onAction) {
                onAction(action.type, { action });
            }
        },
        [onAction]
    );

    // Build resolution context with route params (memoized to prevent re-renders)
    const pageContext = useMemo(
        () => ({
            ...context,
            route: matchedRoute
                ? applyParamDefaults(matchedRoute.params, matchedRoute.route)
                : {},
        }),
        [context, matchedRoute]
    );

    // Load the page when route changes
    const loadCurrentPage = useCallback(async () => {
        // No matching route - redirect to default or show not found
        if (!matchedRoute) {
            loadingPageRef.current = null;
            setPage(null);
            // If we're at root, redirect to default route
            if (currentPath === '/' && onNavigateRef.current) {
                onNavigateRef.current(defaultRoute);
                return;
            }
            setLoading(false);
            return;
        }

        const { route } = matchedRoute;

        // Inline page template
        if (route.inlinePage) {
            loadingPageRef.current = null;
            // Convert inline template to a minimal page object
            const inlinePage: FusionPage = {
                id: `inline-${route.path}`,
                name: route.path.replace(/\//g, '-').replace(/^-/, ''),
                title: route.inlinePage.title,
                status: 'published',
                path: route.path,
                layout: route.inlinePage.layout,
                regions: route.inlinePage.regions,
                dataBindings: route.inlinePage.dataBindings,
                actions: route.inlinePage.actions,
                breadcrumbs: route.inlinePage.breadcrumbs,
                project: '',
                account: '',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            setPage(inlinePage);
            setLoading(false);
            return;
        }

        // Page ID reference
        if (route.pageId) {
            // Prevent duplicate loads: skip if currently loading OR already loaded this page
            if (loadingPageRef.current === route.pageId || loadedPageIdRef.current === route.pageId) {
                return;
            }

            if (!loadPageRef.current) {
                setError('Page loader not configured');
                setLoading(false);
                return;
            }

            // Clear previous loaded page ref since we're loading a new one
            loadedPageIdRef.current = null;
            loadingPageRef.current = route.pageId;
            setLoading(true);
            setError(null);
            setPage(null);

            try {
                const loadedPage = await loadPageRef.current(route.pageId);
                // Only set state if we're still loading this page
                if (loadingPageRef.current === route.pageId) {
                    loadingPageRef.current = null;
                    loadedPageIdRef.current = route.pageId; // Mark as loaded
                    setPage(loadedPage);
                    setLoading(false);
                }
            } catch (err) {
                // Only set error if we're still loading this page
                if (loadingPageRef.current === route.pageId) {
                    loadingPageRef.current = null;
                    // Don't set loadedPageIdRef on error - allow retry
                    setError(
                        err instanceof Error
                            ? err.message
                            : 'Failed to load page'
                    );
                    setLoading(false);
                }
            }
            return;
        }

        // No page configured for this route
        loadingPageRef.current = null;
        setError('No page configured for this route');
        setLoading(false);
    }, [currentPath, matchedRoute, defaultRoute]);

    useEffect(() => {
        loadCurrentPage();
    }, [loadCurrentPage]);

    // Loading state
    if (loading) {
        return <>{loadingComponent || <DefaultLoading />}</>;
    }

    // Not found state
    if (!matchedRoute) {
        return <>{notFoundComponent || <DefaultNotFound />}</>;
    }

    // Error state
    if (error) {
        const errorNode = errorComponent
            ? errorComponent(error)
            : <DefaultError message={error} />;
        return <>{errorNode}</>;
    }

    // No page loaded
    if (!page) {
        return <>{notFoundComponent || <DefaultNotFound />}</>;
    }

    // Render the page
    return (
        <FusionPageRenderer
            page={page}
            data={globalData}
            context={pageContext}
            autoLoadData={true}
            loadingComponent={loadingComponent}
            errorComponent={errorComponent}
            onAction={handlePageAction}
            onNavigate={onNavigate}
        />
    );
}
