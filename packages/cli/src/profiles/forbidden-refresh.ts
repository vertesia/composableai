import { refreshProfileAccessToken } from './auth.js';
import type { Profile } from './index.js';

type FetchFn = (input: RequestInfo, init?: RequestInit) => Promise<Response>;

/**
 * Wrap fetch so that a 403 from the server triggers one forced refresh of a profile's access token and one retry.
 *
 * An access token carries the grants that were in force when it was minted. A grant created after that, such as
 * the installation access an app build adds for its creator, is refused until the next mint, which the CLI would
 * otherwise only do near expiry. The server still makes the decision: a retry with a fresh token that is still
 * refused surfaces the 403 unchanged, and at most one forced refresh happens per process: requests refused while it
 * runs wait for it, and a request already sent with the fresh token is not resent.
 */
export function createRefreshOnForbiddenFetch(
    profile: Profile,
    authProvider: () => Promise<string>,
    baseFetch: FetchFn = (input, init) => fetch(input, init),
    refresh: (profile: Profile) => Promise<unknown> = refreshProfileAccessToken,
): FetchFn {
    // One forced refresh per process, shared by every request refused while it runs.
    let refreshedToken: Promise<string | undefined> | undefined;
    const profileOrigins = new Set(
        [profile.studio_server_url, profile.zeno_server_url].flatMap((url) => {
            try {
                return url ? [new URL(url).origin] : [];
            } catch {
                return [];
            }
        }),
    );

    return async (input, init) => {
        // Only a request that already sends this profile's token to this profile's own servers can be resent with a
        // new one, so a refreshed token never reaches a host it was not meant for. Only a request with no body or a
        // JSON body is resent: keeping a copy of a streamed upload would hold all of it in memory.
        // Building a Request from a Request takes over its body, so a lone Request is used as it is.
        const request = input instanceof Request && init === undefined ? input : new Request(input, init);
        const retryable =
            request.headers.has('authorization') &&
            profileOrigins.has(new URL(request.url).origin) &&
            (request.body === null || isJsonBody(request));
        if (!retryable) {
            return baseFetch(request);
        }
        const response = await baseFetch(request.clone());
        if (response.status !== 403) {
            return response;
        }

        // A failed refresh leaves the original 403 as the answer; it is the error the caller would have seen anyway.
        refreshedToken ??= refresh(profile)
            .then((refreshed) => (refreshed ? authProvider() : undefined))
            .catch(() => undefined);
        const token = await refreshedToken;
        if (!token || token === request.headers.get('authorization')) {
            return response;
        }
        await response.body?.cancel();

        const headers = new Headers(request.headers);
        headers.set('authorization', token);
        return baseFetch(new Request(request, { headers }));
    };
}

function isJsonBody(request: Request): boolean {
    const type = request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
    return type === 'application/json';
}
