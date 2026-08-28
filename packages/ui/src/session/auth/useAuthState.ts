/**
 * This hook is used to generate and verify state for OAuth2 authorization requests.
 *
 * The implementation lives in ./authState so the token layer can start the same round-trip when it
 * renews an expired Central Auth session, where no component is available to call a hook.
 */

import { useCallback } from 'react';
import { clearAuthState, generateAuthState, verifyAuthState } from './authState';

export function useAuthState() {
    const generateState = useCallback(() => generateAuthState(), []);
    const verifyState = useCallback((returnedState: string | null) => verifyAuthState(returnedState), []);
    const clearState = useCallback(() => clearAuthState(), []);

    return { generateState, verifyState, clearState };
}
