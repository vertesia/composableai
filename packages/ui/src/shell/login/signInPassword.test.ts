import { FirebaseError } from 'firebase/app';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    auth: { tenantId: null as string | null },
    setFirebaseTenant: vi.fn(),
    signInWithEmailAndPassword: vi.fn(),
    signInWithRedirect: vi.fn(),
}));

vi.mock('@vertesia/ui/session', () => ({
    getFirebaseAuth: () => mocks.auth,
    setFirebaseTenant: mocks.setFirebaseTenant,
}));

vi.mock('firebase/auth', async (importOriginal) => ({
    ...(await importOriginal<typeof import('firebase/auth')>()),
    signInWithEmailAndPassword: mocks.signInWithEmailAndPassword,
    signInWithRedirect: mocks.signInWithRedirect,
}));

const { passwordFailureReason, readPendingSignin, signInWithPassword, startSignIn } = await import('./signInUtils');

const PASSWORD_TENANT = {
    label: 'Vertesia Reviewers',
    name: 'reviewers',
    firebaseTenantId: 'reviewers-abc12',
    provider: 'password',
    domain: ['reviewers.vertesia.io'],
};
const OIDC_TENANT = { ...PASSWORD_TENANT, label: 'Acme', name: 'acme', provider: 'oidc', domain: ['acme.com'] };
const EMAIL = 'claude@reviewers.vertesia.io';

describe('passwordFailureReason', () => {
    // One answer for every credential failure, so the form cannot be used to probe which
    // addresses exist or are disabled.
    it.each([
        'auth/invalid-credential',
        'auth/wrong-password',
        'auth/user-not-found',
        'auth/user-disabled',
        'auth/invalid-email',
    ])('folds %s into invalid-credentials', (code) => {
        expect(passwordFailureReason(new FirebaseError(code, code))).toBe('invalid-credentials');
    });

    it('reports throttling separately', () => {
        expect(passwordFailureReason(new FirebaseError('auth/too-many-requests', 'throttled'))).toBe(
            'too-many-attempts',
        );
    });

    it('treats anything else as a generic failure', () => {
        expect(passwordFailureReason(new FirebaseError('auth/network-request-failed', 'offline'))).toBe('failed');
        expect(passwordFailureReason(new Error('boom'))).toBe('failed');
        expect(passwordFailureReason(undefined)).toBe('failed');
    });
});

describe('signInWithPassword', () => {
    beforeEach(() => {
        mocks.setFirebaseTenant.mockReset();
        mocks.signInWithEmailAndPassword.mockReset();
        mocks.signInWithRedirect.mockReset();
    });

    afterEach(() => {
        sessionStorage.clear();
        localStorage.clear();
    });

    it('signs a password-tenant user in place and records the pending sign-in', async () => {
        mocks.setFirebaseTenant.mockResolvedValue(PASSWORD_TENANT);
        mocks.signInWithEmailAndPassword.mockResolvedValue({});

        await expect(signInWithPassword(EMAIL, 'secret')).resolves.toEqual({ ok: true });

        expect(mocks.setFirebaseTenant).toHaveBeenCalledWith(EMAIL);
        expect(mocks.signInWithEmailAndPassword).toHaveBeenCalledWith(mocks.auth, EMAIL, 'secret');
        expect(readPendingSignin()).toEqual({
            email: EMAIL,
            provider: 'password',
            tenantName: 'Vertesia Reviewers',
        });
        expect(mocks.signInWithRedirect).not.toHaveBeenCalled();
    });

    // The password form is reachable only through tenant resolution, but the helper re-checks: an
    // address that resolves to a federated tenant must never be offered a password.
    it('refuses an address whose tenant is not a password tenant', async () => {
        mocks.setFirebaseTenant.mockResolvedValue(OIDC_TENANT);

        await expect(signInWithPassword('someone@acme.com', 'secret')).resolves.toEqual({
            ok: false,
            reason: 'not-password-tenant',
        });
        expect(mocks.signInWithEmailAndPassword).not.toHaveBeenCalled();
    });

    it('fails without signing in when the tenant cannot be resolved', async () => {
        mocks.setFirebaseTenant.mockResolvedValue(undefined);

        await expect(signInWithPassword(EMAIL, 'secret')).resolves.toEqual({ ok: false, reason: 'failed' });
        expect(mocks.signInWithEmailAndPassword).not.toHaveBeenCalled();
    });

    it('clears the pending sign-in when Firebase rejects the credential', async () => {
        mocks.setFirebaseTenant.mockResolvedValue(PASSWORD_TENANT);
        mocks.signInWithEmailAndPassword.mockRejectedValue(new FirebaseError('auth/invalid-credential', 'bad'));

        await expect(signInWithPassword(EMAIL, 'wrong')).resolves.toEqual({
            ok: false,
            reason: 'invalid-credentials',
        });
        expect(readPendingSignin()).toBeNull();
    });
});

describe('startSignIn', () => {
    beforeEach(() => {
        mocks.setFirebaseTenant.mockReset();
        mocks.signInWithRedirect.mockReset();
    });

    // A returning session's stored provider can go stale; a password tenant has nowhere to redirect.
    it('does not redirect when the address resolves to a password tenant', async () => {
        mocks.setFirebaseTenant.mockResolvedValue(PASSWORD_TENANT);

        await expect(startSignIn('google', EMAIL)).resolves.toEqual({ ok: false, reason: 'password-required' });
        expect(mocks.signInWithRedirect).not.toHaveBeenCalled();
        expect(readPendingSignin()).toBeNull();
    });
});
