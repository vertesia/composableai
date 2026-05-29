import { useUITranslation } from '@vertesia/ui/i18n';
import { LoginProviderButton } from './LoginPrimitives';
import { startPersonalSignIn, startSignIn } from './loginUtils';

interface GoogleSignInButtonProps {
    /** Email for the tenant-aware flow (pre-selects the account). */
    email?: string;
    redirectTo?: string;
    /** Button variant. */
    variant?: 'outline' | 'filled';
    /** Fired on click, before the redirect. */
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
        // With email: tenant-aware flow. Without: personal OAuth.
        if (email) {
            void startSignIn('google', email, redirectTo);
        } else {
            startPersonalSignIn('google', redirectTo);
        }
    };

    return (
        <LoginProviderButton
            provider="google"
            label={t('auth.continueWithGoogle')}
            onClick={signIn}
            variant={variant}
        />
    );
}
