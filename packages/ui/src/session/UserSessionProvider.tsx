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
import { authReturnUrl, shouldRedirectToCentralAuth } from './auth/domainRouting';
import { getFirebaseAuth } from './auth/firebase';
import { useAuthState } from './auth/useAuthState';
import { UserSession, UserSessionContext } from './UserSession';

const CENTRAL_AUTH_REDIRECT = 'https://internal-auth.vertesia.app/';

function clearAuthHash() {
    const url = new URL(window.location.href);
    url.hash = '';
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`);
}

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

    const redirectToCentralAuth = (projectId?: string, accountId?: string) => {
        const url = new URL(`${CENTRAL_AUTH_REDIRECT}?sts=${Env.endpoints.sts ?? 'https://sts.vertesia.io'}`);
        const currentUrl = authReturnUrl();
        if (projectId) currentUrl.searchParams.set('p', projectId);
        if (accountId) currentUrl.searchParams.set('a', accountId);
        url.searchParams.set('redirect_uri', currentUrl.toString());
        url.searchParams.set('state', generateState());
        location.replace(url.toString());
    };

    authFlowRef.current = () => {
        // Make this effect idempotent - only run auth flow once
        if (hasInitiatedAuthRef.current) {
            console.log('Auth: skipping duplicate auth flow initiation');
            return;
        }
        hasInitiatedAuthRef.current = true;

        console.log('Auth: starting auth flow');
        Env.logger.info('Starting auth flow');
        const currentUrl = new URL(window.location.href);
        const { accountId: selectedAccount, projectId: selectedProject } = resolveAuthSelection(currentUrl);
        console.log('Auth: selected account', selectedAccount);
        console.log('Auth: selected project', selectedProject);
        Env.logger.info('Selected account and project', {
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
                redirectToCentralAuth();
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
                    redirectToCentralAuth();
                });
            return;
        }

        let cancelled = false;
        let unsubscribe: (() => void) | undefined;

        const startFirebaseOrCentralAuth = () => {
            if (cancelled) return;

            // If the current host is not in the Firebase allowlist, central auth owns sign-in.
            if (!session.isLoggedIn()) {
                console.log('Auth: not logged in & no token/state');
                Env.logger.info('Not logged in & no token/state', {
                    vertesia: {
                        account_id: selectedAccount,
                        project_id: selectedProject,
                    },
                });
                if (shouldRedirectToCentralAuth()) {
                    console.log(
                        'Auth: host is not in Firebase auth allowlist, redirecting to central auth with selection',
                        selectedAccount,
                        selectedProject,
                    );
                    Env.logger.info('Redirecting to central auth with selection', {
                        vertesia: {
                            account_id: selectedAccount,
                            project_id: selectedProject,
                        },
                    });
                    redirectToCentralAuth();
                    return; // Don't register onAuthStateChanged listener when redirecting
                }

                console.log('Auth: host is in Firebase auth allowlist');
                Env.logger.info('Host is in Firebase auth allowlist', {
                    vertesia: {
                        account_id: selectedAccount,
                        project_id: selectedProject,
                    },
                });
            }

            unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (firebaseUser) => {
                if (firebaseUser) {
                    console.log('Auth: successful login with firebase');
                    Env.logger.info('Successful login with firebase', {
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
                    console.log('Auth: using anonymous user');
                    Env.logger.info('Using anonymous user', {
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
