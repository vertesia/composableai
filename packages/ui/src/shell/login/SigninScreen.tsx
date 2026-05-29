import type { SignupData, SignupPayload } from '@vertesia/common';
import { useSafeLayoutEffect } from '@vertesia/ui/core';
import { Env } from '@vertesia/ui/env';
import { useUITranslation } from '@vertesia/ui/i18n';
import { RegionTag } from '@vertesia/ui/layout';
import { UserNotFoundError, useUserSession, useUXTracking } from '@vertesia/ui/session';
import { useCallback, useEffect, useState } from 'react';
import LoginAuthPending from './LoginAuthPending';
import LoginEmailStep, { type TenantInfo } from './LoginEmailStep';
import LoginProvidersStep from './LoginProvidersStep';
import LoginReturningStep from './LoginReturningStep';
import LoginTenantBlockedStep from './LoginTenantBlockedStep';
import LoginTenantStep from './LoginTenantStep';
import {
    clearLastSession,
    clearPendingSignin,
    isInviteRequiredError,
    type LastSession,
    type ProviderId,
    readLastSession,
    readPendingSignin,
    writeLastSession,
} from './loginUtils';
import SigninPreview from './SigninPreview';
import SignupForm from './SignupForm';

interface SigninScreenProps {
    isNested?: boolean;
    allowedPrefix?: string;
    lightLogo?: string;
    darkLogo?: string;
    preservePath?: boolean;
}

export function SigninScreen({
    allowedPrefix,
    isNested = false,
    lightLogo,
    darkLogo,
    preservePath,
}: SigninScreenProps) {
    const [allow, setAllow] = useState(false);
    useSafeLayoutEffect(() => {
        if (allowedPrefix) setAllow(window.location.pathname.startsWith(allowedPrefix));
    }, [allowedPrefix]);
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === 'signin') {
        return <SigninPreview />;
    }
    return allow ? null : (
        <SigninScreenImpl isNested={isNested} lightLogo={lightLogo} darkLogo={darkLogo} preservePath={preservePath} />
    );
}

type Mode = 'email' | 'providers' | 'tenant' | 'blocked' | 'returning' | 'pending' | 'signup';

function SigninScreenImpl({ isNested = false, lightLogo, darkLogo, preservePath }: SigninScreenProps) {
    const { t } = useUITranslation();
    const { isLoading, user, authError, signOut } = useUserSession();
    const { trackEvent } = useUXTracking();

    const [storedSession, setStoredSession] = useState<LastSession | null>(() => readLastSession());
    const [mode, setMode] = useState<Mode>(() => {
        const s = readLastSession();
        return s ? 'returning' : 'email';
    });
    const [email, setEmail] = useState('');
    const [tenant, setTenant] = useState<TenantInfo | undefined>(undefined);
    const [pendingProvider, setPendingProvider] = useState<ProviderId | null>(null);

    useEffect(() => {
        if (!preservePath) {
            history.replaceState({}, '', '/');
        }
    }, [preservePath]);

    // Route based on authError surfaced by the session.
    useEffect(() => {
        if (!authError) return;
        if (authError instanceof UserNotFoundError) {
            setMode('signup');
        } else if (isInviteRequiredError(authError)) {
            const pending = readPendingSignin();
            if (pending) setEmail(pending.email);
            setMode('blocked');
        }
    }, [authError]);

    // On successful login, finalize the lastSession entry with the user's name.
    useEffect(() => {
        if (!user) return;
        const pending = readPendingSignin();
        if (!pending) return;
        writeLastSession({
            email: pending.email,
            lastProvider: pending.provider,
            tenantName: pending.tenantName,
            name: user.name || undefined,
        });
        clearPendingSignin();
    }, [user]);

    const onProceedFromEmail = useCallback((e: string, t: TenantInfo | undefined) => {
        setEmail(e);
        setTenant(t);
        setMode(t ? 'tenant' : 'providers');
    }, []);

    const onBack = useCallback(() => {
        setMode('email');
        setTenant(undefined);
    }, []);

    const onNotYou = useCallback(() => {
        clearLastSession();
        clearPendingSignin();
        setStoredSession(null);
        setEmail('');
        setTenant(undefined);
        setMode('email');
        void signOut();
    }, [signOut]);

    const onProviderClicked = useCallback(
        (provider: ProviderId) => {
            // SSO is derived from a resolved tenant or stored tenantName, not the provider.
            const isSso = !!tenant || !!storedSession?.tenantName;
            trackEvent(isSso ? 'enterprise_signin' : 'oauth_signin', { provider });
            setPendingProvider(provider);
            setMode('pending');
            // The redirect itself happens in the calling step's startSignIn(); this just shows the pending screen.
        },
        [trackEvent, storedSession?.tenantName, tenant],
    );

    const goBackToFresh = useCallback(() => {
        setEmail('');
        setTenant(undefined);
        setMode('email');
    }, []);

    // Submits the signup form to /auth/signup, then redirects into the app.
    const onSignup = (data: SignupData, fbToken: string) => {
        const payload: SignupPayload = { signupData: data, firebaseToken: fbToken };
        void fetch(`${Env.endpoints.studio}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        }).then(() => {
            trackEvent('sign_up');
            window.location.href = '/';
        });
    };

    if (isLoading || user) return null;

    let content: React.ReactNode = null;
    if (mode === 'pending' && pendingProvider) {
        content = <LoginAuthPending provider={pendingProvider} />;
    } else if (mode === 'blocked') {
        content = (
            <LoginTenantBlockedStep
                email={email || storedSession?.email || ''}
                tenantName={tenant?.label || tenant?.name || storedSession?.tenantName || undefined}
                onBack={goBackToFresh}
            />
        );
    } else if (mode === 'signup' && !localStorage.getItem('tenantName')) {
        content = <SignupForm onSignup={onSignup} goBack={goBackToFresh} />;
    } else if (mode === 'tenant' && tenant) {
        content = (
            <LoginTenantStep
                email={email}
                tenant={tenant}
                onBack={onBack}
                onProviderClicked={() => onProviderClicked((tenant.provider ?? 'oidc') as ProviderId)}
            />
        );
    } else if (mode === 'providers') {
        content = <LoginProvidersStep email={email} onBack={onBack} onProviderClicked={onProviderClicked} />;
    } else if (mode === 'returning' && storedSession) {
        content = (
            <LoginReturningStep session={storedSession} onNotYou={onNotYou} onProviderClicked={onProviderClicked} />
        );
    } else {
        content = <LoginEmailStep initialEmail={email} onProceed={onProceedFromEmail} />;
    }

    return (
        <div
            style={{ zIndex: 999998 }}
            className={`${isNested ? 'absolute' : 'fixed'} inset-0 overflow-y-auto bg-background`}
        >
            <div className="min-h-full flex flex-col items-center justify-center py-12 px-4">
                <div className="flex flex-col items-center w-full">
                    {(lightLogo || darkLogo) && (
                        <div className="mb-7">
                            {lightLogo && <img src={lightLogo} alt="Vertesia" className="h-10 block dark:hidden" />}
                            {darkLogo && <img src={darkLogo} alt="Vertesia" className="h-10 hidden dark:block" />}
                        </div>
                    )}

                    {content}

                    {authError && !(authError instanceof UserNotFoundError) && !isInviteRequiredError(authError) && (
                        <div className="mt-6 max-w-[420px] text-center text-sm text-muted">
                            <div>
                                {t('auth.signInError')}
                                <br />
                                {t('auth.signInErrorContact')}
                                <a className="text-info mx-1" href="mailto:support@vertesiahq.com">
                                    support@vertesiahq.com
                                </a>
                                {t('auth.signInErrorPersists')}
                                <pre className="mt-2 text-xs">{t('auth.error', { message: authError.message })}</pre>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-5 mt-10 text-xs text-muted-foreground">
                        <a href="https://vertesiahq.com/privacy" className="hover:text-foreground transition">
                            {t('auth.privacyPolicy')}
                        </a>
                        <span className="text-border">·</span>
                        <a href="https://vertesiahq.com/terms" className="hover:text-foreground transition">
                            {t('auth.termsOfService')}
                        </a>
                        <span className="text-border">·</span>
                        <RegionTag className="cursor-default" />
                    </div>
                </div>
            </div>
        </div>
    );
}
