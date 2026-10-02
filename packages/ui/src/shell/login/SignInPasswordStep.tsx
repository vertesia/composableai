import { Spinner } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { ArrowRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
    SignInEmailRow,
    SignInPasswordField,
    SignInStepButton,
    SignInStepHeader,
    SignInStepLayout,
} from './SignInPrimitives';
import { type PasswordSignInFailure, signInWithPassword } from './signInUtils';

interface SignInPasswordStepProps {
    email: string;
    tenantName?: string;
    onBack: () => void;
}

/** Password sign-in for an address whose tenant issues passwords instead of federating an IdP. */
export default function SignInPasswordStep({ email, tenantName, onBack }: SignInPasswordStepProps) {
    const { t } = useUITranslation();
    const [password, setPassword] = useState('');
    const [failure, setFailure] = useState<PasswordSignInFailure | null>(null);
    const [emptyError, setEmptyError] = useState(false);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading) return;
        if (!password) {
            setEmptyError(true);
            return;
        }
        setEmptyError(false);
        setFailure(null);
        setLoading(true);
        const result = await signInWithPassword(email, password);
        if (!result.ok) {
            setFailure(result.reason);
            setLoading(false);
        }
        // On success the spinner stays up: the session's auth-state listener finishes the login and
        // unmounts this screen.
    };

    // Literal keys, one per failure, so i18next-cli extraction sees every message.
    const failureMessage = (reason: PasswordSignInFailure) => {
        switch (reason) {
            case 'invalid-credentials':
                return t('auth.password.invalidCredentials');
            case 'too-many-attempts':
                return t('auth.password.tooManyAttempts');
            case 'not-password-tenant':
                return t('auth.password.notAvailable');
            case 'failed':
                return t('auth.password.failed');
        }
    };
    const error = emptyError ? t('auth.password.required') : failure ? failureMessage(failure) : undefined;

    return (
        <SignInStepLayout>
            <SignInStepHeader
                eyebrow={tenantName ?? t('auth.password.eyebrow')}
                title={t('auth.password.title')}
                body={t('auth.password.body')}
            />

            <SignInEmailRow email={email} actionLabel={t('auth.change')} onAction={onBack} />

            <form onSubmit={submit} noValidate className={`flex flex-col ${error ? 'gap-2' : 'gap-6'}`}>
                <SignInPasswordField
                    inputRef={inputRef}
                    label={t('auth.password.label')}
                    value={password}
                    onChange={(value) => {
                        setPassword(value);
                        if (emptyError) setEmptyError(false);
                    }}
                    invalid={!!error}
                    error={error}
                />

                <SignInStepButton type="submit" disabled={loading}>
                    {loading ? (
                        <Spinner />
                    ) : (
                        <>
                            <span>{t('auth.password.submit')}</span>
                            <ArrowRight className="!size-3.5" />
                        </>
                    )}
                </SignInStepButton>
            </form>
        </SignInStepLayout>
    );
}
