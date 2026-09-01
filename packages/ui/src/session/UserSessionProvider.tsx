import { REQUESTED_SCOPE_UNAVAILABLE_ERROR_CODE } from '@vertesia/common';
import { Env } from '@vertesia/ui/env';
import { onAuthStateChanged } from 'firebase/auth';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
    AuthenticationServiceError,
    CredentialError,
    getComposableToken,
    NoAccessibleAccountError,
    RequestedScopeUnavailableError,
    RestrictedEnvironmentError,
    resolveAuthSelection,
    UserNotFoundError,
} from './auth/composable';
import {
    authReturnUrl,
    buildCentralAuthRedirectUrl,
    centralAuthUrl,
    shouldRedirectToCentralAuth,
} from './auth/domainRouting';
import { getFirebaseAuth } from './auth/firebase';
import { useAuthState } from './auth/useAuthState';
import { UserSession, UserSessionContext } from './UserSession';

function clearAuthHash() {
    const url = new URL(window.location.href);
    url.hash = '';
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`);
}

// Re-exported from its new home in ./auth/domainRouting, which the token layer can import without
// a cycle -- it renews an expired Central Auth session through the same URL.
export { buildCentralAuthRedirectUrl };

export function sanitizeRejectedScopeUrl(
    currentUrl: URL,
    error: RequestedScopeUnavailableError,
    clearHash = false,
): URL {
    const sanitizedUrl = new URL(currentUrl);
    const urlAccountId = sanitizedUrl.searchParams.get('a') ?? undefined;
    const urlProjectId = sanitizedUrl.searchParams.get('p') ?? undefined;

    if (urlAccountId && urlProjectId && urlAccountId === error.accountId && urlProjectId === error.projectId) {
        sanitizedUrl.searchParams.delete('a');
        sanitizedUrl.searchParams.delete('p');
        error.requestedScope = 'project';
        error.selectorSource = 'url';
    } else if (urlProjectId && urlProjectId === error.projectId) {
        sanitizedUrl.searchParams.delete('p');
        error.requestedScope = 'project';
        error.selectorSource = 'url';
    } else if (urlAccountId && urlAccountId === error.accountId) {
        sanitizedUrl.searchParams.delete('a');
        error.requestedScope = 'account';
        error.selectorSource = 'url';
    } else {
        error.requestedScope = error.projectId ? 'project' : 'account';
        error.selectorSource = 'persisted';
    }

    if (clearHash) sanitizedUrl.hash = '';
    error.recoveryUrl = sanitizedUrl.toString();
    return sanitizedUrl;
}

interface UserSessionProviderProps {
    children: ReactNode | ReactNode[];
    loadOnboardingStatus?: boolean;
}
export function UserSessionProvider({ children, loadOnboardingStatus = true }: UserSessionProviderProps) {
    const hashParams = new URLSearchParams(location.hash.substring(1));
    const token = hashParams.get('token');
    const state = hashParams.get('state');
    const [session, setSession] = useState<UserSession>(new UserSession());
    const { generateState, verifyState, clearState } = useAuthState();
    const hasInitiatedAuthRef = useRef(false);
    const authFlowRef = useRef<(() => undefined | (() => void)) | undefined>(undefined);

    const clearRejectedUrlScope = (error: RequestedScopeUnavailableError, clearHash = false) => {
        const sanitizedUrl = sanitizeRejectedScopeUrl(new URL(window.location.href), error, clearHash);
        window.history.replaceState(window.history.state, '', sanitizedUrl);
        Env.logger.warn('Sanitized an unavailable authentication scope', {
            vertesia: {
                account_id: error.accountId,
                project_id: error.projectId,
                error_code: REQUESTED_SCOPE_UNAVAILABLE_ERROR_CODE,
                selector_source: error.selectorSource,
                requested_scope: error.requestedScope,
                recovery_action: 'url_sanitized',
            },
        });
    };

    const surfaceAuthError = (error: unknown, clearHash = false): boolean => {
        if (
            !(
                error instanceof RequestedScopeUnavailableError ||
                error instanceof NoAccessibleAccountError ||
                error instanceof CredentialError ||
                error instanceof AuthenticationServiceError ||
                error instanceof UserNotFoundError ||
                error instanceof RestrictedEnvironmentError
            )
        ) {
            return false;
        }

        if (error instanceof RequestedScopeUnavailableError) {
            clearRejectedUrlScope(error, clearHash);
        } else if (clearHash) {
            clearAuthHash();
        }
        session.isLoading = false;
        session.authError = error;
        setSession(session.clone());
        return true;
    };

    const redirectToCentralAuth = (selection: { accountId?: string; projectId?: string }) => {
        const url = buildCentralAuthRedirectUrl(
            centralAuthUrl(),
            Env.endpoints.sts ?? 'https://sts.vertesia.io',
            authReturnUrl(),
            generateState(),
            selection,
        );
        location.replace(url.toString());
    };

    authFlowRef.current = () => {
        // Make this effect idempotent - only run auth flow once
        if (hasInitiatedAuthRef.current) {
            Env.logger.debug('Skipping duplicate auth flow initiation');
            return;
        }
        hasInitiatedAuthRef.current = true;

        Env.logger.debug('Starting auth flow');
        const currentUrl = new URL(window.location.href);
        const { accountId: selectedAccount, projectId: selectedProject } = resolveAuthSelection(currentUrl);
        Env.logger.debug('Selected account and project', {
            vertesia: {
                account_id: selectedAccount,
                project_id: selectedProject,
            },
        });

        if (Env.isLocalDev && Env.devAuthToken) {
            session.setSession = setSession;
            getComposableToken(selectedAccount, selectedProject, Env.devAuthToken)
                .then((res) => {
                    session.login(res.rawToken).then(() => setSession(session.clone()));
                })
                .catch((err) => {
                    if (surfaceAuthError(err)) return;
                    console.error('Failed to initialize dev auth token', err);
                    Env.logger.error('Failed to initialize dev auth token', {
                        vertesia: {
                            account_id: selectedAccount,
                            project_id: selectedProject,
                            error: err,
                        },
                    });
                    session.isLoading = false;
                    session.authError = err instanceof Error ? err : new Error(String(err));
                    setSession(session.clone());
                });
            return;
        }

        if (token && state) {
            session.setSession = setSession;
            const validationError = verifyState(state);
            if (validationError) {
                console.error(`Auth: invalid state: ${validationError}`);
                Env.logger.error(`Invalid state: ${validationError}`, {
                    vertesia: {
                        state: state,
                    },
                });
                redirectToCentralAuth({ accountId: selectedAccount, projectId: selectedProject });
            } else {
                clearState();
            }
            getComposableToken(selectedAccount, selectedProject, token, false, shouldRedirectToCentralAuth())
                .then((res) => {
                    session.login(res.rawToken, { loadOnboardingStatus }).then(() => {
                        setSession(session.clone());
                        clearAuthHash();
                    });
                })
                .catch((err) => {
                    if (surfaceAuthError(err, true)) return;

                    console.error('Failed to fetch user token from studio, redirecting to central auth', err);
                    Env.logger.error('Failed to fetch user token from studio, redirecting to central auth', {
                        vertesia: {
                            error: err,
                        },
                    });
                    redirectToCentralAuth({ accountId: selectedAccount, projectId: selectedProject });
                });
            return;
        }

        let cancelled = false;
        let unsubscribe: (() => void) | undefined;

        const startFirebaseOrCentralAuth = () => {
            if (cancelled) return;

            // If the current host is not in the Firebase allowlist, central auth owns sign-in.
            if (!session.isLoggedIn()) {
                Env.logger.debug('Not logged in & no token/state', {
                    vertesia: {
                        account_id: selectedAccount,
                        project_id: selectedProject,
                    },
                });
                if (shouldRedirectToCentralAuth()) {
                    Env.logger.debug('Redirecting to central auth with selection', {
                        vertesia: {
                            account_id: selectedAccount,
                            project_id: selectedProject,
                        },
                    });
                    redirectToCentralAuth({ accountId: selectedAccount, projectId: selectedProject });
                    return; // Don't register onAuthStateChanged listener when redirecting
                }

                Env.logger.debug('Host is in Firebase auth allowlist', {
                    vertesia: {
                        account_id: selectedAccount,
                        project_id: selectedProject,
                    },
                });
            }

            unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (firebaseUser) => {
                if (firebaseUser) {
                    Env.logger.debug('Successful login with firebase', {
                        vertesia: {
                            account_id: selectedAccount,
                            project_id: selectedProject,
                        },
                    });
                    session.setSession = setSession;
                    await getComposableToken(
                        selectedAccount,
                        selectedProject,
                        undefined,
                        false,
                        shouldRedirectToCentralAuth(),
                    )
                        .then((res) => {
                            session
                                .login(res.rawToken, { loadOnboardingStatus })
                                .then(() => setSession(session.clone()));
                        })
                        .catch((err) => {
                            if (surfaceAuthError(err)) return;
                            console.error('Unexpected failure while fetching a user token', err);
                            Env.logger.error('Unexpected failure while fetching a user token', {
                                vertesia: { account_id: selectedAccount, project_id: selectedProject, error: err },
                            });
                            session.logout();
                            session.isLoading = false;
                            session.authError = err;
                            setSession(session.clone());
                        });
                } else {
                    // anonymous user
                    Env.logger.debug('Using anonymous user', {
                        vertesia: {
                            account_id: selectedAccount,
                            project_id: selectedProject,
                        },
                    });
                    session.client.withAuthCallback(undefined);
                    session.logout();
                    setSession(session.clone());
                }
            });
        };

        if (Env.authTokenProvider) {
            session.setSession = setSession;
            void Env.authTokenProvider()
                .then(async (injectedToken) => {
                    if (!injectedToken) {
                        startFirebaseOrCentralAuth();
                        return;
                    }
                    const res = await getComposableToken(
                        selectedAccount,
                        selectedProject,
                        injectedToken,
                        false,
                        shouldRedirectToCentralAuth(),
                    );
                    await session.login(res.rawToken, { loadOnboardingStatus });
                    if (!cancelled) setSession(session.clone());
                })
                .catch((err: unknown) => {
                    if (surfaceAuthError(err)) return;
                    console.warn('Auth: failed to initialize injected auth token', err);
                    Env.logger.warn('Failed to initialize injected auth token', {
                        vertesia: {
                            account_id: selectedAccount,
                            project_id: selectedProject,
                            error: err,
                        },
                    });
                    session.isLoading = false;
                    session.authError = err instanceof Error ? err : new Error(String(err));
                    setSession(session.clone());
                });
            return () => {
                cancelled = true;
                unsubscribe?.();
            };
        }

        startFirebaseOrCentralAuth();
        return () => {
            cancelled = true;
            unsubscribe?.();
        };
    };

    useEffect(() => {
        return authFlowRef.current?.();
    }, []);

    return <UserSessionContext.Provider value={session}>{children}</UserSessionContext.Provider>;
}
