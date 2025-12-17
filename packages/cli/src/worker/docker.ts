import ansiColors from "ansi-colors";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getClient } from "../client.js";
import { config } from "../profiles/index.js";
import { WorkerProject } from "./project.js";


const LOCAL_DOCKER_CONFIG_DIR = '.docker';

export function generateDockerConfig() {
    return JSON.stringify({
        "credHelpers": {
            "us-central1-docker.pkg.dev": "vertesia"
        }
    }, undefined, 2);
}


async function getGoogleToken(pkgDir?: string) {
    const project = new WorkerProject(pkgDir);
    const pkg = project.packageJson;
    if (!pkg.vertesia.profile) {
        throw new Error("Profile entry not found in package.json");
    }
    config.use(pkg.vertesia.profile); // will exit if profile not found
    const client = await getClient();
    const r = await client.account.getGoogleToken();
    return r.token;
}

export async function getDockerCredentials(serverUrl: string) {
    const token = await getGoogleToken();
    return {
        ServerURL: serverUrl,
        Username: "oauth2accesstoken",
        Secret: token,
    };
}

export function runDockerWithWorkerConfig(args: string[]) {
    const config = join(process.cwd(), LOCAL_DOCKER_CONFIG_DIR);
    const baseArgs: string[] = [];
    if (existsSync(config)) {
        baseArgs.push("--config", config);
    }
    return runDocker(baseArgs.concat(args));
}

export function runDocker(args: string[]) {
    const verbose = process.argv.includes("--verbose");
    if (verbose) {
        const cmd = `docker ${args.join(' ')}`;
        console.log(`Running: ${ansiColors.magenta(cmd)}`);
    }
    const r = spawnSync('docker', args, {
        stdio: 'inherit',
        env: {
            ...process.env,
            DOCKER_BUILDKIT: "1"
        }
    });
    // check for errors
    if (r.error) {
        console.error(`Failed to execute command "docker ${args.join(' ')}":`, r.error);
        process.exit(2);
    }
    // Check for non-zero exit code
    if (r.status !== 0) {
        console.error(
            `Command "docker ${args.join(' ')}" failed with exit code ${r.status}`
        );
        process.exit(r.status ?? 1);
    }
    return r;
}

export function runDockerWithOutput(args: string[]) {
    const verbose = process.argv.includes("--verbose");
    if (verbose) {
        const cmd = `docker ${args.join(' ')}`;
        console.log(`Running: ${ansiColors.magenta(cmd)}`);
    }
    const r = spawnSync('docker', args, {
        encoding: 'utf-8',
        env: {
            ...process.env,
            DOCKER_BUILDKIT: "1"
        }
    });
    // check for errors
    if (r.error) {
        console.error(`Failed to execute command "docker ${args.join(' ')}":`, r.error);
        process.exit(2);
    }
    // Check for non-zero exit code
    if (r.status !== 0) {
        console.error(
            `Command "docker ${args.join(' ')}" failed with exit code ${r.status}\n${r.stderr}`
        );
        process.exit(r.status ?? 1);
    }
    return r.stdout.trim();
}
