import { useUITranslation } from '@vertesia/ui/i18n';
import GitHubSignInButton from './GitHubSignInButton';
import GoogleSignInButton from './GoogleSignInButton';
import type { TenantInfo } from './LoginEmailStep';
import { LoginAccountCard, LoginStepButton, LoginStepHeader, LoginStepLayout } from './LoginPrimitives';
import { providerLabel } from './loginUtils';
import MicrosoftSignInButton from './MicrosoftSigninButton';
import OidcSignInButton from './OidcSignInButton';

interface LoginTenantStepProps {
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

export default function LoginTenantStep({
    email,
    tenant,
    onBack,
    onProviderClicked,
    redirectTo,
}: LoginTenantStepProps) {
    const { t } = useUITranslation();
    const tenantName = tenant.label || tenant.name || t('auth.blocked.tenantFallback');
    // Brands get their name; OIDC/unknown fall back to a generic localized phrase.
    const idpName =
        tenant.provider === 'google' || tenant.provider === 'github' || tenant.provider === 'microsoft'
            ? providerLabel(tenant.provider)
            : t('auth.tenant.viaIdpFallback');

    // Each provider has a self-contained button that owns its sign-in and label.
    const buttonProps = {
        email,
        redirectTo,
        variant: 'filled' as const,
        onClick: onProviderClicked,
    };
    const providerButton =
        tenant.provider === 'google' ? (
            <GoogleSignInButton {...buttonProps} />
        ) : tenant.provider === 'microsoft' ? (
            <MicrosoftSignInButton {...buttonProps} />
        ) : tenant.provider === 'github' ? (
            <GitHubSignInButton {...buttonProps} />
        ) : (
            <OidcSignInButton {...buttonProps} />
        );

    return (
        <LoginStepLayout>
            <LoginStepHeader
                eyebrow={t('auth.tenant.eyebrowSso')}
                title={t('auth.tenant.title', { name: tenantName })}
                body={t('auth.tenant.bodySso')}
            />

            <LoginAccountCard
                variant="tenant"
                badge={
                    <span className="size-[30px] rounded-md bg-info text-info-foreground grid place-items-center text-[11px] font-semibold shrink-0">
                        {tenantInitials(tenantName)}
                    </span>
                }
                title={tenantName}
                subtitle={t('auth.tenant.viaIdp', { idp: idpName })}
                email={email}
                actionLabel={t('auth.change')}
                onAction={onBack}
            />

            <div className="flex flex-col gap-2">
                {providerButton}
                <LoginStepButton variant="ghost" onClick={onBack}>
                    {t('auth.tenant.notPartOf', { name: tenantName })}
                </LoginStepButton>
            </div>
        </LoginStepLayout>
    );
}
