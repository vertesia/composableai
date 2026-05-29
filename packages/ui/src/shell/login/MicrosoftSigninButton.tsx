import { useUITranslation } from '@vertesia/ui/i18n';
import { LoginProviderButton } from './LoginPrimitives';
import { startPersonalSignIn, startSignIn } from './loginUtils';

interface MicrosoftSignInButtonProps {
    /** Email for the tenant-aware flow (pre-selects the account). */
    email?: string;
    redirectTo?: string;
    /** Button variant. */
    variant?: 'outline' | 'filled';
    /** Fired on click, before the redirect. */
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
        } else {
            startPersonalSignIn('microsoft', redirectTo);
        }
    };

    return (
        <LoginProviderButton
            provider="microsoft"
            label={t('auth.continueWithMicrosoft')}
            onClick={signIn}
            variant={variant}
        />
    );
}
