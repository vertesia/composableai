/**
 * Application Router
 *
 * Handles route matching and page rendering within a fusion application.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
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
        setLoading(true);
        setError(null);
        setPage(null);

        // No matching route - redirect to default or show not found
        if (!matchedRoute) {
            // If we're at root, redirect to default route
            if (currentPath === '/' && onNavigate) {
                onNavigate(defaultRoute);
                return;
            }
            setLoading(false);
            return;
        }

        const { route } = matchedRoute;

        // Inline page template
        if (route.inlinePage) {
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
            if (!loadPage) {
                setError('Page loader not configured');
                setLoading(false);
                return;
            }

            try {
                const loadedPage = await loadPage(route.pageId);
                setPage(loadedPage);
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : 'Failed to load page'
                );
            }
            setLoading(false);
            return;
        }

        // No page configured for this route
        setError('No page configured for this route');
        setLoading(false);
    }, [currentPath, matchedRoute, loadPage, defaultRoute, onNavigate]);

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
