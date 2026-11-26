import { refreshProfileAccessToken } from './auth.js';
import type { Profile } from './index.js';

type FetchFn = (input: RequestInfo, init?: RequestInit) => Promise<Response>;

/**
 * Wrap fetch so that a 403 from the server triggers one forced refresh of a profile's access token and one retry.
 *
 * An access token carries the grants that were in force when it was minted. A grant created after that, such as
 * the installation access an app build adds for its creator, is refused until the next mint, which the CLI would
 * otherwise only do near expiry. The server still makes the decision: a retry with a fresh token that is still
 * refused surfaces the 403 unchanged, and at most one forced refresh happens per process.
 */
export function createRefreshOnForbiddenFetch(
    profile: Profile,
    authProvider: () => Promise<string>,
    baseFetch: FetchFn = (input, init) => fetch(input, init),
    refresh: (profile: Profile) => Promise<unknown> = refreshProfileAccessToken,
): FetchFn {
    let forcedRefreshUsed = false;
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
        const request = new Request(input, init);
        const response = await baseFetch(request.clone());
        // Only a request that already sent this profile's token to this profile's own servers is resent with a new
        // one, so a refreshed token can never reach a host it was not meant for.
        const ownRequest = request.headers.has('authorization') && profileOrigins.has(new URL(request.url).origin);
        if (response.status !== 403 || forcedRefreshUsed || !ownRequest) {
            return response;
        }
        forcedRefreshUsed = true;

        // A failed refresh leaves the original 403 as the answer; it is the error the caller would have seen anyway.
        const refreshed = await refresh(profile).catch(() => undefined);
        const token = refreshed ? await authProvider().catch(() => undefined) : undefined;
        if (!token) {
            return response;
        }
        await response.body?.cancel();

        const headers = new Headers(request.headers);
        headers.set('authorization', token);
        return baseFetch(new Request(request, { headers }));
    };
}
