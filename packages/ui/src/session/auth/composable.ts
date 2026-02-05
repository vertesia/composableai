/**
 * Handle client caching and refresh of auth token
 */
import { AuthTokenPayload } from "@vertesia/common";
import { jwtDecode } from "jwt-decode";
import { Env } from '@vertesia/ui/env';
import { LastSelectedAccountId_KEY, LastSelectedProjectId_KEY } from '../constants';
import { getFirebaseAuth, getFirebaseAuthToken } from './firebase';

let AUTH_TOKEN_RAW: string | undefined;
let AUTH_TOKEN: AuthTokenPayload | undefined;

interface ComposableTokenResponse {
    rawToken: string;
    token: AuthTokenPayload;
    error: boolean;
    message?: string;
}

export async function fetchComposableToken(getIdToken: () => Promise<string | null | undefined>, accountId?: string, projectId?: string, ttl?: number, retryCount = 0): Promise<string> {
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
        const stsUrl = new URL(stsEndpoint + '/token/issue');
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
                'Authorization': `Bearer ${idToken}` // Firebase token for authentication
            },
            body: JSON.stringify(requestBody)
        });

        if (idToken && stsRes?.status === 404) {
            // User not found in token-server - call ensure-user endpoint
            console.log('404: User not found - calling ensure-user endpoint');
            Env.logger.info('404: User not found - calling ensure-user endpoint', {
                vertesia: {
                    account_id: accountId,
                    project_id: projectId,
                    status: stsRes?.status
                },
            });

            const ensureResponse = await fetch(Env.endpoints.studio + '/auth/ensure-user', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${idToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (ensureResponse.status === 412) {
                // No invite - trigger signup
                console.log('412: No invite found - signup required');
                Env.logger.info('412: No invite found - signup required', {
                    vertesia: {
                        account_id: accountId,
                        project_id: projectId,
                    }
                });
                const idTokenDecoded = jwtDecode(idToken) as any;
                if (!idTokenDecoded?.email) {
                    Env.logger.error('No email found in id token');
                    throw new Error('No email found in id token');
                }
                throw new UserNotFoundError('User not found - signup required', idTokenDecoded.email);
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
                }
            });
            return fetchComposableToken(getIdToken, accountId, projectId, ttl, retryCount);
        }

        if (idToken && stsRes?.status === 412) {
            console.log("412: auth succeeded but user doesn't exist - signup required", stsRes?.status);
            Env.logger.error("412: auth succeeded but user doesn't exist - signup required", {
                vertesia: {
                    account_id: accountId,
                    project_id: projectId,
                    status: stsRes?.status
                },
            });
            const idTokenDecoded = jwtDecode(idToken) as any;
            if (!idTokenDecoded?.email) {
                Env.logger.error('No email found in id token');
                throw new Error('No email found in id token');
            }
            Env.logger.error('User not found', {
                vertesia: {
                    account_id: accountId,
                    project_id: projectId,
                    email: idTokenDecoded.email
                }
            });
            throw new UserNotFoundError('User not found', idTokenDecoded.email);
        }

        if (stsRes.status === 403) {
            // User doesn't have access to the requested account/project, or has no accounts
            // This can happen with:
            // 1. Stale localStorage from previous user
            // 2. User invited to a new account (doesn't have access yet)
            // 3. User exists but has no accounts at all

            if (retryCount > 0) {
                // Already retried without account scope - this is a real authorization failure
                console.error('403: Access denied even without account scope - user may have no accounts');
                Env.logger.error('403: Access denied after retry - authorization failure', {
                    vertesia: {
                        account_id: accountId,
                        project_id: projectId,
                        status: stsRes.status,
                        retry_count: retryCount
                    },
                });
                throw new Error('Access denied - user may not have access to any accounts');
            }

            console.log('403: Access denied - clearing cached account and retrying without account scope');
            Env.logger.warn('403: Access denied - clearing cached account and retrying', {
                vertesia: {
                    account_id: accountId,
                    project_id: projectId,
                    status: stsRes.status,
                    retry_count: retryCount
                },
            });

            // Clear any stale account/project from localStorage
            localStorage.removeItem(LastSelectedAccountId_KEY);
            if (accountId) {
                localStorage.removeItem(LastSelectedProjectId_KEY + '-' + accountId);
            }

            // Retry without account/project scope - let user log in to their default account
            return fetchComposableToken(getIdToken, undefined, undefined, ttl, retryCount + 1);
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
        if (error instanceof UserNotFoundError) {
            throw error; // Re-throw UserNotFoundError
        }

        // Clear any stale account/project from localStorage on error
        localStorage.removeItem(LastSelectedAccountId_KEY);
        if (accountId) {
            localStorage.removeItem(LastSelectedProjectId_KEY + '-' + accountId);
        }
        console.error('Failed to get composable token from STS', error);
        Env.logger.error('Failed to get composable token from STS', {
            vertesia: {
                account_id: accountId,
                project_id: projectId,
                error: error,
            },
        });
        throw new Error('Failed to get composable token');
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

export async function getComposableToken(accountId?: string, projectId?: string, initToken?: string, forceRefresh = false, useInternalAuth = false): Promise<ComposableTokenResponse> {

    const selectedAccount = accountId ?? localStorage.getItem(LastSelectedAccountId_KEY) ?? undefined
    const selectedProject = projectId ?? localStorage.getItem(LastSelectedProjectId_KEY + '-' + selectedAccount) ?? undefined

    //token is still valid for more than 5 minutes
    if (!forceRefresh && AUTH_TOKEN_RAW && AUTH_TOKEN && AUTH_TOKEN.exp > (Date.now() / 1000 + 300)) {
        return { rawToken: AUTH_TOKEN_RAW, token: AUTH_TOKEN, error: false };
    }

    //token is close to expire, refresh it
    if (!useInternalAuth && getFirebaseAuth().currentUser) {
        //we have a firebase user, get the token from there
        AUTH_TOKEN_RAW = await fetchComposableTokenFromFirebaseToken(selectedAccount, selectedProject);
    } else if (initToken || AUTH_TOKEN_RAW) {
        // we have a token already and no firebase user, refresh it
        AUTH_TOKEN_RAW = await fetchComposableToken(() => Promise.resolve(initToken ?? AUTH_TOKEN_RAW), selectedAccount, selectedProject);
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

    if (!AUTH_TOKEN || !AUTH_TOKEN.exp || !AUTH_TOKEN_RAW) {
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
