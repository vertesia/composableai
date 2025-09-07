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

export async function fetchComposableToken(getIdToken: () => Promise<string | null | undefined>, accountId?: string, projectId?: string, ttl?: number): Promise<string> {
    console.log(`Getting/refreshing composable token for account ${accountId} and project ${projectId} `);
    Env.logger.info('Getting/refreshing composable token', {
        vertesia: {
            account_id: accountId,
            project_id: projectId,
        },
    });

    const idToken = await getIdToken(); //get from firebase
    if (!idToken) {
        console.log('No id token found - using cookie auth');
        throw new Error('No id token found');
    }

    // Check if STS endpoint is configured and use it for token generation
    if (Env.endpoints.sts) {
        console.log('Using STS for token generation');
        Env.logger.info('Using STS for token generation', {
            vertesia: {
                account_id: accountId,
                project_id: projectId,
                sts_url: Env.endpoints.sts,
            },
        });

        try {
            // Call STS to generate a user token
            const stsUrl = new URL(Env.endpoints.sts + '/token/issue');
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

            if (stsRes.ok) {
                const { token } = await stsRes.json();
                console.log('Successfully got token from STS');
                Env.logger.info('Successfully got token from STS');
                return token;
            } else {
                console.warn('STS token generation failed, falling back to studio', stsRes.status);
                Env.logger.warn('STS token generation failed, falling back to studio', {
                    vertesia: {
                        status: stsRes.status,
                    },
                });
                // Fall through to use studio endpoint
            }
        } catch (error) {
            console.warn('STS request failed, falling back to studio', error);
            Env.logger.warn('STS request failed, falling back to studio', {
                vertesia: {
                    error: error,
                },
            });
            // Fall through to use studio endpoint
        }
    }

    // Original flow - use studio endpoint
    console.log('Fetching composable token from ' + Env.endpoints.studio);
    Env.logger.info('Fetching composable token from' + Env.endpoints.studio, {
        vertesia: {
            account_id: accountId,
            project_id: projectId,
        },
    });

    const url = new URL(Env.endpoints.studio + '/auth/token');
    if (accountId) url.searchParams.set('accountId', accountId);
    if (projectId) url.searchParams.set('projectId', projectId);
    if (ttl) url.searchParams.set('ttl', String(ttl));

    console.log(`Getting composable token for account ${accountId} and project ${projectId}`);
    Env.logger.info('Getting composable token', {
        vertesia: {
            account_id: accountId,
            project_id: projectId,
        },
    });

    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
        }
    }).catch(err => {
        localStorage.removeItem(LastSelectedAccountId_KEY);
        localStorage.removeItem(LastSelectedProjectId_KEY);
        console.error('Failed to get composable token', err);
        Env.logger.error('Failed to get composable token', {
            vertesia: {
                account_id: accountId,
                project_id: projectId,
                error: err,
            },
        });
        throw new Error('Failed to get composable token');
    });

    if (idToken && res?.status === 412) {
        console.log("412: auth succeeded but user doesn't exist - signup required", res?.status);
        Env.logger.error("412: auth succeeded but user doesn't exist - signup required", {
            vertesia: {
                account_id: accountId,
                project_id: projectId,
                status: res?.status
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

    if (!res || !res.ok) {
        console.error('Failed to get composable token', res);
        Env.logger.error('Failed to get composable token', {
            vertesia: {
                account_id: accountId,
                project_id: projectId,
                status: res?.status,
            },
        });
        throw new Error('Failed to get composable token');
    }

    const { token } = await res.json().catch(err => {
        Env.logger.error('Failed to parse composable token', {
            vertesia: {
                account_id: accountId,
                project_id: projectId,
                error: err,
            },
        });
        console.error('Failed to parse composable token', err);
    });

    return token;
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