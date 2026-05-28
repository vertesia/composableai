import { useUITranslation } from '@vertesia/ui/i18n';
import { Mail } from 'lucide-react';
import { useState } from 'react';
import {
    InlineLinkButton,
    OutlinedProviderButton,
    PlainLinkButton,
    ProviderButton,
    StepHeader,
    StepLayout,
} from './LoginPrimitives';
import {
    emailInitial,
    firstNameFromEmail,
    type LastSession,
    type ProviderId,
    providerLabel,
    startSignIn,
} from './loginUtils';

interface ReturningStepProps {
    session: LastSession;
    onNotYou: () => void;
    onProviderClicked: (provider: ProviderId) => void;
    redirectTo?: string;
}

export default function ReturningStep({ session, onNotYou, onProviderClicked, redirectTo }: ReturningStepProps) {
    const { t } = useUITranslation();
    const [showOthers, setShowOthers] = useState(false);
    const firstName = session.name ? session.name.split(' ')[0]! : firstNameFromEmail(session.email);
    // tenantName presence indicates the previous sign-in went through SSO. The
    // button itself looks the same as the personal case — SSO context is
    // conveyed by the tenant card above the button, not by button styling.
    const isSso = !!session.tenantName;
    const primaryLabel = t('auth.continueWithProvider', { provider: providerLabel(session.lastProvider) });

    // "Other ways" alternatives only show personal-OAuth IdPs. OIDC has no
    // personal-OAuth path (it's tenant-driven only) so it's excluded.
    const others: ProviderId[] = (['google', 'github', 'microsoft'] as ProviderId[]).filter(
        (p) => p !== session.lastProvider,
    );

    const continueWith = async (provider: ProviderId) => {
        onProviderClicked(provider);
        await startSignIn(provider, session.email, redirectTo);
    };

    return (
        <StepLayout>
            <StepHeader
                eyebrow={t('auth.returning.eyebrow')}
                title={t('auth.returning.title', { name: firstName })}
                body={t('auth.returning.body')}
            />

            {isSso && session.tenantName ? (
                // Two-part user+org card. Top: avatar + name + company. Bottom:
                // Mail icon + email + "Not you?". Shape mirrors TenantStep so
                // both screens read with the same rhythm.
                <div className="rounded-md border border-border bg-background overflow-hidden">
                    <div className="flex items-center gap-3 px-3.5 py-2.5">
                        <div className="size-9 rounded-full bg-info text-info-foreground grid place-items-center text-sm font-semibold ring-4 ring-background ring-offset-1 ring-offset-border shrink-0">
                            {emailInitial(session.email)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-foreground truncate">
                                {session.name || firstNameFromEmail(session.email)}
                            </div>
                            <div className="text-xs text-foreground/80 truncate">{session.tenantName}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 px-3.5 py-1 border-t border-border bg-muted-background">
                        <div className="w-9 h-6 grid place-items-center shrink-0">
                            <Mail className="size-3.5 text-muted" />
                        </div>
                        <span className="text-xs text-foreground/80 flex-1 truncate">{session.email}</span>
                        <InlineLinkButton size="smaller" onClick={onNotYou}>
                            {t('auth.returning.notYou')}
                        </InlineLinkButton>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-md border border-border bg-muted-background">
                    <div className="size-9 rounded-full bg-info text-info-foreground grid place-items-center text-sm font-semibold ring-4 ring-background ring-offset-1 ring-offset-border shrink-0">
                        {emailInitial(session.email)}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-foreground truncate">
                            {session.name || firstNameFromEmail(session.email)}
                        </div>
                        <div className="text-xs text-muted truncate">{session.email}</div>
                    </div>
                    <InlineLinkButton onClick={onNotYou}>{t('auth.returning.notYou')}</InlineLinkButton>
                </div>
            )}

            <div className="flex flex-col gap-2">
                <ProviderButton
                    provider={session.lastProvider}
                    label={primaryLabel}
                    onClick={() => continueWith(session.lastProvider)}
                    variant="filled"
                />

                {!showOthers && (
                    <PlainLinkButton onClick={() => setShowOthers(true)}>
                        {t('auth.returning.useDifferent')}
                    </PlainLinkButton>
                )}

                {showOthers && (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3 my-2 text-muted-foreground text-[10.5px] uppercase tracking-widest">
                            <div className="flex-1 h-px bg-border" />
                            <span>{t('auth.returning.otherWays')}</span>
                            <div className="flex-1 h-px bg-border" />
                        </div>
                        {others.map((p) => (
                            <OutlinedProviderButton
                                key={p}
                                provider={p}
                                label={t('auth.continueWithProvider', { provider: providerLabel(p) })}
                                onClick={() => continueWith(p)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </StepLayout>
    );
}
