import ansiColors from "ansi-colors";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getClient } from "../client.js";
import { config } from "../profiles/index.js";
import { WorkerProject } from "./project.js";

const LOCAL_DOCKER_CONFIG_DIR = ".docker";

export function generateDockerConfig() {
    return JSON.stringify({
        credHelpers: {
            "us-central1-docker.pkg.dev": "vertesia",
        },
    }, undefined, 2);
}

async function getGoogleToken(pkgDir?: string) {
    const project = new WorkerProject(pkgDir);
    const pkg = project.packageJson;
    if (!pkg.vertesia.profile) {
        throw new Error("Profile entry not found in package.json");
    }
    config.use(pkg.vertesia.profile);
    const client = await getClient();
    const result = await client.account.getGoogleToken();
    return result.token;
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
    const configDir = join(process.cwd(), LOCAL_DOCKER_CONFIG_DIR);
    const baseArgs: string[] = [];
    if (existsSync(configDir)) {
        baseArgs.push("--config", configDir);
    }
    return runDocker(baseArgs.concat(args));
}

export function runDocker(args: string[]) {
    const verbose = process.argv.includes("--verbose");
    if (verbose) {
        console.log(`Running: ${ansiColors.magenta(`docker ${args.join(" ")}`)}`);
    }
    const result = spawnSync("docker", args, {
        stdio: "inherit",
        env: {
            ...process.env,
            DOCKER_BUILDKIT: "1",
        },
    });
    if (result.error) {
        console.error(`Failed to execute command "docker ${args.join(" ")}":`, result.error);
        process.exit(2);
    }
    if (result.status !== 0) {
        console.error(`Command "docker ${args.join(" ")}" failed with exit code ${result.status}`);
        process.exit(result.status ?? 1);
    }
    return result;
}

export function runDockerWithOutput(args: string[]) {
    const verbose = process.argv.includes("--verbose");
    if (verbose) {
        console.log(`Running: ${ansiColors.magenta(`docker ${args.join(" ")}`)}`);
    }
    const result = spawnSync("docker", args, {
        encoding: "utf-8",
        env: {
            ...process.env,
            DOCKER_BUILDKIT: "1",
        },
    });
    if (result.error) {
        console.error(`Failed to execute command "docker ${args.join(" ")}":`, result.error);
        process.exit(2);
    }
    if (result.status !== 0) {
        console.error(`Command "docker ${args.join(" ")}" failed with exit code ${result.status}\n${result.stderr}`);
        process.exit(result.status ?? 1);
    }
    return result.stdout.trim();
}
