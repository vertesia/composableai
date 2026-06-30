import type { AppManifestData, Endpoints, ToolCollectionObject } from '@vertesia/common';

/**
 * Reserved deployment environment names that may never be used as endpoint
 * override keys. Reserving them prevents a manifest from hijacking auto-resolution
 * on a shared production studio-server (whose environment is one of these).
 */
const RESERVED_ENDPOINT_OVERRIDE_ENVS = new Set(['production', 'preview', 'staging']);

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
 * Resolves the effective endpoint for an app.
 *
 * Order of resolution:
 * 1. If `requestedOverride` matches an `endpoint_overrides` key, use that URL
 *    (caller must verify the user is allowed to use the override).
 * 2. Else if `envName` matches an `endpoint_overrides` key, use that URL
 *    (auto-resolution from the studio-server's deployment env).
 * 3. Otherwise use the main `endpoint`.
 * 4. Apply `{{var}}` substitution using `vars`.
 */
export function resolveAppEndpoint(
    manifest: Pick<AppManifestData, 'endpoint' | 'endpoint_overrides'>,
    envName?: string,
    vars?: Endpoints,
    requestedOverride?: string,
): string | undefined {
    let raw: string | undefined;
    if (
        requestedOverride &&
        manifest.endpoint_overrides?.[requestedOverride] &&
        isValidEndpointOverrideEnv(requestedOverride)
    ) {
        raw = manifest.endpoint_overrides[requestedOverride];
    } else if (envName && manifest.endpoint_overrides?.[envName] && isValidEndpointOverrideEnv(envName)) {
        raw = manifest.endpoint_overrides[envName];
    } else {
        raw = manifest.endpoint;
    }
    return raw ? substituteEndpoints(raw, vars) : raw;
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
    envName?: string,
    vars?: Endpoints,
    requestedOverride?: string,
): void {
    if (!manifest) return;

    if (manifest.endpoint) {
        const resolved = resolveAppEndpoint(manifest, envName, vars, requestedOverride);
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
 * (`.../tenants/<t>/apps/<app>`) AND the legacy package mount
 * (`.../tenants/<t>/package/<app>`). Returns undefined for non-gateway endpoints.
 */
export function parseGatewayAppEndpoint(
    endpoint: string,
): { origin: string; tenant: string; appId: string } | undefined {
    const m = /^(.*)\/tenants\/([^/]+)\/(?:package|apps)\/([^/]+)\/?$/.exec(endpoint);
    if (!m) return undefined;
    const [, origin, tenant, appId] = m;
    return { origin, tenant, appId };
}

/**
 * The runtime service-API base for a gateway app endpoint:
 * `.../tenants/<t>/apps/<app>[/versions/<v>]/api`.
 */
export function resolveAppServiceApiBase(endpoint: string, version?: string): string | undefined {
    const parsed = parseGatewayAppEndpoint(endpoint);
    if (!parsed) return undefined;
    const { origin, tenant, appId } = parsed;
    const versionSeg = version ? `/versions/${encodeURIComponent(version)}` : '';
    return `${origin}/tenants/${tenant}/apps/${appId}${versionSeg}/api`;
}

/**
 * The aggregate package descriptor URL for a gateway app endpoint.
 * Falls back to the endpoint unchanged for non-gateway apps.
 */
export function resolvePackageDescriptorUrl(endpoint: string, version?: string): string {
    const parsed = parseGatewayAppEndpoint(endpoint);
    if (!parsed) return endpoint;
    const { origin, tenant, appId } = parsed;
    if (version) {
        return `${origin}/tenants/${tenant}/apps/${appId}/versions/${encodeURIComponent(version)}/api/package`;
    }
    return `${origin}/tenants/${tenant}/package/${appId}`;
}
