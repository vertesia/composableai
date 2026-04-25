import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import open from 'open';
import { startServer } from './server/server.js';
import type { OAuthAuthorizationServerMetadata, OAuthTokenResponse } from '@vertesia/common';
import type { Profile } from './index.js';
import type { StoredAuthBundle } from './keyring.js';
import type { ConfigResult } from './server/index.js';

const OAUTH_AUTHORIZATION_SERVER_PATH = '/.well-known/oauth-authorization-server';
const OAUTH_CLIENT_METADATA_PATH = '/.well-known/oauth-client/vertesia-cli';
const OAUTH_CALLBACK_PATH = '/oauth/callback';
const OAUTH_LOOPBACK_HOST = '127.0.0.1';
const DEFAULT_OAUTH_SCOPE = 'openid profile';

type OAuthProfile = Pick<Profile, 'name' | 'studio_server_url' | 'zeno_server_url'> & Partial<Pick<Profile, 'account' | 'config_url' | 'project'>>;

interface TokenRefs {
    account?: string;
    project?: string;
    audience?: string;
}

interface PkcePair {
    verifier: string;
    challenge: string;
}

interface OAuthDiscovery {
    metadata: OAuthAuthorizationServerMetadata;
    serverUrl: string;
}

export class OAuthUnavailableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'OAuthUnavailableError';
    }
}

export function canUseOAuthProfile(profile: Partial<Pick<Profile, 'studio_server_url'>>): boolean {
    if (!profile.studio_server_url) {
        return false;
    }
    try {
        const url = new URL(profile.studio_server_url);
        const isLoopbackHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
        const isLocalDev = process.env.IS_LOCAL_DEV === 'true';
        if (url.protocol === 'https:') {
            return !isLoopbackHost || isLocalDev;
        }
        return isLocalDev && url.protocol === 'http:' && isLoopbackHost;
    } catch {
        return false;
    }
}

export function getOAuthClientId(oauthServerUrl: string): string {
    return new URL(OAUTH_CLIENT_METADATA_PATH, withTrailingSlash(oauthServerUrl)).toString();
}

export function getOAuthResource(metadata: Pick<OAuthAuthorizationServerMetadata, 'issuer'>): string {
    return new URL(metadata.issuer).toString();
}

export async function startOAuthSession(profile: OAuthProfile, signal?: AbortSignal): Promise<ConfigResult> {
    assertOAuthProfile(profile);

    const { metadata, serverUrl } = await discoverAuthorizationServer(profile);
    const clientId = getOAuthClientId(serverUrl);
    const resource = getOAuthResource(metadata);
    const scope = DEFAULT_OAUTH_SCOPE;
    const pkce = createPkcePair();
    const state = crypto.randomUUID();

    const callback = await createAuthorizationCallback(state, signal);
    const redirectUri = callback.redirectUri;
    const authorizeUrl = buildAuthorizeUrl(metadata, {
        clientId,
        redirectUri,
        resource,
        scope,
        state,
        challenge: pkce.challenge,
        projectId: profile.project,
    });

    console.log('Opening browser to', authorizeUrl);
    open(authorizeUrl).catch((error) => {
        console.error('Unable to open browser:', error instanceof Error ? error.message : String(error));
    });

    try {
        const code = await callback.waitForCode();
        const response = await exchangeAuthorizationCode(metadata, clientId, code, pkce.verifier, redirectUri, resource);
        return buildConfigResult(profile, response, clientId, resource);
    } finally {
        callback.close();
    }
}

export async function refreshOAuthSession(
    profile: OAuthProfile,
    refreshToken: string,
    bundle?: StoredAuthBundle,
    options: {
        projectId?: string;
    } = {},
): Promise<ConfigResult> {
    assertOAuthProfile(profile);

    const { metadata, serverUrl } = await discoverAuthorizationServer(profile);
    const clientId = getOAuthClientId(serverUrl);
    const resource = bundle?.oauthResource || readTokenRefs(bundle?.accessToken).audience || getOAuthResource(metadata);
    const response = await exchangeRefreshToken(metadata, clientId, refreshToken, resource, options.projectId);
    return buildConfigResult(profile, response, clientId, resource);
}

function assertOAuthProfile(profile: OAuthProfile): asserts profile is OAuthProfile & Required<Pick<OAuthProfile, 'name' | 'studio_server_url' | 'zeno_server_url'>> {
    if (!profile.name) {
        throw new Error('Profile name is required for OAuth authentication.');
    }
    if (!profile.studio_server_url || !profile.zeno_server_url) {
        throw new Error('Studio and Zeno server URLs are required for OAuth authentication.');
    }
    if (!canUseOAuthProfile(profile)) {
        throw new Error(`OAuth login is not supported for studio endpoint "${profile.studio_server_url}".`);
    }
}

function withTrailingSlash(url: string): string {
    return url.endsWith('/') ? url : `${url}/`;
}

async function discoverAuthorizationServer(profile: Pick<Profile, 'studio_server_url'> & Partial<Pick<Profile, 'config_url'>>): Promise<OAuthDiscovery> {
    const candidates = getOAuthServerUrlCandidates(profile);
    let unavailableError: OAuthUnavailableError | undefined;
    for (const candidate of candidates) {
        try {
            const metadata = await fetchAuthorizationServerMetadata(candidate);
            return {
                metadata: applyProfileAuthorizationEndpoint(metadata, profile),
                serverUrl: candidate,
            };
        } catch (error) {
            if (error instanceof OAuthUnavailableError) {
                unavailableError = error;
                continue;
            }
            throw error;
        }
    }
    throw unavailableError || new OAuthUnavailableError(`OAuth discovery is not available for ${profile.studio_server_url}.`);
}

function applyProfileAuthorizationEndpoint(
    metadata: OAuthAuthorizationServerMetadata,
    profile: Partial<Pick<Profile, 'config_url'>>,
): OAuthAuthorizationServerMetadata {
    if (!profile.config_url) {
        return metadata;
    }
    const configUrl = new URL(profile.config_url);
    return {
        ...metadata,
        authorization_endpoint: new URL('/oauth/authorize', configUrl.origin).toString(),
    };
}

function getOAuthServerUrlCandidates(profile: Pick<Profile, 'studio_server_url'>): string[] {
    if (process.env.VERTESIA_TOKEN_SERVER_URL) {
        return [process.env.VERTESIA_TOKEN_SERVER_URL];
    }

    const studioUrl = new URL(profile.studio_server_url);
    const isLoopbackHost = studioUrl.hostname === 'localhost' || studioUrl.hostname === '127.0.0.1';
    if (isLoopbackHost) {
        return ['https://sts.dev1.vertesia.io'];
    }

    const candidates = [new URL('/', studioUrl).toString()];
    if (studioUrl.hostname.startsWith('api')) {
        const stsHost = studioUrl.hostname.replace('api-preview.', 'api.').replace(/^api/, 'sts');
        candidates.push(`${studioUrl.protocol}//${stsHost}`);
    }

    if (studioUrl.hostname.endsWith('.api.dev1.vertesia.io') || studioUrl.hostname.endsWith('.ui.dev1.vertesia.io')) {
        candidates.push('https://sts.dev1.vertesia.io');
    }

    candidates.push('https://sts.dev1.vertesia.io');
    return Array.from(new Set(candidates.map((candidate) => candidate.replace(/\/+$/, ''))));
}

async function fetchAuthorizationServerMetadata(oauthServerUrl: string): Promise<OAuthAuthorizationServerMetadata> {
    let response: Response;
    try {
        response = await fetch(new URL(OAUTH_AUTHORIZATION_SERVER_PATH, withTrailingSlash(oauthServerUrl)).toString(), {
            headers: {
                Accept: 'application/json',
            },
        });
    } catch (error) {
        throw new OAuthUnavailableError(`OAuth discovery is not reachable at ${oauthServerUrl}: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (!response.ok) {
        if (response.status === 404 || response.status === 501) {
            throw new OAuthUnavailableError(`OAuth discovery is not available at ${oauthServerUrl}.`);
        }
        throw new Error(`Failed to load OAuth authorization metadata from ${oauthServerUrl} (${response.status} ${response.statusText}).`);
    }

    const metadata = await response.json() as Partial<OAuthAuthorizationServerMetadata>;
    if (!metadata.authorization_endpoint || !metadata.token_endpoint || !metadata.issuer) {
        throw new Error(`Invalid OAuth authorization metadata returned by ${oauthServerUrl}.`);
    }
    return metadata as OAuthAuthorizationServerMetadata;
}

function createPkcePair(): PkcePair {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
}

async function createAuthorizationCallback(expectedState: string, signal?: AbortSignal) {
    let settled = false;
    let rejectAuthorization: (error: Error) => void = () => {};
    let resolveAuthorization: (code: string) => void = () => {};

    const waitForCode = new Promise<string>((resolve, reject) => {
        resolveAuthorization = resolve;
        rejectAuthorization = reject;
    });

    const server = await startServer((req, res) => {
            const requestUrl = new URL(req.url || '/', `http://${req.headers.host || OAUTH_LOOPBACK_HOST}`);

            if (req.method !== 'GET' || requestUrl.pathname !== OAUTH_CALLBACK_PATH) {
                res.statusCode = 404;
                res.setHeader('Connection', 'close');
                res.end();
                return;
            }
            if (settled) {
                res.statusCode = 409;
                res.setHeader('Connection', 'close');
                res.end('Authentication already completed.');
                return;
            }

            const state = requestUrl.searchParams.get('state');
            const code = requestUrl.searchParams.get('code');
            const error = requestUrl.searchParams.get('error');
            const errorDescription = requestUrl.searchParams.get('error_description');

            if (error) {
                settled = true;
                res.statusCode = 400;
                res.setHeader('Connection', 'close');
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.end(errorDescription || error);
                rejectAuthorization(new Error(errorDescription || error));
                closeServer();
                return;
            }

            if (!state || state !== expectedState) {
                settled = true;
                res.statusCode = 400;
                res.setHeader('Connection', 'close');
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.end('State mismatch.');
                rejectAuthorization(new Error('OAuth state mismatch.'));
                closeServer();
                return;
            }

            if (!code) {
                settled = true;
                res.statusCode = 400;
                res.setHeader('Connection', 'close');
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.end('No authorization code was returned.');
                rejectAuthorization(new Error('OAuth authorization code missing from callback.'));
                closeServer();
                return;
            }

            settled = true;
            res.statusCode = 200;
            res.setHeader('Connection', 'close');
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end('Authentication complete. You can close this window.', () => {
                resolveAuthorization(code);
                closeServer();
            });
    });
    const onAbort = () => {
        if (settled) {
            return;
        }
        settled = true;
        closeServer();
        rejectAuthorization(new Error('Authentication aborted.'));
    };

    const closeServer = () => {
        if (server.listening) {
            server.close();
            server.closeIdleConnections?.();
            const closeConnectionsTimer = setTimeout(() => {
                server.closeAllConnections?.();
            }, 100);
            closeConnectionsTimer.unref?.();
        }
        if (signal) {
            signal.removeEventListener('abort', onAbort);
        }
    };

    if (signal?.aborted) {
        onAbort();
    }

    if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
    }

    const address = server.address();
    if (!address || typeof address === 'string') {
        settled = true;
        closeServer();
        throw new Error('Unable to determine local OAuth callback port.');
    }
    const redirectUri = `http://${OAUTH_LOOPBACK_HOST}:${address.port}${OAUTH_CALLBACK_PATH}`;

    return {
        redirectUri,
        waitForCode() {
            return waitForCode;
        },
        close() {
            if (!settled) {
                settled = true;
                rejectAuthorization(new Error('Authentication interrupted.'));
            }
            closeServer();
        },
    };
}

function buildAuthorizeUrl(
    metadata: OAuthAuthorizationServerMetadata,
    input: {
        clientId: string;
        redirectUri: string;
        resource: string;
        scope: string;
        state: string;
        challenge: string;
        projectId?: string;
    },
): string {
    const url = new URL(metadata.authorization_endpoint);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', input.clientId);
    url.searchParams.set('redirect_uri', input.redirectUri);
    url.searchParams.set('resource', input.resource);
    url.searchParams.set('scope', input.scope);
    url.searchParams.set('state', input.state);
    url.searchParams.set('code_challenge', input.challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    if (input.projectId) {
        url.searchParams.set('project_id', input.projectId);
    }
    return url.toString();
}

async function exchangeAuthorizationCode(
    metadata: OAuthAuthorizationServerMetadata,
    clientId: string,
    code: string,
    verifier: string,
    redirectUri: string,
    resource: string,
): Promise<OAuthTokenResponse> {
    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        resource,
        code_verifier: verifier,
    });
    return exchangeToken(metadata.token_endpoint, body);
}

async function exchangeRefreshToken(
    metadata: OAuthAuthorizationServerMetadata,
    clientId: string,
    refreshToken: string,
    resource: string,
    projectId?: string,
): Promise<OAuthTokenResponse> {
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        resource,
    });
    if (projectId) {
        body.set('project_id', projectId);
    }
    return exchangeToken(metadata.token_endpoint, body);
}

async function exchangeToken(endpoint: string, body: URLSearchParams): Promise<OAuthTokenResponse> {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
    });

    if (!response.ok) {
        throw new Error(`OAuth token exchange failed (${response.status}): ${await readErrorMessage(response)}`);
    }

    const payload = await response.json() as Partial<OAuthTokenResponse>;
    if (!payload.access_token || !payload.token_type || typeof payload.expires_in !== 'number') {
        throw new Error('OAuth token endpoint returned an invalid response.');
    }
    return payload as OAuthTokenResponse;
}

async function readErrorMessage(response: Response): Promise<string> {
    const text = await response.text();
    if (!text) {
        return response.statusText || 'Unknown error';
    }
    try {
        const parsed = JSON.parse(text) as Record<string, unknown>;
        if (typeof parsed.error_description === 'string') {
            return parsed.error_description;
        }
        if (typeof parsed.error === 'string') {
            return parsed.error;
        }
    } catch {
        // Ignore non-JSON error responses.
    }
    return text;
}

function buildConfigResult(
    profile: OAuthProfile,
    response: OAuthTokenResponse,
    oauthClientId: string,
    oauthResource: string,
): ConfigResult {
    const refs = readTokenRefs(response.access_token);
    const account = refs.account || profile.account;
    const project = refs.project || profile.project;

    if (!profile.name || !profile.studio_server_url || !profile.zeno_server_url) {
        throw new Error('Profile metadata is incomplete after OAuth authentication.');
    }
    if (!account || !project) {
        throw new Error('OAuth access token did not contain an account or project reference.');
    }

    return {
        profile: profile.name,
        account,
        project,
        studio_server_url: profile.studio_server_url,
        zeno_server_url: profile.zeno_server_url,
        token: response.access_token,
        id_token: response.id_token,
        refresh_token: response.refresh_token,
        expires_in: response.expires_in,
        oauth_client_id: oauthClientId,
        oauth_resource: oauthResource,
    };
}

function readTokenRefs(token: string | undefined): TokenRefs {
    if (!token) {
        return {};
    }
    const decoded = jwt.decode(token, { json: true });
    if (!decoded || typeof decoded !== 'object') {
        return {};
    }
    const audience = readAudience(decoded);
    return {
        account: readRefId(decoded, 'account') || readStringField(decoded, 'account_id'),
        project: readRefId(decoded, 'project') || readStringField(decoded, 'project_id'),
        audience,
    };
}

function readAudience(decoded: object): string | undefined {
    const audience = Reflect.get(decoded, 'aud');
    if (typeof audience === 'string') {
        return audience;
    }
    if (Array.isArray(audience)) {
        const first = audience.find((value) => typeof value === 'string');
        return typeof first === 'string' ? first : undefined;
    }
    return undefined;
}

function readRefId(value: object, key: string): string | undefined {
    const field = Reflect.get(value, key);
    if (typeof field === 'string') {
        return field;
    }
    if (!field || typeof field !== 'object' || Array.isArray(field)) {
        return undefined;
    }
    const id = Reflect.get(field, 'id');
    return typeof id === 'string' ? id : undefined;
}

function readStringField(value: object, key: string): string | undefined {
    const field = Reflect.get(value, key);
    return typeof field === 'string' ? field : undefined;
}
