/**
 * Fusion Runtime Server Utilities
 *
 * Server-side rendering and data prefetching utilities.
 */

import type { FusionApplication, FusionPage, DataBindingSpec } from '@vertesia/common';
import type {
    FusionRuntimeConfig,
    SSRContext,
    SSRHeadElements,
    HydrationData,
} from './types.js';
import type { ResolutionContext } from '../data-binding/types.js';
import { createDataBindingResolver } from '../data-binding/resolver.js';
import { matchRoute, applyParamDefaults } from '../fusion-application/routing.js';

/**
 * Options for server-side data loading.
 */
export interface ServerLoadOptions {
    /** Application definition */
    application: FusionApplication;
    /** Request URL path */
    path: string;
    /** SSR context */
    context?: SSRContext;
    /** Runtime configuration */
    config: FusionRuntimeConfig;
    /** Page loader function */
    loadPage?: (pageId: string) => Promise<FusionPage>;
    /** User context */
    user?: { id: string; roles?: string[]; permissions?: string[] };
}

/**
 * Result from server-side data loading.
 */
export interface ServerLoadResult {
    /** Success flag */
    success: boolean;
    /** Matched page */
    page: FusionPage | null;
    /** Route parameters */
    params: Record<string, string>;
    /** Prefetched data */
    data: Record<string, unknown>;
    /** Redirect URL if route requires redirect */
    redirect?: string;
    /** Status code */
    statusCode: number;
    /** Errors if any */
    errors?: Array<{ key: string; error: string }>;
}

/**
 * Load data on the server for a given path.
 *
 * This function handles:
 * 1. Route matching
 * 2. Page loading
 * 3. Data prefetching
 * 4. Redirect handling
 *
 * @example
 * ```ts
 * // In your server route handler
 * const result = await loadServerData({
 *   application,
 *   path: req.url,
 *   config: { dataFetchers: serverFetchers },
 *   user: req.user,
 * });
 *
 * if (result.redirect) {
 *   return redirect(result.redirect);
 * }
 *
 * // Render with preloaded data
 * return render({ page: result.page, data: result.data });
 * ```
 */
export async function loadServerData(options: ServerLoadOptions): Promise<ServerLoadResult> {
    const { application, path, config, loadPage, user } = options;

    // Match route
    const matched = matchRoute(path, application.routes);

    if (!matched) {
        // Check if we should redirect to default route
        if (path === '/') {
            return {
                success: true,
                page: null,
                params: {},
                data: {},
                redirect: application.defaultRoute,
                statusCode: 302,
            };
        }

        return {
            success: false,
            page: null,
            params: {},
            data: {},
            statusCode: 404,
        };
    }

    const { route, params } = matched;

    // Check permissions
    if (route.requiresAuth && !user) {
        return {
            success: false,
            page: null,
            params,
            data: {},
            redirect: route.permissions?.redirectTo || '/login',
            statusCode: 302,
        };
    }

    if (route.permissions?.roles && route.permissions.roles.length > 0) {
        const hasRole = route.permissions.roles.some((role: string) => user?.roles?.includes(role));
        if (!hasRole) {
            return {
                success: false,
                page: null,
                params,
                data: {},
                redirect: route.permissions?.redirectTo || '/forbidden',
                statusCode: 302,
            };
        }
    }

    // Load page
    let page: FusionPage | null = null;

    if (route.inlinePage) {
        // Convert inline template to page object
        page = {
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
    } else if (route.pageId && loadPage) {
        try {
            page = await loadPage(route.pageId);
        } catch (error) {
            return {
                success: false,
                page: null,
                params,
                data: {},
                statusCode: 500,
                errors: [{ key: 'page', error: (error as Error).message }],
            };
        }
    }

    // Create resolver for data fetching
    if (!config.dataFetchers) {
        return {
            success: true,
            page,
            params,
            data: {},
            statusCode: 200,
        };
    }

    const resolver = createDataBindingResolver({
        fetchers: config.dataFetchers,
        ...config.resolverConfig,
    });

    // Build resolution context
    const resolutionContext: ResolutionContext = {
        route: applyParamDefaults(params, route),
        settings: application.settings || {},
        user: user || undefined,
        resolved: {},
    };

    // Collect all bindings to prefetch
    const bindings: DataBindingSpec[] = [];

    // Add global data sources
    if (application.globalDataSources) {
        const globalBindings = application.globalDataSources
            .filter((s) => s.prefetch !== false)
            .map((s) => s.binding);
        bindings.push(...globalBindings);
    }

    // Add page data bindings
    if (page?.dataBindings) {
        bindings.push(...page.dataBindings);
    }

    // Fetch all data
    let data: Record<string, unknown> = {};
    const errors: Array<{ key: string; error: string }> = [];

    if (bindings.length > 0) {
        const result = await resolver.resolveAll(bindings, resolutionContext);
        data = result.data;

        if (!result.success) {
            errors.push(...result.errors);
        }
    }

    return {
        success: errors.length === 0,
        page,
        params,
        data,
        statusCode: 200,
        errors: errors.length > 0 ? errors : undefined,
    };
}

/**
 * Generate head elements for SSR.
 */
export function generateHeadElements(
    application: FusionApplication,
    page: FusionPage | null,
    _data: Record<string, unknown>
): SSRHeadElements {
    const head: SSRHeadElements = {
        meta: [],
        links: [],
        scripts: [],
        styles: [],
    };

    // Set title
    const pageTitle = page?.title || application.title;
    head.title = typeof pageTitle === 'string' ? pageTitle : pageTitle;

    // Add application meta
    head.meta?.push({ name: 'application-name', content: application.title });

    // Add description if page has one
    if (page?.description) {
        head.meta?.push({ name: 'description', content: page.description });
    }

    // Add Open Graph tags
    head.meta?.push({ property: 'og:title', content: head.title || application.title });
    head.meta?.push({ property: 'og:type', content: 'website' });

    // Add theme color if set
    if (application.theme?.primaryColor) {
        head.meta?.push({ name: 'theme-color', content: application.theme.primaryColor });
    }

    // Add custom CSS if set
    if (application.theme?.customCss) {
        head.styles?.push({ content: application.theme.customCss });
    }

    return head;
}

/**
 * Create hydration data for client-side hydration.
 */
export function createHydrationData(
    application: FusionApplication,
    page: FusionPage | null,
    data: Record<string, unknown>,
    path: string,
    user?: { id: string; roles?: string[]; permissions?: string[] }
): HydrationData {
    return {
        application,
        currentPage: page || undefined,
        preloadedData: data,
        initialPath: path,
        user,
    };
}

/**
 * Serialize hydration data for embedding in HTML.
 */
export function serializeHydrationData(data: HydrationData): string {
    // Escape script tags to prevent XSS
    const json = JSON.stringify(data);
    return json.replace(/<\/script>/gi, '<\\/script>');
}

/**
 * Generate the hydration script tag.
 */
export function generateHydrationScript(data: HydrationData): string {
    const serialized = serializeHydrationData(data);
    return `<script id="__FUSION_DATA__" type="application/json">${serialized}</script>`;
}

/**
 * Parse hydration data from the DOM (client-side).
 */
export function parseHydrationData(): HydrationData | null {
    if (typeof document === 'undefined') {
        return null;
    }

    const script = document.getElementById('__FUSION_DATA__');
    if (!script) {
        return null;
    }

    try {
        return JSON.parse(script.textContent || '{}') as HydrationData;
    } catch {
        console.error('Failed to parse hydration data');
        return null;
    }
}

/**
 * Create server-side fetchers with authentication.
 *
 * This creates a basic fetcher setup with common configuration.
 * Users must provide their own complete DataFetchers implementation
 * with the appropriate methods for their data sources.
 */
export function createServerFetchers(
    baseUrl: string,
    authToken?: string
): { baseUrl: string; headers: Record<string, string> } {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    // Return configuration that can be used to create DataFetchers implementations
    return { baseUrl, headers };
}
