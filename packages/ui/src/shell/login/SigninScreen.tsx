import { REQUESTED_SCOPE_UNAVAILABLE_ERROR_CODE, type SignupData, type SignupPayload } from '@vertesia/common';
import { Env } from '@vertesia/ui/env';
import { useUITranslation } from '@vertesia/ui/i18n';
import {
    AuthenticationServiceError,
    CredentialError,
    NoAccessibleAccountError,
    RequestedScopeUnavailableError,
    RestrictedEnvironmentError,
    UserNotFoundError,
    useUserSession,
    useUXTracking,
} from '@vertesia/ui/session';
import { useCallback, useEffect } from 'react';
import { type SignInFlowController, SignInFlowSteps, useSignInFlow } from './SignInFlow';
import { SignInPageShell } from './SignInPageShell';
import SignInRecoveryStep, { type SignInRecoveryKind } from './SignInRecoveryStep';
import SignInRestrictedEnvStep from './SignInRestrictedEnvStep';
import SignInTenantBlockedStep from './SignInTenantBlockedStep';
import SignupForm from './SignupForm';
import { isInviteRequiredError, readPendingSignin, resetSignInState } from './signInUtils';

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

/**
 * The modes this screen adds on top of {@link SignInCoreMode}: every one is entered from an
 * `authError` the session surfaced, which is why they stay here rather than in the shared flow.
 */
type RecoveryMode =
    | 'blocked'
    | 'signup'
    | 'restricted'
    | 'scopeUnavailable'
    | 'noAccessibleAccount'
    | 'credentialFailure'
    | 'serviceFailure';

function isDedicatedAuthError(error: Error): boolean {
    return (
        error instanceof UserNotFoundError ||
        error instanceof RestrictedEnvironmentError ||
        error instanceof RequestedScopeUnavailableError ||
        error instanceof NoAccessibleAccountError ||
        error instanceof CredentialError ||
        error instanceof AuthenticationServiceError
    );
}

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

    const flow: SignInFlowController<RecoveryMode> = useSignInFlow<RecoveryMode>({ signOut, trackEvent, user });
    const { mode, setMode, email, setEmail, tenant, setTenant, storedSession, setStoredSession } = flow;

    const recoveryIdentity =
        authError instanceof RequestedScopeUnavailableError || authError instanceof NoAccessibleAccountError
            ? authError.identity
            : undefined;
    const matchingStoredIdentity =
        recoveryIdentity && storedSession?.email.toLowerCase() === recoveryIdentity.email.toLowerCase()
            ? storedSession
            : undefined;
    const displayedRecoveryIdentity = recoveryIdentity
        ? { email: recoveryIdentity.email, name: recoveryIdentity.name ?? matchingStoredIdentity?.name }
        : undefined;

    useEffect(() => {
        if (!preservePath && !isLoading && !authError) {
            // Reset to the app's mount root, not the bare origin. A gateway-mounted app carries a
            // served `<base href>` deep mount; collapsing to '/' drops the app off that mount (the
            // bare origin serves no app) and the address bar can no longer be reloaded. This effect
            // also flashes briefly for already-authenticated users during the loading transition, so
            // a bare '/' here loses the URL even on a normal login. Deriving the root from
            // `document.baseURI` keeps it inside the mount; for the origin-served Studio UI the
            // pathname is '/', so the behavior is unchanged.
            const mountRoot = new URL(document.baseURI).pathname || '/';
            history.replaceState({}, '', mountRoot);
        }
    }, [authError, isLoading, preservePath]);

    // Route based on authError surfaced by the session.
    useEffect(() => {
        if (!authError) return;
        if (authError instanceof UserNotFoundError) {
            setMode('signup');
        } else if (authError instanceof RestrictedEnvironmentError) {
            setMode('restricted');
        } else if (authError instanceof RequestedScopeUnavailableError) {
            setMode('scopeUnavailable');
        } else if (authError instanceof NoAccessibleAccountError) {
            setMode('noAccessibleAccount');
        } else if (authError instanceof CredentialError) {
            setMode('credentialFailure');
        } else if (authError instanceof AuthenticationServiceError) {
            setMode('serviceFailure');
        } else if (isInviteRequiredError(authError)) {
            const pending = readPendingSignin();
            if (pending) setEmail(pending.email);
            setMode('blocked');
        }
    }, [authError, setEmail, setMode]);

    // "Use a different email" out of the blocked/signup screen. The user reached it
    // as a valid Firebase user with no Vertesia account, so a partial reset isn't
    // enough: unless we also clear the persisted records and sign out of Firebase,
    // the leftover session re-runs the invite check on the next auth change or
    // reload and lands them back on blocked.
    const { startOver } = flow;

    const useDifferentAccount = useCallback(() => {
        Env.logger.info('Authentication recovery action selected', {
            vertesia: { recovery_action: 'use_different_account' },
        });
        setStoredSession(null);
        setEmail('');
        setTenant(undefined);
        setMode('email');
        void resetSignInState().finally(() => signOut());
    }, [setStoredSession, setEmail, setTenant, setMode, signOut]);

    const continueWithSanitizedScope = useCallback(() => {
        if (!(authError instanceof RequestedScopeUnavailableError)) return;
        Env.logger.info('Authentication recovery action selected', {
            vertesia: {
                error_code: REQUESTED_SCOPE_UNAVAILABLE_ERROR_CODE,
                selector_source: authError.selectorSource,
                requested_scope: authError.requestedScope,
                recovery_action: 'continue_sanitized',
            },
        });
        window.location.replace(authError.recoveryUrl ?? window.location.href);
    }, [authError]);

    const retryAuthentication = useCallback(() => {
        Env.logger.info('Authentication recovery action selected', {
            vertesia: { recovery_action: 'retry' },
        });
        window.location.reload();
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
        suppressAuthError && authError !== undefined && !isDedicatedAuthError(authError);

    if (isLoading || user || shouldHideTransientAuthError) return null;

    let content: React.ReactNode = null;
    if (mode === 'blocked') {
        content = (
            <SignInTenantBlockedStep
                email={email || storedSession?.email || ''}
                tenantName={tenant?.label || tenant?.name || storedSession?.tenantName || undefined}
                onBack={startOver}
            />
        );
    } else if (mode === 'restricted') {
        content = <SignInRestrictedEnvStep onUseDifferentEmail={startOver} />;
    } else if (mode === 'scopeUnavailable' && authError instanceof RequestedScopeUnavailableError) {
        const kind: SignInRecoveryKind = authError.requestedScope === 'project' ? 'scopeProject' : 'scopeAccount';
        content = (
            <SignInRecoveryStep
                details={{
                    accountId: authError.accountId,
                    errorCode: authError.errorCode,
                    message: authError.message,
                    projectId: authError.projectId,
                    status: authError.status,
                }}
                identity={displayedRecoveryIdentity}
                kind={kind}
                onContinue={continueWithSanitizedScope}
                onUseDifferentAccount={useDifferentAccount}
            />
        );
    } else if (mode === 'noAccessibleAccount' && authError instanceof NoAccessibleAccountError) {
        content = (
            <SignInRecoveryStep
                details={{ errorCode: authError.errorCode, message: authError.message, status: authError.status }}
                identity={displayedRecoveryIdentity}
                kind="noAccessibleAccount"
                onUseDifferentAccount={useDifferentAccount}
            />
        );
    } else if (mode === 'credentialFailure' && authError instanceof CredentialError) {
        content = (
            <SignInRecoveryStep
                details={{ errorCode: authError.errorCode, message: authError.message, status: authError.status }}
                kind="credential"
                onUseDifferentAccount={useDifferentAccount}
            />
        );
    } else if (mode === 'serviceFailure' && authError instanceof AuthenticationServiceError) {
        content = (
            <SignInRecoveryStep
                details={{ errorCode: authError.errorCode, message: authError.message, status: authError.status }}
                kind="service"
                onContinue={retryAuthentication}
                onUseDifferentAccount={useDifferentAccount}
            />
        );
    } else if (mode === 'signup' && !localStorage.getItem('tenantName')) {
        content = <SignupForm onSignup={onSignup} goBack={startOver} />;
    } else {
        // Every remaining mode is a core one; an unmatched recovery mode falls through to the
        // email step, exactly as it did when this chain owned all twelve branches.
        content = <SignInFlowSteps flow={flow} />;
    }

    return (
        <div
            style={{ zIndex: 999998 }}
            className={`${isNested ? 'absolute' : 'fixed'} inset-0 overflow-y-auto bg-background`}
        >
            <SignInPageShell
                lightLogo={lightLogo}
                darkLogo={darkLogo}
                notice={
                    authError &&
                    !isDedicatedAuthError(authError) &&
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
                            </div>
                        </div>
                    )
                }
            >
                {content}
            </SignInPageShell>
        </div>
    );
}
