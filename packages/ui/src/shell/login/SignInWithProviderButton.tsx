import { useUITranslation } from '@vertesia/ui/i18n';
import { SignInProviderButton } from './SignInPrimitives';
import { providerLabel, type RedirectProviderId, startSignIn, startSignInWithoutTenant } from './signInUtils';

interface SignInWithProviderButtonProps {
    provider: RedirectProviderId;
    /** Email for the tenant-aware flow. Omit for a no-tenant sign-in (e.g. SignInModal). */
    email?: string;
    redirectTo?: string;
    variant?: 'outline' | 'filled';
    /** Fired on click, before the redirect. */
    onClick?: () => void;
    /** Fired instead of a redirect when the email resolves to a password tenant. */
    onPasswordRequired?: () => void;
}

// "Continue with <provider>" button that owns its sign-in redirect.
export default function SignInWithProviderButton({
    provider,
    email,
    redirectTo,
    variant = 'outline',
    onClick,
    onPasswordRequired,
}: SignInWithProviderButtonProps) {
    const { t } = useUITranslation();
    const label =
        provider === 'oidc'
            ? t('auth.continueWithSignIn')
            : t('auth.continueWithProvider', { provider: providerLabel(provider) });

    const signIn = async () => {
        onClick?.();
        if (!email) {
            // OIDC needs a resolved tenant; the no-email path is only hit by no-tenant buttons.
            startSignInWithoutTenant(provider, redirectTo);
            return;
        }
        const result = await startSignIn(provider, email, redirectTo);
        if (!result.ok && result.reason === 'password-required') onPasswordRequired?.();
    };

    return <SignInProviderButton provider={provider} label={label} onClick={() => void signIn()} variant={variant} />;
}
