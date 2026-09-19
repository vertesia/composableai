import type { AuthTokenPayload } from '@vertesia/common';
import { Env } from '@vertesia/ui/env';
import { jwtDecode } from 'jwt-decode';
import { markCentralAuthRoundTripStarted } from './authRoundTrip';
import { usesGatewaySession } from './gateway';

const TRANSACTION_KEY = 'vertesia.oauth.transaction';
const TOKEN_KEY = 'vertesia.oauth.access';
const MAX_TRANSACTION_AGE = 10 * 60_000;
let pending: Promise<string> | undefined;

export class OAuthLoginError extends Error {}

function hasVertesiaFragmentToken(): boolean {
    try {
        const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
        if (!token) return false;
        return jwtDecode<AuthTokenPayload>(token).iss.replace(/\/+$/, '') === Env.endpoints.sts.replace(/\/+$/, '');
    } catch {
        return false;
    }
}

export function usesAppOAuth(): boolean {
    return Boolean(
        Env.oauth &&
            window.parent === window &&
            window.AUTH_MODE !== 'firebase' &&
            !usesGatewaySession() &&
            !hasVertesiaFragmentToken(),
    );
}

function base64url(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}
function randomValue(): string {
    return base64url(crypto.getRandomValues(new Uint8Array(32)));
}
function httpsUrl(value: string): URL {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('OAuth endpoint must use HTTPS');
    return url;
}

interface Transaction {
    state: string;
    verifier: string;
    created: number;
    clientId: string;
    redirectUri: string;
    issuer: string;
    target: string;
}

export function clearAppOAuth(): void {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TRANSACTION_KEY);
}

/** Public-client PKCE for independently hosted apps. No Firebase identity token or client secret. */
async function acquireToken(forceRefresh = false): Promise<string> {
    const config = Env.oauth;
    if (!config) throw new Error('Application OAuth is not configured');
    const clientId = config.clientId.trim();
    if (!clientId) throw new Error('OAuth client ID is required');
    const redirect = new URL(config.redirectUri);
    const loopback =
        redirect.hostname === 'localhost' ||
        redirect.hostname.endsWith('.localhost') ||
        redirect.hostname === '[::1]' ||
        /^127\.\d+\.\d+\.\d+$/.test(redirect.hostname);
    if (redirect.protocol !== 'https:' && !(loopback && redirect.protocol === 'http:')) {
        throw new Error('OAuth callback must use HTTPS or loopback HTTP');
    }
    const redirectUri = redirect.toString();
    if (new URL(redirectUri).origin !== window.location.origin) throw new Error('OAuth callback must be same-origin');
    const issuer = Env.endpoints.sts.replace(/\/+$/, '');
    const current = new URL(window.location.href);
    const callback = current.origin + current.pathname === new URL(redirectUri).origin + new URL(redirectUri).pathname;
    const state = callback ? current.searchParams.get('state') : null;
    const code = callback ? current.searchParams.get('code') : null;
    const error = callback ? current.searchParams.get('error') : null;
    let refreshCredential: string | undefined;
    let transaction: Transaction | undefined;
    if (state || code || error) {
        const raw = sessionStorage.getItem(TRANSACTION_KEY);
        sessionStorage.removeItem(TRANSACTION_KEY);
        transaction = raw ? (JSON.parse(raw) as Transaction) : undefined;
        if (
            !transaction ||
            transaction.state !== state ||
            transaction.clientId !== clientId ||
            transaction.redirectUri !== redirectUri ||
            transaction.issuer !== issuer ||
            Date.now() - transaction.created > MAX_TRANSACTION_AGE ||
            transaction.created > Date.now()
        ) {
            throw new Error('Invalid or expired OAuth login state');
        }
        if (error || !code) throw new Error(`Application sign-in was not completed (${error || 'missing code'})`);
    } else {
        const raw = sessionStorage.getItem(TOKEN_KEY);
        if (raw) {
            const cached = JSON.parse(raw) as {
                token: string;
                clientId: string;
                issuer: string;
                refreshToken?: string;
                tokenEndpoint?: string;
            };
            const claims = jwtDecode<AuthTokenPayload>(cached.token);
            if (
                config.offlineAccess &&
                cached.clientId === clientId &&
                cached.issuer === issuer &&
                (!current.searchParams.get('p') || claims.project?.id === current.searchParams.get('p')) &&
                (!current.searchParams.get('a') || claims.account?.id === current.searchParams.get('a'))
            )
                refreshCredential = cached.refreshToken;
            if (
                cached.clientId === clientId &&
                cached.issuer === issuer &&
                !forceRefresh &&
                claims.exp > Date.now() / 1000 + (config.offlineAccess ? 300 : 30) &&
                (!current.searchParams.get('p') || claims.project?.id === current.searchParams.get('p')) &&
                (!current.searchParams.get('a') || claims.account?.id === current.searchParams.get('a'))
            ) {
                return cached.token;
            }
        }
    }
    const discovery = await fetch(`${issuer}/.well-known/oauth-authorization-server`);
    if (!discovery.ok) throw new Error(`OAuth discovery failed (${discovery.status})`);
    const metadata: { issuer: string; authorization_endpoint: string; token_endpoint: string } = await discovery.json();
    if (metadata.issuer.replace(/\/+$/, '') !== issuer) throw new Error('OAuth issuer mismatch');
    const authorize = httpsUrl(metadata.authorization_endpoint);
    const tokenEndpoint = httpsUrl(metadata.token_endpoint);
    const resource = new URL(metadata.issuer).toString();
    if (refreshCredential) {
        try {
            const response = await fetch(tokenEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    client_id: clientId,
                    refresh_token: refreshCredential,
                    resource,
                }),
            });
            if (response.ok) {
                const grant = (await response.json()) as {
                    access_token?: string;
                    refresh_token?: string;
                    token_type?: string;
                };
                if (!grant.access_token || grant.token_type?.toLowerCase() !== 'bearer')
                    throw new OAuthLoginError('Invalid OAuth refresh grant');
                const claims = jwtDecode<AuthTokenPayload & { client_id?: string }>(grant.access_token);
                if (
                    claims.iss.replace(/\/+$/, '') !== issuer ||
                    claims.client_id !== clientId ||
                    claims.exp <= Date.now() / 1000
                )
                    throw new OAuthLoginError('Invalid OAuth refresh identity');
                sessionStorage.setItem(
                    TOKEN_KEY,
                    JSON.stringify({
                        token: grant.access_token,
                        clientId,
                        issuer,
                        refreshToken: grant.refresh_token ?? refreshCredential,
                        tokenEndpoint: tokenEndpoint.toString(),
                    }),
                );
                return grant.access_token;
            }
        } catch {
            // A failed or invalid refresh starts a fresh authorization transaction.
        }
        sessionStorage.removeItem(TOKEN_KEY);
    }
    if (transaction && code) {
        const response = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                resource,
                code,
                client_id: clientId,
                redirect_uri: redirectUri,
                code_verifier: transaction.verifier,
            }),
        });
        if (!response.ok) throw new Error(`OAuth code exchange failed (${response.status})`);
        const grant: { access_token?: string; token_type?: string; refresh_token?: string } = await response.json();
        if (!grant.access_token || grant.token_type?.toLowerCase() !== 'bearer') throw new Error('Invalid OAuth grant');
        const claims = jwtDecode<AuthTokenPayload & { client_id?: string }>(grant.access_token);
        if (
            claims.iss.replace(/\/+$/, '') !== issuer ||
            claims.client_id !== clientId ||
            claims.exp <= Date.now() / 1000
        ) {
            throw new Error('OAuth grant does not match this application');
        }
        sessionStorage.setItem(
            TOKEN_KEY,
            JSON.stringify({
                token: grant.access_token,
                clientId,
                issuer,
                refreshToken: config.offlineAccess ? grant.refresh_token : undefined,
                tokenEndpoint: tokenEndpoint.toString(),
            }),
        );
        const target = new URL(transaction.target);
        if (target.origin !== window.location.origin) throw new Error('Invalid OAuth return target');
        if (claims.account?.id) target.searchParams.set('a', claims.account.id);
        else target.searchParams.delete('a');
        if (claims.project?.id) target.searchParams.set('p', claims.project.id);
        else target.searchParams.delete('p');
        if (target.pathname === '/auth/callback') target.pathname = '/';
        window.history.replaceState(window.history.state, '', target);
        return grant.access_token;
    }
    let scopes = config.scopes ?? ['openid', 'profile'];
    if (clientId.startsWith('https://')) {
        const documentResponse = await fetch(httpsUrl(clientId), { cache: 'no-store' });
        if (!documentResponse.ok) throw new Error(`Application CIMD unavailable (${documentResponse.status})`);
        const document: { scope?: string; redirect_uris?: string[] } = await documentResponse.json();
        if (!document.redirect_uris?.includes(redirectUri))
            throw new Error('Application CIMD does not allow this callback');
        if (!config.scopes && document.scope) scopes = document.scope.split(/\s+/);
    }
    const verifier = randomValue();
    const next: Transaction = {
        state: randomValue(),
        verifier,
        clientId,
        redirectUri,
        issuer,
        target: current.toString(),
        created: Date.now(),
    };
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    authorize.searchParams.set('client_id', clientId);
    authorize.searchParams.set('redirect_uri', redirectUri);
    authorize.searchParams.set('response_type', 'code');
    authorize.searchParams.set('resource', resource);
    authorize.searchParams.set('state', next.state);
    authorize.searchParams.set('code_challenge_method', 'S256');
    authorize.searchParams.set('code_challenge', base64url(new Uint8Array(digest)));
    authorize.searchParams.set(
        'scope',
        (config.offlineAccess
            ? [...new Set([...scopes, 'offline_access'])]
            : scopes.filter((s) => s !== 'offline_access')
        ).join(' '),
    );
    const account = current.searchParams.get('a');
    if (account) authorize.searchParams.set('account_id', account);
    const project = current.searchParams.get('p');
    if (project) authorize.searchParams.set('project_id', project);
    sessionStorage.setItem(TRANSACTION_KEY, JSON.stringify(next));
    markCentralAuthRoundTripStarted();
    window.location.replace(authorize.toString());
    return new Promise(() => {});
}

export function getAppOAuthToken(forceRefresh = false): Promise<string> {
    pending ??= acquireToken(forceRefresh).finally(() => {
        pending = undefined;
    });
    return pending;
}

export function isAppOAuthLoginPending(): boolean {
    return usesAppOAuth();
}
export const startAppOAuthLogin = getAppOAuthToken;

export async function revokeAppOAuthSession(): Promise<void> {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    clearAppOAuth();
    if (!raw) return;
    const cached = JSON.parse(raw) as { refreshToken?: string; tokenEndpoint?: string; clientId: string };
    if (!cached.refreshToken || !cached.tokenEndpoint) return;
    const revoke = httpsUrl(cached.tokenEndpoint);
    revoke.pathname = revoke.pathname.replace(/\/token$/, '/revoke');
    await fetch(revoke, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: cached.clientId,
            token: cached.refreshToken,
            token_type_hint: 'refresh_token',
        }),
    });
}
