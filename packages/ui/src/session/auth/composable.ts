/**
 * Handle client caching and refresh of auth token
 */
import {
    type AuthTokenPayload,
    NO_ACCESSIBLE_ACCOUNT_ERROR_CODE,
    REQUESTED_SCOPE_UNAVAILABLE_ERROR_CODE,
    RESTRICTED_ENVIRONMENT_ERROR_CODE,
} from '@vertesia/common';
import { Env } from '@vertesia/ui/env';
import { jwtDecode } from 'jwt-decode';
import { LastSelectedAccountId_KEY, LastSelectedProjectId_KEY } from '../constants';
import { generateAuthState } from './authState';
import {
    authReturnUrl,
    buildCentralAuthRedirectUrl,
    centralAuthUrl,
    shouldRedirectToCentralAuth,
} from './domainRouting';
import { getFirebaseAuth, getFirebaseAuthToken } from './firebase';

let AUTH_TOKEN_RAW: string | undefined;
let AUTH_TOKEN: AuthTokenPayload | undefined;

/**
 * Whether this tab ever held a token.
 *
 * Separates "the session expired" from "there is no session yet". Only the first is renewed from
 * here; the first load is UserSessionProvider's, and it has the account/project selection that
 * this layer does not.
 */
let HAD_SESSION = false;

/** Session-storage stamp of the last renewal redirect, so the cooldown survives the navigation. */
const RENEWAL_ATTEMPT_KEY = 'vt.centralAuthRenewalAt';
const RENEWAL_COOLDOWN_MS = 60_000;

/**
 * Renew an expired Central Auth session by bouncing through the broker.
 *
 * A Central Auth session holds exactly one credential -- the STS JWT, in memory -- and STS refuses
 * it once it has expired. There is no Firebase user in this browser to mint a replacement from and
 * no refresh token, so the only way back is the broker, which still has the user's own session and
 * returns a fresh identity token without prompting. That is precisely what a manual reload does
 * today; doing it here turns a page that dead-ends on "Cannot acquire a composable token" into a
 * redirect the user usually does not notice.
 *
 * The cooldown is the important part. If the broker returns a credential STS also rejects, an
 * unguarded redirect bounces the browser between the two forever -- and a redirect loop is a worse
 * failure than the error page it replaced, because it never comes to rest anywhere the user can
 * read. One attempt per minute, recorded in sessionStorage because the module state does not
 * survive the navigation this function starts.
 *
 * Returns whether a redirect was started.
 */
function renewExpiredCentralAuthSession(): boolean {
    if (!HAD_SESSION || !shouldRedirectToCentralAuth()) {
        return false;
    }

    let lastAttempt = 0;
    try {
        lastAttempt = Number(sessionStorage.getItem(RENEWAL_ATTEMPT_KEY) ?? '0');
    } catch {
        // sessionStorage unavailable -- treated as "no previous attempt", so the redirect is
        // allowed once and the failure surfaces normally if it does not stick.
    }
    if (Number.isFinite(lastAttempt) && lastAttempt > 0 && Date.now() - lastAttempt < RENEWAL_COOLDOWN_MS) {
        Env.logger.warn('Central Auth session renewal already attempted; surfacing the failure instead', {
            vertesia: { last_attempt_ms_ago: Date.now() - lastAttempt },
        });
        return false;
    }

    try {
        sessionStorage.setItem(RENEWAL_ATTEMPT_KEY, String(Date.now()));
    } catch {
        // Without the stamp the cooldown cannot be enforced across the navigation. Still worth
        // redirecting once: the alternative is a page the user can only fix by reloading manually.
    }

    Env.logger.info('Renewing an expired Central Auth session through the broker');
    const url = buildCentralAuthRedirectUrl(
        centralAuthUrl(),
        Env.endpoints.sts ?? 'https://sts.vertesia.io',
        authReturnUrl(),
        generateAuthState(),
    );
    location.replace(url.toString());
    return true;
}

function clearRejectedPersistedScope(accountId?: string, projectId?: string) {
    if (!accountId) return;

    const projectKey = `${LastSelectedProjectId_KEY}-${accountId}`;
    if (projectId) {
        const persistedProjectMatches = localStorage.getItem(projectKey) === projectId;
        if (persistedProjectMatches) {
            localStorage.removeItem(projectKey);
        }
        if (persistedProjectMatches && localStorage.getItem(LastSelectedAccountId_KEY) === accountId) {
            localStorage.removeItem(LastSelectedAccountId_KEY);
        }
        return;
    }

    if (localStorage.getItem(LastSelectedAccountId_KEY) === accountId) {
        localStorage.removeItem(LastSelectedAccountId_KEY);
        localStorage.removeItem(projectKey);
    }
}

interface ComposableTokenResponse {
    rawToken: string;
    token: AuthTokenPayload;
    error: boolean;
    message?: string;
}

export interface AuthenticatedIdentity {
    email: string;
    name?: string;
}

function identityFromAcceptedToken(token: string): AuthenticatedIdentity | undefined {
    try {
        const payload = jwtDecode<{ email?: unknown; name?: unknown }>(token);
        if (typeof payload.email !== 'string' || !payload.email) return undefined;
        return {
            email: payload.email,
            name: typeof payload.name === 'string' && payload.name ? payload.name : undefined,
        };
    } catch {
        return undefined;
    }
}

export function resolveAuthSelection(currentUrl: URL): { accountId?: string; projectId?: string } {
    const urlAccount = currentUrl.searchParams.get('a') ?? undefined;
    const urlProject = currentUrl.searchParams.get('p') ?? undefined;
    const accountId =
        urlAccount ??
        (urlProject === undefined ? (localStorage.getItem(LastSelectedAccountId_KEY) ?? undefined) : undefined);
    const projectId = urlProject ?? localStorage.getItem(`${LastSelectedProjectId_KEY}-${accountId}`) ?? undefined;

    return { accountId, projectId };
}

function normalizeIssuer(value: string | undefined): string | undefined {
    return value?.replace(/\/+$/, '');
}

function decodeToken(token: string): AuthTokenPayload {
    return jwtDecode(token) as AuthTokenPayload;
}

function isVertesiaIssuedToken(token: string | undefined): token is string {
    if (!token) return false;
    try {
        const decoded = decodeToken(token) as AuthTokenPayload & { iss?: string };
        return normalizeIssuer(decoded.iss) === normalizeIssuer(Env.endpoints.sts);
    } catch {
        return false;
    }
}

function canUseVertesiaTokenDirectly(token: string, accountId?: string, projectId?: string): boolean {
    const decoded = decodeToken(token);
    if (!decoded.exp || decoded.exp <= Date.now() / 1000 + 300) {
        return false;
    }
    const hasAuthorizationClaims = Boolean(
        decoded.permissions?.length ||
            decoded.account_roles?.length ||
            decoded.project_roles?.length ||
            decoded.apps?.length,
    );
    if (!hasAuthorizationClaims) {
        return false;
    }
    if (accountId && decoded.account?.id !== accountId) {
        return false;
    }
    if (projectId && decoded.project?.id !== projectId) {
        return false;
    }
    return true;
}

export async function fetchComposableToken(
    getIdToken: () => Promise<string | null | undefined>,
    accountId?: string,
    projectId?: string,
    ttl?: number,
    retryCount = 0,
): Promise<string> {
    Env.logger.debug('Getting/refreshing composable token', {
        vertesia: {
            account_id: accountId,
            project_id: projectId,
            retry_count: retryCount,
        },
    });

    const idToken = await getIdToken(); //get from firebase
    if (!idToken) {
        throw new Error('No id token found');
    }

    // Use STS endpoint - either configured or default to sts.vertesia.io
    const stsEndpoint = Env.endpoints.sts;
    Env.logger.debug('Using STS for token generation', {
        vertesia: {
            account_id: accountId,
            project_id: projectId,
            sts_url: stsEndpoint,
        },
    });

    try {
        // Call STS to generate a user token
        const stsUrl = new URL(`${stsEndpoint}/token/issue`);
        const requestBody = {
            type: 'user',
            account_id: accountId,
            project_id: projectId,
            expires_at: ttl ? Math.floor(Date.now() / 1000) + ttl : undefined,
        };

        const stsRes = await fetch(stsUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`, // Firebase token for authentication
            },
            body: JSON.stringify(requestBody),
        }).catch((error) => {
            console.error('Failed to call STS endpoint', error);
            Env.logger.error('Failed to call STS endpoint', {
                vertesia: {
                    account_id: accountId,
                    project_id: projectId,
                    error: error,
                },
            });
            throw new AuthenticationServiceError('The authentication service could not be reached', stsEndpoint, {
                cause: error,
            });
        });

        if (idToken && stsRes?.status === 404) {
            // User not found in token-server - call ensure-user endpoint
            Env.logger.debug('404: User not found - calling ensure-user endpoint', {
                vertesia: {
                    account_id: accountId,
                    project_id: projectId,
                    status: stsRes?.status,
                },
            });

            const ensureResponse = await fetch(`${Env.endpoints.studio}/auth/ensure-user`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${idToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (ensureResponse.status === 412) {
                // No invite - trigger signup
                Env.logger.debug('412: No invite found - signup required', {
                    vertesia: {
                        account_id: accountId,
                        project_id: projectId,
                    },
                });
                const idTokenDecoded = jwtDecode<{ email?: string }>(idToken);
                if (!idTokenDecoded?.email) {
                    Env.logger.error('No email found in id token');
                    throw new Error('No email found in id token');
                }
                throw new UserNotFoundError('User not found - signup required', idTokenDecoded.email);
            }

            if (ensureResponse.status === 403) {
                // SigninScreen keys the invite-required view off this message.
                Env.logger.warn('403: Customer-domain user requires an invite to join', {
                    vertesia: {
                        account_id: accountId,
                        project_id: projectId,
                    },
                });
                throw new Error('Customer-domain user requires an invite to join');
            }

            if (!ensureResponse.ok) {
                console.error('Failed to ensure user exists', ensureResponse.status);
                Env.logger.error('Failed to ensure user exists', {
                    vertesia: {
                        account_id: accountId,
                        project_id: projectId,
                        status: ensureResponse.status,
                    },
                });
                throw new Error('Failed to ensure user exists');
            }

            // User created/exists - retry token generation
            Env.logger.debug('User ensured - retrying token generation', {
                vertesia: {
                    account_id: accountId,
                    project_id: projectId,
                },
            });
            return fetchComposableToken(getIdToken, accountId, projectId, ttl, retryCount);
        }

        if (idToken && stsRes?.status === 412) {
            Env.logger.info("412: auth succeeded but user doesn't exist - signup required", {
                vertesia: {
                    account_id: accountId,
                    project_id: projectId,
                    status: stsRes?.status,
                },
            });
            const idTokenDecoded = jwtDecode<{ email?: string }>(idToken);
            if (!idTokenDecoded?.email) {
                Env.logger.error('No email found in id token');
                throw new Error('No email found in id token');
            }
            Env.logger.info('User not found', {
                vertesia: {
                    account_id: accountId,
                    project_id: projectId,
                    email: idTokenDecoded.email,
                },
            });
            throw new UserNotFoundError('User not found', idTokenDecoded.email);
        }

        if (stsRes.status === 401) {
            Env.logger.warn('STS rejected the identity credential', {
                vertesia: { account_id: accountId, project_id: projectId, status: stsRes.status },
            });
            throw new CredentialError('Your sign-in credentials could not be verified', stsEndpoint, {
                status: stsRes.status,
            });
        }

        if (stsRes.status === 403) {
            const body = (await stsRes.json().catch(() => undefined)) as
                | { errorCode?: string; message?: string }
                | undefined;
            const identity = identityFromAcceptedToken(idToken);
            if (body?.errorCode === RESTRICTED_ENVIRONMENT_ERROR_CODE) {
                Env.logger.warn('403: User lacks early-access for this restricted environment', {
                    vertesia: {
                        account_id: accountId,
                        project_id: projectId,
                    },
                });
                throw new RestrictedEnvironmentError(
                    body.message ?? "You don't have sufficient permission to visit unstable environments",
                );
            }

            if (body?.errorCode === NO_ACCESSIBLE_ACCOUNT_ERROR_CODE) {
                Env.logger.warn('STS identity has no accessible account', {
                    vertesia: { error_code: body.errorCode, status: stsRes.status },
                });
                throw new NoAccessibleAccountError(stsEndpoint, body.message, identity);
            }

            // During rolling deployment an older STS may return an uncoded user-token 403.
            // Treat it as a requested-scope rejection; all calls in this function issue user tokens.
            if (!body?.errorCode || body.errorCode === REQUESTED_SCOPE_UNAVAILABLE_ERROR_CODE) {
                Env.logger.warn('STS rejected the requested account or project', {
                    vertesia: {
                        account_id: accountId,
                        project_id: projectId,
                        status: stsRes.status,
                        error_code: body?.errorCode ?? REQUESTED_SCOPE_UNAVAILABLE_ERROR_CODE,
                    },
                });
                throw new RequestedScopeUnavailableError(
                    stsEndpoint,
                    accountId,
                    projectId,
                    body?.errorCode ? body.message : undefined,
                    identity,
                );
            }

            Env.logger.error('STS returned an unrecognized forbidden response', {
                vertesia: {
                    account_id: accountId,
                    project_id: projectId,
                    status: stsRes.status,
                    error_code: body.errorCode,
                },
            });
            throw new AuthenticationServiceError('The authentication service rejected the request', stsEndpoint, {
                status: stsRes.status,
                errorCode: body.errorCode,
                cause: body,
            });
        }

        if (!stsRes.ok) {
            const errorText = await stsRes.text();
            console.error('STS token generation failed:', stsRes.status, errorText);
            Env.logger.error('STS token generation failed', {
                vertesia: {
                    status: stsRes.status,
                    error: errorText,
                    account_id: accountId,
                    project_id: projectId,
                },
            });
            throw new AuthenticationServiceError('The authentication service could not complete sign-in', stsEndpoint, {
                status: stsRes.status,
                cause: errorText,
            });
        }

        const { token } = await stsRes.json();
        Env.logger.debug('Successfully got token from STS');
        return token;
    } catch (error) {
        if (
            error instanceof UserNotFoundError ||
            error instanceof STSError ||
            error instanceof RestrictedEnvironmentError
        ) {
            // Re-throw typed auth errors to be handled separately in the caller
            throw error;
        }

        if (error instanceof Error && error.message === 'Customer-domain user requires an invite to join') throw error;
        console.error('Failed to get composable token from STS', error);
        Env.logger.error('Failed to get composable token from STS', {
            vertesia: {
                account_id: accountId,
                project_id: projectId,
                error: error,
            },
        });
        throw new AuthenticationServiceError('The authentication service could not complete sign-in', stsEndpoint, {
            cause: error,
        });
    }
}

/**
 *
 * @param accountId
 * @param projectId
 * @param ttl time to live for the token in seconds
 * @returns
 */
export async function fetchComposableTokenFromFirebaseToken(accountId?: string, projectId?: string, ttl?: number) {
    return fetchComposableToken(getFirebaseAuthToken, accountId, projectId, ttl);
}

/**
 * Mint a scoped Vertesia token from an existing Vertesia JWT. STS accepts STS-issued
 * tokens on /token/issue, so this works for sessions established via Central Auth where
 * the browser has no Firebase user.
 */
export async function fetchComposableTokenFromVertesiaToken(
    vertesiaToken: string,
    accountId?: string,
    projectId?: string,
    ttl?: number,
) {
    return fetchComposableToken(() => Promise.resolve(vertesiaToken), accountId, projectId, ttl);
}

/** Returns the cached Vertesia raw JWT, if any. Does not refresh. */
export function getCurrentVertesiaToken(): string | undefined {
    return AUTH_TOKEN_RAW;
}

export async function getComposableToken(
    accountId?: string,
    projectId?: string,
    initToken?: string,
    forceRefresh = false,
    useInternalAuth = false,
): Promise<ComposableTokenResponse> {
    const selectedAccount =
        accountId ??
        (projectId === undefined ? (localStorage.getItem(LastSelectedAccountId_KEY) ?? undefined) : undefined);
    const selectedProject =
        projectId ?? localStorage.getItem(`${LastSelectedProjectId_KEY}-${selectedAccount}`) ?? undefined;
    const devAuthToken = Env.isLocalDev ? Env.devAuthToken : undefined;
    const suppliedToken = devAuthToken ?? initToken ?? AUTH_TOKEN_RAW;

    const cachedTokenMatchesScope =
        (!selectedAccount || AUTH_TOKEN?.account?.id === selectedAccount) &&
        (!selectedProject || AUTH_TOKEN?.project?.id === selectedProject);

    // Token is still valid for more than 5 minutes and belongs to the requested scope.
    if (
        !forceRefresh &&
        AUTH_TOKEN_RAW &&
        AUTH_TOKEN &&
        cachedTokenMatchesScope &&
        AUTH_TOKEN.exp > Date.now() / 1000 + 300
    ) {
        HAD_SESSION = true;
        return { rawToken: AUTH_TOKEN_RAW, token: AUTH_TOKEN, error: false };
    }

    if (
        !forceRefresh &&
        isVertesiaIssuedToken(suppliedToken) &&
        canUseVertesiaTokenDirectly(suppliedToken, selectedAccount, selectedProject)
    ) {
        AUTH_TOKEN_RAW = suppliedToken;
        AUTH_TOKEN = decodeToken(AUTH_TOKEN_RAW);
        if (!AUTH_TOKEN.exp) {
            throw new Error('Invalid composable token');
        }
        HAD_SESSION = true;
        return { rawToken: AUTH_TOKEN_RAW, token: AUTH_TOKEN, error: false };
    }

    try {
        //token is close to expire, refresh it
        if (!devAuthToken && !useInternalAuth && getFirebaseAuth().currentUser) {
            //we have a firebase user, get the token from there
            AUTH_TOKEN_RAW = await fetchComposableTokenFromFirebaseToken(selectedAccount, selectedProject);
        } else if (!devAuthToken) {
            // Embedded apps can reacquire a fresh credential from their host after their cached token expires.
            const refreshCredential = (await Env.authTokenProvider?.()) ?? initToken ?? AUTH_TOKEN_RAW;
            // `forceRefresh` has to defeat this shortcut, not just the cache above it. A caller
            // asking for a forced refresh wants claims recomputed -- `refreshAuthToken()` exists so
            // a stale `apps` claim can be re-read after an ACE change, and STS recomputes it on
            // every issuance. Adopting the credential we already hold satisfies the check and
            // returns the very token whose claims were suspect, silently making the call a no-op
            // for exactly the sessions that have no other credential to fall back on.
            if (
                !forceRefresh &&
                refreshCredential &&
                isVertesiaIssuedToken(refreshCredential) &&
                canUseVertesiaTokenDirectly(refreshCredential, selectedAccount, selectedProject)
            ) {
                AUTH_TOKEN_RAW = refreshCredential;
            } else if (refreshCredential) {
                AUTH_TOKEN_RAW = await fetchComposableToken(
                    () => Promise.resolve(refreshCredential),
                    selectedAccount,
                    selectedProject,
                );
            } else {
                AUTH_TOKEN_RAW = undefined;
            }
        } else if (devAuthToken) {
            AUTH_TOKEN_RAW = devAuthToken;
        }
    } catch (error: unknown) {
        if (
            error instanceof RequestedScopeUnavailableError ||
            error instanceof NoAccessibleAccountError ||
            error instanceof CredentialError
        ) {
            AUTH_TOKEN_RAW = undefined;
            AUTH_TOKEN = undefined;
            if (error instanceof RequestedScopeUnavailableError) {
                clearRejectedPersistedScope(selectedAccount, selectedProject);
            }
        }
        // An expired Central Auth session presents as a rejected credential: the JWT we sent STS to
        // renew from is the one that timed out. The broker can still vouch for the user. Only this
        // error -- a scope or account failure is about who the user is, and the broker would hand
        // back the same identity and the same refusal.
        if (error instanceof CredentialError) {
            renewExpiredCentralAuthSession();
        }
        throw error;
    }

    if (!AUTH_TOKEN_RAW) {
        Env.logger.error('Cannot acquire a composable token', {
            vertesia: {
                account_id: selectedAccount,
                project_id: selectedProject,
            },
        });
        // Reached once the credential has already been discarded -- typically the call after the
        // one that saw STS reject it. Same remedy, and the cooldown keeps this from redirecting a
        // second time for the same expiry.
        renewExpiredCentralAuthSession();
        throw new Error('Cannot acquire a composable token');
    }

    AUTH_TOKEN = decodeToken(AUTH_TOKEN_RAW);

    if (!AUTH_TOKEN?.exp || !AUTH_TOKEN_RAW) {
        console.error('Invalid composable token', AUTH_TOKEN);
        Env.logger.error('Invalid composable token', {
            vertesia: {
                account_id: selectedAccount,
                project_id: selectedProject,
            },
        });
        throw new Error('Invalid composable token');
    }

    HAD_SESSION = true;
    return { rawToken: AUTH_TOKEN_RAW, token: AUTH_TOKEN, error: false };
}

export class UserNotFoundError extends Error {
    email: string;
    constructor(message: string, email: string) {
        super(message);
        this.name = 'UserNotFoundError';
        this.email = email;
    }
}

export class STSError extends Error {
    stsURL: string;
    readonly status?: number;
    readonly errorCode?: string;
    constructor(message: string, stsURL: string, options?: ErrorOptions & { status?: number; errorCode?: string }) {
        super(message, options);
        this.name = 'STSError';
        this.stsURL = stsURL;
        this.status = options?.status;
        this.errorCode = options?.errorCode;
    }
}

export type RequestedScopeKind = 'account' | 'project';
export type AuthSelectorSource = 'url' | 'persisted';

export class RequestedScopeUnavailableError extends STSError {
    requestedScope: RequestedScopeKind;
    selectorSource?: AuthSelectorSource;
    recoveryUrl?: string;

    constructor(
        stsURL: string,
        public readonly accountId?: string,
        public readonly projectId?: string,
        responseMessage?: string,
        public readonly identity?: AuthenticatedIdentity,
    ) {
        super(responseMessage ?? 'The requested account or project is not available.', stsURL, {
            status: 403,
            errorCode: REQUESTED_SCOPE_UNAVAILABLE_ERROR_CODE,
        });
        this.name = 'RequestedScopeUnavailableError';
        this.requestedScope = projectId ? 'project' : 'account';
    }
}

/** @deprecated Use RequestedScopeUnavailableError. */
export const TokenAuthorizationError = RequestedScopeUnavailableError;
/** @deprecated Use RequestedScopeUnavailableError. */
export type TokenAuthorizationError = RequestedScopeUnavailableError;

export class NoAccessibleAccountError extends STSError {
    constructor(
        stsURL: string,
        responseMessage?: string,
        public readonly identity?: AuthenticatedIdentity,
    ) {
        super(responseMessage ?? 'No accessible account is available for this user.', stsURL, {
            status: 403,
            errorCode: NO_ACCESSIBLE_ACCOUNT_ERROR_CODE,
        });
        this.name = 'NoAccessibleAccountError';
    }
}

export class CredentialError extends STSError {
    constructor(message: string, stsURL: string, options?: ErrorOptions & { status?: number; errorCode?: string }) {
        super(message, stsURL, options);
        this.name = 'CredentialError';
    }
}

export class AuthenticationServiceError extends STSError {
    constructor(message: string, stsURL: string, options?: ErrorOptions & { status?: number; errorCode?: string }) {
        super(message, stsURL, options);
        this.name = 'AuthenticationServiceError';
    }
}

export function isRequestedScopeUnavailableError(error: unknown): error is RequestedScopeUnavailableError {
    return error instanceof RequestedScopeUnavailableError;
}

export function isNoAccessibleAccountError(error: unknown): error is NoAccessibleAccountError {
    return error instanceof NoAccessibleAccountError;
}

export function isCredentialError(error: unknown): error is CredentialError {
    return error instanceof CredentialError;
}

export function isAuthenticationServiceError(error: unknown): error is AuthenticationServiceError {
    return error instanceof AuthenticationServiceError;
}

/**
 * Thrown when the STS rejects sign-in because the current environment (preview/preprod) is
 * restricted to early-access users and this user lacks the `early-access` annotation. The
 * sign-in screen renders a dedicated "restricted environment" step for this error.
 * See docs/restrict-access-to-non-production-envs.md.
 */
export class RestrictedEnvironmentError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'RestrictedEnvironmentError';
    }
}
