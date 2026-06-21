import { VertesiaClient } from '@vertesia/client';
import type { AuthTokenPayload } from '@vertesia/common';
import { Env } from '@vertesia/ui/env';
import { jwtDecode } from 'jwt-decode';
import { createContext, useContext } from 'react';

import { getComposableToken } from './auth/composable';
import { authReturnUrl, mountRootUrl, shouldRedirectToCentralAuth } from './auth/domainRouting';
import { getFirebaseAuth } from './auth/firebase';

import { LastSelectedAccountId_KEY, LastSelectedProjectId_KEY } from './constants';

export { LastSelectedAccountId_KEY, LastSelectedProjectId_KEY };

const CENTRAL_AUTH_REDIRECT = 'https://internal-auth.vertesia.app/';

export interface UserSessionLoginOptions {
    loadOnboardingStatus?: boolean;
}

class UserSession {
    isLoading = true;
    client: VertesiaClient;
    authError?: Error;
    authToken?: AuthTokenPayload;
    setSession?: (session: UserSession) => void;
    lastSelectedAccount?: string | null;
    lastSelectedProject?: string | null;
    onboardingComplete?: boolean;

    constructor(client?: VertesiaClient, setSession?: (session: UserSession) => void) {
        if (client) {
            this.client = client;
        } else {
            this.client = new VertesiaClient({
                serverUrl: Env.endpoints.studio,
                storeUrl: Env.endpoints.zeno,
                tokenServerUrl: Env.endpoints.sts,
            });
        }

        if (setSession) {
            this.setSession = setSession;
        }

        this.logout = this.logout.bind(this);
    }

    get store() {
        return this.client.store;
    }

    get user() {
        //compatibility
        return this.authToken;
    }

    get account() {
        //compatibility
        return this.authToken?.account;
    }

    get project() {
        return this.authToken?.project;
    }

    get accounts() {
        //compatibility
        return this.authToken?.accounts;
    }

    get authCallback() {
        return this.rawAuthToken.then((token) => `Bearer ${token}`);
    }

    get rawAuthToken() {
        return getComposableToken().then((res) => {
            const token = res?.rawToken;
            if (!token) {
                throw new Error('No token available');
            }
            this.authToken = jwtDecode(token) as unknown as AuthTokenPayload;
            return token;
        });
    }

    /**
     * Force a fresh Vertesia JWT from STS, bypassing the in-memory cache.
     * Use this when the current token's claims (e.g. `apps`) are suspected
     * stale — STS recomputes the `apps` claim from ACEs on every issuance.
     */
    async refreshAuthToken(): Promise<AuthTokenPayload> {
        const res = await getComposableToken(undefined, undefined, undefined, true);
        const token = res?.rawToken;
        if (!token) {
            throw new Error('No token available');
        }
        this.authToken = jwtDecode(token) as unknown as AuthTokenPayload;
        this.setSession?.(this.clone());
        return this.authToken;
    }

    signOut() {
        //compatibility
        this.logout();
    }

    getAccount() {
        return this.authToken?.account;
    }

    async login(token: string, options: UserSessionLoginOptions = {}) {
        this.authError = undefined;
        this.isLoading = false;
        this.client.withAuthCallback(() => this.authCallback);
        this.authToken = jwtDecode(token) as unknown as AuthTokenPayload;
        console.log(
            `Logging in as ${this.authToken?.name} with account ${this.authToken?.account.name} (${this.authToken?.account.id}, and project ${this.authToken?.project?.name} (${this.authToken?.project?.id})`,
        );

        //store selected account in local storage
        localStorage.setItem(LastSelectedAccountId_KEY, this.authToken.account.id);
        localStorage.setItem(
            `${LastSelectedProjectId_KEY}-${this.authToken.account.id}`,
            this.authToken.project?.id ?? '',
        );
        // notify the host app of the login
        Env.onLogin?.(this.authToken);

        if (options.loadOnboardingStatus ?? true) {
            await this.fetchOnboardingStatus();
        }

        return Promise.resolve();
    }

    isLoggedIn() {
        return !!this.authToken;
    }

    logout() {
        console.log('Logging out');

        if (shouldRedirectToCentralAuth()) {
            // Redirect to central auth for logout
            // Central auth will handle Firebase logout
            console.log('Using central auth logout');
            this.authError = undefined;
            this.isLoading = false;
            this.authToken = undefined;
            this.setSession = undefined;
            this.client.withAuthCallback(undefined);

            const logoutUrl = new URL(CENTRAL_AUTH_REDIRECT);
            const currentUrl = authReturnUrl();
            logoutUrl.pathname = '/logout';
            logoutUrl.searchParams.set('redirect_uri', currentUrl.toString());
            location.replace(logoutUrl.toString());
        } else {
            // Use Firebase logout directly
            console.log('Using Firebase logout');
            const wasLoggedIn = !!this.authToken;
            if (this.authToken) {
                void getFirebaseAuth().signOut();
            }
            this.authError = undefined;
            this.isLoading = false;
            this.authToken = undefined;
            this.setSession = undefined;
            this.client.withAuthCallback(undefined);
            // Navigate to the app root to avoid React rendering errors when
            // unmounting deeply nested route components during logout.
            // Use the mount root (not bare '/') so a gateway-mounted app stays
            // on its mount. Only navigate if user was actually logged in to
            // avoid an infinite reload loop on fresh/incognito sessions.
            if (wasLoggedIn) {
                location.replace(mountRootUrl().toString());
            }
        }
    }

    async switchAccount(targetAccountId: string) {
        localStorage.setItem(LastSelectedAccountId_KEY, targetAccountId);
        if (this) {
            if (this.account && this.project) {
                localStorage.setItem(`${LastSelectedProjectId_KEY}-${this.account.id}`, this.project.id);
            } else if (this.account) {
                localStorage.removeItem(`${LastSelectedProjectId_KEY}-${this.account.id}`);
            }
        }

        const url = mountRootUrl();
        url.searchParams.set('a', targetAccountId);
        window.location.replace(url.toString());
    }

    async switchProject(targetProjectId: string) {
        if (this.account) {
            localStorage.setItem(`${LastSelectedProjectId_KEY}-${this.account.id}`, targetProjectId);
        }

        const url = mountRootUrl();
        if (this.account?.id) {
            url.searchParams.set('a', this.account.id);
        }
        url.searchParams.set('p', targetProjectId);
        window.location.replace(url.toString());
    }

    async fetchAccounts() {
        return this.client.accounts
            .list()
            .then((accounts) => {
                if (!this.authToken) {
                    throw new Error('No token available');
                }
                this.authToken.accounts = accounts;
                this.setSession?.(this.clone());
            })
            .catch((err) => {
                console.error('Failed to fetch accounts', err);
                throw err;
            });
    }

    async fetchProjects(accountId: string) {
        return this.client.projects
            .list([accountId])
            .then((projects) => {
                if (!this.authToken) {
                    throw new Error('No token available');
                }
                this.authToken = {
                    ...this.authToken,
                    accounts: this.authToken.accounts?.map((account) => {
                        if (account.id === accountId) {
                            return {
                                ...account,
                                projects: projects.filter((project) => project.account === accountId),
                            };
                        }
                        return account;
                    }),
                };
                this.setSession?.(this.clone());
            })
            .catch((err) => {
                console.error('Failed to fetch projects', err);
                throw err;
            });
    }

    async fetchOnboardingStatus(): Promise<boolean> {
        if (this.onboardingComplete) {
            console.log('Onboarding already completed');
            return false;
        }
        const previousStatus = this.onboardingComplete;
        try {
            const onboarding = await this.client.account.onboardingProgress();
            this.onboardingComplete = Object.values(onboarding).every((value) => value === true);
            if (previousStatus !== this.onboardingComplete) {
                return true;
            }
            this.setSession?.(this.clone());
        } catch (error) {
            console.error('Error fetching onboarding status:', error);
            this.onboardingComplete = false;
            this.setSession?.(this.clone());
        }
        return false;
    }

    clone() {
        const session = new UserSession(this.client);
        session.isLoading = this.isLoading;
        session.authError = this.authError;
        session.authToken = this.authToken;
        session.setSession = this.setSession;
        session.lastSelectedAccount = this.lastSelectedAccount;
        session.switchAccount = this.switchAccount;
        session.onboardingComplete = this.onboardingComplete;
        return session;
    }
}

const UserSessionContext = createContext<UserSession | undefined>(undefined);

export function useUserSession() {
    const session = useContext(UserSessionContext);

    if (!session) {
        throw new Error('useUserSession must be used within a UserSessionProvider');
    }
    return session;
}

export { UserSession, UserSessionContext };
