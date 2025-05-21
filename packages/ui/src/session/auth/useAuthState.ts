
/**
 * This hook is used to generate and verify state for OAuth2 authorization requests.
 * @returns 
 */

import { useCallback } from "react";


const AUTH_STATE_KEY = 'auth_state';
const STATE_EXPIRY_KEY = 'auth_state_expiry';
const STATE_TTL = 5 * 60 * 1000; // 5 min


export function useAuthState() {
    // Generate new state
    const generateState = useCallback(() => {
        const state = crypto.randomUUID();
        const expiryTime = Date.now() + STATE_TTL;
        
        // Store state and expiry
        sessionStorage.setItem(AUTH_STATE_KEY, state);
        sessionStorage.setItem(STATE_EXPIRY_KEY, expiryTime.toString());
        
        return state;
    }, []);

    // Verify returned state
    const verifyState = useCallback((returnedState: string | null): string | undefined => {
        if (!returnedState) {
            return 'Missing state';
        }

        const savedState = sessionStorage.getItem(AUTH_STATE_KEY);
        const expiryTime = parseInt(sessionStorage.getItem(STATE_EXPIRY_KEY) || '0');
        let reason: string | undefined;

        // Verify state matches and hasn't expired
        if (savedState !== returnedState) {
            reason = `State mismatched (${savedState} !== ${returnedState})`;
        } else if (Date.now() > expiryTime) {
            reason = 'State expired';
        } else {
            reason = undefined; // No errors
        }

        // Clear stored state regardless of outcome
        sessionStorage.removeItem(AUTH_STATE_KEY);
        sessionStorage.removeItem(STATE_EXPIRY_KEY);

        return reason;
    }, []);

    // Clear state (useful for cleanup)
    const clearState = useCallback(() => {
        sessionStorage.removeItem(AUTH_STATE_KEY);
        sessionStorage.removeItem(STATE_EXPIRY_KEY);
    }, []);

    return { generateState, verifyState, clearState };
}
