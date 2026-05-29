import { useUITranslation } from '@vertesia/ui/i18n';
import { LoginProviderButton } from './LoginPrimitives';
import { type ProviderId, providerLabel, startPersonalSignIn, startSignIn } from './loginUtils';

interface LoginProviderSignInButtonProps {
    provider: ProviderId;
    /** Email for the tenant-aware flow. Omit for personal OAuth (e.g. SignInModal). */
    email?: string;
    redirectTo?: string;
    variant?: 'outline' | 'filled';
    /** Fired on click, before the redirect. */
    onClick?: () => void;
}

// "Continue with <provider>" button that owns its sign-in redirect.
export default function LoginProviderSignInButton({
    provider,
    email,
    redirectTo,
    variant = 'outline',
    onClick,
}: LoginProviderSignInButtonProps) {
    const { t } = useUITranslation();
    const label =
        provider === 'oidc'
            ? t('auth.continueWithSignIn')
            : t('auth.continueWithProvider', { provider: providerLabel(provider) });

    const signIn = () => {
        onClick?.();
        if (email) {
            void startSignIn(provider, email, redirectTo);
        } else {
            // OIDC needs a resolved tenant; the no-email path is only hit by personal-OAuth buttons.
            startPersonalSignIn(provider, redirectTo);
        }
    };

    return <LoginProviderButton provider={provider} label={label} onClick={signIn} variant={variant} />;
}
