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
