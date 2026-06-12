import { useUITranslation } from '@vertesia/ui/i18n';
import {
    SignInAccountCard,
    SignInAccountRow,
    SignInInitialsBadge,
    SignInProviderButton,
    SignInStepButton,
    SignInStepHeader,
    SignInStepLayout,
} from './SignInPrimitives';
import {
    emailInitial,
    firstNameFromEmail,
    type LastSuccessfulLogin,
    type ProviderId,
    providerLabel,
    startSignIn,
} from './signInUtils';

interface SignInReturningStepProps {
    session: LastSuccessfulLogin;
    onNotYou: () => void;
    onProviderClicked: (provider: ProviderId) => void;
    redirectTo?: string;
}

export default function SignInReturningStep({
    session,
    onNotYou,
    onProviderClicked,
    redirectTo,
}: SignInReturningStepProps) {
    const { t } = useUITranslation();
    const firstName = session.name ? session.name.split(' ')[0] || session.name : firstNameFromEmail(session.email);
    const displayName = session.name || firstNameFromEmail(session.email);
    const avatar = <SignInInitialsBadge initials={emailInitial(session.email)} />;
    // A stored tenantName means we resolved the user's organization.
    const hasTenant = !!session.tenantName;
    const primaryLabel =
        session.lastProvider === 'oidc'
            ? t('auth.continueWithSignIn')
            : t('auth.continueWithProvider', { provider: providerLabel(session.lastProvider) });

    const continueWith = async (provider: ProviderId) => {
        onProviderClicked(provider);
        await startSignIn(provider, session.email, redirectTo);
    };

    return (
        <SignInStepLayout>
            <SignInStepHeader
                eyebrow={t('auth.returning.eyebrow')}
                title={t('auth.returning.title', { name: firstName })}
                body={t('auth.returning.body')}
            />

            {hasTenant && session.tenantName ? (
                <SignInAccountCard
                    variant="returning"
                    badge={avatar}
                    title={displayName}
                    subtitle={session.tenantName}
                    email={session.email}
                    actionLabel={t('auth.returning.notYou')}
                    onAction={onNotYou}
                />
            ) : (
                <SignInAccountRow
                    badge={avatar}
                    title={displayName}
                    subtitle={session.email}
                    actionLabel={t('auth.returning.notYou')}
                    onAction={onNotYou}
                />
            )}

            <div className="flex flex-col gap-2">
                <SignInProviderButton
                    provider={session.lastProvider}
                    label={primaryLabel}
                    onClick={() => continueWith(session.lastProvider)}
                    variant="filled"
                />
                <SignInStepButton variant="ghost" onClick={onNotYou}>
                    {t('auth.returning.useDifferent')}
                </SignInStepButton>
            </div>
        </SignInStepLayout>
    );
}
