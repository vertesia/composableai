import { useUITranslation } from '@vertesia/ui/i18n';
import { SignInProviderButton } from './LoginPrimitives';
import { startPersonalSignIn, startSignIn } from './loginUtils';

interface MicrosoftSignInButtonProps {
    /** When set, sign-in goes through the tenant-aware flow and the IdP pre-selects this account. */
    email?: string;
    redirectTo?: string;
    /** Visual style of the underlying SignInProviderButton. Defaults to "outline". */
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
        } else {
            startPersonalSignIn('microsoft', redirectTo);
        }
    };

    return (
        <SignInProviderButton
            provider="microsoft"
            label={t('auth.continueWithMicrosoft')}
            onClick={signIn}
            variant={variant}
        />
    );
}
