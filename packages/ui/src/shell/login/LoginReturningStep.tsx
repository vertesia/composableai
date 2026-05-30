import { useUITranslation } from '@vertesia/ui/i18n';
import {
    LoginAccountCard,
    LoginAccountRow,
    LoginInitialsBadge,
    LoginProviderButton,
    LoginStepButton,
    LoginStepHeader,
    LoginStepLayout,
} from './LoginPrimitives';
import {
    emailInitial,
    firstNameFromEmail,
    type LastSession,
    type ProviderId,
    providerLabel,
    startSignIn,
} from './loginUtils';

interface LoginReturningStepProps {
    session: LastSession;
    onNotYou: () => void;
    onProviderClicked: (provider: ProviderId) => void;
    redirectTo?: string;
}

export default function LoginReturningStep({
    session,
    onNotYou,
    onProviderClicked,
    redirectTo,
}: LoginReturningStepProps) {
    const { t } = useUITranslation();
    const firstName = session.name ? session.name.split(' ')[0]! : firstNameFromEmail(session.email);
    const displayName = session.name || firstNameFromEmail(session.email);
    const avatar = <LoginInitialsBadge initials={emailInitial(session.email)} />;
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
        <LoginStepLayout>
            <LoginStepHeader
                eyebrow={t('auth.returning.eyebrow')}
                title={t('auth.returning.title', { name: firstName })}
                body={t('auth.returning.body')}
            />

            {hasTenant && session.tenantName ? (
                <LoginAccountCard
                    variant="returning"
                    badge={avatar}
                    title={displayName}
                    subtitle={session.tenantName}
                    email={session.email}
                    actionLabel={t('auth.returning.notYou')}
                    onAction={onNotYou}
                />
            ) : (
                <LoginAccountRow
                    badge={avatar}
                    title={displayName}
                    subtitle={session.email}
                    actionLabel={t('auth.returning.notYou')}
                    onAction={onNotYou}
                />
            )}

            <div className="flex flex-col gap-2">
                <LoginProviderButton
                    provider={session.lastProvider}
                    label={primaryLabel}
                    onClick={() => continueWith(session.lastProvider)}
                    variant="filled"
                />
                <LoginStepButton variant="ghost" onClick={onNotYou}>
                    {t('auth.returning.useDifferent')}
                </LoginStepButton>
            </div>
        </LoginStepLayout>
    );
}
