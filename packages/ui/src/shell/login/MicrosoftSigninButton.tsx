import { useUITranslation } from '@vertesia/ui/i18n';
import { getFirebaseAuth } from '@vertesia/ui/session';
import { OAuthProvider, signInWithRedirect } from 'firebase/auth';
import { ProviderButton } from './LoginPrimitives';
import { startSignIn } from './loginUtils';

interface MicrosoftSignInButtonProps {
    /** When set, sign-in goes through the tenant-aware flow and the IdP pre-selects this account. */
    email?: string;
    redirectTo?: string;
    /** Visual style of the underlying ProviderButton. Defaults to "outline". */
    variant?: 'outline' | 'filled';
    /** Fired on click, before the redirect — for analytics / pending-screen state. */
    onClick?: () => void;
}

export default function MicrosoftSignInButton({
    email,
    redirectTo,
    variant = 'outline',
    onClick,
}: MicrosoftSignInButtonProps) {
    const { t } = useUITranslation();

    const signIn = () => {
        onClick?.();
        if (email) {
            void startSignIn('microsoft', email, redirectTo);
            return;
        }
        localStorage.removeItem('tenantName');
        const provider = new OAuthProvider('microsoft.com');
        provider.addScope('profile');
        provider.addScope('email');
        void signInWithRedirect(getFirebaseAuth(), provider);
    };

    return (
        <ProviderButton
            provider="microsoft"
            label={t('auth.continueWithMicrosoft')}
            onClick={signIn}
            variant={variant}
        />
    );
}
