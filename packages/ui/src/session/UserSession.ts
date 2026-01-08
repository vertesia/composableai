import { jwtDecode } from 'jwt-decode';
import { createContext, useContext } from 'react';

import { VertesiaClient } from '@vertesia/client';
import { AuthTokenPayload } from '@vertesia/common';
import { Env } from '@vertesia/ui/env';

import { getComposableToken } from './auth/composable';
import { getFirebaseAuth } from './auth/firebase';
import { TypeRegistry } from './TypeRegistry';

import { LastSelectedAccountId_KEY, LastSelectedProjectId_KEY } from './constants';
export { LastSelectedAccountId_KEY, LastSelectedProjectId_KEY };


class UserSession {

    isLoading = true;
    client: VertesiaClient;
    authError?: Error;
    authToken?: AuthTokenPayload;
    private _typeRegistry?: TypeRegistry;
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
                tokenServerUrl: Env.endpoints.sts
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

    get user() { //compatibility
        return this.authToken;
    }

    get account() { //compatibility
        return this.authToken?.account;
    }

    get project() {
        return this.authToken?.project;
    }

    get accounts() { //compatibility
        return this.authToken?.accounts;
    }

    /**
     * Get type registry. Automatically triggers background reload if cache is stale (>60s old).
     * Returns cached types immediately, and reloads in background if data is older than 60 seconds.
     */
    get typeRegistry(): TypeRegistry | undefined {
        return this.getTypes();
    }

    get authCallback() {
        return this.rawAuthToken.then(token => `Bearer ${token}`);
    }

    get rawAuthToken() {
        return getComposableToken().then(res => {
            const token = res?.rawToken
            if (!token) {
                throw new Error('No token available');
            }
            this.authToken = jwtDecode(token) as unknown as AuthTokenPayload;
            return token;
        });
    }

    signOut() { //compatibility
        this.logout();
    }

    getAccount() {
        return this.authToken?.account;
    }

    async login(token: string) {
        this.authError = undefined;
        this.isLoading = false;
        this.client.withAuthCallback(() => this.authCallback)
        this.authToken = jwtDecode(token) as unknown as AuthTokenPayload;
        console.log(`Logging in as ${this.authToken?.name} with account ${this.authToken?.account.name} (${this.authToken?.account.id}, and project ${this.authToken?.project?.name} (${this.authToken?.project?.id})`);

        //store selected account in local storage
        localStorage.setItem(LastSelectedAccountId_KEY, this.authToken.account.id);
        localStorage.setItem(LastSelectedProjectId_KEY + '-' + this.authToken.account.id, this.authToken.project?.id ?? '');
        // notify the host app of the login
        Env.onLogin?.(this.authToken);

        // Fetch onboarding status only - types will be lazy loaded on first access
        await this.fetchOnboardingStatus();

        return Promise.resolve();

    }

    isLoggedIn() {
        return !!this.authToken;
    }


    logout() {
        console.log('Logging out');
        if (this.authToken) {
            getFirebaseAuth().signOut();
        }
        this.authError = undefined;
        this.isLoading = false;
        this.authToken = undefined;
        this._typeRegistry = undefined;
        this.setSession = undefined;
        this.client.withAuthCallback(undefined);
    }

    async switchAccount(targetAccountId: string) {
        localStorage.setItem(LastSelectedAccountId_KEY, targetAccountId);
        if (this) {
            if (this.account && this.project) {
                localStorage.setItem(LastSelectedProjectId_KEY + '-' + this.account.id, this.project.id);
            } else if (this.account) {
                localStorage.removeItem(LastSelectedProjectId_KEY + '-' + this.account.id);
            }
        }

        window.location.replace('/?a=' + targetAccountId);
    }

    async switchProject(targetProjectId: string) {
        if (this.account) {
            localStorage.setItem(LastSelectedProjectId_KEY + '-' + this.account.id, targetProjectId);
        }

        window.location.replace('/?a=' + this.account?.id + '&p=' + targetProjectId);
    }

    async _loadTypes() {
        if (this.project) {
            return this.store.types.list({}, { layout: true }).then(types => this._typeRegistry = new TypeRegistry(types)).catch(err => {
                console.error('Failed to fetch object types', err);
                throw err;
            })
        } else {
            console.log('No project selected');
        }
    }

    /**
     * Reload types from the server.
     * Updates _typeRegistry in place without triggering a full React state update.
     * Components accessing typeRegistry will get the updated value on their next render.
     */
    async reloadTypes() {
        return this._loadTypes();
    }

    /**
     * Get types synchronously with lazy loading.
     * - If cache doesn't exist, triggers first load in background
     * - If cache is stale (>60s), triggers background reload
     * Returns undefined during initial load, then returns cached types on subsequent calls.
     */
    getTypes(): TypeRegistry | undefined {
        // Lazy load on first access
        if (!this._typeRegistry) {
            // Fire and forget - don't await
            this.reloadTypes().catch(err => {
                console.error('Failed to load types', err);
            });
            return undefined;
        }

        // Trigger background reload if stale
        if (this._typeRegistry.isStale()) {
            // Fire and forget - don't await
            this.reloadTypes().catch(err => {
                console.error('Background type reload failed', err);
            });
        }

        return this._typeRegistry;
    }

    async fetchAccounts() {
        return this.client.accounts.list().then(accounts => {
            if (!this.authToken) {
                throw new Error('No token available');
            }
            this.authToken.accounts = accounts;
            this.setSession?.(this.clone());
        }).catch(err => {
            console.error('Failed to fetch accounts', err);
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
            this.onboardingComplete = Object.values(onboarding).every(value => value === true);
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
        session._typeRegistry = this._typeRegistry;
        session.onboardingComplete = this.onboardingComplete;
        return session;
    }
}

const UserSessionContext = createContext<UserSession>(undefined as any);

export function useUserSession() {
    const session = useContext(UserSessionContext);

    if (!session) {
        throw new Error('useUserSession must be used within a UserSessionProvider');
    }
    return session;
}

export { UserSession, UserSessionContext };
