import { Env } from '@vertesia/ui/env';
import { useUITranslation } from '@vertesia/ui/i18n';
import { claimOidcAutoStart, clearOidcSignOut, startOidcSignIn } from '@vertesia/ui/session';
import { useCallback, useEffect, useState } from 'react';
import { SignInStepButton, SignInStepHeader, SignInStepLayout } from './SignInPrimitives';

interface OidcSignInStepProps {
    /** A sign-in failed: wait for a click, so the page shows the error instead of trying again. */
    hasError?: boolean;
}

/**
 * The sign-in step of a page whose users all come from one OpenID Connect provider (`Env.oidc`):
 * there is no email step and no provider list, only the hand-off to that provider, which comes back
 * to this page.
 *
 * With a single provider there is nothing to choose, so the hand-off starts on its own; see
 * session/auth/oidcAutoStart.ts for when the button waits for a click instead.
 */
export function OidcSignInStep({ hasError = false }: OidcSignInStepProps) {
    const { t } = useUITranslation();
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState<string>();
    const label = Env.oidc?.label || t('auth.oidc.defaultLabel');

    const signIn = useCallback(() => {
        setStarting(true);
        setError(undefined);
        startOidcSignIn({ returnTo: window.location.href }).catch((err: unknown) => {
            setStarting(false);
            setError(err instanceof Error ? err.message : t('auth.oidc.failed'));
        });
    }, [t]);

    useEffect(() => {
        if (claimOidcAutoStart(hasError)) signIn();
    }, [hasError, signIn]);

    return (
        <SignInStepLayout centered>
            <SignInStepHeader title={t('auth.oidc.title')} />
            <SignInStepButton
                className="w-full"
                disabled={starting}
                onClick={() => {
                    clearOidcSignOut();
                    signIn();
                }}
            >
                {t('auth.continueWithProvider', { provider: label })}
            </SignInStepButton>
            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}
        </SignInStepLayout>
    );
}
