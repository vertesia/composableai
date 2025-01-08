import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getClient } from "../client.js";
import { config } from "../profiles/index.js";
import { AgentProject } from "./project.js";


const LOCAL_DOCKER_CONFIG = 'docker.json';

export function genrateDockerConfig() {
    return JSON.stringify({
        "credHelpers": {
            "us-central1-docker.pkg.dev": "vertesia"
        }
    }, undefined, 2);
}


async function getGoogleToken(pkgDir?: string) {
    const project = new AgentProject(pkgDir);
    const pkg = project.packageJson;
    if (!pkg.vertesia.profile) {
        console.log('Profile not found in package.json');
        process.exit(1);
    }
    config.use(pkg.vertesia.profile); // will exit if profile not found
    const client = getClient();
    const r = await client.account.getGoogleToken();
    return r.token;
}

export async function getDockerCredentials(serverUrl: string) {
    const token = await getGoogleToken();
    return {
        ServerURL: serverUrl,
        Username: "_json_key",
        Secret: token,
    };
}

export function runDocker(args: string[]) {
    const config = join(process.cwd(), LOCAL_DOCKER_CONFIG);
    const baseArgs: string[] = [];
    if (existsSync(config)) {
        baseArgs.push("--config", config);
    }
    return spawnSync('docker', baseArgs.concat(args), { stdio: 'inherit' });
}