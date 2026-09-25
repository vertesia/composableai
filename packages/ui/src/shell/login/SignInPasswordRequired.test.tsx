import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
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
const { SignInFlowSteps, useSignInFlow } = await import('./SignInFlow');
const { writeLastSuccessfulLogin } = await import('./signInUtils');

const EMAIL = 'claude@reviewers.vertesia.io';

// A provider click enters the pending screen before the redirect starts. When the address turns
// out to belong to a password tenant there is no redirect, so the step must hand over to the
// password step instead of leaving the user on the pending spinner.
describe('password-required after a provider click', () => {
    afterEach(() => {
        mocks.startSignIn.mockReset();
        cleanup();
        localStorage.clear();
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

describe('shared password sign-in flow', () => {
    afterEach(() => {
        cleanup();
        localStorage.clear();
        mocks.startSignIn.mockReset();
    });

    it('shows password entry directly for a resolved password tenant and supports going back', () => {
        const { result } = renderHook(() => useSignInFlow());
        act(() =>
            result.current.onProceedFromEmail(EMAIL, {
                firebaseTenantId: 'password-tenant',
                name: 'Example',
                provider: 'password',
            }),
        );
        const view = render(<SignInFlowSteps flow={result.current} />);
        expect(screen.getByLabelText('auth.password.label')).toBeTruthy();
        expect(mocks.startSignIn).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'auth.change' }));
        view.rerender(<SignInFlowSteps flow={result.current} />);
        expect(screen.queryByLabelText('auth.password.label')).toBeNull();
        expect(screen.getByRole('textbox').getAttribute('value')).toBe(EMAIL);
    });

    it.each(['password', 'google'] as const)(
        'shows password entry for a returning %s user when a password is required',
        async (lastProvider) => {
            writeLastSuccessfulLogin({ email: EMAIL, lastProvider, tenantName: 'Example' });
            mocks.startSignIn.mockResolvedValue({ ok: false, reason: 'password-required' });
            function Flow() {
                const flow = useSignInFlow();
                return <SignInFlowSteps flow={flow} />;
            }
            render(<Flow />);
            fireEvent.click(
                screen.getByRole('button', {
                    name: lastProvider === 'password' ? 'auth.password.continue' : /auth.continueWithProvider/,
                }),
            );
            await waitFor(() => expect(screen.getByLabelText('auth.password.label')).toBeTruthy());
            expect(screen.getByText(EMAIL)).toBeTruthy();
        },
    );
});
