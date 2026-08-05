import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SignInRecoveryStep from './SignInRecoveryStep';

const translations: Record<string, string> = {
    'auth.recovery.scopeProject.eyebrow': 'Link Unavailable',
    'auth.recovery.scopeProject.title': 'Project not available',
    'auth.recovery.scopeProject.body':
        'You’re signed in, but the project in this link isn’t available. The link may be outdated, or you may not have access.',
    'auth.recovery.scopeAccount.eyebrow': 'Link Unavailable',
    'auth.recovery.scopeAccount.title': 'Account not available',
    'auth.recovery.scopeAccount.body': 'Account unavailable body',
    'auth.recovery.noAccessibleAccount.eyebrow': 'Account Required',
    'auth.recovery.noAccessibleAccount.title': 'No account is available',
    'auth.recovery.noAccessibleAccount.body': 'No accessible account body',
    'auth.recovery.credential.eyebrow': 'Sign-In Required',
    'auth.recovery.credential.title': 'Your sign-in could not be verified',
    'auth.recovery.credential.body': 'Credential body',
    'auth.recovery.service.eyebrow': 'Service Unavailable',
    'auth.recovery.service.title': "We couldn't complete sign-in",
    'auth.recovery.service.body': 'Service body',
    'auth.recovery.continue': 'Continue to Vertesia',
    'auth.recovery.tryAgain': 'Try again',
    'auth.recovery.useDifferentAccount': 'Use a different account',
    'auth.recovery.supportPrefix': 'If you need help, contact',
    'auth.recovery.technicalDetails': 'Technical details',
    'auth.recovery.errorCode': 'Error code',
    'auth.recovery.httpStatus': 'HTTP status',
    'auth.recovery.requestedAccount': 'Requested account',
    'auth.recovery.requestedProject': 'Requested project',
    'auth.recovery.errorMessage': 'Error message',
    'auth.returning.notYou': 'Not you?',
};

vi.mock('@vertesia/ui/i18n', () => ({
    useUITranslation: () => ({ t: (key: string) => translations[key] ?? key }),
}));

describe('SignInRecoveryStep', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('shows project-safe copy, focuses the primary action, and prevents duplicate submissions', () => {
        const onContinue = vi.fn();
        render(<SignInRecoveryStep kind="scopeProject" onContinue={onContinue} onUseDifferentAccount={vi.fn()} />);

        expect(screen.getByText('Project not available')).toBeTruthy();
        expect(screen.getByText(/project in this link isn’t available/)).toBeTruthy();
        const continueButton = screen.getByRole('button', { name: 'Continue to Vertesia' });
        expect(document.activeElement).toBe(continueButton);

        fireEvent.click(continueButton);
        fireEvent.click(continueButton);

        expect(onContinue).toHaveBeenCalledOnce();
        expect((continueButton as HTMLButtonElement).disabled).toBe(true);
    });

    it('omits continue for an identity with no accessible account and includes support guidance', () => {
        const onUseDifferentAccount = vi.fn();
        render(<SignInRecoveryStep kind="noAccessibleAccount" onUseDifferentAccount={onUseDifferentAccount} />);

        expect(screen.queryByRole('button', { name: 'Continue to Vertesia' })).toBeNull();
        expect(screen.getByText('No account is available')).toBeTruthy();
        expect(screen.getByRole('link', { name: 'support@vertesiahq.com' }).getAttribute('href')).toBe(
            'mailto:support@vertesiahq.com',
        );
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Use a different account' }));
    });

    it('shows submitted selectors and the normalized server error in collapsed technical details', () => {
        render(
            <SignInRecoveryStep
                details={{
                    accountId: 'apple',
                    errorCode: 'requested_scope_unavailable',
                    message: 'The requested account or project is not available.',
                    projectId: 'banana',
                    status: 403,
                }}
                kind="scopeProject"
                onContinue={vi.fn()}
                onUseDifferentAccount={vi.fn()}
            />,
        );

        const disclosure = screen.getByText('Technical details').closest('details');
        expect(disclosure?.hasAttribute('open')).toBe(false);
        expect(screen.getByText('requested_scope_unavailable')).toBeTruthy();
        expect(screen.getByText('apple')).toBeTruthy();
        expect(screen.getByText('banana')).toBeTruthy();
        expect(screen.getByText('The requested account or project is not available.')).toBeTruthy();
    });

    it('reuses the returning-user identity row for the authenticated credential', () => {
        const onUseDifferentAccount = vi.fn();
        render(
            <SignInRecoveryStep
                identity={{ email: 'leon@example.com', name: 'Leon Ruggiero' }}
                kind="scopeProject"
                onContinue={vi.fn()}
                onUseDifferentAccount={onUseDifferentAccount}
            />,
        );

        expect(screen.getByText('Leon Ruggiero')).toBeTruthy();
        expect(screen.getByText('leon@example.com')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Not you?' }));
        expect(onUseDifferentAccount).toHaveBeenCalledOnce();
    });
});
