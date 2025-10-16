import { VertesiaClient } from "@vertesia/client";
import { Command } from "commander";
import { config, Profile } from "./profiles/index.js";


let _client: VertesiaClient | undefined;

export function getClient(program?: Command) {
    if (!_client) {
        _client = createClient(config.current, program);
    }
    return _client;
}

function createClient(profile: Profile | undefined, program?: Command) {
    // Get options from CLI flags (highest priority), then profile, then environment variables
    const opts = program?.opts() || {};

    const apikey = opts.apikey || profile?.apikey || process.env.COMPOSABLE_PROMPTS_APIKEY;
    const studioUrl = opts.studioUrl || profile?.studio_server_url || process.env.COMPOSABLE_PROMPTS_SERVER_URL;
    const storeUrl = opts.storeUrl || profile?.zeno_server_url || process.env.ZENO_SERVER_URL;
    const stsUrl = opts.stsUrl || profile?.sts_server_url || process.env.STS_SERVER_URL;
    const site = opts.site || process.env.VERTESIA_SITE;
    const sessionTags = profile?.session_tags ? profile.session_tags.split(/\s*,\s*/) : 'cli';

    // Ensure we have either site or studioUrl to avoid client initialization error
    if (!studioUrl && !site) {
        throw new Error(
            "No server configuration found. Please set up a profile with 'vertesia profiles add', " +
            "use --site or --studio-url options, or set COMPOSABLE_PROMPTS_SERVER_URL environment variable."
        );
    }

    const env: any = {
        apikey,
        sessionTags,
    };

    if (studioUrl) {
        env.serverUrl = studioUrl;
        if (storeUrl) {
            env.storeUrl = storeUrl;
        }
        if (stsUrl) {
            env.stsUrl = stsUrl;
        }
    } else if (site) {
        env.site = site;
    }

    return new VertesiaClient(env);
}
