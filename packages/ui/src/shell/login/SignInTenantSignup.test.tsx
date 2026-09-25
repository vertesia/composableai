import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => {
    class UserNotFoundError extends Error {
        email: string;
        constructor(message: string, email: string) {
            super(message);
            this.email = email;
        }
    }
    class OtherAuthError extends Error {}
    return {
        UserNotFoundError,
        OtherAuthError,
        state: { authError: undefined as Error | undefined },
    };
});

vi.mock('@vertesia/ui/i18n', () => ({
    useUITranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@vertesia/ui/layout', () => ({ RegionTag: () => null }));

vi.mock('@vertesia/ui/session', () => ({
    UserNotFoundError: session.UserNotFoundError,
    AuthenticationServiceError: session.OtherAuthError,
    CredentialError: session.OtherAuthError,
    NoAccessibleAccountError: session.OtherAuthError,
    RequestedScopeUnavailableError: session.OtherAuthError,
    RestrictedEnvironmentError: session.OtherAuthError,
    useUserSession: () => ({
        isLoading: false,
        user: undefined,
        authError: session.state.authError,
        signOut: vi.fn(),
    }),
    useUXTracking: () => ({ trackEvent: vi.fn() }),
}));

vi.mock('./SignupForm', () => ({ default: () => <div>signup-form</div> }));

const { SigninScreen } = await import('./SigninScreen');

const EMAIL = 'claude@review.vertesia.io';

// A first sign-in with no invite surfaces UserNotFoundError. Outside a tenant that opens self-serve
// signup; a tenant user has no signup form, so the screen must say an invite is needed instead of
// falling back to the email step, which resolves the tenant again and restarts the sign-in.
describe('first sign-in without an invite', () => {
    afterEach(() => {
        session.state.authError = undefined;
        localStorage.clear();
        document.body.innerHTML = '';
    });

    it('shows the invite-required screen for a tenant user', async () => {
        localStorage.setItem('tenantName', 'review');
        session.state.authError = new session.UserNotFoundError('User not found - signup required', EMAIL);

        render(<SigninScreen />);

        expect(await screen.findByText('auth.blocked.title')).toBeTruthy();
        expect(screen.queryByText('signup-form')).toBeNull();
    });

    it('opens self-serve signup outside a tenant', async () => {
        session.state.authError = new session.UserNotFoundError('User not found - signup required', EMAIL);

        render(<SigninScreen />);

        expect(await screen.findByText('signup-form')).toBeTruthy();
        expect(screen.queryByText('auth.blocked.title')).toBeNull();
    });
});
