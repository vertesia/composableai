import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const getFirebaseAuth = vi.hoisted(() => vi.fn());

vi.mock('@vertesia/ui/i18n', () => ({
    useUITranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@vertesia/ui/session', () => ({ getFirebaseAuth }));

vi.mock('@vertesia/ui/core', () => ({
    Button: ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
        <button type="button" onClick={onClick}>
            {children}
        </button>
    ),
    Input: () => null,
    SelectBox: () => null,
    RadioGroup: ({ options, onSelect }: { options: { id: string }[]; onSelect: (option: { id: string }) => void }) => (
        <>
            {options.map((option) => (
                <button key={option.id} type="button" onClick={() => onSelect(option)}>
                    {option.id}
                </button>
            ))}
        </>
    ),
}));

const { default: SignupForm } = await import('./SignupForm');

describe('SignupForm', () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
        localStorage.clear();
    });

    // After a sign-in through the central broker the provider session lives on the broker's origin, so the form must
    // sign up with the token it is given. On a deployment without Firebase, touching Firebase would throw.
    it('signs up with the given ID token and never reads a Firebase session', async () => {
        const onSignup = vi.fn();
        render(
            <SignupForm
                idToken="provider-id-token"
                identity={{ email: 'jane.doe@example.gov', displayName: 'Jane Doe' }}
                onSignup={onSignup}
                goBack={vi.fn()}
            />,
        );

        fireEvent.click(screen.getByText('personal'));
        fireEvent.click(screen.getByText('signup.signUp'));

        await waitFor(() =>
            expect(onSignup).toHaveBeenCalledWith(
                expect.objectContaining({ accountType: 'personal' }),
                'provider-id-token',
            ),
        );
        expect(getFirebaseAuth).not.toHaveBeenCalled();
    });

    it('reads the Firebase session of this page when no token is given', async () => {
        const getIdToken = vi.fn(async () => 'firebase-id-token');
        getFirebaseAuth.mockReturnValue({ currentUser: { email: 'a@b.c', displayName: 'A', getIdToken } });
        const onSignup = vi.fn();
        render(<SignupForm onSignup={onSignup} goBack={vi.fn()} />);

        fireEvent.click(screen.getByText('personal'));
        fireEvent.click(screen.getByText('signup.signUp'));

        await waitFor(() => expect(onSignup).toHaveBeenCalledWith(expect.anything(), 'firebase-id-token'));
    });
});
