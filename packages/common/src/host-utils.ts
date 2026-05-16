function stripLeadingWildcard(host: string): string {
    return host.startsWith('*.') ? host.slice(2) : host;
}

function stripIPv6Brackets(host: string): string {
    return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
}

function looksLikeBareIpv6(host: string): boolean {
    const firstColon = host.indexOf(':');
    return firstColon >= 0 && host.indexOf(':', firstColon + 1) >= 0 && !host.startsWith('[');
}

function hasWhitespace(host: string): boolean {
    return host.includes(' ') || host.includes('\t') || host.includes('\n') || host.includes('\r') || host.includes('\f') || host.includes('\v');
}

export function normalizeHost(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    let input = value.trim().toLowerCase();
    if (!input) return undefined;
    input = stripLeadingWildcard(input);
    input = input.endsWith('.') ? input.slice(0, -1) : input;

    if (!input.includes('://')) {
        input = looksLikeBareIpv6(input) ? `https://[${input}]` : `https://${input}`;
    }

    try {
        const url = new URL(input);
        let host = stripIPv6Brackets(url.hostname.toLowerCase());
        host = host.endsWith('.') ? host.slice(0, -1) : host;
        return host && !hasWhitespace(host) ? host : undefined;
    } catch {
        return undefined;
    }
}

export function hostFromUrl(value: string, baseUrl?: string): string | undefined {
    try {
        const url = baseUrl ? new URL(value, baseUrl) : new URL(value);
        return normalizeHost(url.hostname);
    } catch {
        return undefined;
    }
}

export function normalizeHostList(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return Array.from(
        new Set(value.map((entry) => normalizeHost(entry)).filter((entry): entry is string => !!entry)),
    );
}

export function hostMatchesAny(host: string, allowlist: readonly string[] | undefined): boolean {
    if (!allowlist || allowlist.length === 0) return true;
    const normalizedHost = normalizeHost(host);
    if (!normalizedHost) return false;
    return allowlist.some((entry) => {
        const normalizedEntry = normalizeHost(entry);
        return !!normalizedEntry && (normalizedHost === normalizedEntry || normalizedHost.endsWith(`.${normalizedEntry}`));
    });
}

export function urlMatchesAnyHost(url: string, allowlist: readonly string[] | undefined, baseUrl?: string): boolean {
    if (!allowlist || allowlist.length === 0) return true;
    const host = hostFromUrl(url, baseUrl);
    return !!host && hostMatchesAny(host, allowlist);
}

export function isLocalhostOrVertesiaHost(value: string | undefined): boolean {
    const host = normalizeHost(value);
    return !!host && (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '::1' ||
        host === 'vertesia.io' ||
        host.endsWith('.vertesia.io')
    );
}

export function isLocalhostOrVertesiaUrl(value: string): boolean {
    const host = hostFromUrl(value);
    return isLocalhostOrVertesiaHost(host);
}
