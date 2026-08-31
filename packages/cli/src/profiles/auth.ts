import type { OnResultCallback } from './commands.js';
import type { Profile } from './index.js';
import { config, shouldRefreshProfileToken } from './index.js';
import { readAuthBundle, readProfileAccessToken } from './keyring.js';
import { canUseOAuthProfile, refreshOAuthSession } from './oauth.js';
import type { ConfigResult } from './server/index.js';

export async function ensureProfileAccessToken(
    profile: Profile,
    onResult?: OnResultCallback,
): Promise<string | undefined> {
    const token = await readProfileAccessToken(profile);
    if (token && !(await shouldRefreshProfileToken(profile, 30))) {
        return token;
    }

    const result = await refreshProfileAccessToken(profile, onResult);
    return result?.token;
}

/**
 * Build an authorization callback that resolves the profile access token at call time.
 *
 * Long-running commands (streaming an agent run for hours, tailing a workflow) outlive the access
 * token TTL. Pinning the token captured when the command started makes every later request — and
 * every stream reconnect — fail with 401/403. This callback goes back through the same profile
 * refresh path as `vertesia auth token` on each call, and collapses concurrent callers onto a
 * single refresh.
 */
export function createProfileAuthProvider(profile: Profile): () => Promise<string> {
    let pending: Promise<string | undefined> | undefined;

    return async () => {
        if (!pending) {
            pending = resolveProfileToken(profile).finally(() => {
                pending = undefined;
            });
        }
        const token = await pending;
        if (!token) {
            throw new Error(
                `No auth token is available for profile "${profile.name}". Run \`vertesia auth refresh\` to authenticate again.`,
            );
        }
        return `Bearer ${token}`;
    };
}

async function resolveProfileToken(profile: Profile): Promise<string | undefined> {
    try {
        const token = await ensureProfileAccessToken(profile);
        if (token) {
            return token;
        }
    } catch (error) {
        // A refresh failure is often transient (network, STS hiccup). Report it and fall back to
        // the stored token so a long-running command can recover on the next request.
        console.warn(
            `Failed to refresh the access token for profile "${profile.name}": ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
    }
    return readProfileAccessToken(profile);
}

export async function refreshProfileAccessToken(
    profile: Profile,
    onResult?: OnResultCallback,
    options: {
        projectId?: string;
    } = {},
): Promise<ConfigResult | undefined> {
    const bundle = await readAuthBundle(profile.name);
    if (!bundle?.refreshToken || !canUseOAuthProfile(profile)) {
        return undefined;
    }

    const result = await refreshOAuthSession(profile, bundle.refreshToken, bundle, options);
    const updater = config.updateProfile(profile.name);
    updater.onResultCallback = onResult;
    await updater.persistConfigResult(result);
    return result;
}

export async function refreshProfileAuthentication(
    profileName: string,
    onResult?: OnResultCallback,
    signal?: AbortSignal,
    options: {
        projectId?: string;
    } = {},
): Promise<ConfigResult | undefined> {
    const profile = config.getProfile(profileName);
    if (!profile) {
        throw new Error(`Profile ${profileName} not found.`);
    }

    try {
        const refreshed = await refreshProfileAccessToken(profile, onResult, options);
        if (refreshed) {
            logRefreshSuccess(profileName, refreshed);
            return refreshed;
        }
    } catch (error) {
        if (options.projectId) {
            throw error;
        }
        console.error(error instanceof Error ? error.message : String(error));
        console.error('Falling back to interactive authentication.');
    }

    if (options.projectId) {
        throw new Error(
            'Project switching requires a stored OAuth refresh token. Run `vertesia auth refresh` without --project to authenticate again.',
        );
    }

    const updater = config.updateProfile(profileName);
    await updater.start(onResult, signal);
    return undefined;
}

function logRefreshSuccess(profileName: string, result: ConfigResult): void {
    const expiresAtMs =
        typeof result.access_token_expires_at === 'number'
            ? result.access_token_expires_at
            : typeof result.expires_in === 'number'
              ? Date.now() + result.expires_in * 1000
              : undefined;
    const suffix = expiresAtMs ? ` (expires ${new Date(expiresAtMs).toISOString()})` : '';
    console.log(`Refreshed access token for profile "${profileName}"${suffix}.`);
}

export async function refreshCurrentProfileAuthentication(
    onResult?: OnResultCallback,
    signal?: AbortSignal,
    options: {
        projectId?: string;
    } = {},
): Promise<ConfigResult | undefined> {
    if (!config.current) {
        console.log('No profile is selected. Run `vertesia profiles use <name>` to select a profile');
        process.exit(1);
    }
    return refreshProfileAuthentication(config.current.name, onResult, signal, options);
}
