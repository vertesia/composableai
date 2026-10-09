const LOOPBACK_IPV4 = /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
/** A single DNS label: alphanumeric, inner hyphens allowed. */
const LABEL = '[a-z0-9](?:[a-z0-9-]*[a-z0-9])?';

/** The region label is optional throughout, because each regional host has a global US alias. */
const REGION = `(?:${LABEL}\\.)?`;

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
