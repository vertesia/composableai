import { useUITranslation } from '@vertesia/ui/i18n';
import { SignInProviderButton } from './LoginPrimitives';
import { providerLabel, startPersonalSignIn, startSignIn } from './loginUtils';

interface OidcSignInButtonProps {
    /**
     * The matched tenant's email. OIDC is tenant-scoped, so this is effectively
     * required in practice — the button only renders after a tenant with
     * provider `oidc` has been matched, which is where the email comes from.
     */
    email?: string;
    redirectTo?: string;
    /** Visual style of the underlying SignInProviderButton. Defaults to "outline". */
    variant?: 'outline' | 'filled';
    /** Fired on click, before the redirect — for analytics / pending-screen state. */
    onClick?: () => void;
}

// Generic OIDC ("Continue with Sign In") provider button. Unlike Google/Microsoft/GitHub,
// OIDC has no personal form — it only exists tenant-scoped. With an email, startSignIn
// resolves the tenant (setting auth.tenantId), writes pendingSignin/tenantName, and
// passes the login hint before redirecting to the tenant's `oidc.main` IdP.
export default function OidcSignInButton({ email, redirectTo, variant = 'outline', onClick }: OidcSignInButtonProps) {
    const { t } = useUITranslation();

    const signIn = () => {
        onClick?.();
        if (email) {
            void startSignIn('oidc', email, redirectTo);
        } else {
            // Degenerate: OIDC needs a tenant, so this path shouldn't be reached
            // (the button only renders post-match). Kept for prop-shape parity.
            startPersonalSignIn('oidc', redirectTo);
        }
    };

    return (
        <SignInProviderButton
            provider="oidc"
            label={t('auth.continueWithProvider', { provider: providerLabel('oidc') })}
            onClick={signIn}
            variant={variant}
        />
    );
}
