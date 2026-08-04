import type { AppManifestData, Endpoints, ToolCollectionObject } from '@vertesia/common';
import { getStudioUtilsLogger } from '../logger.js';

declare const URL: {
    new (
        url: string,
    ): {
        pathname: string;
        toString(): string;
    };
};

export interface ResolveAppEndpointOptions {
    envName?: string;
    vars?: Endpoints;
    requestedOverride?: string;
    version?: string;
}

/**
 * Reserved deployment environment names that may never be used as endpoint
 * override keys. Reserving them prevents a manifest from hijacking auto-resolution
 * on a shared production studio-server (whose environment is one of these).
 */
const RESERVED_ENDPOINT_OVERRIDE_ENVS = new Set(['production', 'preview', 'staging']);
const GATEWAY_APP_ENDPOINT_PATTERN = new RegExp(
    '^(.*)/tenants/([^/]+)/(?:' + 'package/([^/]+)|' + 'apps/([^/]+)(?:/versions/([^/]+))?(?:/api/package)?' + ')/?$',
);

/**
 * Returns true if the given environment name is allowed as an endpoint override key.
 * Any non-empty name is accepted except the reserved shared-deployment names.
 */
export function isValidEndpointOverrideEnv(envName: string): boolean {
    if (!envName) return false;
    return !RESERVED_ENDPOINT_OVERRIDE_ENVS.has(envName.toLowerCase());
}

/**
 * Substitutes `{{key}}` placeholders in a URL with the matching endpoint.
 * Unknown placeholders are left untouched (so failures surface as fetch errors
 * with the unresolved placeholder visible, rather than silently pointing nowhere).
 * Trailing slashes on replacement values are stripped to avoid `//api/...` joins.
 */
export function substituteEndpoints(url: string, endpoints?: Endpoints): string {
    if (!url || !endpoints) return url;
    return url.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
        const value = (endpoints as Record<string, string | undefined>)[key];
        if (typeof value !== 'string' || !value) return match;
        return trimTrailingSlashes(value);
    });
}

function trimTrailingSlashes(value: string): string {
    let end = value.length;
    while (end > 0 && value[end - 1] === '/') {
        end--;
    }
    return end === value.length ? value : value.slice(0, end);
}

/**
 * Resolves an app manifest endpoint to its package descriptor URL.
 *
 * Resolution has two modes:
 *
 * Gateway apps: if the base `endpoint` is an app-gateway URL, endpoint overrides
 * are ignored. Gateway versions are resolved by rewriting the canonical gateway
 * package URL itself:
 * - `https://gw/tenants/t/apps/my-app`
 *   -> `https://gw/tenants/t/apps/my-app/api/package`
 * - `https://gw/tenants/t/package/my-app`
 *   -> `https://gw/tenants/t/apps/my-app/api/package`
 * - with `version: "1.2.3"`
 *   -> `https://gw/tenants/t/apps/my-app/versions/1.2.3/api/package`
 *
 * Regular apps: endpoint overrides are supported in this order:
 * 1. Version override: if `version` matches `endpoint_overrides[version]`, use
 *    that URL. This lets regular, non-gateway apps expose version-pinned package
 *    endpoints without going through the app gateway.
 * 2. Explicit override: if `requestedOverride` matches an allowed
 *    `endpoint_overrides` key, use that URL. Callers must still verify the user
 *    is allowed to request that override.
 * 3. Environment override: if `envName` matches an allowed `endpoint_overrides`
 *    key, use that URL for deployment-env-specific endpoints.
 * 4. Base endpoint: otherwise use `manifest.endpoint`.
 * 5. Placeholder substitution: replace `{{gateway}}`, `{{studio}}`, etc. from
 *    `vars`.
 *
 * Regular package URLs are returned unchanged:
 * - `https://plugin.example.com/api/package`
 *   -> `https://plugin.example.com/api/package`
 *
 * Non-standard package URLs are also returned unchanged, with a warning:
 * - `https://plugin.example.com/exotic/pkg`
 *   -> `https://plugin.example.com/exotic/pkg`
 */
export function resolveAppEndpoint(
    manifest: Pick<AppManifestData, 'endpoint' | 'endpoint_overrides'>,
    options: ResolveAppEndpointOptions = {},
): string | undefined {
    if (!manifest.endpoint) {
        return undefined;
    }

    const baseEndpoint = substituteEndpoints(manifest.endpoint, options.vars);
    const gateway = parseGatewayAppEndpoint(baseEndpoint);
    if (gateway) {
        return resolveGatewayAppEndpoint(gateway, options.version);
    }

    return resolveRegularAppEndpoint(manifest, manifest.endpoint, options);
}

function resolveGatewayAppEndpoint(
    gateway: { origin: string; tenant: string; appId: string; version?: string },
    version?: string,
): string {
    const effectiveVersion = version || gateway.version;
    const versionSeg = effectiveVersion ? `/versions/${encodeURIComponent(effectiveVersion)}` : '';
    return `${gateway.origin}/tenants/${gateway.tenant}/apps/${gateway.appId}${versionSeg}/api/package`;
}

function resolveRegularAppEndpoint(
    manifest: Pick<AppManifestData, 'endpoint_overrides'>,
    baseEndpoint: string,
    options: ResolveAppEndpointOptions,
): string | undefined {
    const { envName, vars, requestedOverride, version } = options;
    let raw: string;
    if (version && manifest.endpoint_overrides?.[version]) {
        raw = manifest.endpoint_overrides[version];
    } else if (
        requestedOverride &&
        manifest.endpoint_overrides?.[requestedOverride] &&
        isValidEndpointOverrideEnv(requestedOverride)
    ) {
        raw = manifest.endpoint_overrides[requestedOverride];
    } else if (envName && manifest.endpoint_overrides?.[envName] && isValidEndpointOverrideEnv(envName)) {
        raw = manifest.endpoint_overrides[envName];
    } else {
        raw = baseEndpoint;
    }

    // Substitute the selected regular endpoint, not only the base endpoint:
    // `raw` may be an override. Current server validation usually requires
    // overrides to be absolute URLs, but keeping substitution here preserves
    // compatibility if trusted/system manifests use placeholders in overrides.
    const endpoint = substituteEndpoints(raw, vars);
    warnIfNonStandardPackageEndpoint(endpoint);
    return endpoint;
}

/**
 * Resolves all URL placeholders in a manifest in place (both `endpoint` and
 * `tool_collections[].url`). Intended for server-side serialization.
 *
 * Mutates the manifest rather than returning a copy so it works cleanly with
 * Mongoose populated subdocs.
 */
export function resolveManifestUrls(
    manifest: Partial<AppManifestData> | null | undefined,
    options: ResolveAppEndpointOptions = {},
): void {
    if (!manifest) return;
    const { vars } = options;

    if (manifest.endpoint) {
        const resolved = resolveAppEndpoint(manifest, options);
        if (resolved && resolved !== manifest.endpoint) {
            manifest.endpoint = resolved;
        }
    }

    const toolCollections = manifest.tool_collections as ToolCollectionObject[] | undefined;
    if (toolCollections && Array.isArray(toolCollections)) {
        for (let i = 0; i < toolCollections.length; i++) {
            const item = toolCollections[i];
            if (item && typeof item === 'object' && item.url) {
                const sub = substituteEndpoints(item.url, vars);
                if (sub !== item.url) item.url = sub;
            }
        }
    }
}

/**
 * Parse a gateway app endpoint into its parts. Accepts BOTH the canonical apps mount
 * (`.../tenants/<t>/apps/<app>`), the canonical package route
 * (`.../tenants/<t>/apps/<app>/api/package`), versioned package routes, AND the
 * legacy package mount (`.../tenants/<t>/package/<app>`). Returns undefined for
 * non-gateway endpoints.
 */
export function parseGatewayAppEndpoint(
    endpoint: string,
): { origin: string; tenant: string; appId: string; version?: string } | undefined {
    const m = GATEWAY_APP_ENDPOINT_PATTERN.exec(endpoint);
    if (!m) return undefined;
    const [, origin, tenant, legacyAppId, appsAppId, version] = m;
    return {
        origin,
        tenant,
        appId: legacyAppId || appsAppId,
        ...(version ? { version } : {}),
    };
}

function warnIfNonStandardPackageEndpoint(endpoint: string): void {
    if (!isStandardPackageEndpoint(endpoint)) {
        getStudioUtilsLogger().warn(
            { endpoint },
            'Non-standard app package endpoint; returning it unchanged during app endpoint resolution',
        );
    }
}

function isStandardPackageEndpoint(endpoint: string): boolean {
    try {
        const url = new URL(endpoint);
        return trimTrailingSlashes(url.pathname).endsWith('/package');
    } catch {
        return false;
    }
}

/**
 * Derives the runtime app API base from a package descriptor URL by removing the
 * final path segment.
 *
 * Examples:
 * - `https://plugin.example.com/api/package` -> `https://plugin.example.com/api`
 * - `https://plugin.example.com/exotic/pkg` -> `https://plugin.example.com/exotic`
 * - `https://gw/tenants/t/apps/my-app/api/package` -> `https://gw/tenants/t/apps/my-app/api`
 */
export function resolveAppApiBase(packageEndpoint: string): string {
    const url = new URL(packageEndpoint);
    const path = trimTrailingSlashes(url.pathname);
    const lastSlash = path.lastIndexOf('/');
    url.pathname = lastSlash <= 0 ? '/' : path.slice(0, lastSlash);
    return url.toString();
}

/**
 * Resolves an app resource URL from a package descriptor endpoint and a path
 * relative to the app `/api` base.
 *
 * Examples:
 * - `resolveAppResource("https://plugin.example.com/api/package", "tools/main")`
 *   -> `https://plugin.example.com/api/tools/main`
 * - `resolveAppResource("https://gw/tenants/t/apps/my-app/api/package", "/interactions/x")`
 *   -> `https://gw/tenants/t/apps/my-app/api/interactions/x`
 */
export function resolveAppResource(packageEndpoint: string, pathRelativeToApiBase: string): string {
    const base = resolveAppApiBase(packageEndpoint);
    const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
    const normalizedPath = pathRelativeToApiBase.startsWith('/') ? pathRelativeToApiBase : `/${pathRelativeToApiBase}`;
    return `${normalizedBase}${normalizedPath}`;
}
