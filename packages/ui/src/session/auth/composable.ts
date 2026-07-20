/**
 * Handle client caching and refresh of auth token
 */
import type { AuthTokenPayload } from '@vertesia/common';
import { Env } from '@vertesia/ui/env';
import { jwtDecode } from 'jwt-decode';
import { LastSelectedAccountId_KEY, LastSelectedProjectId_KEY } from '../constants';
import { getFirebaseAuth, getFirebaseAuthToken } from './firebase';

let AUTH_TOKEN_RAW: string | undefined;
let AUTH_TOKEN: AuthTokenPayload | undefined;

function clearRejectedPersistedScope(accountId?: string, projectId?: string) {
    if (!accountId) return;

    const projectKey = `${LastSelectedProjectId_KEY}-${accountId}`;
    if (projectId) {
        if (localStorage.getItem(projectKey) === projectId) {
            localStorage.removeItem(projectKey);
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

export async function fetchComposableToken(
    getIdToken: () => Promise<string | null | undefined>,
    accountId?: string,
    projectId?: string,
    ttl?: number,
    retryCount = 0,
): Promise<string> {
    console.log(`Getting/refreshing composable token for account ${accountId} and project ${projectId} `);
    Env.logger.info('Getting/refreshing composable token', {
        vertesia: {
            account_id: accountId,
            project_id: projectId,
            retry_count: retryCount,
        },
    });

    const idToken = await getIdToken(); //get from firebase
    if (!idToken) {
        console.log('No id token found - using cookie auth');
        throw new Error('No id token found');
    }

    // Use STS endpoint - either configured or default to sts.vertesia.io
    const stsEndpoint = Env.endpoints.sts;
    console.log('Using STS for token generation:', stsEndpoint);
    Env.logger.info('Using STS for token generation', {
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
            throw new STSError('Failed to call STS endpoint', stsEndpoint);
        });

        if (idToken && stsRes?.status === 404) {
            // User not found in token-server - call ensure-user endpoint
            console.log('404: User not found - calling ensure-user endpoint');
            Env.logger.info('404: User not found - calling ensure-user endpoint', {
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
                console.log('412: No invite found - signup required');
                Env.logger.info('412: No invite found - signup required', {
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
            console.log('User ensured - retrying token generation');
            Env.logger.info('User ensured - retrying token generation', {
                vertesia: {
                    account_id: accountId,
                    project_id: projectId,
                },
            });
            return fetchComposableToken(getIdToken, accountId, projectId, ttl, retryCount);
        }

        if (idToken && stsRes?.status === 412) {
            console.log("412: auth succeeded but user doesn't exist - signup required", stsRes?.status);
            Env.logger.error("412: auth succeeded but user doesn't exist - signup required", {
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
            Env.logger.error('User not found', {
                vertesia: {
                    account_id: accountId,
                    project_id: projectId,
                    email: idTokenDecoded.email,
                },
            });
            throw new UserNotFoundError('User not found', idTokenDecoded.email);
        }

        if (stsRes.status === 403) {
            const responseMessage = await stsRes.text();
            Env.logger.warn('STS rejected the requested account or project', {
                vertesia: {
                    account_id: accountId,
                    project_id: projectId,
                    status: stsRes.status,
                    error: responseMessage,
                },
            });
            throw new TokenAuthorizationError(stsEndpoint, accountId, projectId, responseMessage);
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
            throw new Error(`Failed to get token from STS: ${stsRes.status}`);
        }

        const { token } = await stsRes.json();
        console.log('Successfully got token from STS');
        Env.logger.info('Successfully got token from STS');
        return token;
    } catch (error) {
        if (error instanceof UserNotFoundError || error instanceof STSError) {
            throw error; // Re-throw UserNotFoundError and STSError to be handled separately in the caller
        }

        // Clear any stale account/project from localStorage on error
        localStorage.removeItem(LastSelectedAccountId_KEY);
        if (accountId) {
            localStorage.removeItem(`${LastSelectedProjectId_KEY}-${accountId}`);
        }
        console.error('Failed to get composable token from STS', error);
        Env.logger.error('Failed to get composable token from STS', {
            vertesia: {
                account_id: accountId,
                project_id: projectId,
                error: error,
            },
        });
        throw new Error('Failed to get composable token', { cause: error });
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
    const selectedAccount = accountId ?? localStorage.getItem(LastSelectedAccountId_KEY) ?? undefined;
    const selectedProject =
        projectId ?? localStorage.getItem(`${LastSelectedProjectId_KEY}-${selectedAccount}`) ?? undefined;

    //token is still valid for more than 5 minutes
    if (!forceRefresh && AUTH_TOKEN_RAW && AUTH_TOKEN && AUTH_TOKEN.exp > Date.now() / 1000 + 300) {
        return { rawToken: AUTH_TOKEN_RAW, token: AUTH_TOKEN, error: false };
    }

    try {
        //token is close to expire, refresh it
        if (!useInternalAuth && getFirebaseAuth().currentUser) {
            //we have a firebase user, get the token from there
            AUTH_TOKEN_RAW = await fetchComposableTokenFromFirebaseToken(selectedAccount, selectedProject);
        } else if (initToken || AUTH_TOKEN_RAW) {
            // we have a token already and no firebase user, refresh it
            AUTH_TOKEN_RAW = await fetchComposableToken(
                () => Promise.resolve(initToken ?? AUTH_TOKEN_RAW),
                selectedAccount,
                selectedProject,
            );
        }
    } catch (error: unknown) {
        if (error instanceof TokenAuthorizationError) {
            AUTH_TOKEN_RAW = undefined;
            AUTH_TOKEN = undefined;
            clearRejectedPersistedScope(selectedAccount, selectedProject);
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
        throw new Error('Cannot acquire a composable token');
    }

    AUTH_TOKEN = jwtDecode(AUTH_TOKEN_RAW) as AuthTokenPayload;

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
    constructor(message: string, stsURL: string) {
        super(message);
        this.name = 'STSError';
        this.stsURL = stsURL;
    }
}

export class TokenAuthorizationError extends STSError {
    constructor(
        stsURL: string,
        public readonly accountId?: string,
        public readonly projectId?: string,
        public readonly responseMessage?: string,
    ) {
        super('Access denied for the selected account or project', stsURL);
        this.name = 'TokenAuthorizationError';
    }
}
