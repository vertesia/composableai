import { useUITranslation } from '@vertesia/ui/i18n';
import type { TenantInfo } from './SignInEmailStep';
import {
    SignInAccountCard,
    SignInInitialsBadge,
    SignInStepButton,
    SignInStepHeader,
    SignInStepLayout,
} from './SignInPrimitives';
import SignInWithProviderButton from './SignInWithProviderButton';
import { type ProviderId, providerLabel } from './signInUtils';

interface SignInTenantStepProps {
    email: string;
    tenant: TenantInfo;
    onBack: () => void;
    onProviderClicked: () => void;
    redirectTo?: string;
}

function tenantInitials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]!.toUpperCase())
        .join('');
}

export default function SignInTenantStep({
    email,
    tenant,
    onBack,
    onProviderClicked,
    redirectTo,
}: SignInTenantStepProps) {
    const { t } = useUITranslation();
    const tenantName = tenant.label || tenant.name || t('auth.blocked.tenantFallback');
    // Brands keep their identity; anything else routes through OIDC.
    const provider: ProviderId =
        tenant.provider === 'google' || tenant.provider === 'github' || tenant.provider === 'microsoft'
            ? tenant.provider
            : 'oidc';
    const idpName = provider === 'oidc' ? t('auth.tenant.viaIdpFallback') : providerLabel(provider);

    return (
        <SignInStepLayout>
            <SignInStepHeader
                eyebrow={t('auth.tenant.eyebrow')}
                title={t('auth.tenant.title', { name: tenantName })}
                body={t('auth.tenant.body')}
            />

            <SignInAccountCard
                variant="tenant"
                badge={<SignInInitialsBadge initials={tenantInitials(tenantName)} shape="square" />}
                title={tenantName}
                subtitle={t('auth.tenant.viaIdp', { idp: idpName })}
                email={email}
                actionLabel={t('auth.change')}
                onAction={onBack}
            />

            <div className="flex flex-col gap-2">
                <SignInWithProviderButton
                    provider={provider}
                    email={email}
                    redirectTo={redirectTo}
                    variant="filled"
                    onClick={onProviderClicked}
                />
                <SignInStepButton variant="ghost" onClick={onBack}>
                    {t('auth.tenant.notPartOf', { name: tenantName })}
                </SignInStepButton>
            </div>
        </SignInStepLayout>
    );
}
