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
});
