/**
 * Whether a sign-in page (the broker's, or an application's own) may send the user to the OIDC
 * provider without waiting for a click.
 *
 * On a deployment with one provider the sign-in page has a single button, so it starts the sign-in
 * itself: a user who opens Studio or an application from an Okta or My Apps tile is already signed in
 * at the provider, which sends them straight back, and they never see the sign-in page. Three cases
 * keep the button:
 *
 * - after a sign-out from this origin. The provider's own session outlives it, so starting the
 *   sign-in would sign the user back in at once. The first click clears this, in every tab of the
 *   browser.
 * - after a failed sign-in, so the error is shown rather than retried.
 * - right after an automatic start in this tab. Being back on the sign-in page that soon means the
 *   round-trip did not end in a session, and starting it again would loop.
 */

const SIGNED_OUT_KEY = 'vertesia.oidc.signed_out';
const AUTO_STARTED_AT_KEY = 'vertesia.oidc.auto_started_at';
/** An automatic start this recent, in the same tab, is not repeated. */
export const AUTO_START_COOLDOWN_MS = 60_000;

export interface AutoStartStorage {
    /** Shared by the browser's tabs, like the sign-out it records. */
    local: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
    /** This tab only, like the sign-in round-trip. */
    session: Pick<Storage, 'getItem' | 'setItem'>;
}

function browserStorage(): AutoStartStorage {
    return { local: localStorage, session: sessionStorage };
}

/**
 * Whether to start the sign-in now, and if so record it. Recording it is what keeps the next call,
 * from React's second effect run or a sign-in page reached again after the round-trip, from
 * starting another.
 */
export function claimOidcAutoStart(
    hasError: boolean,
    storage: AutoStartStorage = browserStorage(),
    now = Date.now(),
): boolean {
    try {
        if (hasError || storage.local.getItem(SIGNED_OUT_KEY)) return false;
        const last = Number(storage.session.getItem(AUTO_STARTED_AT_KEY));
        if (last && now - last >= 0 && now - last < AUTO_START_COOLDOWN_MS) return false;
        storage.session.setItem(AUTO_STARTED_AT_KEY, String(now));
        return true;
    } catch {
        // Storage refused (a locked-down browser): the button still works, so do nothing on our own.
        return false;
    }
}

/** Keep the next sign-in page from starting a sign-in until the user asks for one. */
export function recordOidcSignOut(storage: AutoStartStorage = browserStorage()): void {
    try {
        storage.local.setItem(SIGNED_OUT_KEY, '1');
    } catch {
        // Without storage, the next sign-in page may sign the user back in through the provider.
    }
}

/** The user asked to sign in: later sign-in pages may start on their own again. */
export function clearOidcSignOut(storage: AutoStartStorage = browserStorage()): void {
    try {
        storage.local.removeItem(SIGNED_OUT_KEY);
    } catch {
        // Nothing recorded, then.
    }
}
