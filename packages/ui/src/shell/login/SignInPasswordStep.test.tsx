import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ signInWithPassword: vi.fn() }));

vi.mock('@vertesia/ui/i18n', () => ({
    useUITranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('./signInUtils', () => ({ signInWithPassword: mocks.signInWithPassword }));

const { default: SignInPasswordStep } = await import('./SignInPasswordStep');

const EMAIL = 'claude@reviewers.vertesia.io';

function submitWith(password: string) {
    fireEvent.change(screen.getByLabelText('auth.password.label'), { target: { value: password } });
    fireEvent.click(screen.getByRole('button', { name: /auth.password.submit/ }));
}

describe('SignInPasswordStep', () => {
    afterEach(() => {
        mocks.signInWithPassword.mockReset();
        document.body.innerHTML = '';
    });

    it('asks for a password before calling sign-in', () => {
        render(<SignInPasswordStep email={EMAIL} onBack={vi.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: /auth.password.submit/ }));

        expect(screen.getByRole('alert').textContent).toBe('auth.password.required');
        expect(mocks.signInWithPassword).not.toHaveBeenCalled();
    });

    it('shows the failure and lets the user retry', async () => {
        mocks.signInWithPassword.mockResolvedValue({ ok: false, reason: 'invalid-credentials' });
        render(<SignInPasswordStep email={EMAIL} onBack={vi.fn()} />);

        submitWith('wrong');

        await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('auth.password.invalidCredentials'));
        expect(mocks.signInWithPassword).toHaveBeenCalledWith(EMAIL, 'wrong');
        expect((screen.getByRole('button', { name: /auth.password.submit/ }) as HTMLButtonElement).disabled).toBe(
            false,
        );
    });

    // Success hands off to the session's auth-state listener, which unmounts the screen; until then
    // the button must stay disabled so a second click cannot start a second sign-in.
    it('keeps the submit disabled after a successful sign-in', async () => {
        mocks.signInWithPassword.mockResolvedValue({ ok: true });
        render(<SignInPasswordStep email={EMAIL} onBack={vi.fn()} />);

        submitWith('secret');

        await waitFor(() => expect(mocks.signInWithPassword).toHaveBeenCalledOnce());
        const submit = screen.getAllByRole('button').find((b) => (b as HTMLButtonElement).type === 'submit');
        expect((submit as HTMLButtonElement).disabled).toBe(true);
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('returns to the email step from the change link', () => {
        const onBack = vi.fn();
        render(<SignInPasswordStep email={EMAIL} onBack={onBack} />);

        fireEvent.click(screen.getByRole('button', { name: 'auth.change' }));

        expect(onBack).toHaveBeenCalledOnce();
    });
});
