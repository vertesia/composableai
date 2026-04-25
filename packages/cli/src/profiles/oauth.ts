import jwt from 'jsonwebtoken';
import open from 'open';
import type { OAuthAuthorizationServerMetadata, OAuthDeviceAuthorizationResponse, OAuthTokenResponse } from '@vertesia/common';
import type { Profile } from './index.js';
import type { StoredAuthBundle } from './keyring.js';
import type { ConfigResult } from './server/index.js';

const OAUTH_AUTHORIZATION_SERVER_PATH = '/.well-known/oauth-authorization-server';
const OAUTH_CLIENT_METADATA_PATH = '/.well-known/oauth-client/vertesia-cli';
const DEFAULT_OAUTH_SCOPE = 'openid profile';

type OAuthProfile = Pick<Profile, 'name' | 'studio_server_url' | 'zeno_server_url'> & Partial<Pick<Profile, 'account' | 'config_url' | 'project'>>;

interface TokenRefs {
    account?: string;
    project?: string;
    audience?: string;
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
    const deviceAuthorization = await createDeviceAuthorization(metadata, {
        clientId,
        resource,
        scope,
        projectId: profile.project,
    });
    const verificationUrl = buildDeviceVerificationUrl(profile, deviceAuthorization);

    console.log('Opening browser to', verificationUrl);
    console.log('The session code is', deviceAuthorization.user_code);
    console.log('Waiting for browser authorization...');
    open(verificationUrl).catch((error) => {
        console.error('Unable to open browser:', error instanceof Error ? error.message : String(error));
    });

    const response = await pollDeviceToken(metadata, clientId, deviceAuthorization, signal);
    return buildConfigResult(profile, response, clientId, resource);
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

async function createDeviceAuthorization(
    metadata: OAuthAuthorizationServerMetadata,
    input: {
        clientId: string;
        resource: string;
        scope: string;
        projectId?: string;
    },
): Promise<OAuthDeviceAuthorizationResponse> {
    if (!metadata.device_authorization_endpoint) {
        throw new OAuthUnavailableError('OAuth device authorization is not available for this endpoint.');
    }

    const body = new URLSearchParams({
        client_id: input.clientId,
        resource: input.resource,
        scope: input.scope,
    });
    if (input.projectId) {
        body.set('project_id', input.projectId);
    }

    const response = await fetch(metadata.device_authorization_endpoint, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
    });

    if (!response.ok) {
        const error = await readOAuthError(response);
        if (response.status === 404 || response.status === 501) {
            throw new OAuthUnavailableError(`OAuth device authorization is not available for this endpoint: ${error.message}`);
        }
        throw new Error(`OAuth device authorization failed (${response.status}): ${error.message}`);
    }

    const payload = await response.json() as Partial<OAuthDeviceAuthorizationResponse>;
    if (!payload.device_code || !payload.user_code || !payload.verification_uri || !payload.verification_uri_complete
        || typeof payload.expires_in !== 'number' || typeof payload.interval !== 'number') {
        throw new Error('OAuth device authorization endpoint returned an invalid response.');
    }
    return payload as OAuthDeviceAuthorizationResponse;
}

function buildDeviceVerificationUrl(profile: OAuthProfile, device: OAuthDeviceAuthorizationResponse): string {
    if (!profile.config_url) {
        return device.verification_uri_complete;
    }

    const configUrl = new URL(profile.config_url);
    const verificationUrl = new URL('/oauth/device', configUrl.origin);
    verificationUrl.searchParams.set('user_code', device.user_code);
    return verificationUrl.toString();
}

async function pollDeviceToken(
    metadata: OAuthAuthorizationServerMetadata,
    clientId: string,
    device: OAuthDeviceAuthorizationResponse,
    signal?: AbortSignal,
): Promise<OAuthTokenResponse> {
    const expiresAt = Date.now() + device.expires_in * 1000;
    let intervalMs = Math.max(device.interval, 1) * 1000;

    while (Date.now() < expiresAt) {
        throwIfAborted(signal);
        const body = new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            device_code: device.device_code,
            client_id: clientId,
        });
        const response = await fetch(metadata.token_endpoint, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
        });

        if (response.ok) {
            const payload = await response.json() as Partial<OAuthTokenResponse>;
            if (!payload.access_token || !payload.token_type || typeof payload.expires_in !== 'number') {
                throw new Error('OAuth token endpoint returned an invalid response.');
            }
            return payload as OAuthTokenResponse;
        }

        const error = await readOAuthError(response);
        if (response.status === 400 && error.error === 'authorization_pending') {
            await delay(intervalMs, signal);
            continue;
        }
        if (response.status === 400 && error.error === 'slow_down') {
            intervalMs += 5000;
            await delay(intervalMs, signal);
            continue;
        }
        if (response.status === 400 && error.error === 'access_denied') {
            throw new Error('OAuth device authorization was denied.');
        }
        if (response.status === 400 && error.error === 'expired_token') {
            throw new Error('OAuth device authorization expired.');
        }
        throw new Error(`OAuth token exchange failed (${response.status}): ${error.message}`);
    }

    throw new Error('OAuth device authorization expired.');
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
    return (await readOAuthError(response)).message;
}

async function readOAuthError(response: Response): Promise<{ error?: string; message: string }> {
    const text = await response.text();
    if (!text) {
        return { message: response.statusText || 'Unknown error' };
    }
    try {
        const parsed = JSON.parse(text) as Record<string, unknown>;
        const error = typeof parsed.error === 'string' ? parsed.error : undefined;
        if (typeof parsed.error_description === 'string') {
            return { error, message: parsed.error_description };
        }
        if (error) {
            return { error, message: error };
        }
    } catch {
        // Ignore non-JSON error responses.
    }
    return { message: text };
}

function throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
        throw new Error('Authentication aborted.');
    }
}

async function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
    throwIfAborted(signal);
    await new Promise<void>((resolve, reject) => {
        let timeout: ReturnType<typeof setTimeout>;
        const onAbort = () => {
            clearTimeout(timeout);
            signal?.removeEventListener('abort', onAbort);
            reject(new Error('Authentication aborted.'));
        };
        const cleanup = () => {
            signal?.removeEventListener('abort', onAbort);
        };
        timeout = setTimeout(() => {
            cleanup();
            resolve();
        }, milliseconds);
        signal?.addEventListener('abort', onAbort, { once: true });
    });
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
