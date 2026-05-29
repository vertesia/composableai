import { useUITranslation } from '@vertesia/ui/i18n';
import { ShieldOff } from 'lucide-react';
import { SignInStepButton, StepHeader, StepLayout } from './LoginPrimitives';
import { capitalizeFirst, emailDomain } from './loginUtils';

interface TenantBlockedStepProps {
    email: string;
    /** Tenant display name if known. Falls back to a generic phrase if not. */
    tenantName?: string;
    onBack: () => void;
}

export default function TenantBlockedStep({ email, tenantName, onBack }: TenantBlockedStepProps) {
    const { t } = useUITranslation();
    // Subheading keeps the i18n fallback ("your organization"). The callout
    // box uses a "<Domain> Team" form so the user sees something concrete when
    // we don't have a real tenant name.
    const subheadingName = tenantName || t('auth.blocked.tenantFallback');
    const domain = emailDomain(email);
    const boxName = tenantName || (domain ? `${capitalizeFirst(domain)} Team` : t('auth.blocked.tenantFallback'));

    return (
        <StepLayout>
            <StepHeader
                tone="destructive"
                eyebrow={t('auth.blocked.eyebrow')}
                title={t('auth.blocked.title')}
                body={t('auth.blocked.body', { name: subheadingName, email })}
            />

            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-md bg-destructive-background border border-destructive/20">
                    <ShieldOff className="size-5 text-destructive shrink-0" />
                    <div className="flex-1 min-w-0 text-sm">
                        <div className="font-semibold text-destructive">{boxName}</div>
                        <div className="text-xs text-destructive/80">{t('auth.blocked.tenantMeta', { email })}</div>
                    </div>
                </div>
                <SignInStepButton variant="ghost" onClick={onBack}>
                    {t('auth.blocked.useDifferent')}
                </SignInStepButton>
            </div>
        </StepLayout>
    );
}
