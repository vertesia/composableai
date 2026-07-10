import { useUITranslation } from '@vertesia/ui/i18n';
import { ShieldOff } from 'lucide-react';
import { useEffect } from 'react';
import { getProductionAppUrl } from './productionUrl';
import { SignInCallout, SignInStepButton, SignInStepHeader, SignInStepLayout } from './SignInPrimitives';
import { resetSignInState } from './signInUtils';

interface SignInRestrictedEnvStepProps {
    /** Signed-in email, shown in the callout when known. */
    email?: string;
    /** Return to the email-entry step to sign in with a different account. */
    onUseDifferentEmail: () => void;
}

/**
 * Shown when the STS rejects sign-in because the current environment (preview/preprod) is
 * restricted to early-access users. Offers a redirect to the production web application and a way
 * to sign in with a different account. See docs/restrict-access-to-non-production-envs.md.
 */
export default function SignInRestrictedEnvStep({ email, onUseDifferentEmail }: SignInRestrictedEnvStepProps) {
    const { t } = useUITranslation();

    // Clear the rejected session (Firebase sign-out + cached login) once the screen is shown, so a
    // page reload restarts the normal sign-in flow instead of re-triggering the STS 403 and landing
    // straight back here. `mode` in SigninScreen is sticky, so clearing the session does not hide
    // this screen in the current session.
    useEffect(() => {
        void resetSignInState();
    }, []);

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
                    meta={email || t('auth.restricted.calloutMeta')}
                />
                <SignInStepButton
                    className="w-full"
                    onClick={() => {
                        window.location.href = getProductionAppUrl();
                    }}
                >
                    {t('auth.restricted.redirect')}
                </SignInStepButton>
                <SignInStepButton variant="ghost" onClick={onUseDifferentEmail}>
                    {t('auth.restricted.useDifferent')}
                </SignInStepButton>
            </div>
        </SignInStepLayout>
    );
}
