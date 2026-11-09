/**
 * True when a status lookup got no answer about the connection: the network failed, or the server or an OAuth
 * server it depends on was unavailable. The connection may be fine, so it must not read as disconnected.
 * A 4xx is a real answer about this request, and offering Connect is still the way forward.
 */
export function isOAuthStatusUnknownError(error: unknown): boolean {
    const status = (error as { status?: unknown } | null | undefined)?.status;
    return typeof status !== 'number' || status === 0 || status === 429 || status >= 500;
}

/** The readable part of a failed request: `message` also carries the request line and a stack label. */
export function oauthErrorDetail(error: unknown): string | undefined {
    if (!(error instanceof Error)) return undefined;
    const raw = (error as { original_message?: string }).original_message ?? error.message;
    return raw.replace(/^[A-Za-z\s]+:\s/, '');
}
