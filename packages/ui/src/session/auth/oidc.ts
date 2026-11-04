import { Env } from '@vertesia/ui/env';
import { jwtDecode } from 'jwt-decode';
import { isLoopbackHostname } from './vertesiaHosts';

/**
 * Sign-in through a standard OpenID Connect provider, in place of Firebase, for an environment that
 * signs every user in through one directory (`Env.oidc`): authorization code with PKCE, as a public
 * client, against the provider's own endpoints.
 *
 * The page sends the user to the provider, the provider returns to {@link OIDC_CALLBACK_PATH} on
 * the same origin, and {@link completeOidcSignIn} exchanges the code for an ID token. That ID token
 * is the credential the rest of the session hands to the STS, exactly where a Firebase ID token is
 * handed today. Its signature is verified by the STS; the checks here (state, nonce, issuer,
 * audience, expiry) keep this page from adopting a token that was not issued for this sign-in.
 *
 * The provider must allow this origin to call its token endpoint (CORS): an Okta "Trusted Origin",
 * or the "Single-page application" platform of an Entra ID app registration.
 */

export const OIDC_CALLBACK_PATH = '/oidc/callback';

const TRANSACTION_KEY = 'vertesia.oidc.transaction';
const ID_TOKEN_KEY = 'vertesia.oidc.id_token';
const MAX_TRANSACTION_AGE_MS = 10 * 60_000;
/** An ID token closer than this to its expiry is not handed out. */
const EXPIRY_MARGIN_SECONDS = 30;

interface OidcMetadata {
    issuer: string;
    authorization_endpoint: string;
    token_endpoint: string;
    end_session_endpoint?: string;
}

interface OidcTransaction {
    state: string;
    nonce: string;
    verifier: string;
    issuer: string;
    clientId: string;
    created: number;
    /** Same-origin URL to return to once the sign-in completes. */
    returnTo: string;
}

interface StoredIdToken {
    idToken: string;
    issuer: string;
    clientId: string;
    exp: number;
}

export class OidcSignInError extends Error {
    constructor(message: string, options?: { cause?: unknown }) {
        super(message, options);
        this.name = 'OidcSignInError';
    }
}

/** Whether this environment signs users in through an OIDC provider rather than Firebase. */
export function usesOidcSignIn(): boolean {
    return Boolean(Env.oidc);
}

function requireConfig() {
    const config = Env.oidc;
    if (!config) throw new OidcSignInError('OIDC sign-in is not configured');
    return { ...config, issuer: config.issuer.trim(), clientId: config.clientId.trim() };
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

function validatedEndpoint(value: unknown, name: string): string {
    if (typeof value !== 'string') throw new OidcSignInError(`The provider advertises no ${name}`);
    const url = new URL(value);
    const localHttp = url.protocol === 'http:' && isLoopbackHostname(url.hostname);
    if ((url.protocol !== 'https:' && !localHttp) || url.username || url.password) {
        throw new OidcSignInError(`The provider's ${name} must use HTTPS`);
    }
    return url.toString();
}

const metadataCache = new Map<string, Promise<OidcMetadata>>();

function discover(issuer: string): Promise<OidcMetadata> {
    let cached = metadataCache.get(issuer);
    if (!cached) {
        cached = (async () => {
            const response = await fetch(`${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`);
            if (!response.ok) throw new OidcSignInError(`OIDC discovery failed (${response.status})`);
            const metadata = (await response.json()) as Record<string, unknown>;
            // The document must describe the configured issuer, or its endpoints belong to someone else.
            if (metadata.issuer !== issuer) throw new OidcSignInError('OIDC discovery describes another issuer');
            return {
                issuer,
                authorization_endpoint: validatedEndpoint(metadata.authorization_endpoint, 'authorization endpoint'),
                token_endpoint: validatedEndpoint(metadata.token_endpoint, 'token endpoint'),
                end_session_endpoint:
                    metadata.end_session_endpoint === undefined
                        ? undefined
                        : validatedEndpoint(metadata.end_session_endpoint, 'end session endpoint'),
            };
        })();
        cached.catch(() => metadataCache.delete(issuer));
        metadataCache.set(issuer, cached);
    }
    return cached;
}

function redirectUri(): string {
    return `${window.location.origin}${OIDC_CALLBACK_PATH}`;
}

function sameOriginUrl(value: string | undefined): string {
    const url = new URL(value ?? window.location.href, window.location.href);
    if (url.origin !== window.location.origin)
        throw new OidcSignInError('The sign-in return target must be same-origin');
    return url.toString();
}

/**
 * Send the user to the provider's sign-in page. Resolves only if navigation does not happen.
 *
 * @param options.loginHint pre-fills the provider's username field.
 * @param options.returnTo same-origin URL to come back to; defaults to the current page, query included.
 */
export async function startOidcSignIn(options: { loginHint?: string; returnTo?: string } = {}): Promise<void> {
    const config = requireConfig();
    const metadata = await discover(config.issuer);
    const verifier = randomValue();
    const transaction: OidcTransaction = {
        state: randomValue(),
        nonce: randomValue(),
        verifier,
        issuer: config.issuer,
        clientId: config.clientId,
        created: Date.now(),
        returnTo: sameOriginUrl(options.returnTo),
    };
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));

    const authorize = new URL(metadata.authorization_endpoint);
    authorize.searchParams.set('response_type', 'code');
    authorize.searchParams.set('client_id', config.clientId);
    authorize.searchParams.set('redirect_uri', redirectUri());
    authorize.searchParams.set('scope', (config.scopes ?? ['openid', 'email', 'profile']).join(' '));
    authorize.searchParams.set('state', transaction.state);
    authorize.searchParams.set('nonce', transaction.nonce);
    authorize.searchParams.set('code_challenge', base64url(new Uint8Array(digest)));
    authorize.searchParams.set('code_challenge_method', 'S256');
    if (options.loginHint) authorize.searchParams.set('login_hint', options.loginHint);

    sessionStorage.setItem(TRANSACTION_KEY, JSON.stringify(transaction));
    window.location.assign(authorize.toString());
}

interface IdTokenClaims {
    iss?: string;
    aud?: string | string[];
    exp?: number;
    nonce?: string;
}

/**
 * Finish a sign-in when the provider has returned to {@link OIDC_CALLBACK_PATH}: check the state,
 * exchange the code, check the ID token, store it, and put the page back on the URL the sign-in
 * started from. Call it before routing reads the location.
 *
 * @returns `false` when the current page is not the callback.
 * @throws OidcSignInError when the provider reported an error or the response does not belong to
 * the sign-in this page started.
 */
export function completeOidcSignIn(): Promise<boolean> {
    // The exchange leaves the callback URL before it finishes, so a caller arriving meanwhile (React
    // Strict Mode runs a provider's effect twice) would see an ordinary page and no token yet, and
    // sign the user out. It waits for the same exchange instead.
    if (pendingCompletion !== undefined) return pendingCompletion;
    if (!Env.oidc || window.location.pathname !== OIDC_CALLBACK_PATH) return Promise.resolve(false);
    pendingCompletion = finishOidcCallback().finally(() => {
        pendingCompletion = undefined;
    });
    return pendingCompletion;
}

let pendingCompletion: Promise<boolean> | undefined;

async function finishOidcCallback(): Promise<boolean> {
    const params = new URLSearchParams(window.location.search);
    const raw = sessionStorage.getItem(TRANSACTION_KEY);
    sessionStorage.removeItem(TRANSACTION_KEY);
    const transaction = raw ? (JSON.parse(raw) as OidcTransaction) : undefined;
    const config = requireConfig();

    // Leave the callback URL first, whatever the outcome: it carries a one-time code.
    const returnTo = transaction ? transaction.returnTo : '/';
    window.history.replaceState(window.history.state, '', returnTo);

    if (
        !transaction ||
        transaction.state !== params.get('state') ||
        transaction.issuer !== config.issuer ||
        transaction.clientId !== config.clientId ||
        transaction.created > Date.now() ||
        Date.now() - transaction.created > MAX_TRANSACTION_AGE_MS
    ) {
        throw new OidcSignInError('Invalid or expired sign-in state');
    }
    const error = params.get('error');
    const code = params.get('code');
    if (error || !code) {
        throw new OidcSignInError(`Sign-in was not completed (${error ?? 'missing code'})`);
    }

    const metadata = await discover(config.issuer);
    const response = await fetch(metadata.token_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri(),
            client_id: config.clientId,
            code_verifier: transaction.verifier,
        }),
    });
    const body = (await response.json().catch(() => ({}))) as { id_token?: unknown; error?: unknown };
    if (!response.ok || typeof body.id_token !== 'string') {
        throw new OidcSignInError(
            `The provider refused the sign-in (${typeof body.error === 'string' ? body.error : response.status})`,
        );
    }

    let claims: IdTokenClaims;
    try {
        claims = jwtDecode<IdTokenClaims>(body.id_token);
    } catch (err: unknown) {
        throw new OidcSignInError('The provider returned an unreadable ID token', { cause: err });
    }
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (
        claims.iss !== config.issuer ||
        !audiences.includes(config.clientId) ||
        claims.nonce !== transaction.nonce ||
        typeof claims.exp !== 'number' ||
        claims.exp <= Date.now() / 1000
    ) {
        throw new OidcSignInError('The ID token was not issued for this sign-in');
    }

    const stored: StoredIdToken = {
        idToken: body.id_token,
        issuer: config.issuer,
        clientId: config.clientId,
        exp: claims.exp,
    };
    sessionStorage.setItem(ID_TOKEN_KEY, JSON.stringify(stored));
    return true;
}

/** The ID token of the current sign-in, or `undefined` when there is none or it is about to expire. */
export function getOidcIdToken(): string | undefined {
    const config = Env.oidc;
    const raw = sessionStorage.getItem(ID_TOKEN_KEY);
    if (!config || !raw) return undefined;
    try {
        const stored = JSON.parse(raw) as StoredIdToken;
        if (
            stored.issuer === config.issuer.trim() &&
            stored.clientId === config.clientId.trim() &&
            stored.exp > Date.now() / 1000 + EXPIRY_MARGIN_SECONDS
        ) {
            return stored.idToken;
        }
    } catch {
        // Unreadable: treated as signed out.
    }
    sessionStorage.removeItem(ID_TOKEN_KEY);
    return undefined;
}

/** Forget the sign-in in this browser tab. The provider's own session is left as it is. */
export function clearOidcSession(): void {
    sessionStorage.removeItem(ID_TOKEN_KEY);
    sessionStorage.removeItem(TRANSACTION_KEY);
}
