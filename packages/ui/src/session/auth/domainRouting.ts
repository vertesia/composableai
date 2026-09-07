import { Env } from '@vertesia/ui/env';
import { generateAuthState } from './authState';

declare global {
    interface Window {
        AUTH_MODE?: 'firebase' | 'central';
    }
}

/**
 * The broker this app sends users to for sign-in and logout.
 *
 * Hard-coded until now, which meant every consumer of this package reached the same deployment no
 * matter what was running. It is read from the environment so a single app can be pointed at a
 * different broker, and it keeps this default so an app that configures nothing is unaffected.
 */
export const DEFAULT_CENTRAL_AUTH_URL = 'https://internal-auth.vertesia.app/';

export function centralAuthUrl(): string {
    const configured = Env.endpoints.auth;
    return configured ? configured : DEFAULT_CENTRAL_AUTH_URL;
}

export function shouldUseFirebaseAuth(_hostname?: string) {
    return window.AUTH_MODE === 'firebase';
}

export function shouldRedirectToCentralAuth(_hostname?: string) {
    return !shouldUseFirebaseAuth();
}

interface AuthSelection {
    accountId?: string;
    projectId?: string;
}

/**
 * The page URL to return to after a central-auth round-trip (`redirect_uri`).
 *
 * Apps served under a deep gateway mount carry a `<base href="/tenants/<t>/apps/<app>/.../app/">`
 * that the app-gateway injects at serve time. The in-app router rewrites the address bar relative
 * to the origin rather than that mount, so by the time the auth flow runs `window.location` can
 * read as the bare origin `/`. Building `redirect_uri` from that drops the app path, and the
 * post-login token bounces back to a URL that serves no app.
 *
 * Prefer the live location when it still sits under the mount (preserves the in-app deep route);
 * otherwise fall back to `document.baseURI` — the mount, which the router cannot clobber. With no
 * `<base>` element (the Studio UI), `document.baseURI` is the document URL and its `pathname` is a
 * prefix of the live location, so the live URL is used unchanged — no behavior change there.
 */
export function authReturnUrl(): URL {
    const base = new URL(document.baseURI);
    const current = new URL(window.location.href);
    const target = current.pathname.startsWith(base.pathname) ? current : base;
    target.hash = '';
    return target;
}

/**
 * The app's mount root URL — the served `<base href>` (or the origin root for the Studio UI).
 *
 * Used for full-reload navigations that intentionally reset to the app root (logout, account /
 * project switch). Building these from a bare `/` drops a gateway-mounted app off its mount and
 * lands on a URL that serves no app; resolving against `document.baseURI` keeps the reload inside
 * the mount. For the Studio UI (no `<base>` element) `document.baseURI` is the origin root, so the
 * behavior is unchanged.
 */
export function mountRootUrl(): URL {
    const url = new URL(document.baseURI);
    url.hash = '';
    url.search = '';
    return url;
}

/**
 * The broker URL a sign-in or renewal round-trip navigates to.
 *
 * Every parameter goes on through `searchParams`, never by concatenating a query string onto
 * `centralAuth`. The endpoint is configurable, so it may already carry its own query or a
 * fragment -- and appending `?sts=...` to one of those folds the parameter into the existing value
 * or hides it in the fragment, leaving Central Auth with no `sts` at all. `searchParams` also
 * percent-encodes the values, which the interpolated URLs did not.
 */
export function buildCentralAuthRedirectUrl(
    centralAuth: string,
    stsUrl: string,
    returnUrl: URL,
    state: string,
    selection: AuthSelection = {},
): URL {
    const selectedReturnUrl = new URL(returnUrl);
    if (selection.projectId) selectedReturnUrl.searchParams.set('p', selection.projectId);
    if (selection.accountId) selectedReturnUrl.searchParams.set('a', selection.accountId);

    const url = new URL(centralAuth);
    url.searchParams.set('sts', stsUrl);
    url.searchParams.set('redirect_uri', selectedReturnUrl.toString());
    url.searchParams.set('state', state);
    return url;
}

/**
 * A short-lived marker saying "a Central Auth round-trip is in flight for this browser".
 *
 * It exists for the server that generates index.html. Preload hints are markup, so they start
 * fetching before any script runs: a page load that is going to bounce off to the broker cannot
 * avoid downloading the application by any decision made in the page itself. The server can, but
 * only if it can tell the outgoing leg from the return leg -- and the token comes back in the URL
 * *fragment*, which a server never sees. Hence a cookie: set here, immediately before navigating to
 * the broker, and cleared by the app as soon as it mounts.
 *
 * It carries no identity and grants nothing; it is a hint about which of two page loads this is.
 * The TTL bounds the cost of the case where the app never mounts (the visitor abandons the login
 * screen): after it lapses, cold loads are back to withholding the application preloads.
 */
const AUTH_ROUND_TRIP_COOKIE = 'vtsauth';
const AUTH_ROUND_TRIP_TTL_SECONDS = 300;

function authRoundTripCookie(value: string, maxAgeSeconds: number): string {
    // Secure only over https: setting it on http://localhost would make the browser drop the
    // cookie, and local development would silently lose the return-leg preloads.
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    return `${AUTH_ROUND_TRIP_COOKIE}=${value}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

/** Record that this browser is on its way to the broker. Called for you by {@link redirectToCentralAuth}. */
export function markCentralAuthRoundTripStarted(): void {
    // biome-ignore lint/suspicious/noDocumentCookie: CookieStore is async; this must land before location.replace()
    document.cookie = authRoundTripCookie('1', AUTH_ROUND_TRIP_TTL_SECONDS);
}

/**
 * Drop the marker. An app calls this once it is actually rendering, so that its *next* cold load is
 * recognized as an outgoing leg again and does not preload an application it is about to discard.
 */
export function clearCentralAuthRoundTripMarker(): void {
    // biome-ignore lint/suspicious/noDocumentCookie: pairs with the write above; see that comment.
    document.cookie = authRoundTripCookie('', 0);
}

/**
 * Start a Central Auth round-trip for the current page.
 *
 * The single place the broker URL is assembled, so the boot-time shortcut in an app's entry module
 * and {@link isCentralAuthRedirectPending}'s counterpart inside `UserSessionProvider` cannot drift
 * into producing different `redirect_uri` / `state` / `sts` values for the same page load.
 */
export function redirectToCentralAuth(selection: AuthSelection = {}): void {
    const url = buildCentralAuthRedirectUrl(
        centralAuthUrl(),
        Env.endpoints.sts ?? 'https://sts.vertesia.io',
        authReturnUrl(),
        generateAuthState(),
        selection,
    );
    markCentralAuthRoundTripStarted();
    location.replace(url.toString());
}

/**
 * Whether this page load is already certain to end in a Central Auth round-trip, decidable before
 * any application module has run.
 *
 * A fresh `UserSession` holds no token and nothing persists one across loads, so on a cold load
 * `session.isLoggedIn()` in `UserSessionProvider` is always false. Every condition that can keep
 * that provider from redirecting is therefore knowable up front, and this predicate enumerates
 * them in the same order:
 *
 *   - Firebase-allowlisted hosts sign in in place rather than at the broker;
 *   - a host app that injects a token through `Env.authTokenProvider` may not need the broker
 *     (and when its token turns out to be empty the provider still redirects — answering `false`
 *     here just lets the normal flow decide, which is the safe direction);
 *   - local development with a configured dev token skips auth entirely;
 *   - a load carrying `#token=…&state=…` *is* the return leg and must be allowed to exchange it.
 *
 * When this returns true the app is going to navigate away, so an entry module can redirect
 * immediately instead of mounting a full React tree, initializing telemetry and warming route
 * chunks that the navigation is about to discard.
 */
export function isCentralAuthRedirectPending(): boolean {
    if (!shouldRedirectToCentralAuth()) return false;
    if (Env.authTokenProvider) return false;
    if (Env.isLocalDev && Env.devAuthToken) return false;
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    return !(hashParams.get('token') && hashParams.get('state'));
}
