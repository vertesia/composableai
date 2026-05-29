import { useUITranslation } from '@vertesia/ui/i18n';
import { LoginEmailRow, LoginProviderButton, LoginStepHeader, LoginStepLayout } from './LoginPrimitives';
import { type ProviderId, providerLabel, startSignIn } from './loginUtils';

interface LoginProvidersStepProps {
    email: string;
    onBack: () => void;
    onProviderClicked: (provider: ProviderId) => void;
    redirectTo?: string;
}

const PROVIDERS: ProviderId[] = ['google', 'github', 'microsoft'];

export default function LoginProvidersStep({ email, onBack, onProviderClicked, redirectTo }: LoginProvidersStepProps) {
    const { t } = useUITranslation();

    const pick = async (provider: ProviderId) => {
        onProviderClicked(provider);
        await startSignIn(provider, email, redirectTo);
    };

    return (
        <LoginStepLayout>
            <LoginStepHeader
                eyebrow={t('auth.providers.eyebrow')}
                title={t('auth.providers.title')}
                body={t('auth.providers.bodyConsumer')}
            />

            <LoginEmailRow email={email} actionLabel={t('auth.change')} onAction={onBack} />

            <div className="flex flex-col gap-2">
                {PROVIDERS.map((id) => (
                    <LoginProviderButton
                        key={id}
                        provider={id}
                        label={t('auth.continueWithProvider', { provider: providerLabel(id) })}
                        onClick={() => pick(id)}
                        variant="arrow"
                    />
                ))}
            </div>
        </LoginStepLayout>
    );
}
