import { useUITranslation } from '@vertesia/ui/i18n';
import { SignInEmailRow, SignInProviderButton, SignInStepHeader, SignInStepLayout } from './SignInPrimitives';
import { type ProviderId, providerLabel, type RedirectProviderId, startSignIn } from './signInUtils';

interface SignInProvidersStepProps {
    email: string;
    onBack: () => void;
    onProviderClicked: (provider: ProviderId) => void;
    /** The address resolved to a password tenant on retry, so the parent shows the password step. */
    onPasswordRequired: (email: string) => void;
    redirectTo?: string;
}

const PROVIDERS: RedirectProviderId[] = ['google', 'github', 'microsoft'];

export default function SignInProvidersStep({
    email,
    onBack,
    onProviderClicked,
    onPasswordRequired,
    redirectTo,
}: SignInProvidersStepProps) {
    const { t } = useUITranslation();

    const pick = async (provider: RedirectProviderId) => {
        onProviderClicked(provider);
        const result = await startSignIn(provider, email, redirectTo);
        if (!result.ok && result.reason === 'password-required') onPasswordRequired(email);
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
