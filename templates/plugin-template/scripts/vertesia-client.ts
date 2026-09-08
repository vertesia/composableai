/**
 * The single supported way for a generated app's Node-side scripts and Playwright fixtures to build
 * an authenticated Vertesia client.
 *
 * `VertesiaClient` takes the credential as `apikey` and pins the app version through the
 * `withAppVersion()` method — NOT as `token` / `appVersion` constructor options. Unknown
 * constructor options are ignored (the SDK warns, but still builds the client), so a client built
 * with the wrong names sends no `Authorization` header at all and every call fails with
 * `401 Unauthorized: Authorization token is required`, while an unpinned client silently resolves
 * `app:<app-name>:…` refs against the promoted version instead of the candidate under test.
 *
 * Import this factory instead of calling `new VertesiaClient(...)`, so that shape is written once.
 */
import { VertesiaClient } from '@vertesia/client';

export interface CreateVertesiaClientOptions {
    /**
     * Immutable version id to pin the client to. Required when exercising an unpromoted candidate
     * build; omit it to resolve against the promoted version.
     */
    appVersion?: string;
}

/**
 * Endpoints supplied by the runtime that launched this script. When they are absent the client
 * falls back to the endpoints baked into the token, which may target a different environment.
 */
function resolveEndpoints(): { studio: string; store: string; token?: string } | undefined {
    const studio = process.env.VERTESIA_SERVER_URL;
    const store = process.env.VERTESIA_STORE_URL;
    if (!studio || !store) return undefined;
    return { studio, store, token: process.env.VERTESIA_TOKEN_SERVER_URL };
}

/** Build an authenticated client from `VERTESIA_TOKEN`. */
export async function createVertesiaClient(options: CreateVertesiaClientOptions = {}): Promise<VertesiaClient> {
    const token = process.env.VERTESIA_TOKEN;
    if (!token) {
        throw new Error(
            'VERTESIA_TOKEN is required. Agent runs export it automatically; ' +
                'locally use `VERTESIA_TOKEN="$(vertesia auth token)" <command>`.',
        );
    }
    const client = await VertesiaClient.fromAuthToken(token, undefined, resolveEndpoints());
    return options.appVersion ? client.withAppVersion(options.appVersion) : client;
}
