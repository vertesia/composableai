import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ startSignIn: vi.fn() }));

vi.mock('@vertesia/ui/i18n', () => ({
    useUITranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('./signInUtils', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./signInUtils')>()),
    startSignIn: mocks.startSignIn,
}));

const { default: SignInProvidersStep } = await import('./SignInProvidersStep');
const { default: SignInReturningStep } = await import('./SignInReturningStep');

const EMAIL = 'claude@reviewers.vertesia.io';

// A provider click enters the pending screen before the redirect starts. When the address turns
// out to belong to a password tenant there is no redirect, so the step must hand over to the
// password step instead of leaving the user on the pending spinner.
describe('password-required after a provider click', () => {
    afterEach(() => {
        mocks.startSignIn.mockReset();
        document.body.innerHTML = '';
    });

    it('routes the provider list to the password step', async () => {
        mocks.startSignIn.mockResolvedValue({ ok: false, reason: 'password-required' });
        const onPasswordRequired = vi.fn();
        render(
            <SignInProvidersStep
                email={EMAIL}
                onBack={vi.fn()}
                onProviderClicked={vi.fn()}
                onPasswordRequired={onPasswordRequired}
            />,
        );

        fireEvent.click(screen.getAllByRole('button', { name: /auth.continueWithProvider/ })[0]);

        await waitFor(() => expect(onPasswordRequired).toHaveBeenCalledWith(EMAIL));
    });

    it('routes a returning user with a stale provider to the password step', async () => {
        mocks.startSignIn.mockResolvedValue({ ok: false, reason: 'password-required' });
        const onProviderClicked = vi.fn();
        const onPasswordRequired = vi.fn();
        render(
            <SignInReturningStep
                session={{ email: EMAIL, lastProvider: 'google' }}
                onNotYou={vi.fn()}
                onProviderClicked={onProviderClicked}
                onPasswordRequired={onPasswordRequired}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: /auth.continueWithProvider/ }));

        await waitFor(() => expect(onPasswordRequired).toHaveBeenCalledWith(EMAIL));
        expect(onProviderClicked).toHaveBeenCalledWith('google');
    });

    it('does not leave the redirect path when the sign-in started', async () => {
        mocks.startSignIn.mockResolvedValue({ ok: true });
        const onPasswordRequired = vi.fn();
        render(
            <SignInReturningStep
                session={{ email: EMAIL, lastProvider: 'google' }}
                onNotYou={vi.fn()}
                onProviderClicked={vi.fn()}
                onPasswordRequired={onPasswordRequired}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: /auth.continueWithProvider/ }));

        await waitFor(() => expect(mocks.startSignIn).toHaveBeenCalledOnce());
        expect(onPasswordRequired).not.toHaveBeenCalled();
    });
});
