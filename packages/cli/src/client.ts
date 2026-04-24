import { VertesiaClient } from "@vertesia/client";
import { Command } from "commander";
import { config, Profile } from "./profiles/index.js";
import { ensureProfileAccessToken } from "./profiles/auth.js";
import { isKeyringAvailable } from "./profiles/keyring.js";


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

    // Explicit environment overrides should win over profile settings so the same
    // credential can be reused against a local deployment without changing profiles.
    const env = {
        apikey: process.env.VERTESIA_APIKEY
            || process.env.COMPOSABLE_PROMPTS_APIKEY,
        serverUrl: process.env.VERTESIA_SERVER_URL
            || process.env.COMPOSABLE_PROMPTS_SERVER_URL!,
        storeUrl: process.env.VERTESIA_STORE_URL
            || process.env.ZENO_SERVER_URL!,
        projectId: process.env.VERTESIA_PROJECT_ID
            || process.env.COMPOSABLE_PROMPTS_PROJECT_ID
            || profile?.project
            || undefined,
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
        const endpoints = env.serverUrl && env.storeUrl
            ? {
                studio: env.serverUrl,
                store: env.storeUrl,
                token: process.env.VERTESIA_TOKEN_SERVER_URL,
            }
            : undefined;
        return VertesiaClient.fromAuthToken(token, undefined, endpoints);
    }

    if (!env.apikey && profile) {
        env.apikey = await ensureProfileAccessToken(profile);
        if (!env.apikey && !profile.apikey) {
            if (!isKeyringAvailable()) {
                throw new Error('No keyring-backed auth token is available for the selected profile on this system. Use VERTESIA_APIKEY or VERTESIA_TOKEN instead.');
            }
            throw new Error('No auth token is stored for the selected profile. Run `vertesia auth refresh` to authenticate again.');
        }
    }

    return new VertesiaClient(env);
}
