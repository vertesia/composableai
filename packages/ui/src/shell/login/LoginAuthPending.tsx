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
    // OIDC has no brand name for the title; use a generic noun phrase.
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
