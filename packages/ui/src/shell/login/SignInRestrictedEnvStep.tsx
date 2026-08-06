import { Env } from '@vertesia/ui/env';
import { useUITranslation } from '@vertesia/ui/i18n';
import { ShieldOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getProductionAppUrl } from './productionUrl';
import { SignInCallout, SignInStepButton, SignInStepHeader, SignInStepLayout } from './SignInPrimitives';
import { resetSignInState } from './signInUtils';

interface SignInRestrictedEnvStepProps {
    /** Return to the email-entry step to sign in with a different account. */
    onUseDifferentEmail: () => void;
}

/** Seconds of inactivity on this screen before the user is redirected to production automatically. */
const AUTO_REDIRECT_SECONDS = 15;

/**
 * Shown when the STS rejects sign-in because the current environment (any non-production tier) is
 * restricted to early-access users. Offers a redirect to the production web application — in the
 * user's own region — and a way to sign in with a different account. If the user takes no action, it
 * redirects automatically after {@link AUTO_REDIRECT_SECONDS}. See
 * docs/restrict-access-to-non-production-envs.md.
 */
export default function SignInRestrictedEnvStep({ onUseDifferentEmail }: SignInRestrictedEnvStepProps) {
    const { t } = useUITranslation();
    // Region-aware: send the user to their own region's production site, never another region's (an
    // EU user must not be redirected to the US site). Falls back to the canonical site when unknown.
    const productionUrl = getProductionAppUrl(Env.region);
    const [secondsLeft, setSecondsLeft] = useState(AUTO_REDIRECT_SECONDS);

    // Clear the rejected session (Firebase sign-out + cached login) once the screen is shown, so a
    // page reload restarts the normal sign-in flow instead of re-triggering the STS 403 and landing
    // straight back here. `mode` in SigninScreen is sticky, so clearing the session does not hide
    // this screen in the current session.
    useEffect(() => {
        void resetSignInState();
    }, []);

    // Auto-redirect to production after AUTO_REDIRECT_SECONDS of inactivity. Taking an action —
    // "Use a different email" unmounts this step, "Go to the main site" redirects immediately — runs
    // the cleanup below and cancels the timer, so the automatic redirect only fires on inactivity.
    useEffect(() => {
        const redirect = setTimeout(() => {
            window.location.href = productionUrl;
        }, AUTO_REDIRECT_SECONDS * 1000);
        const countdown = setInterval(() => {
            setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
        }, 1000);
        return () => {
            clearTimeout(redirect);
            clearInterval(countdown);
        };
    }, [productionUrl]);

    return (
        <SignInStepLayout>
            <SignInStepHeader
                variant="destructive"
                eyebrow={t('auth.restricted.eyebrow')}
                title={t('auth.restricted.title')}
                body={t('auth.restricted.body')}
            />

            <div className="flex flex-col gap-2">
                <SignInCallout
                    icon={ShieldOff}
                    title={t('auth.restricted.calloutTitle')}
                    meta={t('auth.restricted.calloutMeta')}
                />
                <SignInStepButton
                    className="w-full"
                    onClick={() => {
                        window.location.href = productionUrl;
                    }}
                >
                    {t('auth.restricted.redirect')}
                </SignInStepButton>
                <SignInStepButton variant="ghost" onClick={onUseDifferentEmail}>
                    {t('auth.restricted.useDifferent')}
                </SignInStepButton>
                <p className="text-center text-xs text-muted">
                    {t('auth.restricted.autoRedirect', { seconds: secondsLeft })}
                </p>
            </div>
        </SignInStepLayout>
    );
}
