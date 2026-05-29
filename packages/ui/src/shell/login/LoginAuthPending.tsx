import { Spinner } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { providerIcon } from './LoginIcons';
import { LoginStepButton, LoginStepHeader, LoginStepLayout } from './LoginPrimitives';
import { type ProviderId, providerLabel } from './loginUtils';

interface LoginAuthPendingProps {
    provider: ProviderId;
    onCancel?: () => void;
}

export default function LoginAuthPending({ provider, onCancel }: LoginAuthPendingProps) {
    const { t } = useUITranslation();
    const Icon = providerIcon(provider);
    // OIDC has no brand name to drop into "Redirecting to X" — the title needs
    // a noun phrase ("Sign-In Provider"), unlike the button CTA context where
    // providerLabel's "Sign In" reads fine ("Continue with Sign In").
    const titleProvider = provider === 'oidc' ? 'Sign-In Provider' : providerLabel(provider);

    return (
        <LoginStepLayout centered>
            <div>
                <div className="inline-grid place-items-center size-14 rounded-xl bg-info-background border border-info/15 mb-3.5">
                    <Icon className={provider === 'oidc' ? 'size-6 text-info' : 'size-6'} />
                </div>
                <LoginStepHeader
                    title={t('auth.pending.title', { provider: titleProvider })}
                    body={t('auth.pending.body')}
                />
            </div>

            <div className="w-full flex flex-col gap-2">
                <LoginStepButton variant="loading">
                    <Spinner />
                    <span>{t('auth.pending.authenticating')}</span>
                </LoginStepButton>
                {onCancel && (
                    <LoginStepButton variant="ghost" onClick={onCancel}>
                        {t('auth.pending.cancel')}
                    </LoginStepButton>
                )}
            </div>
        </LoginStepLayout>
    );
}
