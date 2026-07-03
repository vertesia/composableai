import type { UIResolvedTenant } from '@vertesia/common';
import { Spinner } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { setFirebaseTenant } from '@vertesia/ui/session';
import { ArrowRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { SignInEmailField, SignInStepButton, SignInStepHeader, SignInStepLayout } from './SignInPrimitives';
import { isValidEmail } from './signInUtils';

export type TenantInfo = UIResolvedTenant;

interface SignInEmailStepProps {
    initialEmail?: string;
    onProceed: (email: string, tenant?: TenantInfo) => void;
}

export default function SignInEmailStep({ initialEmail, onProceed }: SignInEmailStepProps) {
    const { t } = useUITranslation();
    const [email, setEmail] = useState(initialEmail ?? '');
    const [submitError, setSubmitError] = useState(false);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading) return;
        if (!isValidEmail(email)) {
            setSubmitError(true);
            return;
        }
        setSubmitError(false);
        setLoading(true);
        try {
            const tenant = await setFirebaseTenant(email.trim().toLowerCase());
            onProceed(email.trim().toLowerCase(), tenant ?? undefined);
        } catch {
            // resolveTenant failed quietly — proceed to providers panel
            onProceed(email.trim().toLowerCase(), undefined);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SignInStepLayout>
            <SignInStepHeader
                eyebrow={t('auth.email.eyebrow')}
                title={t('auth.email.title')}
                body={t('auth.email.body')}
            />

            <form onSubmit={submit} noValidate className={`flex flex-col ${submitError ? 'gap-2' : 'gap-6'}`}>
                <SignInEmailField
                    inputRef={inputRef}
                    label={t('auth.email.label')}
                    placeholder={t('auth.email.placeholder')}
                    value={email}
                    onChange={(value) => {
                        setEmail(value);
                        if (submitError) setSubmitError(false);
                    }}
                    invalid={submitError}
                    error={submitError ? t('auth.email.invalidError') : undefined}
                />

                <SignInStepButton type="submit" disabled={loading}>
                    {loading ? (
                        <Spinner />
                    ) : (
                        <>
                            <span>{t('auth.continue')}</span>
                            <ArrowRight className="!size-3.5" />
                        </>
                    )}
                </SignInStepButton>
            </form>
        </SignInStepLayout>
    );
}
