import type { Profile } from './index.js';
import { config, shouldRefreshProfileToken } from './index.js';
import type { OnResultCallback } from './commands.js';
import { canUseOAuthProfile, refreshOAuthSession } from './oauth.js';
import { readAuthBundle, readProfileAccessToken } from './keyring.js';
import type { ConfigResult } from './server/index.js';

export async function ensureProfileAccessToken(profile: Profile, onResult?: OnResultCallback): Promise<string | undefined> {
    const token = readProfileAccessToken(profile);
    if (token && !shouldRefreshProfileToken(profile, 30)) {
        return token;
    }

    const result = await refreshProfileAccessToken(profile, onResult);
    return result?.token;
}

export async function refreshProfileAccessToken(profile: Profile, onResult?: OnResultCallback): Promise<ConfigResult | undefined> {
    const bundle = readAuthBundle(profile.name);
    if (!bundle?.refreshToken || !canUseOAuthProfile(profile)) {
        return undefined;
    }

    const result = await refreshOAuthSession(profile, bundle.refreshToken, bundle);
    const updater = config.updateProfile(profile.name);
    updater.onResultCallback = onResult;
    await updater.persistConfigResult(result);
    return result;
}

export async function refreshProfileAuthentication(
    profileName: string,
    onResult?: OnResultCallback,
    signal?: AbortSignal,
): Promise<ConfigResult | undefined> {
    const profile = config.getProfile(profileName);
    if (!profile) {
        throw new Error(`Profile ${profileName} not found.`);
    }

    try {
        const refreshed = await refreshProfileAccessToken(profile, onResult);
        if (refreshed) {
            return refreshed;
        }
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        console.error('Falling back to interactive authentication.');
    }

    const updater = config.updateProfile(profileName);
    await updater.start(onResult, signal);
    return undefined;
}

export async function refreshCurrentProfileAuthentication(
    onResult?: OnResultCallback,
    signal?: AbortSignal,
): Promise<ConfigResult | undefined> {
    if (!config.current) {
        console.log("No profile is selected. Run `vertesia profiles use <name>` to select a profile");
        process.exit(1);
    }
    return refreshProfileAuthentication(config.current.name, onResult, signal);
}
