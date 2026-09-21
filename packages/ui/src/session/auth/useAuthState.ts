/** React wrappers for the state record shared with boot-time Central Auth redirects. */
import { useCallback } from 'react';
import { clearAuthState, generateAuthState, verifyAuthState } from './authState';

export function useAuthState() {
    const generateState = useCallback(generateAuthState, []);
    const verifyState = useCallback(verifyAuthState, []);
    const clearState = useCallback(clearAuthState, []);
    return { generateState, verifyState, clearState };
}
