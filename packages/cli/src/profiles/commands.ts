import colors from 'ansi-colors';
import enquirer from "enquirer";
import jwt from 'jsonwebtoken';
import { config, getConfigUrl, getServerUrls, shouldRefreshProfileToken } from "./index.js";
import { ConfigResult } from './server/index.js';
const { prompt } = enquirer;

export type OnResultCallback = (result: ConfigResult) => void | Promise<void>;


export async function listProfiles() {
    const selected = config.current?.name;
    for (const profile of config.profiles) {
        console.log(profile.name + (selected === profile.name ? " " + colors.symbols.check : ""));
    }
    if (!config.profiles.length) {
        console.log("No profiles are defined. Run `cpcli config create` to add a new profile.");
        console.log();
        const r: any = await prompt({
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
            console.log('No profiles are defined. Run `composable profiles create` to add a new profile.');
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

export function showActiveAuthToken() {
    if (config.profiles.length === 0) {
        console.log('No profiles are defined. Run `composable profiles create` to add a new profile.');
        return;
    } else if (config.current) {
        const token = jwt.decode(config.current.apikey, { json: true });
        if (token?.exp && token.exp * 1000 < Date.now()) {
            console.log("Authentication token expired. Create a new one ");
            _doRefreshToken(config.current.name);
        } else {
            console.log(config.current.apikey);
        }
    } else {
        console.log('No profile is selected. Run `composable auth refresh` to refrehs the token');
    }
}


export function deleteProfile(name: string) {
    config.remove(name).save();
}

interface CreateProfileOptions {
    target?: string,
    apikey?: string,
    project?: string;
    account?: string;
    onResult?: OnResultCallback
}
export async function createProfile(name?: string, options: CreateProfileOptions = {}) {
    const format = (value: string) => value.trim();
    const questions: any[] = [];
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
        // only show local and staging in dev mode
        const choices = config.isDevMode ? ['local', 'staging', 'preview', 'prod', 'custom'] : ['preview', 'prod'];
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
        const response: any = await prompt(questions)
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

    if (options.apikey) {
        if (!options.account || !options.project) {
            console.error("When using --apikey you must provide the project and account IDs");
            process.exit(1);
        }
        config.add({
            account: options.account,
            project: options.project,
            name,
            config_url: getConfigUrl(target),
            apikey: options.apikey,
            ...getServerUrls(target),
        });
        config.use(name!).save();
    } else {
        config.createProfile(name!, target!).start(options.onResult);
    }

    return name!;
}

export async function updateProfile(name?: string, onResult?: OnResultCallback) {
    if (!name) {
        name = await selectProfile("Select the profile to update");
    }
    const profile = config.getProfile(name!);
    if (!profile) {
        console.error(`Profile ${name} not found`);
        process.exit(1);
    }
    config.updateProfile(name).start(onResult);
}

export function updateCurrentProfile(onResult?: OnResultCallback) {
    if (!config.current) {
        console.log("No profile is selected. Run `cpcli config use <name>` to select a profile");
        process.exit(1);
    }
    config.updateProfile(config.current.name).start(onResult);
}


async function selectProfile(message = "Select the profile") {
    const response: any = await prompt({
        type: 'select',
        name: 'name',
        message,
        choices: config.profiles.map(p => p.name)
    })
    return response.name as string;
}

export async function tryRrefreshToken() {
    if (!config.current) {
        console.log("No profile is selected. Run `vertesia profiles use <name>` to select a profile");
        process.exit(1);
    }
    if (shouldRefreshProfileToken(config.current)) {
        console.log();
        console.log(colors.bold("Operation Failed:"), colors.red("Authentication token expired!"));
        console.log();
        _doRefreshToken(config.current.name);
    }
}

async function _doRefreshToken(profileName: string, onResult?: OnResultCallback) {
    const r: any = await prompt({
        name: 'refresh',
        type: "confirm",
        message: "Do you want to refresh the token for the current profile?",
        initial: true,
    })
    if (r.refresh) {
        config.updateProfile(profileName).start(onResult);
    }
}