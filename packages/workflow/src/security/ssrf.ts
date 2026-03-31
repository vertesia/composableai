/**
 * SSRF protection shim for @vertesia/workflow.
 *
 * URL validation is delegated via client.apps.validateUrl() so that security
 * policy details (blocked IP ranges, ports, hostnames) are not exposed in this
 * public package.
 *
 * This file only provides redirect-safe fetch and the error class.
 */

export class URLValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'URLValidationError';
    }
}

/**
 * Redirect-safe fetch wrapper. Does not validate the URL — call client.apps.validateUrl() first.
 * @throws {URLValidationError} if the server redirects (potential redirect-based SSRF)
 */
export async function safeFetch(url: string, init: RequestInit = {}): Promise<Response> {
    const response = await fetch(url, { ...init, redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) {
        throw new URLValidationError(
            `Request to ${url} returned a redirect (${response.status}), which is not allowed`,
        );
    }
    return response;
}
