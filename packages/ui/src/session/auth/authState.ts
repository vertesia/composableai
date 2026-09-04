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

/** Mint a state value and record it for {@link verifyAuthState}. */
export function generateAuthState(): string {
    const state = crypto.randomUUID();
    sessionStorage.setItem(AUTH_STATE_KEY, state);
    sessionStorage.setItem(STATE_EXPIRY_KEY, String(Date.now() + STATE_TTL));
    return state;
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
