import { useUITranslation } from '@vertesia/ui/i18n';
import { Mail } from 'lucide-react';
import { LoginInlineLinkButton, LoginProviderButton, LoginStepHeader, LoginStepLayout } from './LoginPrimitives';
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

            <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-muted-background">
                <Mail className="size-4 text-muted shrink-0" />
                <span className="text-sm text-foreground/80 flex-1 truncate">{email}</span>
                <LoginInlineLinkButton onClick={onBack}>{t('auth.change')}</LoginInlineLinkButton>
            </div>

            <div className="flex flex-col gap-2">
                {PROVIDERS.map((id) => (
                    <LoginProviderButton
                        key={id}
                        provider={id}
                        label={t('auth.continueWithProvider', { provider: providerLabel(id) })}
                        onClick={() => pick(id)}
                        variant="arrow"
                        arrowSlide
                    />
                ))}
            </div>
        </LoginStepLayout>
    );
}
