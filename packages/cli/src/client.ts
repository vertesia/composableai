import { VertesiaClient } from "@vertesia/client";
import { Command } from "commander";
import { config, getServerUrls, Profile } from "./profiles/index.js";


let _client: VertesiaClient | undefined;

export function getClient(program?: Command) {
    if (!_client) {
        _client = createClient(config.current, program);
    }
    return _client;
}

function createClient(profile: Profile | undefined, program?: Command) {
    // Get global options from commander if available
    const opts = program?.opts() || {};

    // Resolve site environment to server URLs if provided
    let siteUrls: { studio_server_url: string; zeno_server_url: string } | undefined;
    if (opts.site) {
        siteUrls = getServerUrls(opts.site);
    }

    const env = {
        apikey: opts.apikey || profile?.apikey || process.env.COMPOSABLE_PROMPTS_APIKEY,
        serverUrl: opts.server || siteUrls?.studio_server_url || profile?.studio_server_url || process.env.COMPOSABLE_PROMPTS_SERVER_URL!,
        storeUrl: opts.store || siteUrls?.zeno_server_url || profile?.zeno_server_url || process.env.ZENO_SERVER_URL!,
        projectId: opts.project || profile?.project || process.env.COMPOSABLE_PROMPTS_PROJECT_ID || undefined,
        sessionTags: profile?.session_tags ? profile.session_tags.split(/\s*,\s*/) : 'cli',
    }

    return new VertesiaClient(env)

}
