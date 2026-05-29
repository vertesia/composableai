import { useUITranslation } from '@vertesia/ui/i18n';
import { Mail } from 'lucide-react';
import type { TenantInfo } from './EmailStep';
import GitHubSignInButton from './GitHubSignInButton';
import GoogleSignInButton from './GoogleSignInButton';
import { InlineLinkButton, SignInStepButton, StepHeader, StepLayout } from './LoginPrimitives';
import MicrosoftSignInButton from './MicrosoftSigninButton';
import OidcSignInButton from './OidcSignInButton';

interface TenantStepProps {
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

function providerDisplay(provider: string): string {
    const map: Record<string, string> = {
        google: 'Google',
        microsoft: 'Microsoft',
        oidc: 'your identity provider',
        github: 'GitHub',
    };
    return map[provider] ?? 'your identity provider';
}

export default function TenantStep({ email, tenant, onBack, onProviderClicked, redirectTo }: TenantStepProps) {
    const { t } = useUITranslation();
    const tenantName = tenant.label || tenant.name || t('auth.blocked.tenantFallback');
    const idpName = providerDisplay(tenant.provider ?? '');

    // Each tenant provider has its own self-contained button. They own the
    // sign-in (startSignIn → tenant-scoped redirect with login hint) and their
    // own canonical label; the onClick fires first for analytics + the pending
    // screen.
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
        <StepLayout>
            <StepHeader
                eyebrow={t('auth.tenant.eyebrowSso')}
                title={t('auth.tenant.title', { name: tenantName })}
                body={t('auth.tenant.bodySso')}
            />

            <div className="rounded-md border border-border bg-background overflow-hidden">
                <div className="flex items-center gap-2.5 px-3 py-2.5">
                    <span className="size-[30px] rounded-md bg-info text-info-foreground grid place-items-center text-[11px] font-semibold shrink-0">
                        {tenantInitials(tenantName)}
                    </span>
                    <div className="flex-1 min-w-0">
                        <div className="text-[13.5px] font-semibold text-foreground leading-tight">{tenantName}</div>
                        <div className="text-[11.5px] text-muted leading-tight mt-0.5">
                            {t('auth.tenant.viaIdp', { idp: idpName })}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2.5 px-3 py-1.5 border-t border-border bg-muted-background">
                    <div className="size-[30px] grid place-items-center shrink-0">
                        <Mail className="size-4 text-muted" />
                    </div>
                    <span className="text-sm text-foreground/80 flex-1 truncate">{email}</span>
                    <InlineLinkButton onClick={onBack}>{t('auth.change')}</InlineLinkButton>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                {providerButton}
                <SignInStepButton variant="ghost" onClick={onBack}>
                    {t('auth.tenant.notPartOf', { name: tenantName })}
                </SignInStepButton>
            </div>
        </StepLayout>
    );
}
