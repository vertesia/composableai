import { useUITranslation } from '@vertesia/ui/i18n';
import { LoginProviderButton } from './LoginPrimitives';
import { startPersonalSignIn, startSignIn } from './loginUtils';

interface GitHubSignInButtonProps {
    /** Email for the tenant-aware flow (pre-selects the account). */
    email?: string;
    redirectTo?: string;
    /** Button variant. */
    variant?: 'outline' | 'filled';
    /** Fired on click, before the redirect. */
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
        } else {
            startPersonalSignIn('github', redirectTo);
        }
    };

    return (
        <LoginProviderButton
            provider="github"
            label={t('auth.continueWithGithub')}
            onClick={signIn}
            variant={variant}
        />
    );
}
