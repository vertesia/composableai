import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "fs";
import jwt from 'jsonwebtoken';
import os from "node:os";
import { join } from "path";
import { readJsonFile } from "../utils/stdio.js";
import { ConfigPayload, ConfigResult, startConfigSession } from "./server/index.js";
import { OnResultCallback } from "./commands.js";

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

export type ConfigUrlRef = "local" | "dev-main" | "dev-preview" | "preview" | "prod" | string;
export function getConfigUrl(value: ConfigUrlRef, region: Region = DEFAULT_REGION): string {
    switch (value) {
        case "local":
            return "https://localhost:5173/cli";
        case "dev-main":
            return "https://dev-main.ui.dev1.vertesia.io/cli";
        case "dev-preview":
            return "https://dev-preview.ui.dev1.vertesia.io/cli";
        case "preview":
            return `https://preview.cloud.${region}.vertesia.io/cli`;
        case "prod":
            return `https://cloud.${region}.vertesia.io/cli`;
        default:
            if (value.startsWith("http://") || value.startsWith("https://")) {
                return value;
            } else {
                throw new InvalidConfigUrlError("Custom targets must be a valid http or https URL.");
            }
    }
}
export function getServerUrls(value: ConfigUrlRef, region: Region = DEFAULT_REGION): { studio_server_url: string; zeno_server_url: string } {
    switch (value) {
        case "local":
            return {
                studio_server_url: "http://localhost:8091",
                zeno_server_url: "http://localhost:8092",
            };
        case "dev-main":
            return {
                studio_server_url: "https://studio-server-dev-main.api.dev1.vertesia.io",
                zeno_server_url: "https://zeno-server-dev-main.api.dev1.vertesia.io",
            };
        case "dev-preview":
            return {
                studio_server_url: "https://studio-server-dev-preview.api.dev1.vertesia.io",
                zeno_server_url: "https://zeno-server-dev-preview.api.dev1.vertesia.io",
            };
        case "preview":
            return {
                studio_server_url: `https://api-preview.${region}.vertesia.io`,
                zeno_server_url: `https://api-preview.${region}.vertesia.io`,
            };
        case "prod":
            return {
                studio_server_url: `https://api.${region}.vertesia.io`,
                zeno_server_url: `https://api.${region}.vertesia.io`,
            };
        default:
            throw new Error("Unable to detect server urls from custom target.");
    }
}
export function getCloudTypeFromConfigUrl(url: string) {
    if (url.startsWith("https://localhost")) {
        return "staging";
    } else if (url.includes(".ui.dev1.vertesia.io")) {
        return "staging";
    } else if (url.startsWith("https://preview.")) {
        return "preview";
    } else if (url.startsWith("https://cloud.")) {
        return "production";
    } else {
        throw new Error("Unknown cloud env type");
    }
}

export interface Profile {
    name: string;
    config_url: string;
    apikey?: string;
    token_ref?: string;
    account: string;
    project: string;
    studio_server_url: string;
    zeno_server_url: string;
    region?: Region;
    session_tags?: string;
}


interface ProfilesData {
    default: string;
    profiles: Profile[];
}

interface TokenData {
    token: string;
    created_at?: number;
    expires_at?: number;
}

const ACTIVE_PROFILE_ENV_VAR = 'VERTESIA_PROFILE';
const TOKENS_DIR = 'tokens';

function ensurePrivateDir(dir: string) {
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    chmodSync(dir, 0o700);
}

function writePrivateJsonFile(file: string, data: object) {
    const tmpFile = `${file}.${process.pid}.tmp`;
    writeFileSync(tmpFile, JSON.stringify(data, null, 4), { encoding: 'utf8', mode: 0o600 });
    chmodSync(tmpFile, 0o600);
    renameSync(tmpFile, file);
}

function safeTokenFileName(profileName: string) {
    return `${encodeURIComponent(profileName)}.json`;
}

function defaultTokenRef(profileName: string) {
    return `${TOKENS_DIR}/${safeTokenFileName(profileName)}`;
}

function isSafeTokenRef(tokenRef: string | undefined) {
    return !!tokenRef
        && tokenRef.startsWith(`${TOKENS_DIR}/`)
        && !tokenRef.startsWith('/')
        && !tokenRef.split(/[\\/]/).includes('..');
}

function getProfileTokenRef(profile: Pick<Profile, 'name' | 'token_ref'>) {
    return isSafeTokenRef(profile.token_ref) ? profile.token_ref! : defaultTokenRef(profile.name);
}

function getTokenFile(profile: Pick<Profile, 'name' | 'token_ref'>) {
    return getConfigFile(getProfileTokenRef(profile));
}

function readTokenFile(profile: Profile): TokenData | undefined {
    try {
        return JSON.parse(readFileSync(getTokenFile(profile), 'utf8')) as TokenData;
    } catch (err: any) {
        if (err.code === 'ENOENT') {
            return undefined;
        }
        throw err;
    }
}

function writeTokenFile(profile: Profile, token: string) {
    const tokenDir = getConfigFile(TOKENS_DIR);
    ensurePrivateDir(tokenDir);
    const decoded = jwt.decode(token, { json: true });
    writePrivateJsonFile(getTokenFile(profile), {
        token,
        created_at: Math.floor(Date.now() / 1000),
        expires_at: decoded?.exp,
    });
}

function removeTokenFile(profile: Profile) {
    try {
        unlinkSync(getTokenFile(profile));
    } catch (err: any) {
        if (err.code !== 'ENOENT') {
            throw err;
        }
    }
}

export function getProfileToken(profile: Profile | undefined) {
    if (!profile) {
        return undefined;
    }
    if (profile.apikey) {
        return profile.apikey;
    }
    return readTokenFile(profile)?.token;
}

export function getProfileTokenPayload(profile: Profile | undefined) {
    const token = getProfileToken(profile);
    if (!token) {
        return undefined;
    }
    return jwt.decode(token, { json: true }) || undefined;
}

export function shouldRefreshProfileToken(profile: Profile, thresholdInSeconds = 1) {
    const token = getProfileTokenPayload(profile);
    if (token?.exp) {
        return (token.exp - thresholdInSeconds) * 1000 < Date.now();
    }
    // if no token or no expiration set then refresh auth token
    return true;
}

export class ConfigureProfile {
    onResultCallback?: OnResultCallback;
    constructor(public config: Config, public data: Partial<Profile>, public isNew: boolean) {
        this.data = data;
        this.isNew = !data.name;
    }

    getConfigPayload(): ConfigPayload {
        return {
            profile: this.data.name,
            account: this.data.account,
            project: this.data.project,
        }
    }

    async applyConfigResult(result: ConfigResult | undefined) {
        if (!result) {
            // Handle cancellation or no result
            console.log('\nAuthentication canceled or failed.');
            process.exit(1);
            return;
        }
        const oldName = this.data.name!;
        this.data.name = result.profile;
        this.data.account = result.account;
        this.data.project = result.project;
        this.data.studio_server_url = result.studio_server_url;
        this.data.zeno_server_url = result.zeno_server_url;
        this.data.apikey = result.token;
        this.data.token_ref = defaultTokenRef(result.profile);
        this.config.remove(oldName);
        this.config.add(this.data as Profile);
        if (this.isNew) {
            this.config.use(this.data.name!);
        }
        this.config.save();
        if (this.onResultCallback) {
            await this.onResultCallback(result);
            this.onResultCallback = undefined;
        }
        // force exit to close last prompt
        console.log('\n');
        console.log('Authentication completed.');
        process.exit(0);
    }

    async start(onResult?: OnResultCallback, signal?: AbortSignal) {
        this.onResultCallback = onResult;
        await startConfigSession(
            this.data.config_url!, 
            this.getConfigPayload(), 
            this.applyConfigResult.bind(this),
            signal
        );
    }
}

export class Config {
    current?: Profile;
    profiles: Profile[];
    isDevMode = false;

    constructor(data?: ProfilesData) {
        this.profiles = data?.profiles || [];
        if (data?.default) {
            this.use(data.default);
        }
    }

    hasProfile(name: string) {
        return !!this.profiles.find(p => p.name === name);
    }

    getProfile(name: string) {
        return this.profiles.find(p => p.name === name);
    }

    use(name: string) {
        this.current = this.profiles.find(p => p.name === name);
        if (!this.current) {
            console.error(`No configuration named ${name} found`);
            process.exit(1);
        }
        return this;
    }

    add(profile: Profile) {
        if (this.profiles.find(p => p.name === profile.name)) {
            console.error(`A configuration named ${profile.name} already exists`);
        } else {
            this.profiles.push(profile);
        }
        this.use(profile.name);
        return this;
    }

    update(profile: Profile) {
        const existingProfile = this.profiles.find(p => p.name === profile.name);
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
        const i = this.profiles.findIndex(p => p.name === name);
        if (i > -1) {
            removeTokenFile(this.profiles[i]);
            this.profiles.splice(i, 1);
            if (this.current?.name === name) {
                this.current = undefined;
            }
        }
        return this;
    }

    createProfile(name: string, target: ConfigUrlRef, region: Region = DEFAULT_REGION) {
        const config_url = getConfigUrl(target, region);
        return new ConfigureProfile(this, { name, config_url, region }, true);
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
        const data = this.getProfile(name);
        if (config_url) { // create a new profile on config_url
            if (data) {
                throw new ProfileAlreadyExistsError(`Profile ${name} already exists.`);
            } else {
                return new ConfigureProfile(this, { name, config_url }, true);
            }
        } else { // update an existing profile
            if (data) {
                return new ConfigureProfile(this, data, false);
            } else {
                throw new ProfileNotFoundError(`Profile not found: ${name}.`);
            }
        }
    }

    save() {
        const dir = getConfigFile();
        ensurePrivateDir(dir);
        const file = getConfigFile('profiles.json');
        const profiles = this.profiles.map(profile => {
            const token = profile.apikey;
            const token_ref = getProfileTokenRef(profile);
            if (token) {
                writeTokenFile({ ...profile, token_ref }, token);
            }
            const { apikey: _apikey, ...storedProfile } = profile;
            return { ...storedProfile, token_ref };
        });
        writePrivateJsonFile(file, {
            default: this.current?.name,
            profiles,
        });
        return this;
    }

    load() {
        try {
            const stats = statSync(getConfigFile('dev'));
            if (stats.isFile()) {
                this.isDevMode = true;
            }
        } catch (err: any) {
            if (err.code !== 'ENOENT') {
                throw err;
            }
        }
        try {
            const data = readJsonFile(getConfigFile('profiles.json')) as ProfilesData;
            this.profiles = (data.profiles || []).map(profile => ({
                ...profile,
                token_ref: profile.token_ref || defaultTokenRef(profile.name),
            }));
            const selectedProfile = process.env[ACTIVE_PROFILE_ENV_VAR] || data.default;
            if (selectedProfile) {
                this.use(selectedProfile)
            } else {
                this.current = undefined;
            }
        } catch (err: any) {
            if (err.code !== 'ENOENT') {
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
