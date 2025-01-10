import { VertesiaClient } from "@vertesia/client";
import { Command } from "commander";
import { config, Profile } from "./profiles/index.js";


let _client: VertesiaClient | undefined;
//TODO remove program?
export function getClient(_program?: Command) {
    //TODO use program -p ioption to get the profile?
    if (!_client) {
        _client = createClient(config.current);
    }
    return _client;
}

function createClient(profile: Profile | undefined) {
    const env = {
        apikey: profile?.apikey || process.env.COMPOSABLE_PROMPTS_APIKEY,
        serverUrl: profile?.studio_server_url || process.env.COMPOSABLE_PROMPTS_SERVER_URL!,
        storeUrl: profile?.zeno_server_url || process.env.ZENO_SERVER_URL!,
        projectId: profile?.project || process.env.COMPOSABLE_PROMPTS_PROJECT_ID || undefined,
        sessionTags: profile?.session_tags ? profile.session_tags.split(/\s*,\s*/) : 'cli',
    }

    return new VertesiaClient(env)

}
