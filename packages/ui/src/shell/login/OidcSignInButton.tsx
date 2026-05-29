import { useUITranslation } from '@vertesia/ui/i18n';
import { LoginProviderButton } from './LoginPrimitives';
import { startPersonalSignIn, startSignIn } from './loginUtils';

interface OidcSignInButtonProps {
    /** Matched tenant's email. Required in practice — OIDC only renders post-match. */
    email?: string;
    redirectTo?: string;
    /** Button variant. */
    variant?: 'outline' | 'filled';
    /** Fired on click, before the redirect. */
    onClick?: () => void;
}

// Generic OIDC ("Continue with Sign In") button. Tenant-scoped only — no personal form.
export default function OidcSignInButton({ email, redirectTo, variant = 'outline', onClick }: OidcSignInButtonProps) {
    const { t } = useUITranslation();

    const signIn = () => {
        onClick?.();
        if (email) {
            void startSignIn('oidc', email, redirectTo);
        } else {
            // OIDC needs a resolved tenant; this no-email path isn't reachable normally.
            startPersonalSignIn('oidc', redirectTo);
        }
    };

    return (
        <LoginProviderButton provider="oidc" label={t('auth.continueWithSignIn')} onClick={signIn} variant={variant} />
    );
}
