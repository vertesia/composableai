import { useUITranslation } from '@vertesia/ui/i18n';
import { ShieldOff } from 'lucide-react';
import { SignInCallout, SignInStepButton, SignInStepHeader, SignInStepLayout } from './SignInPrimitives';
import { capitalizeFirst, emailDomain } from './signInUtils';

interface SignInTenantBlockedStepProps {
    email: string;
    /** Tenant display name if known. Falls back to a generic phrase if not. */
    tenantName?: string;
    onBack: () => void;
}

export default function SignInTenantBlockedStep({ email, tenantName, onBack }: SignInTenantBlockedStepProps) {
    const { t } = useUITranslation();
    // Without a tenant name: subheading uses the i18n fallback, callout uses "<Domain> Team".
    const subheadingName = tenantName || t('auth.blocked.tenantFallback');
    const domain = emailDomain(email);
    const boxName =
        tenantName ||
        (domain
            ? t('auth.blocked.teamFromDomain', { domain: capitalizeFirst(domain) })
            : t('auth.blocked.tenantFallback'));

    return (
        <SignInStepLayout>
            <SignInStepHeader
                variant="destructive"
                eyebrow={t('auth.blocked.eyebrow')}
                title={t('auth.blocked.title')}
                body={t('auth.blocked.body', { name: subheadingName, email })}
            />

            <div className="flex flex-col gap-2">
                <SignInCallout icon={ShieldOff} title={boxName} meta={t('auth.blocked.tenantMeta', { email })} />
                <SignInStepButton variant="ghost" onClick={onBack}>
                    {t('auth.blocked.useDifferent')}
                </SignInStepButton>
            </div>
        </SignInStepLayout>
    );
}
