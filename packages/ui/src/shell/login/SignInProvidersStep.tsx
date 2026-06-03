import { useUITranslation } from '@vertesia/ui/i18n';
import { SignInEmailRow, SignInProviderButton, SignInStepHeader, SignInStepLayout } from './SignInPrimitives';
import { type ProviderId, providerLabel, startSignIn } from './signInUtils';

interface SignInProvidersStepProps {
    email: string;
    onBack: () => void;
    onProviderClicked: (provider: ProviderId) => void;
    redirectTo?: string;
}

const PROVIDERS: ProviderId[] = ['google', 'github', 'microsoft'];

export default function SignInProvidersStep({
    email,
    onBack,
    onProviderClicked,
    redirectTo,
}: SignInProvidersStepProps) {
    const { t } = useUITranslation();

    const pick = async (provider: ProviderId) => {
        onProviderClicked(provider);
        await startSignIn(provider, email, redirectTo);
    };

    return (
        <SignInStepLayout>
            <SignInStepHeader
                eyebrow={t('auth.providers.eyebrow')}
                title={t('auth.providers.title')}
                body={t('auth.providers.bodyConsumer')}
            />

            <SignInEmailRow email={email} actionLabel={t('auth.change')} onAction={onBack} />

            <div className="flex flex-col gap-2">
                {PROVIDERS.map((id) => (
                    <SignInProviderButton
                        key={id}
                        provider={id}
                        label={t('auth.continueWithProvider', { provider: providerLabel(id) })}
                        onClick={() => pick(id)}
                        variant="arrow"
                    />
                ))}
            </div>
        </SignInStepLayout>
    );
}
