import { useUITranslation } from '@vertesia/ui/i18n';
import { getFirebaseAuth } from '@vertesia/ui/session';
import { GoogleAuthProvider, signInWithRedirect } from 'firebase/auth';
import { ProviderButton } from './LoginPrimitives';
import { startSignIn } from './loginUtils';

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
        // Tenant-aware path: startSignIn resolves the tenant, writes pendingSignin /
        // tenantName, and passes the email as a login hint before redirecting.
        if (email) {
            void startSignIn('google', email, redirectTo);
            return;
        }
        // Standalone path (e.g. SignInModal, no email): direct personal OAuth.
        localStorage.removeItem('tenantName');
        let redirectPath = redirectTo || window.location.pathname || '/';
        if (redirectPath[0] !== '/') {
            redirectPath = `/${redirectPath}`;
        }
        const provider = new GoogleAuthProvider();
        provider.addScope('profile');
        provider.addScope('email');
        provider.setCustomParameters({
            prompt: 'select_account',
            redirect_uri: window.location.origin + redirectPath,
        });
        void signInWithRedirect(getFirebaseAuth(), provider);
    };

    return <ProviderButton provider="google" label={t('auth.continueWithGoogle')} onClick={signIn} variant={variant} />;
}
