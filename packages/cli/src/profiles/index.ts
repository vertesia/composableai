import { existsSync, mkdirSync, statSync } from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import jwt from 'jsonwebtoken';
import { hasErrorCode } from '../utils/options.js';
import { readJsonFile, writeJsonFile } from '../utils/stdio.js';
import type { OnResultCallback } from './commands.js';
import {
    deleteAuthBundle,
    getAccessTokenExpiry,
    hasStoredAccessToken,
    isKeyringAvailable,
    readAuthBundle,
    readProfileAccessToken,
    writeAuthBundle,
} from './keyring.js';
import { canUseOAuthProfile, OAuthUnavailableError, startOAuthSession } from './oauth.js';
import { type ConfigPayload, type ConfigResult, startConfigSession } from './server/index.js';

export function getConfigFile(path?: string) {
    const dir = join(os.homedir(), '.vertesia');
    if (!path || path === '/') {
        return dir;
    } else {
        return join(dir, path);
    }
}

export type Region = 'us1' | 'eu1' | 'jp1';
export const DEFAULT_REGION: Region = 'us1';
export const AVAILABLE_REGIONS: Region[] = ['us1', 'eu1', 'jp1'];

export type ConfigUrlRef = 'local' | 'dev-main' | 'dev-preview' | 'preview' | 'prod' | string;
export function getConfigUrl(value: ConfigUrlRef, region: Region = DEFAULT_REGION): string {
    if (isDevDeploymentTarget(value)) {
        return `https://${value}.ui.dev1.vertesia.io/cli`;
    }
    switch (value) {
        case 'local':
            return 'https://localhost:5173/cli';
        case 'dev-main':
            return 'https://dev-main.ui.dev1.vertesia.io/cli';
        case 'dev-preview':
            return 'https://dev-preview.ui.dev1.vertesia.io/cli';
        case 'preview':
            return `https://preview.cloud.${region}.vertesia.io/cli`;
        case 'prod':
            return `https://cloud.${region}.vertesia.io/cli`;
        default:
            if (value.startsWith('http://') || value.startsWith('https://')) {
                return value;
            } else {
                throw new InvalidConfigUrlError('Custom targets must be a valid http or https URL.');
            }
    }
}

function isDevDeploymentTarget(value: string): boolean {
    return value.startsWith('dev-');
}
export function getServerUrls(
    value: ConfigUrlRef,
    region: Region = DEFAULT_REGION,
): { studio_server_url: string; zeno_server_url: string; oauth_server_url?: string } {
    if (isDevDeploymentTarget(value)) {
        return {
            studio_server_url: `https://studio-server-${value}.api.dev1.vertesia.io`,
            zeno_server_url: `https://zeno-server-${value}.api.dev1.vertesia.io`,
            oauth_server_url: 'https://sts.dev1.vertesia.io',
        };
    }
    switch (value) {
        case 'local':
            return {
                studio_server_url: 'http://localhost:8091',
                zeno_server_url: 'http://localhost:8092',
                // Local CLI dev still authenticates against the shared dev1 STS.
                oauth_server_url: 'https://sts.dev1.vertesia.io',
            };
        case 'dev-main':
            return {
                studio_server_url: 'https://studio-server-dev-main.api.dev1.vertesia.io',
                zeno_server_url: 'https://zeno-server-dev-main.api.dev1.vertesia.io',
                oauth_server_url: 'https://sts.dev1.vertesia.io',
            };
        case 'dev-preview':
            return {
                studio_server_url: 'https://studio-server-dev-preview.api.dev1.vertesia.io',
                zeno_server_url: 'https://zeno-server-dev-preview.api.dev1.vertesia.io',
                oauth_server_url: 'https://sts.dev1.vertesia.io',
            };
        case 'preview':
            return {
                studio_server_url: `https://api-preview.${region}.vertesia.io`,
                zeno_server_url: `https://api-preview.${region}.vertesia.io`,
                oauth_server_url: `https://sts-preview.${region}.vertesia.io`,
            };
        case 'prod':
            return {
                studio_server_url: `https://api.${region}.vertesia.io`,
                zeno_server_url: `https://api.${region}.vertesia.io`,
                oauth_server_url: `https://sts.${region}.vertesia.io`,
            };
        default:
            throw new Error('Unable to detect server urls from custom target.');
    }
}

export function getCloudTypeFromConfigUrl(url: string) {
    let parsedUrl: URL;
    try {
        parsedUrl = new URL(url);
    } catch {
        throw new Error('Unknown cloud env type');
    }

    const { hostname, protocol } = parsedUrl;
    if ((protocol === 'http:' || protocol === 'https:') && hostname === 'localhost') {
        return 'staging';
    } else if (hostname.endsWith('.ui.dev1.vertesia.io')) {
        return 'staging';
    } else if (protocol === 'https:' && hostname.startsWith('preview.')) {
        return 'preview';
    } else if (protocol === 'https:' && hostname.startsWith('cloud.')) {
        return 'production';
    } else {
        throw new Error('Unknown cloud env type');
    }
}

export interface Profile {
    name: string;
    config_url: string;
    apikey?: string;
    account: string;
    project: string;
    studio_server_url: string;
    zeno_server_url: string;
    // Optional: when set, the CLI uses this URL directly as the OAuth authorization server
    // (no fallback derivation from studio_server_url). Old profiles without this field keep
    // working via the legacy derivation in oauth.ts.
    oauth_server_url?: string;
    region?: Region;
    session_tags?: string;
}

interface ProfilesData {
    default: string;
    profiles: Profile[];
}

export function shouldRefreshProfileToken(profile: Profile, thresholdInSeconds = 1) {
    const token = readProfileAccessToken(profile);
    if (token) {
        const bundle = readAuthBundle(profile.name);
        const expiresAt = bundle?.accessTokenExpiresAt ?? getAccessTokenExpiry(token);
        if (expiresAt) {
            return expiresAt - thresholdInSeconds * 1000 < Date.now();
        }
    }
    // if no token or no expiration set then refresh auth token
    return true;
}

export class ConfigureProfile {
    onResultCallback?: OnResultCallback;
    constructor(
        public config: Config,
        public data: Partial<Profile>,
        public isNew: boolean,
    ) {
        this.data = data;
        this.isNew = !data.name;
    }

    getConfigPayload(): ConfigPayload {
        return {
            profile: this.data.name,
            account: this.data.account,
            project: this.data.project,
        };
    }

    async persistConfigResult(result: ConfigResult | undefined) {
        if (!result) {
            return;
        }
        // biome-ignore lint/style/noNonNullAssertion: intentional non-null assertion; TS can't prove narrowing here
        const oldName = this.data.name!;
        const previousBundle = oldName ? readAuthBundle(oldName) : undefined;
        this.data.name = result.profile;
        this.data.account = result.account;
        this.data.project = result.project;
        this.data.studio_server_url = result.studio_server_url;
        this.data.zeno_server_url = result.zeno_server_url;
        if (result.oauth_server_url) {
            this.data.oauth_server_url = result.oauth_server_url;
        }
        try {
            writeAuthBundle(result.profile, {
                accessToken: result.token,
                accessTokenExpiresAt: readResultAccessTokenExpiry(result),
                idToken: result.id_token || previousBundle?.idToken,
                refreshToken: result.refresh_token || previousBundle?.refreshToken,
                refreshTokenExpiresAt: result.refresh_token_expires_at || previousBundle?.refreshTokenExpiresAt,
                oauthClientId: result.oauth_client_id || previousBundle?.oauthClientId,
                oauthResource: result.oauth_resource || previousBundle?.oauthResource,
            });
            delete this.data.apikey;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn(
                `Unable to store credentials in the native keychain; falling back to profile file storage: ${message}`,
            );
            this.data.apikey = result.token;
        }
        if (oldName && oldName !== result.profile) {
            deleteAuthBundle(oldName);
        }
        this.config.remove(oldName);
        this.config.add(this.data as Profile);
        if (this.isNew) {
            // biome-ignore lint/style/noNonNullAssertion: intentional non-null assertion; TS can't prove narrowing here
            this.config.use(this.data.name!);
        }
        this.config.save();
        if (this.onResultCallback) {
            await this.onResultCallback(result);
            this.onResultCallback = undefined;
        }
    }

    async applyConfigResult(
        result: ConfigResult | undefined,
        options: { logCompletion?: boolean; exitOnComplete?: boolean } = {},
    ) {
        if (!result) {
            console.log('\nAuthentication canceled or failed.');
            process.exit(1);
            return;
        }
        await this.persistConfigResult(result);
        if (options.logCompletion) {
            console.log('\n');
            console.log('Authentication completed.');
        }
        if (options.exitOnComplete) {
            process.exit(0);
        }
    }

    private async startLegacySession(signal?: AbortSignal) {
        await startConfigSession(
            // biome-ignore lint/style/noNonNullAssertion: intentional non-null assertion; TS can't prove narrowing here
            this.data.config_url!,
            this.getConfigPayload(),
            (result) => this.applyConfigResult(result, { logCompletion: true, exitOnComplete: true }),
            signal,
        );
    }

    async start(onResult?: OnResultCallback, signal?: AbortSignal) {
        this.onResultCallback = onResult;
        if (canUseOAuthProfile(this.data)) {
            try {
                const result = await startOAuthSession(
                    this.data as Pick<Profile, 'name' | 'studio_server_url' | 'zeno_server_url'> &
                        Partial<Pick<Profile, 'account' | 'config_url' | 'project'>>,
                    signal,
                );
                await this.applyConfigResult(result, { logCompletion: true });
                return;
            } catch (error: unknown) {
                if (!(error instanceof OAuthUnavailableError)) {
                    throw error;
                }
                console.log('OAuth login is not available for this endpoint. Falling back to legacy CLI login.');
            }
        }
        await this.startLegacySession(signal);
    }
}

export class Config {
    current?: Profile;
    profiles: Profile[];
    isDevMode = false;
    explicitProfile = false;

    constructor(data?: ProfilesData) {
        this.profiles = data?.profiles || [];
        if (data?.default) {
            this.current = this.profiles.find((p) => p.name === data.default);
        }
    }

    hasProfile(name: string) {
        return !!this.profiles.find((p) => p.name === name);
    }

    getProfile(name: string) {
        return this.profiles.find((p) => p.name === name);
    }

    use(name: string, options: { explicit?: boolean } = {}) {
        this.current = this.profiles.find((p) => p.name === name);
        if (!this.current) {
            console.error(`No configuration named ${name} found`);
            process.exit(1);
        }
        this.explicitProfile = Boolean(options.explicit);
        return this;
    }

    add(profile: Profile) {
        if (this.profiles.find((p) => p.name === profile.name)) {
            console.error(`A configuration named ${profile.name} already exists`);
        } else {
            this.profiles.push(profile);
        }
        this.use(profile.name);
        return this;
    }

    update(profile: Profile) {
        const existingProfile = this.profiles.find((p) => p.name === profile.name);
        if (existingProfile) {
            Object.assign(existingProfile, profile);
        } else {
            console.error(`Configuration named ${profile.name} doesn't exists`);
        }
        return this;
    }

    replace(existingProfile: Profile, newProfile: Profile) {
        const index = this.profiles.indexOf(existingProfile);
        if (index > -1) {
            this.profiles[index] = newProfile;
        }
        return this;
    }

    remove(name: string) {
        const i = this.profiles.findIndex((p) => p.name === name);
        if (i > -1) {
            this.profiles.splice(i, 1);
            if (this.current?.name === name) {
                this.current = undefined;
            }
        }
        return this;
    }

    createProfile(name: string, target: ConfigUrlRef, region: Region = DEFAULT_REGION) {
        const config_url = getConfigUrl(target, region);
        return new ConfigureProfile(this, { name, config_url, region, ...readKnownServerUrls(target, region) }, true);
    }

    updateProfile(name: string) {
        const profile = this.getProfile(name);
        if (!profile) {
            throw new ProfileNotFoundError(`Profile not found: ${name}.`);
        }
        return new ConfigureProfile(this, profile, false);
    }

    createOrUpdateProfile(name: string, target?: ConfigUrlRef): ConfigureProfile {
        const config_url = target && getConfigUrl(target);
        const knownServerUrls = target ? readKnownServerUrls(target) : {};
        const data = this.getProfile(name);
        if (config_url) {
            // create a new profile on config_url
            if (data) {
                throw new ProfileAlreadyExistsError(`Profile ${name} already exists.`);
            } else {
                return new ConfigureProfile(this, { name, config_url, ...knownServerUrls }, true);
            }
        } else {
            // update an existing profile
            if (data) {
                return new ConfigureProfile(this, data, false);
            } else {
                throw new ProfileNotFoundError(`Profile not found: ${name}.`);
            }
        }
    }

    save() {
        const dir = getConfigFile();
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
        const file = getConfigFile('profiles.json');
        writeJsonFile(file, {
            default: this.current?.name,
            profiles: this.profiles.map((profile) => {
                if (profile.apikey && !hasStoredAccessToken(profile.name)) {
                    return profile;
                }
                const { apikey, ...safeProfile } = profile;
                void apikey;
                return safeProfile;
            }),
        });
        return this;
    }

    load() {
        try {
            const stats = statSync(getConfigFile('dev'));
            if (stats.isFile()) {
                this.isDevMode = true;
            }
        } catch (err: unknown) {
            if (!hasErrorCode(err, 'ENOENT')) {
                throw err;
            }
        }
        try {
            const data = readJsonFile(getConfigFile('profiles.json')) as ProfilesData;
            this.profiles = data.profiles;
            let needsSave = false;
            if (isKeyringAvailable()) {
                for (const profile of this.profiles) {
                    if (!profile.apikey) {
                        continue;
                    }
                    const existingBundle = readAuthBundle(profile.name);
                    if (!existingBundle?.accessToken) {
                        try {
                            writeAuthBundle(profile.name, {
                                accessToken: profile.apikey,
                                accessTokenExpiresAt: readInlineTokenExpiry(profile.apikey),
                                refreshToken: existingBundle?.refreshToken,
                                refreshTokenExpiresAt: existingBundle?.refreshTokenExpiresAt,
                            });
                        } catch {
                            continue;
                        }
                    }
                    delete profile.apikey;
                    needsSave = true;
                }
            }
            if (data.default) {
                this.current = this.profiles.find((p) => p.name === data.default);
                if (!this.current) {
                    needsSave = true;
                }
            } else {
                this.current = undefined;
            }
            if (needsSave) {
                this.save();
            }
        } catch (err: unknown) {
            if (!hasErrorCode(err, 'ENOENT')) {
                throw err;
            }
        }
        return this;
    }
}

export class ProfileAlreadyExistsError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ProfileAlreadyExistsError';
    }
}

export class ProfileNotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ProfileNotFoundError';
    }
}

export class InvalidConfigUrlError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidConfigUrlError';
    }
}

const config = new Config().load();

export { config };

function readInlineTokenExpiry(token: string): number | undefined {
    const decoded = jwt.decode(token, { json: true });
    if (!decoded?.exp) {
        return undefined;
    }
    return decoded.exp * 1000;
}

function readResultAccessTokenExpiry(result: ConfigResult): number | undefined {
    if (typeof result.access_token_expires_at === 'number') {
        return result.access_token_expires_at;
    }
    if (typeof result.expires_in === 'number') {
        return Date.now() + result.expires_in * 1000;
    }
    return readInlineTokenExpiry(result.token);
}

function readKnownServerUrls(
    target: ConfigUrlRef,
    region: Region = DEFAULT_REGION,
): Partial<Pick<Profile, 'studio_server_url' | 'zeno_server_url'>> {
    try {
        return getServerUrls(target, region);
    } catch {
        return {};
    }
}
