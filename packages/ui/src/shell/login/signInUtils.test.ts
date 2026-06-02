import { describe, expect, it } from 'vitest';
import { isInviteRequiredError } from './signInUtils';

// The server's 403 message. The token fetch (composable.ts) re-wraps it as
// `new Error('Failed to get composable token', { cause })`, so the matcher must
// walk the cause chain — this is what makes the blocked-screen route fire.
const INVITE_MESSAGE = 'Customer-domain user requires an invite to join';

describe('isInviteRequiredError', () => {
    it('matches the invite-required error directly', () => {
        expect(isInviteRequiredError(new Error(INVITE_MESSAGE))).toBe(true);
    });

    it('matches when the message is wrapped in a cause (the real token-fetch path)', () => {
        const wrapped = new Error('Failed to get composable token', { cause: new Error(INVITE_MESSAGE) });
        expect(isInviteRequiredError(wrapped)).toBe(true);
    });

    it('matches when nested deeper in the cause chain', () => {
        const deep = new Error('outer', { cause: new Error('mid', { cause: new Error(INVITE_MESSAGE) }) });
        expect(isInviteRequiredError(deep)).toBe(true);
    });

    it('returns false for unrelated errors', () => {
        expect(isInviteRequiredError(new Error('Failed to get composable token'))).toBe(false);
        expect(isInviteRequiredError(new Error('User not found'))).toBe(false);
    });

    it('returns false for null, undefined, and non-error values', () => {
        expect(isInviteRequiredError(null)).toBe(false);
        expect(isInviteRequiredError(undefined)).toBe(false);
        expect(isInviteRequiredError('just a string')).toBe(false);
    });

    it('terminates on a circular cause chain', () => {
        const a = new Error('a');
        const b = new Error('b', { cause: a });
        (a as { cause?: unknown }).cause = b;
        expect(isInviteRequiredError(a)).toBe(false);
    });
});
