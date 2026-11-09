/**
 * SSRF protection shim for @vertesia/workflow.
 *
 * URL validation is delegated via client.apps.validateUrl() so that security
 * policy details (blocked IP ranges, ports, hostnames) are not exposed in this
 * public package.
 *
 * This file only provides redirect-safe fetch, the hook a host process uses to bind its connections to that policy,
 * and the error class.
 */

export class URLValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'URLValidationError';
    }
}

/** A fetch function the activities send requests to caller-chosen URLs through. */
export type OutboundFetch = (url: string, init: RequestInit) => Promise<Response>;

// On globalThis, not in a module variable: a worker can load this module more than once (an activity bundle next to the
// unbundled package), and every copy must see the fetch the host installed.
const OUTBOUND_FETCH = Symbol.for('vertesia.workflow.outboundFetch');

type OutboundFetchHolder = { [OUTBOUND_FETCH]?: OutboundFetch };

/**
 * Installs the fetch {@link safeFetch} connects through, or restores the global fetch with `undefined`.
 *
 * client.apps.validateUrl() checks the addresses a hostname resolves to when it is called; the request is sent later
 * and resolves the name again. A host process (the Vertesia worker) installs a fetch that checks the address of every
 * connection against the same policy, so a low-TTL record cannot point the request at a private address in between.
 */
export function setOutboundFetch(fetchImpl: OutboundFetch | undefined): void {
    (globalThis as OutboundFetchHolder)[OUTBOUND_FETCH] = fetchImpl;
}

function outboundFetch(): OutboundFetch {
    return (globalThis as OutboundFetchHolder)[OUTBOUND_FETCH] ?? fetch;
}

/**
 * Redirect-safe fetch wrapper, sent through the fetch installed with {@link setOutboundFetch}. Does not validate the
 * URL — call client.apps.validateUrl() first.
 * @throws {URLValidationError} if the server redirects (potential redirect-based SSRF)
 */
export async function safeFetch(url: string, init: RequestInit = {}): Promise<Response> {
    const response = await outboundFetch()(url, { ...init, redirect: 'manual' });
    // Only block actual redirects (those with a Location header). 304 Not Modified is a 3xx
    // but carries no Location and must not be treated as a redirect.
    if (response.headers.has('location')) {
        throw new URLValidationError(
            `Request to ${url} returned a redirect (${response.status}), which is not allowed`,
        );
    }
    return response;
}
