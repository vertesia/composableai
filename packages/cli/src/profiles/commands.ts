import { VertesiaClient } from '@vertesia/client';
import colors from 'ansi-colors';
import enquirer from "enquirer";
import jwt from 'jsonwebtoken';
import { AVAILABLE_REGIONS, DEFAULT_REGION, Region, config, getConfigUrl, getServerUrls, shouldRefreshProfileToken } from "./index.js";
import { deleteAuthBundle, getAccessTokenExpiry, readProfileAccessToken, writeAuthBundle } from "./keyring.js";
import { ConfigResult } from './server/index.js';
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


export async function listProfiles() {
    const selected = config.current?.name;
    for (const profile of config.profiles) {
        console.log(profile.name + (selected === profile.name ? " " + colors.symbols.check : ""));
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
        const token = readProfileAccessToken(config.current);
        if (!token) {
            console.log('No auth token is stored for the current profile. Run `vertesia auth refresh` to authenticate again.');
            return;
        }
        const expiresAt = getAccessTokenExpiry(token);
        if (expiresAt && expiresAt < Date.now()) {
            console.log("Authentication token expired. Create a new one ");
            await _doRefreshToken(config.current.name);
        } else {
            console.log(token);
        }
    } else {
        console.log('No profile is selected. Run `vertesia auth refresh` to refresh the token');
    }
}


export function deleteProfile(name: string) {
    deleteAuthBundle(name);
    config.remove(name).save();
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
        // only show dev environments in dev mode
        const choices = config.isDevMode ? ['local', 'dev-main', 'dev-preview', 'preview', 'prod', 'custom'] : ['preview', 'prod'];
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
            config_url: getConfigUrl(target!, region),
            region,
            ...serverUrls,
        });
        config.use(name!).save();
    } else {
        await config.createProfile(name!, target!, region).start(options.onResult);
    }

    return name!;
}

export async function updateProfile(name?: string, onResult?: OnResultCallback, signal?: AbortSignal) {
    if (!name) {
        name = await selectProfile("Select the profile to update");
    }
    const profile = config.getProfile(name!);
    if (!profile) {
        console.error(`Profile ${name} not found`);
        process.exit(1);
    }
    await config.updateProfile(name).start(onResult, signal);
}

export function updateCurrentProfile(onResult?: OnResultCallback, signal?: AbortSignal): Promise<void> {
    if (!config.current) {
        console.log("No profile is selected. Run `vertesia profiles use <name>` to select a profile");
        process.exit(1);
    }
    return config.updateProfile(config.current.name).start(onResult, signal);
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
            await config.updateProfile(profileName).start(onResult, abortController.signal);
        }
    } finally {
        process.off('SIGINT', handleSignal);
        process.off('SIGTERM', handleSignal);
    }
}
