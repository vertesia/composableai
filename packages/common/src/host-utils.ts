export function normalizeHost(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return undefined;

    let host: string;
    try {
        host = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`).hostname.toLowerCase();
    } catch {
        host = trimmed.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    }

    host = host.replace(/^\*\./, '').replace(/^\[/, '').replace(/\]$/, '').replace(/\.$/, '');
    if (host.includes(':') && !host.includes('::')) {
        host = host.replace(/:\d+$/, '');
        if (host.includes(':')) return undefined;
    }
    if (!host || /\s/.test(host)) return undefined;
    return host;
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
