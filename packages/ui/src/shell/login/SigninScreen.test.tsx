import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Button } from '@vertesia/ui/core';
import { Env } from '@vertesia/ui/env';
import { CredentialError } from '@vertesia/ui/session';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SignInScreenViewProps, SigninScreen } from './SigninScreen';

const session = {
    isLoading: false,
    user: undefined as { name: string } | undefined,
    authError: undefined as Error | undefined,
    signOut: vi.fn(),
};
vi.mock('@vertesia/ui/session', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@vertesia/ui/session')>()),
    useUserSession: () => session,
    useUXTracking: () => ({ trackEvent: vi.fn() }),
}));
vi.mock('./signInUtils', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./signInUtils')>()),
    resetSignInState: vi.fn().mockResolvedValue(undefined),
}));

function CustomSignIn({ flow, onUseDifferentAccount, notice }: SignInScreenViewProps) {
    return (
        <main>
            <h1>My application login</h1>
            <p>Mode: {flow.mode}</p>
            <Button onClick={() => flow.onProceedFromEmail('person@example.com')}>Continue with email</Button>
            <Button onClick={onUseDifferentAccount}>Change identity</Button>
            {notice}
        </main>
    );
}

describe('custom sign-in presentation', () => {
    beforeEach(() => {
        Env.init({
            version: '1.0.0',
            isLocalDev: true,
            isDocker: false,
            type: 'development',
            name: 'Test application',
            endpoints: {
                studio: 'https://studio.example.test',
                zeno: 'https://store.example.test',
                sts: 'https://sts.example.test',
            },
        });
        session.isLoading = false;
        session.user = undefined;
        session.authError = undefined;
        session.signOut.mockClear();
        localStorage.clear();
        sessionStorage.clear();
        history.replaceState({}, '', '/app/deep-link');
    });
    afterEach(cleanup);

    it('replaces the complete page and drives the existing flow while preserving the return path', () => {
        const view = render(<SigninScreen preservePath View={CustomSignIn} />);
        expect(view.container.firstElementChild?.tagName).toBe('MAIN');
        expect(screen.queryByText('Privacy Policy')).toBeNull();
        expect(screen.getByText('Mode: email')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Continue with email' }));
        expect(screen.getByText('Mode: providers')).toBeTruthy();
        expect(window.location.pathname).toBe('/app/deep-link');
    });

    it('keeps session gating in shared code for custom views', () => {
        session.isLoading = true;
        const view = render(<SigninScreen preservePath View={CustomSignIn} />);
        expect(screen.queryByText('My application login')).toBeNull();
        session.isLoading = false;
        view.rerender(<SigninScreen preservePath View={CustomSignIn} />);
        expect(screen.getByText('My application login')).toBeTruthy();
        session.user = { name: 'Signed-in user' };
        view.rerender(<SigninScreen preservePath View={CustomSignIn} />);
        expect(screen.queryByText('My application login')).toBeNull();
    });

    it('retains allowed-path and transient-error suppression for custom views', () => {
        const view = render(<SigninScreen allowedPrefix="/app/" View={CustomSignIn} />);
        expect(screen.queryByText('My application login')).toBeNull();
        session.authError = new Error('Transient failure');
        view.rerender(<SigninScreen suppressAuthErrorPrefix="/app/" View={CustomSignIn} />);
        expect(screen.queryByText('My application login')).toBeNull();
    });

    it('exposes dedicated recovery modes and working identity reset even on a suppressed path', async () => {
        session.authError = new CredentialError('Expired credential', 'https://sts.example.test');
        render(<SigninScreen preservePath suppressAuthErrorPrefix="/app/" View={CustomSignIn} />);
        expect(await screen.findByText('Mode: credentialFailure')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Change identity' }));
        await waitFor(() => expect(session.signOut).toHaveBeenCalledOnce());
        expect(screen.getByText('Mode: email')).toBeTruthy();
    });

    it('continues to render the default page when no override is supplied', () => {
        render(<SigninScreen preservePath />);
        expect(screen.queryByText('My application login')).toBeNull();
        expect(screen.getByRole('link', { name: /privacy policy/i })).toBeTruthy();
    });
});
