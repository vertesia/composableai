/**
 * Routing Utilities
 *
 * Functions for matching and building routes.
 */

import type { RouteSpec } from '@vertesia/common';
import type { MatchedRoute } from './types.js';

/**
 * Convert a route pattern to a regex.
 * Supports:
 * - Static segments: /products
 * - Dynamic segments: /products/:id
 * - Optional segments: /products/:id?
 * - Wildcard: /files/*
 */
function patternToRegex(pattern: string): { regex: RegExp; paramNames: string[] } {
    const paramNames: string[] = [];
    let regexStr = '^';

    // Split pattern into segments
    const segments = pattern.split('/').filter(Boolean);

    for (const segment of segments) {
        regexStr += '/';

        if (segment === '*') {
            // Wildcard - match anything
            regexStr += '.*';
        } else if (segment.startsWith(':')) {
            // Dynamic parameter
            const isOptional = segment.endsWith('?');
            const paramName = isOptional
                ? segment.slice(1, -1)
                : segment.slice(1);

            paramNames.push(paramName);

            if (isOptional) {
                regexStr += '([^/]*)?';
            } else {
                regexStr += '([^/]+)';
            }
        } else {
            // Static segment - escape special regex characters
            regexStr += segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
    }

    // Allow trailing slash
    regexStr += '/?$';

    return {
        regex: new RegExp(regexStr),
        paramNames,
    };
}

/**
 * Match a path against a single route pattern.
 */
export function matchPath(
    path: string,
    pattern: string
): Record<string, string> | null {
    const { regex, paramNames } = patternToRegex(pattern);
    const match = path.match(regex);

    if (!match) {
        return null;
    }

    // Extract parameters
    const params: Record<string, string> = {};
    for (let i = 0; i < paramNames.length; i++) {
        const value = match[i + 1];
        if (value !== undefined && value !== '') {
            params[paramNames[i]] = decodeURIComponent(value);
        }
    }

    return params;
}

/**
 * Match a path against a list of routes.
 * Returns the first matching route with extracted parameters.
 */
export function matchRoute(
    path: string,
    routes: RouteSpec[]
): MatchedRoute | null {
    // Strip query string and hash before matching
    const pathWithoutQuery = path.split('?')[0].split('#')[0];
    // Normalize path - remove trailing slash (except for root)
    const normalizedPath = pathWithoutQuery === '/' ? '/' : pathWithoutQuery.replace(/\/$/, '');

    for (const route of routes) {
        const params = matchPath(normalizedPath, route.path);
        if (params !== null) {
            return {
                route,
                params,
            };
        }
    }

    return null;
}

/**
 * Build a path from a route pattern and parameters.
 *
 * @example
 * ```ts
 * buildPath('/products/:id', { id: '123' }) // '/products/123'
 * buildPath('/users/:userId/posts/:postId', { userId: '1', postId: '2' }) // '/users/1/posts/2'
 * ```
 */
export function buildPath(
    pattern: string,
    params: Record<string, string>
): string {
    let path = pattern;

    // Replace each parameter
    for (const [key, value] of Object.entries(params)) {
        // Handle both :param and :param? patterns
        const encodedValue = encodeURIComponent(value);
        path = path.replace(`:${key}?`, encodedValue);
        path = path.replace(`:${key}`, encodedValue);
    }

    // Remove any remaining optional parameters
    path = path.replace(/\/:[^/]+\?/g, '');

    return path;
}

/**
 * Extract parameter names from a route pattern.
 */
export function extractParamNames(pattern: string): string[] {
    const names: string[] = [];
    const regex = /:([a-zA-Z_][a-zA-Z0-9_]*)\??/g;
    let match;

    while ((match = regex.exec(pattern)) !== null) {
        names.push(match[1]);
    }

    return names;
}

/**
 * Validate route parameters against their definitions.
 */
export function validateParams(
    params: Record<string, string>,
    route: RouteSpec
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!route.params) {
        return { valid: true, errors: [] };
    }

    for (const paramDef of route.params) {
        const value = params[paramDef.name];

        // Check required
        if (paramDef.required && (value === undefined || value === '')) {
            errors.push(`Parameter '${paramDef.name}' is required`);
            continue;
        }

        // Skip validation if no value
        if (value === undefined || value === '') {
            continue;
        }

        // Type validation
        if (paramDef.type === 'number') {
            if (isNaN(Number(value))) {
                errors.push(`Parameter '${paramDef.name}' must be a number`);
            }
        } else if (paramDef.type === 'uuid') {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(value)) {
                errors.push(`Parameter '${paramDef.name}' must be a valid UUID`);
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Apply default values to parameters.
 */
export function applyParamDefaults(
    params: Record<string, string>,
    route: RouteSpec
): Record<string, string> {
    const result = { ...params };

    if (!route.params) {
        return result;
    }

    for (const paramDef of route.params) {
        if (result[paramDef.name] === undefined && paramDef.default !== undefined) {
            result[paramDef.name] = paramDef.default;
        }
    }

    return result;
}

/**
 * Check if a user has permission to access a route.
 */
export function checkRoutePermission(
    route: RouteSpec,
    user: { roles?: string[]; permissions?: string[] } | null
): boolean {
    // No authentication required
    if (!route.requiresAuth) {
        return true;
    }

    // Auth required but no user
    if (!user) {
        return false;
    }

    // No specific permissions required, just auth
    if (!route.permissions) {
        return true;
    }

    const { roles: requiredRoles, permissions: requiredPermissions } = route.permissions;

    // Check roles
    if (requiredRoles && requiredRoles.length > 0) {
        const hasRole = requiredRoles.some((role) => user.roles?.includes(role));
        if (!hasRole) {
            return false;
        }
    }

    // Check permissions
    if (requiredPermissions && requiredPermissions.length > 0) {
        const hasPermission = requiredPermissions.some((perm) =>
            user.permissions?.includes(perm)
        );
        if (!hasPermission) {
            return false;
        }
    }

    return true;
}

/**
 * Get the appropriate redirect for an unauthorized route.
 */
export function getUnauthorizedRedirect(
    route: RouteSpec,
    user: { id: string } | null
): string | null {
    if (!route.requiresAuth) {
        return null;
    }

    // Not logged in - redirect to login
    if (!user) {
        return '/login';
    }

    // No permission - use fallback from route permissions
    if (route.permissions?.fallback === 'redirect' && route.permissions.redirectTo) {
        return route.permissions.redirectTo;
    }

    // Default unauthorized redirect
    return '/unauthorized';
}
