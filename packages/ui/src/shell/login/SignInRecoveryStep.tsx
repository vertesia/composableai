import { useUITranslation } from '@vertesia/ui/i18n';
import { AlertTriangle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
    SignInAccountRow,
    SignInIconBadge,
    SignInInitialsBadge,
    SignInStepButton,
    SignInStepHeader,
    SignInStepLayout,
} from './SignInPrimitives';
import { emailInitial, firstNameFromEmail } from './signInUtils';

export type SignInRecoveryKind = 'scopeProject' | 'scopeAccount' | 'noAccessibleAccount' | 'credential' | 'service';

export interface SignInRecoveryDetails {
    accountId?: string;
    errorCode?: string;
    message: string;
    projectId?: string;
    status?: number;
}

export interface SignInRecoveryIdentity {
    email: string;
    name?: string;
}

interface SignInRecoveryStepProps {
    details?: SignInRecoveryDetails;
    identity?: SignInRecoveryIdentity;
    kind: SignInRecoveryKind;
    onContinue?: () => void;
    onUseDifferentAccount: () => void;
}

export default function SignInRecoveryStep({
    details,
    identity,
    kind,
    onContinue,
    onUseDifferentAccount,
}: SignInRecoveryStepProps) {
    const { t } = useUITranslation();
    const [submitting, setSubmitting] = useState(false);
    const initialButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        initialButtonRef.current?.focus();
    }, []);

    const isScopeFailure = kind === 'scopeProject' || kind === 'scopeAccount';
    let copy: { eyebrow: string; title: string; body: string };
    if (kind === 'scopeProject') {
        copy = {
            eyebrow: t('auth.recovery.scopeProject.eyebrow'),
            title: t('auth.recovery.scopeProject.title'),
            body: t('auth.recovery.scopeProject.body'),
        };
    } else if (kind === 'scopeAccount') {
        copy = {
            eyebrow: t('auth.recovery.scopeAccount.eyebrow'),
            title: t('auth.recovery.scopeAccount.title'),
            body: t('auth.recovery.scopeAccount.body'),
        };
    } else if (kind === 'noAccessibleAccount') {
        copy = {
            eyebrow: t('auth.recovery.noAccessibleAccount.eyebrow'),
            title: t('auth.recovery.noAccessibleAccount.title'),
            body: t('auth.recovery.noAccessibleAccount.body'),
        };
    } else if (kind === 'credential') {
        copy = {
            eyebrow: t('auth.recovery.credential.eyebrow'),
            title: t('auth.recovery.credential.title'),
            body: t('auth.recovery.credential.body'),
        };
    } else {
        copy = {
            eyebrow: t('auth.recovery.service.eyebrow'),
            title: t('auth.recovery.service.title'),
            body: t('auth.recovery.service.body'),
        };
    }

    const runAction = (action: () => void) => {
        if (submitting) return;
        setSubmitting(true);
        action();
    };

    return (
        <SignInStepLayout>
            <div role="alert" aria-live="assertive">
                <SignInIconBadge>
                    <AlertTriangle className="size-7 text-attention" aria-hidden="true" />
                </SignInIconBadge>
                <SignInStepHeader eyebrow={copy.eyebrow} title={copy.title} body={copy.body} />
            </div>

            {identity && (
                <SignInAccountRow
                    badge={<SignInInitialsBadge initials={emailInitial(identity.email)} />}
                    title={identity.name || firstNameFromEmail(identity.email)}
                    subtitle={identity.email}
                    actionLabel={t('auth.returning.notYou')}
                    onAction={onUseDifferentAccount}
                />
            )}

            <div className="flex flex-col gap-2">
                {onContinue && (
                    <SignInStepButton
                        ref={initialButtonRef}
                        className="w-full"
                        disabled={submitting}
                        onClick={() => runAction(onContinue)}
                    >
                        {isScopeFailure ? t('auth.recovery.continue') : t('auth.recovery.tryAgain')}
                    </SignInStepButton>
                )}
                <SignInStepButton
                    ref={onContinue ? undefined : initialButtonRef}
                    variant={onContinue ? 'ghost' : 'primary'}
                    disabled={submitting}
                    onClick={() => runAction(onUseDifferentAccount)}
                >
                    {t('auth.recovery.useDifferentAccount')}
                </SignInStepButton>
                {(kind === 'noAccessibleAccount' || kind === 'service') && (
                    <p className="text-center text-xs text-muted">
                        {t('auth.recovery.supportPrefix')}{' '}
                        <a className="text-info" href="mailto:support@vertesiahq.com">
                            support@vertesiahq.com
                        </a>
                    </p>
                )}
            </div>

            {details && (
                <details className="rounded-lg border border-mixer-muted/30 bg-mixer-muted/10 px-4 py-3 text-sm">
                    <summary className="cursor-pointer font-medium text-muted marker:text-muted focus-visible:outline-2 focus-visible:outline-offset-2">
                        {t('auth.recovery.technicalDetails')}
                    </summary>
                    <dl className="mt-3 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs">
                        {details.errorCode && (
                            <>
                                <dt className="text-muted">{t('auth.recovery.errorCode')}</dt>
                                <dd className="wrap-break-word font-mono">{details.errorCode}</dd>
                            </>
                        )}
                        {details.status && (
                            <>
                                <dt className="text-muted">{t('auth.recovery.httpStatus')}</dt>
                                <dd className="font-mono">{details.status}</dd>
                            </>
                        )}
                        {details.accountId && (
                            <>
                                <dt className="text-muted">{t('auth.recovery.requestedAccount')}</dt>
                                <dd className="wrap-break-word font-mono">{details.accountId}</dd>
                            </>
                        )}
                        {details.projectId && (
                            <>
                                <dt className="text-muted">{t('auth.recovery.requestedProject')}</dt>
                                <dd className="wrap-break-word font-mono">{details.projectId}</dd>
                            </>
                        )}
                        <dt className="text-muted">{t('auth.recovery.errorMessage')}</dt>
                        <dd className="wrap-break-word font-mono">{details.message}</dd>
                    </dl>
                </details>
            )}
        </SignInStepLayout>
    );
}
