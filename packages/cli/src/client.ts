import { VertesiaClient } from '@vertesia/client';
import type { Command } from 'commander';
import { createProfileAuthProvider, ensureProfileAccessToken } from './profiles/auth.js';
import { config, type Profile } from './profiles/index.js';
import { isKeyringAvailable } from './profiles/keyring.js';

let _client: VertesiaClient | undefined;

/**
 * Get the Vertesia client instance.
 * Supports initialization from:
 * 1. VERTESIA_TOKEN env var (contains embedded endpoint URLs)
 * 2. Profile configuration
 * 3. Individual env vars (VERTESIA_APIKEY, VERTESIA_SERVER_URL, etc.)
 * 4. Legacy env vars (COMPOSABLE_PROMPTS_* - deprecated)
 */
export async function getClient(_program?: Command): Promise<VertesiaClient> {
    if (!_client) {
        _client = await createClient(config.current);
    }
    return _client;
}

async function createClient(profile: Profile | undefined): Promise<VertesiaClient> {
    const token = process.env.VERTESIA_TOKEN;
    const preferProfileEndpoints = Boolean(profile && config.explicitProfile);

    // Endpoint env vars are useful for localhost development, but an explicit
    // --profile must not be silently redirected by inherited local env vars.
    const env = {
        apikey: process.env.VERTESIA_APIKEY || process.env.COMPOSABLE_PROMPTS_APIKEY,
        serverUrl: preferProfileEndpoints
            ? profile?.studio_server_url
            : process.env.VERTESIA_SERVER_URL || process.env.COMPOSABLE_PROMPTS_SERVER_URL,
        storeUrl: preferProfileEndpoints
            ? profile?.zeno_server_url
            : process.env.VERTESIA_STORE_URL || process.env.ZENO_SERVER_URL,
        sessionTags: profile?.session_tags ? profile.session_tags.split(/\s*,\s*/) : 'cli',
    };

    if (!env.serverUrl && profile?.studio_server_url) {
        env.serverUrl = profile.studio_server_url;
    }
    if (!env.storeUrl && profile?.zeno_server_url) {
        env.storeUrl = profile.zeno_server_url;
    }

    // VERTESIA_TOKEN contains endpoint URLs, but explicit endpoint env vars
    // should win so the same token can be used against a local server.
    if (token) {
        const endpoints =
            env.serverUrl && env.storeUrl
                ? {
                      studio: env.serverUrl,
                      store: env.storeUrl,
                      token: process.env.VERTESIA_TOKEN_SERVER_URL,
                  }
                : undefined;
        return VertesiaClient.fromAuthToken(token, undefined, endpoints);
    }

    if (!env.apikey && profile) {
        const profileToken = await ensureProfileAccessToken(profile);
        if (!profileToken && !profile.apikey) {
            if (!isKeyringAvailable()) {
                throw new Error(
                    'No keyring-backed auth token is available for the selected profile on this system. Use VERTESIA_APIKEY or VERTESIA_TOKEN instead.',
                );
            }
            throw new Error(
                'No auth token is stored for the selected profile. Run `vertesia auth refresh` to authenticate again.',
            );
        }
        // A profile configured with a long-lived API key uses it directly.
        if (!profileToken && profile.apikey) {
            return new VertesiaClient({ ...env, apikey: profile.apikey });
        }
        // A profile access token is short-lived. Resolve it per request through the profile
        // refresh path instead of pinning the token captured here, so commands that run longer
        // than the token TTL (`agents stream`, workflow tails) keep working.
        return new VertesiaClient({ ...env, apikey: undefined }).withAuthCallback(createProfileAuthProvider(profile));
    }

    return new VertesiaClient(env);
}
