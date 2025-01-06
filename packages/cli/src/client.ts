import { ComposableClient } from "@vertesia/client";
import { Command } from "commander";
import { config } from "./profiles/index.js";


let _client: ComposableClient | undefined;
export function getClient(program: Command) {
    if (!_client) {
        _client = createClient(program);
    }
    return _client;
}

function createClient(_program: Command) {
    const profile = config.current;

    const env = {
        apikey: profile?.apikey || process.env.COMPOSABLE_PROMPTS_APIKEY,
        serverUrl: profile?.studio_server_url || process.env.COMPOSABLE_PROMPTS_SERVER_URL!,
        storeUrl: profile?.zeno_server_url || process.env.ZENO_SERVER_URL!,
        projectId: profile?.project || process.env.COMPOSABLE_PROMPTS_PROJECT_ID || undefined,
        sessionTags: profile?.session_tags ? profile.session_tags.split(/\s*,\s*/) : 'cli',
    }

    return new ComposableClient(env)

}
