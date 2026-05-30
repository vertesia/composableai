import { useUITranslation } from '@vertesia/ui/i18n';
import { useState } from 'react';
import {
    LoginAccountCard,
    LoginAccountRow,
    LoginInitialsBadge,
    LoginOrDivider,
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
    const [showOthers, setShowOthers] = useState(false);
    const firstName = session.name ? session.name.split(' ')[0]! : firstNameFromEmail(session.email);
    const displayName = session.name || firstNameFromEmail(session.email);
    const avatar = <LoginInitialsBadge initials={emailInitial(session.email)} />;
    // A stored tenantName means we resolved the user's organization.
    const hasTenant = !!session.tenantName;
    const primaryLabel =
        session.lastProvider === 'oidc'
            ? t('auth.continueWithSignIn')
            : t('auth.continueWithProvider', { provider: providerLabel(session.lastProvider) });

    // OIDC only exists with a tenant, so it's not offered as an alternative provider.
    const others: ProviderId[] = (['google', 'github', 'microsoft'] as ProviderId[]).filter(
        (p) => p !== session.lastProvider,
    );

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

                {!showOthers && (
                    <LoginStepButton variant="ghost" onClick={() => setShowOthers(true)}>
                        {t('auth.returning.useDifferent')}
                    </LoginStepButton>
                )}

                {showOthers && (
                    <div className="flex flex-col gap-2">
                        <LoginOrDivider>{t('auth.returning.otherWays')}</LoginOrDivider>
                        {others.map((p) => (
                            <LoginProviderButton
                                key={p}
                                provider={p}
                                label={t('auth.continueWithProvider', { provider: providerLabel(p) })}
                                onClick={() => continueWith(p)}
                                variant="arrow"
                            />
                        ))}
                    </div>
                )}
            </div>
        </LoginStepLayout>
    );
}
