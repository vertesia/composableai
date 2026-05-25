import { VertesiaClient } from '@vertesia/client';
import colors from 'ansi-colors';
import enquirer from "enquirer";
import jwt from 'jsonwebtoken';
import {
    AVAILABLE_REGIONS,
    DEFAULT_REGION,
    type Region,
    config,
    getConfigUrl,
    getServerUrls,
    shouldRefreshProfileToken,
} from "./index.js";
import {
    deleteAuthBundle,
    getAccessTokenExpiry,
    isKeyringAvailable,
    readAuthBundle,
    writeAuthBundle,
} from "./keyring.js";
import { ensureProfileAccessToken, refreshCurrentProfileAuthentication, refreshProfileAuthentication } from './auth.js';
import type { ConfigResult } from './server/index.js';
const { prompt } = enquirer;

export type OnResultCallback = (result: ConfigResult | undefined) => void | Promise<void>;

interface CliPromptQuestion {
    type: string;
    name: string;
    message: string;
    choices?: string[];
    initial?: string | number | boolean;
    format?: (value: string) => string;
    validate?: (value: string) => boolean | string;
}

interface AuthDetailsOptions {
    json?: boolean;
}

interface TokenDetails {
    present: boolean;
    type?: 'jwt' | 'opaque';
    expires_at?: string;
    expired?: boolean;
    issuer?: string;
    subject?: string;
    audience?: string;
    account?: string;
    project?: string;
}

interface AuthDetailsPayload {
    selected_profile?: string;
    profile?: {
        name: string;
        account: string;
        project: string;
        config_url: string;
        studio_server_url: string;
        zeno_server_url: string;
        region?: Region;
    };
    keyring_available: boolean;
    active_credential_source: string;
    environment: {
        credential?: string;
        studio_server_url?: string;
        zeno_server_url?: string;
        token_server_url?: string;
        project?: string;
    };
    stored_credentials?: {
        access_token: TokenDetails;
        refresh_token: TokenDetails;
        id_token: TokenDetails;
        oauth_client_id?: string;
        oauth_resource?: string;
    };
    active_token: TokenDetails;
}


export async function listProfiles() {
    const selected = config.current?.name;
    for (const profile of config.profiles) {
        console.log(profile.name + (selected === profile.name ? ` ${colors.symbols.check}` : ""));
    }
    if (!config.profiles.length) {
        console.log("No profiles are defined. Run `vertesia profiles add` to add a new profile.");
        console.log();
        const r = await prompt<{ create?: boolean }>({
            type: "confirm",
            name: 'create',
            message: "Do you want to create a profile now?",
        })
        if (r.create) {
            return createProfile();
        }
    }
}

export async function useProfile(name?: string) {
    if (!name) {
        name = await selectProfile("Select the profile to use");
    }
    config.use(name).save();
}

export function showProfile(name?: string) {
    if (!name) {
        if (config.profiles.length === 0) {
            console.log('No profiles are defined. Run `vertesia profiles create` to add a new profile.');
            return;
        } else {
            console.log(JSON.stringify({
                default: config.current?.name,
                profiles: config.profiles,
            }, undefined, 4));
        }
    } else {
        const profile = config.getProfile(name);
        if (profile) {
            console.log(JSON.stringify(profile, undefined, 4));
        } else {
            console.error(`Profile ${name} not found`);
        }
    }
}

export function showAuthDetails(options: AuthDetailsOptions = {}) {
    const envAuth = readEnvCredential();
    const profile = config.current;
    const bundle = profile ? readAuthBundle(profile.name) : undefined;
    const profileAccessToken = bundle?.accessToken || profile?.apikey;
    const activeToken = envAuth?.token || profileAccessToken;
    const activeCredentialSource = envAuth
        ? `environment:${envAuth.name}`
        : profileAccessToken
            ? `profile:${profile?.name}`
            : 'none';

    const payload: AuthDetailsPayload = {
        selected_profile: profile?.name,
        profile: profile && {
            name: profile.name,
            account: profile.account,
            project: profile.project,
            config_url: profile.config_url,
            studio_server_url: profile.studio_server_url,
            zeno_server_url: profile.zeno_server_url,
            region: profile.region,
        },
        keyring_available: isKeyringAvailable(),
        active_credential_source: activeCredentialSource,
        environment: {
            credential: envAuth?.name,
            studio_server_url: process.env.VERTESIA_SERVER_URL || process.env.COMPOSABLE_PROMPTS_SERVER_URL,
            zeno_server_url: process.env.VERTESIA_STORE_URL || process.env.ZENO_SERVER_URL,
            token_server_url: process.env.VERTESIA_TOKEN_SERVER_URL,
            project: process.env.VERTESIA_PROJECT_ID || process.env.COMPOSABLE_PROMPTS_PROJECT_ID,
        },
        stored_credentials: profile ? {
            access_token: readTokenDetails(profileAccessToken, bundle?.accessTokenExpiresAt),
            refresh_token: readTokenDetails(bundle?.refreshToken, bundle?.refreshTokenExpiresAt),
            id_token: readTokenDetails(bundle?.idToken),
            oauth_client_id: bundle?.oauthClientId,
            oauth_resource: bundle?.oauthResource,
        } : undefined,
        active_token: readTokenDetails(activeToken, envAuth ? undefined : bundle?.accessTokenExpiresAt),
    };

    if (options.json) {
        console.log(JSON.stringify(payload, undefined, 4));
        return;
    }

    printAuthDetails(payload);
}

export async function showActiveAuthToken() {
    const envToken = process.env.VERTESIA_TOKEN
        || process.env.VERTESIA_APIKEY
        || process.env.COMPOSABLE_PROMPTS_APIKEY;
    if (envToken) {
        console.log(envToken);
        return;
    }
    if (config.profiles.length === 0) {
        console.log('No profiles are defined. Run `vertesia profiles create` to add a new profile.');
        return;
    } else if (config.current) {
        let token: string | undefined;
        try {
            token = await ensureProfileAccessToken(config.current);
        } catch (error) {
            console.error(error instanceof Error ? error.message : String(error));
            console.error('Run `vertesia auth refresh` to authenticate again.');
            process.exit(1);
        }
        if (!token) {
            console.log('No auth token is stored for the current profile. Run `vertesia auth refresh` to authenticate again.');
            return;
        }
        console.log(token);
    } else {
        console.log('No profile is selected. Run `vertesia auth refresh` to refresh the token');
    }
}

export async function showActiveIdToken() {
    if (config.profiles.length === 0) {
        console.log('No profiles are defined. Run `vertesia profiles create` to add a new profile.');
        return;
    }
    if (!config.current) {
        console.log('No profile is selected. Run `vertesia auth refresh` to refresh the token');
        return;
    }

    const bundle = readAuthBundle(config.current.name);
    if (!bundle?.idToken) {
        console.log('No ID token is stored for the current profile. Run `vertesia auth refresh` to authenticate again.');
        return;
    }
    console.log(bundle.idToken);
}


export function deleteProfile(name: string) {
    deleteAuthBundle(name);
    config.remove(name).save();
}

export function logoutProfile(name?: string) {
    const profileName = name || config.current?.name;
    if (!profileName) {
        console.log("No profile is selected. Run `vertesia profiles use <name>` to select a profile");
        return;
    }
    if (!config.getProfile(profileName)) {
        console.error(`Profile ${profileName} not found`);
        process.exit(1);
    }
    const profile = config.getProfile(profileName);
    if (profile?.apikey) {
        delete profile.apikey;
        config.save();
    }
    deleteAuthBundle(profileName);
    console.log(`Logged out of profile ${profileName}.`);
}

export interface CreateProfileOptions {
    target?: string,
    region?: string,
    apikey?: string,
    project?: string;
    account?: string;
    onResult?: OnResultCallback
}
export async function createProfile(name?: string, options: CreateProfileOptions = {}) {
    const format = (value: string) => value.trim();
    const questions: CliPromptQuestion[] = [];
    if (!name) {
        questions.push({
            type: 'input',
            name: 'name',
            message: "Profile name",
            format,
            validate: (value: string) => {
                const v = value.trim();
                if (!v) {
                    return "Profile name cannot be empty";
                }
                if (config.hasProfile(v)) {
                    return `A profile named "${v}" already exists`;
                }
                return true;
            }
        });
    }
    if (!options.target) {
        // Branch/dev deployments are custom URLs so profile config is explicit.
        const choices = config.isDevMode ? ['local', 'preview', 'prod', 'custom'] : ['preview', 'prod', 'custom'];
        questions.push({
            type: 'select',
            name: 'target',
            message: "Target environment",
            choices,
            initial: choices[0],
        });
    }

    let target = options.target === "production" ? "prod" : options.target;
    if (questions.length > 0) {
        const response = await prompt<{ name?: string; target?: string }>(questions);
        if (!name) {
            name = response.name;
        }
        if (!target) {
            target = response.target;
        }
    }

    if (!target || !name) {
        console.error("Invalid profile name or target");
        process.exit(1);
    }

    // If custom target, prompt for URL
    if (target === 'custom') {
        const customResponse = await prompt<{ url?: string }>({
            type: 'input',
            name: 'url',
            message: 'Enter the custom URL (e.g., https://your-deployment.vercel.app/cli)',
            validate: (value: string) => {
                const v = value.trim();
                if (!v.startsWith('http://') && !v.startsWith('https://')) {
                    return 'URL must start with http:// or https://';
                }
                return true;
            }
        });
        const customUrl = customResponse.url?.trim();
        if (!customUrl) {
            console.error("Invalid target URL");
            process.exit(1);
        }
        target = customUrl;
    }

    // Prompt for region when target requires it (preview/prod only)
    const selectedRegion = readRegion(options.region);
    if (options.region && !selectedRegion) {
        console.error(`Invalid region "${options.region}". Expected one of: ${AVAILABLE_REGIONS.join(', ')}`);
        process.exit(1);
    }
    let region = selectedRegion ?? DEFAULT_REGION;
    const needsRegionPrompt = !options.region && (target === 'preview' || target === 'prod');
    if (needsRegionPrompt) {
        const regionQuestion: CliPromptQuestion = {
            type: 'select',
            name: 'region',
            message: 'Deployment region',
            choices: AVAILABLE_REGIONS,
            initial: AVAILABLE_REGIONS[0],
        };
        const regionResponse = await prompt<{ region?: string }>(regionQuestion);
        region = readRegion(regionResponse.region) ?? DEFAULT_REGION;
    }

    if (options.apikey) {
        // biome-ignore lint/style/noNonNullAssertion: intentional non-null assertion; TS can't prove narrowing here
        const serverUrls = getServerUrls(target!, region);
        const tokenRefs = await resolveCredentialRefs(options.apikey, serverUrls);
        const account = options.account || tokenRefs.account;
        const project = options.project || tokenRefs.project;
        if (!account || !project) {
            console.error("Unable to resolve project and account from the supplied credential. Check the target endpoint or provide --project and --account.");
            process.exit(1);
        }
        writeAuthBundle(name, {
            accessToken: options.apikey,
            accessTokenExpiresAt: getAccessTokenExpiry(options.apikey),
        });
        config.add({
            account,
            project,
            name,
            // biome-ignore lint/style/noNonNullAssertion: intentional non-null assertion; TS can't prove narrowing here
            config_url: getConfigUrl(target!, region),
            region,
            ...serverUrls,
        });
        // biome-ignore lint/style/noNonNullAssertion: intentional non-null assertion; TS can't prove narrowing here
        config.use(name!).save();
    } else {
        // biome-ignore lint/style/noNonNullAssertion: intentional non-null assertion; TS can't prove narrowing here
        await config.createProfile(name!, target!, region).start(options.onResult);
    }

    // biome-ignore lint/style/noNonNullAssertion: intentional non-null assertion; TS can't prove narrowing here
    return name!;
}

export async function loginProfile(name?: string, options: CreateProfileOptions & RefreshProfileOptions = {}) {
    const profile = name
        ? config.getProfile(name)
        : config.current;
    if (profile) {
        await refreshProfileAuthentication(profile.name, options.onResult, undefined, {
            projectId: options.project,
        });
        return profile.name;
    }

    return createProfile(name, options);
}

export async function updateProfile(name?: string, onResult?: OnResultCallback, signal?: AbortSignal) {
    if (!name) {
        name = await selectProfile("Select the profile to update");
    }
    // biome-ignore lint/style/noNonNullAssertion: intentional non-null assertion; TS can't prove narrowing here
    const profile = config.getProfile(name!);
    if (!profile) {
        console.error(`Profile ${name} not found`);
        process.exit(1);
    }
    await config.updateProfile(name).start(onResult, signal);
}

export interface RefreshProfileOptions {
    project?: string;
}

export async function refreshProfile(
    name?: string,
    onResult?: OnResultCallback,
    signal?: AbortSignal,
    options: RefreshProfileOptions = {},
): Promise<ConfigResult | undefined> {
    if (!name) {
        name = await selectProfile("Select the profile to refresh");
    }
    return refreshProfileAuthentication(name, onResult, signal, {
        projectId: options.project,
    });
}

export function updateCurrentProfile(
    onResult?: OnResultCallback,
    signal?: AbortSignal,
    options: RefreshProfileOptions = {},
): Promise<void> {
    return refreshCurrentProfileAuthentication(onResult, signal, {
        projectId: options.project,
    }).then(() => undefined);
}


async function selectProfile(message = "Select the profile") {
    const question: CliPromptQuestion = {
        type: 'select',
        name: 'name',
        message,
        choices: config.profiles.map(p => p.name)
    };
    const response = await prompt<{ name?: string }>(question);
    if (!response.name) {
        console.error("No profile selected");
        process.exit(1);
    }
    return response.name;
}

function readRegion(value: string | undefined): Region | undefined {
    return AVAILABLE_REGIONS.find(region => region === value);
}

interface CredentialRefs {
    account?: string;
    project?: string;
}

async function resolveCredentialRefs(credential: string, serverUrls: { studio_server_url: string; zeno_server_url: string }): Promise<CredentialRefs> {
    const tokenRefs = readTokenRefs(credential);
    if (tokenRefs.account && tokenRefs.project) {
        return tokenRefs;
    }

    const client = new VertesiaClient({
        serverUrl: serverUrls.studio_server_url,
        storeUrl: serverUrls.zeno_server_url,
        apikey: credential,
    });
    const [account, project] = await Promise.all([
        client.getAccount(),
        client.getProject(),
    ]);

    return {
        account: tokenRefs.account || account?.id,
        project: tokenRefs.project || project?.id,
    };
}

function readTokenRefs(token: string): CredentialRefs {
    const decoded = jwt.decode(token, { json: true });
    if (!decoded || typeof decoded !== 'object') {
        return {};
    }
    return {
        account: readRefId(decoded, 'account') || readStringField(decoded, 'account_id'),
        project: readRefId(decoded, 'project') || readStringField(decoded, 'project_id'),
    };
}

function readEnvCredential(): { name: string; token: string } | undefined {
    if (process.env.VERTESIA_TOKEN) {
        return {
            name: 'VERTESIA_TOKEN',
            token: process.env.VERTESIA_TOKEN,
        };
    }
    if (process.env.VERTESIA_APIKEY) {
        return {
            name: 'VERTESIA_APIKEY',
            token: process.env.VERTESIA_APIKEY,
        };
    }
    if (process.env.COMPOSABLE_PROMPTS_APIKEY) {
        return {
            name: 'COMPOSABLE_PROMPTS_APIKEY',
            token: process.env.COMPOSABLE_PROMPTS_APIKEY,
        };
    }
    return undefined;
}

function readTokenDetails(token: string | undefined, expiresAt?: number): TokenDetails {
    if (!token) {
        return { present: false };
    }

    const decoded = jwt.decode(token, { json: true });
    if (!decoded || typeof decoded !== 'object') {
        return readOpaqueTokenDetails(expiresAt);
    }

    const tokenExpiresAt = expiresAt ?? readNumericDate(decoded, 'exp');
    return {
        present: true,
        type: 'jwt',
        expires_at: formatTimestamp(tokenExpiresAt),
        expired: tokenExpiresAt === undefined ? undefined : tokenExpiresAt <= Date.now(),
        issuer: readStringField(decoded, 'iss'),
        subject: readStringField(decoded, 'sub'),
        audience: readAudience(decoded),
        account: readRefId(decoded, 'account') || readStringField(decoded, 'account_id'),
        project: readRefId(decoded, 'project') || readStringField(decoded, 'project_id'),
    };
}

function readOpaqueTokenDetails(expiresAt?: number): TokenDetails {
    return {
        present: true,
        type: 'opaque',
        expires_at: formatTimestamp(expiresAt),
        expired: expiresAt === undefined ? undefined : expiresAt <= Date.now(),
    };
}

function readNumericDate(value: object, key: string): number | undefined {
    const field = Reflect.get(value, key);
    return typeof field === 'number' ? field * 1000 : undefined;
}

function readAudience(value: object): string | undefined {
    const field = Reflect.get(value, 'aud');
    if (typeof field === 'string') {
        return field;
    }
    if (Array.isArray(field)) {
        const first = field.find((candidate) => typeof candidate === 'string');
        return typeof first === 'string' ? first : undefined;
    }
    return undefined;
}

function formatTimestamp(value: number | undefined): string | undefined {
    return value === undefined ? undefined : new Date(value).toISOString();
}

function readRefId(value: object, key: string): string | undefined {
    const field = Reflect.get(value, key);
    if (typeof field === 'string') {
        return field;
    }
    if (!isRecord(field)) {
        return undefined;
    }
    const id = Reflect.get(field, 'id');
    return typeof id === 'string' ? id : undefined;
}

function readStringField(value: object, key: string): string | undefined {
    const field = Reflect.get(value, key);
    return typeof field === 'string' ? field : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function printAuthDetails(payload: AuthDetailsPayload) {
    console.log('Authentication details');
    console.log();
    printSection('Profile', [
        ['Selected', payload.selected_profile],
        ['Account', payload.profile?.account],
        ['Project', payload.profile?.project],
        ['Config URL', payload.profile?.config_url],
        ['Studio server', payload.profile?.studio_server_url],
        ['Zeno server', payload.profile?.zeno_server_url],
        ['Region', payload.profile?.region],
    ]);
    printSection('Environment overrides', [
        ['Credential', payload.environment.credential],
        ['Studio server', payload.environment.studio_server_url],
        ['Zeno server', payload.environment.zeno_server_url],
        ['Token server', payload.environment.token_server_url],
        ['Project', payload.environment.project],
    ]);
    printSection('Stored credentials', [
        ['Keyring', payload.keyring_available ? 'available' : 'unavailable'],
        ['Access token', formatTokenSummary(payload.stored_credentials?.access_token)],
        ['Refresh token', formatTokenSummary(payload.stored_credentials?.refresh_token)],
        ['ID token', formatTokenSummary(payload.stored_credentials?.id_token)],
        ['OAuth client', payload.stored_credentials?.oauth_client_id],
        ['OAuth resource', payload.stored_credentials?.oauth_resource],
    ]);
    printSection('Active credential', [
        ['Source', payload.active_credential_source],
        ['Token', formatTokenSummary(payload.active_token)],
        ['Issuer', payload.active_token.issuer],
        ['Subject', payload.active_token.subject],
        ['Audience', payload.active_token.audience],
        ['Account', payload.active_token.account],
        ['Project', payload.active_token.project],
    ]);
}

function printSection(title: string, rows: Array<[string, string | undefined]>) {
    console.log(colors.bold(title));
    for (const [label, value] of rows) {
        console.log(`  ${label}: ${value || '-'}`);
    }
    console.log();
}

function formatTokenSummary(details: TokenDetails | undefined): string {
    if (!details?.present) {
        return 'not stored';
    }
    const parts = [details.type || 'token'];
    if (details.expires_at) {
        parts.push(`${details.expired ? 'expired' : 'expires'} ${details.expires_at}`);
    }
    return parts.join(', ');
}

export async function tryRefreshToken() {
    if (!config.current) {
        console.log("No profile is selected. Run `vertesia profiles use <name>` to select a profile");
        process.exit(1);
    }
    if (shouldRefreshProfileToken(config.current)) {
        console.log();
        console.log(colors.bold("Operation Failed:"), colors.red("Authentication token expired!"));
        console.log();
        await _doRefreshToken(config.current.name);
    }
}

async function _doRefreshToken(profileName: string, onResult?: OnResultCallback) {
    const abortController = new AbortController();
    const handleSignal = () => {
        abortController.abort();
        console.log("\nToken refresh interrupted");
        process.exit(130);
    };
    process.once('SIGINT', handleSignal);
    process.once('SIGTERM', handleSignal);
    try {
        const r = await prompt<{ refresh?: boolean }>({
            name: 'refresh',
            type: "confirm",
            message: "Do you want to refresh the token for the current profile?",
            initial: true,
        });
        if (r.refresh) {
            await refreshProfileAuthentication(profileName, onResult, abortController.signal);
        }
    } finally {
        process.off('SIGINT', handleSignal);
        process.off('SIGTERM', handleSignal);
    }
}
