import type { SignupData, SignupPayload } from '@vertesia/common';
import { Env } from '@vertesia/ui/env';
import { useUITranslation } from '@vertesia/ui/i18n';
import { RegionTag } from '@vertesia/ui/layout';
import { RestrictedEnvironmentError, UserNotFoundError, useUserSession, useUXTracking } from '@vertesia/ui/session';
import { useCallback, useEffect, useState } from 'react';
import SignInAuthPending from './SignInAuthPending';
import SignInEmailStep, { type TenantInfo } from './SignInEmailStep';
import SignInProvidersStep from './SignInProvidersStep';
import SignInRestrictedEnvStep from './SignInRestrictedEnvStep';
import SignInReturningStep from './SignInReturningStep';
import SignInTenantBlockedStep from './SignInTenantBlockedStep';
import SignInTenantStep from './SignInTenantStep';
import SignupForm from './SignupForm';
import {
    clearLastSuccessfulLogin,
    clearPendingSignin,
    isInviteRequiredError,
    type LastSuccessfulLogin,
    type ProviderId,
    readLastSuccessfulLogin,
    readPendingSignin,
    resetSignInState,
    writeLastSuccessfulLogin,
} from './signInUtils';

interface SigninScreenProps {
    isNested?: boolean;
    allowedPrefix?: string | string[];
    lightLogo?: string;
    darkLogo?: string;
    preservePath?: boolean;
    suppressAuthErrorPrefix?: string | string[];
}

export function SigninScreen({
    allowedPrefix,
    isNested = false,
    lightLogo,
    darkLogo,
    preservePath,
    suppressAuthErrorPrefix,
}: SigninScreenProps) {
    const pathname = typeof window === 'undefined' ? '' : window.location.pathname;
    const allow = matchesPathPrefix(pathname, allowedPrefix);
    const suppressAuthError = matchesPathPrefix(pathname, suppressAuthErrorPrefix);
    return allow ? null : (
        <SigninScreenImpl
            isNested={isNested}
            lightLogo={lightLogo}
            darkLogo={darkLogo}
            preservePath={preservePath}
            suppressAuthError={suppressAuthError}
        />
    );
}

function matchesPathPrefix(pathname: string, prefix?: string | string[]) {
    const prefixes = Array.isArray(prefix) ? prefix : prefix ? [prefix] : [];
    return prefixes.some((candidate) => {
        if (pathname === candidate) {
            return true;
        }
        return pathname.startsWith(candidate.endsWith('/') ? candidate : `${candidate}/`);
    });
}

type Mode = 'email' | 'providers' | 'tenant' | 'blocked' | 'returning' | 'pending' | 'signup' | 'restricted';

function SigninScreenImpl({
    isNested = false,
    lightLogo,
    darkLogo,
    preservePath,
    suppressAuthError,
}: SigninScreenProps & { suppressAuthError?: boolean }) {
    const { t } = useUITranslation();
    const { isLoading, user, authError, signOut } = useUserSession();
    const { trackEvent } = useUXTracking();

    const [storedSession, setStoredSession] = useState<LastSuccessfulLogin | null>(() => readLastSuccessfulLogin());
    const [mode, setMode] = useState<Mode>(() => {
        const s = readLastSuccessfulLogin();
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
        } else if (authError instanceof RestrictedEnvironmentError) {
            setMode('restricted');
        } else if (isInviteRequiredError(authError)) {
            const pending = readPendingSignin();
            if (pending) setEmail(pending.email);
            setMode('blocked');
        }
    }, [authError]);

    // On successful login, finalize the last-successful-login entry with the user's name.
    useEffect(() => {
        if (!user) return;
        const pending = readPendingSignin();
        if (!pending) return;
        writeLastSuccessfulLogin({
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
        clearLastSuccessfulLogin();
        clearPendingSignin();
        setStoredSession(null);
        setEmail('');
        setTenant(undefined);
        setMode('email');
        void signOut();
    }, [signOut]);

    const onProviderClicked = useCallback(
        (provider: ProviderId) => {
            // Tenant context comes from a resolved tenant or stored tenantName, not the provider.
            const hasTenant = !!tenant || !!storedSession?.tenantName;
            // Only the pre-existing enterprise_signin event; non-tenant sign-ins emit nothing.
            if (hasTenant) trackEvent('enterprise_signin', { provider });
            setPendingProvider(provider);
            setMode('pending');
            // The redirect itself happens in the calling step's startSignIn(); this just shows the pending screen.
        },
        [trackEvent, storedSession?.tenantName, tenant],
    );

    // "Use a different email" out of the blocked/signup screen. The user reached it
    // as a valid Firebase user with no Vertesia account, so a partial reset isn't
    // enough: unless we also clear the persisted records and sign out of Firebase,
    // the leftover session re-runs the invite check on the next auth change or
    // reload and lands them back on blocked.
    const startOver = useCallback(() => {
        setStoredSession(null); // drop the in-memory mirror too — resetSignInState only clears storage
        setEmail('');
        setTenant(undefined);
        setMode('email');
        void resetSignInState();
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

    const shouldHideTransientAuthError =
        suppressAuthError &&
        authError !== undefined &&
        !(authError instanceof UserNotFoundError) &&
        !(authError instanceof RestrictedEnvironmentError);

    if (isLoading || user || shouldHideTransientAuthError) return null;

    let content: React.ReactNode = null;
    if (mode === 'pending' && pendingProvider) {
        content = <SignInAuthPending provider={pendingProvider} />;
    } else if (mode === 'blocked') {
        content = (
            <SignInTenantBlockedStep
                email={email || storedSession?.email || ''}
                tenantName={tenant?.label || tenant?.name || storedSession?.tenantName || undefined}
                onBack={startOver}
            />
        );
    } else if (mode === 'restricted') {
        content = <SignInRestrictedEnvStep onUseDifferentEmail={startOver} />;
    } else if (mode === 'signup' && !localStorage.getItem('tenantName')) {
        content = <SignupForm onSignup={onSignup} goBack={startOver} />;
    } else if (mode === 'tenant' && tenant) {
        content = (
            <SignInTenantStep
                email={email}
                tenant={tenant}
                onBack={onBack}
                onProviderClicked={() => onProviderClicked((tenant.provider ?? 'oidc') as ProviderId)}
            />
        );
    } else if (mode === 'providers') {
        content = <SignInProvidersStep email={email} onBack={onBack} onProviderClicked={onProviderClicked} />;
    } else if (mode === 'returning' && storedSession) {
        content = (
            <SignInReturningStep session={storedSession} onNotYou={onNotYou} onProviderClicked={onProviderClicked} />
        );
    } else {
        content = <SignInEmailStep initialEmail={email} onProceed={onProceedFromEmail} />;
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

                    {authError &&
                        !(authError instanceof UserNotFoundError) &&
                        !(authError instanceof RestrictedEnvironmentError) &&
                        !isInviteRequiredError(authError) && (
                            <div className="mt-6 max-w-[420px] text-center text-sm text-muted">
                                <div>
                                    {t('auth.signInError')}
                                    <br />
                                    {t('auth.signInErrorContact')}
                                    <a className="text-info mx-1" href="mailto:support@vertesiahq.com">
                                        support@vertesiahq.com
                                    </a>
                                    {t('auth.signInErrorPersists')}
                                    <pre className="mt-2 text-xs">
                                        {t('auth.error', { message: authError.message })}
                                    </pre>
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
