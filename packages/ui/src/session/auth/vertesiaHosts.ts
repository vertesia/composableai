const LOOPBACK_IPV4 = /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
/** A single DNS label: alphanumeric, inner hyphens allowed. */
export const LABEL = '[a-z0-9](?:[a-z0-9-]*[a-z0-9])?';

/** The region label is optional throughout, because each regional host has a global US alias. */
export const REGION = `(?:${LABEL}\\.)?`;

/**
 * Hostnames served by the UI backend — Vertesia's own code, not merely a Vertesia-owned name:
 *   `cloud.vertesia.io`, `cloud.us1.vertesia.io`                     — the Cloud UI
 *   `preprod.cloud.vertesia.io`, `preview.cloud.us1.vertesia.io`     — its preview/preprod tiers
 *   `acme.cloud.us1.vertesia.io`                                     — per-IdP-tenant branded hosts
 *   `dev-feat-x.ui.dev1.vertesia.io`                                 — dynamic per-branch dev envs
 *
 * Mirrors the load-balancer host rules (region-lb/main.tf: `cloud.${var.domain}`,
 * `*.cloud.${var.domain}`, `*.ui.${var.domain}`) rather than the DNS zone, so a name we merely own
 * is not trusted for what serves it.
 */
export const FIRST_PARTY_HOST_PATTERNS: readonly RegExp[] = [
    new RegExp(`^cloud\\.${REGION}vertesia\\.io$`),
    new RegExp(`^${LABEL}\\.cloud\\.${REGION}vertesia\\.io$`),
    new RegExp(`^${LABEL}\\.ui\\.${LABEL}\\.vertesia\\.io$`),
];

/**
 * Public app-gateway origins. Stable tiers use the `apps*` browser-facing host, while development
 * environments reach the gateway through its `*.api.*` Cloud Run route:
 *   `apps.us1.vertesia.io`, `apps-preview.us1.vertesia.io`
 *   `app-gateway-dev1.api.dev1.vertesia.io`, `app-gateway-us3.api.us3.vertesia.io`
 *
 * The second label is deliberately unconstrained. Branch environments do NOT each get a gateway —
 * they share their region's (`detectGatewayUrl` in packages/server-common/src/env/ServerEnv.ts:444
 * and `getAppgenServerBaseUrl` in packages/workflows/.../app_workspace/workspace-utils.ts), so the
 * host published to browsers is region-scoped, while the per-branch `app-gateway-dev-<branch>`
 * shape in the infrastructure README also exists. Matching `app-gateway-<anything>` covers both,
 * and every Cloud Run service named that way *is* a gateway (region-compute/main.tf:373).
 *
 * These serve every tenant's published application from one shared origin, and published assets
 * need no authentication — so this is generated, low-trust code sitting on a Vertesia-owned
 * hostname. Owning the domain is not the test; which backend serves the origin is.
 *
 * Two load-balancer variables can map further hostnames onto the same backend —
 * `appgen_host_aliases` and `appgen_preview_host_aliases` in
 * infrastructure/terraform/modules/region-lb/variables.tf. Both are empty in every region today; if
 * one is ever set, add the alias here too, or it silently falls through to the permissive branch of
 * Policy L and becomes an origin that may receive a token at any path.
 */
export const GATEWAY_HOST_PATTERNS: readonly RegExp[] = [
    new RegExp(`^apps(?:-preview|-preprod)?\\.${REGION}vertesia\\.io$`),
    new RegExp(`^app-gateway-${LABEL}\\.api\\.${LABEL}\\.vertesia\\.io$`),
];

export function isLoopbackHostname(hostname: string): boolean {
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
        return true;
    }
    if (hostname === '::1' || hostname === '[::1]') {
        return true;
    }
    return LOOPBACK_IPV4.test(hostname);
}

export function normalizeHostname(hostname: string): string {
    return hostname.toLowerCase().replace(/\.$/, '');
}

export const AUTH_BROKER_HOST_PATTERNS: readonly RegExp[] = [new RegExp(`^auth\\.${REGION}vertesia\\.io$`)];

export function isTrustedAuthBrokerUrl(value: string, options: { allowLoopback?: boolean } = {}): boolean {
    try {
        const url = new URL(value);
        const hostname = normalizeHostname(url.hostname);
        if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return false;
        if (options.allowLoopback && isLoopbackHostname(hostname)) {
            return url.protocol === 'http:' || url.protocol === 'https:';
        }
        return (
            url.protocol === 'https:' &&
            !url.port &&
            AUTH_BROKER_HOST_PATTERNS.some((pattern) => pattern.test(hostname))
        );
    } catch {
        return false;
    }
}
