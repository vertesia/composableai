import { useUITranslation } from '@vertesia/ui/i18n';
import { ProviderButton } from './LoginPrimitives';
import { startPersonalSignIn, startSignIn } from './loginUtils';

interface GoogleSignInButtonProps {
    /** When set, sign-in goes through the tenant-aware flow and the IdP pre-selects this account. */
    email?: string;
    redirectTo?: string;
    /** Visual style of the underlying ProviderButton. Defaults to "outline". */
    variant?: 'outline' | 'filled';
    /** Fired on click, before the redirect — for analytics / pending-screen state. */
    onClick?: () => void;
}

export default function GoogleSignInButton({
    email,
    redirectTo,
    variant = 'outline',
    onClick,
}: GoogleSignInButtonProps) {
    const { t } = useUITranslation();

    const signIn = () => {
        onClick?.();
        // With an email: tenant-aware flow (resolves tenant, writes pendingSignin /
        // tenantName, login hint). Without: personal OAuth (e.g. SignInModal).
        if (email) {
            void startSignIn('google', email, redirectTo);
        } else {
            startPersonalSignIn('google', redirectTo);
        }
    };

    return <ProviderButton provider="google" label={t('auth.continueWithGoogle')} onClick={signIn} variant={variant} />;
}
