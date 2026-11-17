/**
 * The `state` parameter binding a Central Auth round-trip to the tab that started it.
 *
 * Plain functions rather than a hook, because the round-trip is not always started from a
 * component: an expired session is renewed from the token layer, which has no React context to
 * call {@link useAuthState} from. The hook wraps these so both paths write the same record.
 */

const AUTH_STATE_KEY = 'auth_state';
const STATE_EXPIRY_KEY = 'auth_state_expiry';
const STATE_TTL = 5 * 60 * 1000; // 5 min
const RETURN_HASH_KEY = 'auth_return_hash';
const RETURN_HASH_EXPIRY_KEY = 'auth_return_hash_expiry';

/**
 * Mint a state value and record it for {@link verifyAuthState}. Also remembers the page's hash: the
 * round-trip returns with `#token=…&state=…` in its place, so a deep link to a tab
 * (`/settings/projects/applications#mcp`) would otherwise lose its tab on every cold load.
 */
export function generateAuthState(): string {
    const state = crypto.randomUUID();
    sessionStorage.setItem(AUTH_STATE_KEY, state);
    sessionStorage.setItem(STATE_EXPIRY_KEY, String(Date.now() + STATE_TTL));
    try {
        rememberReturnHash((window.location.hash ?? '').slice(1));
    } catch {
        // Best effort: without storage the round-trip still signs the user in, only on the page's default tab.
    }
    return state;
}

function rememberReturnHash(hash: string): void {
    // A hash of `key=value` pairs is not a page location and may carry a credential (the handoff itself is
    // `token=…&state=…`), so it is never stored.
    if (!hash || hash.includes('=')) {
        sessionStorage.removeItem(RETURN_HASH_KEY);
        sessionStorage.removeItem(RETURN_HASH_EXPIRY_KEY);
        return;
    }
    sessionStorage.setItem(RETURN_HASH_KEY, hash);
    sessionStorage.setItem(RETURN_HASH_EXPIRY_KEY, String(Date.now() + STATE_TTL));
}

/**
 * The hash of the page that started the round-trip, once: reading it forgets it. Undefined when there
 * was none, or when it is older than the round-trip's state.
 */
export function takeAuthReturnHash(): string | undefined {
    const hash = sessionStorage.getItem(RETURN_HASH_KEY);
    const expiry = parseInt(sessionStorage.getItem(RETURN_HASH_EXPIRY_KEY) || '0', 10);
    sessionStorage.removeItem(RETURN_HASH_KEY);
    sessionStorage.removeItem(RETURN_HASH_EXPIRY_KEY);
    return hash && Date.now() <= expiry ? hash : undefined;
}

/** The reason `returnedState` is unacceptable, or undefined when it is good. */
export function verifyAuthState(returnedState: string | null): string | undefined {
    if (!returnedState) {
        return 'Missing state';
    }

    const savedState = sessionStorage.getItem(AUTH_STATE_KEY);
    const expiryTime = parseInt(sessionStorage.getItem(STATE_EXPIRY_KEY) || '0', 10);

    if (savedState !== returnedState) {
        return `State mismatched (${savedState} !== ${returnedState})`;
    }
    if (Date.now() > expiryTime) {
        return 'State expired';
    }
    return undefined;
}

export function clearAuthState(): void {
    sessionStorage.removeItem(AUTH_STATE_KEY);
    sessionStorage.removeItem(STATE_EXPIRY_KEY);
}
