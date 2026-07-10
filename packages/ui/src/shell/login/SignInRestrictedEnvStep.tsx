import { useUITranslation } from '@vertesia/ui/i18n';
import { ShieldOff } from 'lucide-react';
import { getProductionAppUrl } from './productionUrl';
import { SignInCallout, SignInStepButton, SignInStepHeader, SignInStepLayout } from './SignInPrimitives';

interface SignInRestrictedEnvStepProps {
    /** Signed-in email, shown in the callout when known. */
    email?: string;
}

/**
 * Shown when the STS rejects sign-in because the current environment (preview/preprod) is
 * restricted to early-access users. Offers a redirect to the production web application, where
 * the user's identity is valid. See docs/restrict-access-to-non-production-envs.md.
 */
export default function SignInRestrictedEnvStep({ email }: SignInRestrictedEnvStepProps) {
    const { t } = useUITranslation();

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
            </div>
        </SignInStepLayout>
    );
}
