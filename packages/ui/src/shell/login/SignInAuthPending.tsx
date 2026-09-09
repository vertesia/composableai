import { Spinner } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { providerIcon } from './SignInIcons';
import { SignInIconBadge, SignInStepButton, SignInStepHeader, SignInStepLayout } from './SignInPrimitives';
import { type ProviderId, providerLabel } from './signInUtils';

interface SignInAuthPendingProps {
    provider: ProviderId;
    onCancel?: () => void;
}

export default function SignInAuthPending({ provider, onCancel }: SignInAuthPendingProps) {
    const { t } = useUITranslation();
    const Icon = providerIcon(provider);
    // OIDC has no brand name for the title; use a generic noun phrase.
    const titleProvider = provider === 'oidc' ? t('auth.pending.genericProvider') : providerLabel(provider);

    return (
        <SignInStepLayout centered>
            <div>
                <SignInIconBadge>
                    <Icon className={provider === 'oidc' ? 'size-6 text-info' : 'size-6'} />
                </SignInIconBadge>
                <SignInStepHeader
                    title={t('auth.pending.title', { provider: titleProvider })}
                    body={t('auth.pending.body')}
                />
            </div>

            <div className="w-full flex flex-col gap-2">
                <SignInStepButton variant="loading">
                    <Spinner />
                    <span>{t('auth.pending.authenticating')}</span>
                </SignInStepButton>
                {onCancel && (
                    <SignInStepButton variant="ghost" onClick={onCancel}>
                        {t('auth.pending.cancel')}
                    </SignInStepButton>
                )}
            </div>
        </SignInStepLayout>
    );
}
