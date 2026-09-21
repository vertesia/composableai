import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateAuthState, verifyAuthState } from './authState';
import { useAuthState } from './useAuthState';

afterEach(() => {
    sessionStorage.clear();
    vi.useRealTimers();
});

describe('shared auth state', () => {
    it('lets the provider hook verify and clear state generated before React mounts', () => {
        const state = generateAuthState();
        const { result } = renderHook(() => useAuthState());
        expect(result.current.verifyState(state)).toBeUndefined();
        result.current.clearState();
        expect(verifyAuthState(state)).toContain('State mismatched');
        expect(sessionStorage.getItem('auth_state_expiry')).toBeNull();
    });

    it('keeps hook-generated state compatible with the shared verifier', () => {
        const { result } = renderHook(() => useAuthState());
        const state = result.current.generateState();
        expect(verifyAuthState(state)).toBeUndefined();
        expect(verifyAuthState(null)).toBe('Missing state');
        expect(verifyAuthState('wrong')).toContain('State mismatched');
    });

    it('rejects the recorded state after the existing five-minute lifetime', () => {
        vi.useFakeTimers();
        const state = generateAuthState();
        vi.advanceTimersByTime(5 * 60 * 1000 + 1);
        expect(verifyAuthState(state)).toBe('State expired');
    });
});
