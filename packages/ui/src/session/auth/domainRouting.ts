declare global {
    interface Window {
        AUTH_MODE?: 'firebase' | 'central';
    }
}

export function shouldUseFirebaseAuth(_hostname?: string) {
    return window.AUTH_MODE === 'firebase';
}

export function shouldRedirectToCentralAuth(_hostname?: string) {
    return !shouldUseFirebaseAuth();
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
