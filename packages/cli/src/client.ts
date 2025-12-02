import { VertesiaClient } from "@vertesia/client";
import { Command } from "commander";
import { config, Profile } from "./profiles/index.js";


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
    // Priority 1: VERTESIA_TOKEN (contains embedded endpoint URLs, used by agent sandboxes)
    const token = process.env.VERTESIA_TOKEN;
    if (token) {
        return VertesiaClient.fromAuthToken(token);
    }

    // Priority 2: Profile config or individual env vars
    // Support both new VERTESIA_* and legacy COMPOSABLE_PROMPTS_* env vars
    const env = {
        apikey: profile?.apikey
            || process.env.VERTESIA_APIKEY
            || process.env.COMPOSABLE_PROMPTS_APIKEY,
        serverUrl: profile?.studio_server_url
            || process.env.VERTESIA_SERVER_URL
            || process.env.COMPOSABLE_PROMPTS_SERVER_URL!,
        storeUrl: profile?.zeno_server_url
            || process.env.VERTESIA_STORE_URL
            || process.env.ZENO_SERVER_URL!,
        projectId: profile?.project
            || process.env.VERTESIA_PROJECT_ID
            || process.env.COMPOSABLE_PROMPTS_PROJECT_ID
            || undefined,
        sessionTags: profile?.session_tags ? profile.session_tags.split(/\s*,\s*/) : 'cli',
    };

    return new VertesiaClient(env);
}
