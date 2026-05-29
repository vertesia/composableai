import { useUITranslation } from '@vertesia/ui/i18n';
import { getFirebaseAuth } from '@vertesia/ui/session';
import { GithubAuthProvider, signInWithRedirect } from 'firebase/auth';
import { ProviderButton } from './LoginPrimitives';
import { startSignIn } from './loginUtils';

interface GitHubSignInButtonProps {
    /** When set, sign-in goes through the tenant-aware flow and the IdP pre-selects this account. */
    email?: string;
    redirectTo?: string;
    /** Visual style of the underlying ProviderButton. Defaults to "outline". */
    variant?: 'outline' | 'filled';
    /** Fired on click, before the redirect — for analytics / pending-screen state. */
    onClick?: () => void;
}

export default function GitHubSignInButton({
    email,
    redirectTo,
    variant = 'outline',
    onClick,
}: GitHubSignInButtonProps) {
    const { t } = useUITranslation();

    const signIn = () => {
        onClick?.();
        if (email) {
            void startSignIn('github', email, redirectTo);
            return;
        }
        localStorage.removeItem('tenantName');
        const provider = new GithubAuthProvider();
        provider.addScope('profile');
        provider.addScope('email');
        void signInWithRedirect(getFirebaseAuth(), provider);
    };

    return <ProviderButton provider="github" label={t('auth.continueWithGithub')} onClick={signIn} variant={variant} />;
}
