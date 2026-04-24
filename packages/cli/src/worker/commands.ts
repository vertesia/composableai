import colors from "ansi-colors";
import fs from "fs";
import os from "os";
import { join } from "path";
import { getClient } from "../client.js";
import { config, getCloudTypeFromConfigUrl, Profile } from "../profiles/index.js";
import { runDocker, runDockerWithOutput, runDockerWithWorkerConfig } from "./docker.js";
import { WorkerProject } from "./project.js";
import { tryRefreshProjectToken } from "./refresh.js";
import { updateNpmrc } from "./registry.js";
import { validateVersion } from "./version.js";

export enum PublishMode {
    Push = 1,
    Deploy = 2,
    PushAndDeploy = 3,
}

function shouldDeploy(mode: PublishMode) {
    return mode & PublishMode.Deploy;
}

function shouldPush(mode: PublishMode) {
    return mode & PublishMode.Push;
}

const TARGET_PLATFORM = "linux/amd64";
const LATEST_VERSION = "latest";

async function pushImage(project: WorkerProject, version: string) {
    await tryRefreshProjectToken(project);

    const localTag = project.getLocalDockerTag(version);
    const remoteTag = project.getVertesiaDockerTag(version);

    console.log(`Pushing docker image ${remoteTag}`);
    runDocker(["tag", localTag, remoteTag]);
    runDockerWithWorkerConfig(["push", remoteTag]);
}

async function triggerDeploy(profile: Profile, project: WorkerProject, version: string) {
    const environment = getCloudTypeFromConfigUrl(profile.config_url);
    const client = await getClient();
    console.log(`Deploy worker ${project.getWorkerId()}:${version} to ${environment}`);
    await client.store.workers.deploy({
        environment,
        workerId: project.getWorkerId(),
        version,
    });
}

export async function publish(version: string, mode: PublishMode) {
    if (!validateVersion(version)) {
        console.log(`Invalid version format: ${version}. Use major.minor.patch[-modifier] format.`);
        process.exit(1);
    }
    if (!config.current) {
        console.log("No active profile is defined.");
        process.exit(1);
    }
    const profile = config.current;
    const project = new WorkerProject();
    if (shouldPush(mode)) {
        await pushImage(project, version);
    }
    if (shouldDeploy(mode)) {
        await triggerDeploy(profile, project, version);
    }
}

export async function build(contextDir = ".") {
    const project = new WorkerProject();

    const refreshResult = await tryRefreshProjectToken(project);
    if (refreshResult) {
        await updateNpmrc(project, refreshResult.profile);
    }

    const tag = project.getLocalDockerTag(LATEST_VERSION);
    const args = ["buildx", "build", "--platform", TARGET_PLATFORM, "-t", tag];
    if (contextDir !== ".") {
        args.push("-f", "Dockerfile");
    }
    console.log(`Building docker image: ${tag}`);
    runDocker([...args, contextDir]);
}

export async function release(version: string) {
    if (!validateVersion(version)) {
        console.log(`Invalid version format: ${version}. Use major.minor.patch[-modifier] format.`);
        process.exit(1);
    }
    const project = new WorkerProject();
    const latestTag = project.getLocalDockerTag(LATEST_VERSION);
    const versionTag = project.getLocalDockerTag(version);

    runDocker(["tag", latestTag, versionTag]);
}

export function run(version: string = LATEST_VERSION) {
    if (version !== LATEST_VERSION && !validateVersion(version)) {
        console.log(`Invalid version format: ${version}. Use major.minor.patch[-modifier] format.`);
        process.exit(1);
    }
    const project = new WorkerProject();
    const tag = project.getLocalDockerTag(version);
    const args = ["run", "--platform", TARGET_PLATFORM, "--env-file", ".env"];
    const googleCredsFile = getGoogleCredentialsFile();
    if (googleCredsFile) {
        args.push("-v", `${googleCredsFile}:/tmp/google-credentials.json`);
        args.push("-e", "GOOGLE_APPLICATION_CREDENTIALS=/tmp/google-credentials.json");
    }
    args.push(tag);
    runDocker(args);
}

export async function listVersions() {
    const project = new WorkerProject();
    if (!project.packageJson.vertesia?.image) {
        console.error("Invalid package.json. Missing vertesia.image configuration.");
        process.exit(1);
    }
    const out = runDockerWithOutput(["images", "--format", "{{.Repository}}:{{.Tag}}"]);
    const lines = out.trim().split("\n");
    const localTagPrefix = project.getLocalDockerTag("");
    const remoteTagPrefix = project.getVertesiaDockerTag("");
    const localTags: Record<string, TagInfo> = {};
    const remoteTags: Record<string, TagInfo> = {};
    const versions = new Set<string>();
    for (const line of lines) {
        const index = line.indexOf(":");
        if (index > 0) {
            const name = line.substring(0, index);
            const version = line.substring(index + 1);
            if (line.startsWith(localTagPrefix)) {
                localTags[version] = { version, name };
                versions.add(version);
            } else if (line.startsWith(remoteTagPrefix)) {
                remoteTags[version] = { version, name };
                versions.add(version);
            }
        }
    }

    versions.delete(LATEST_VERSION);
    printVersion(LATEST_VERSION, localTags[LATEST_VERSION], remoteTags[LATEST_VERSION]);
    Array.from(versions).sort((left, right) => right.localeCompare(left)).forEach((version) => {
        printVersion(version, localTags[version], remoteTags[version]);
    });
}

function printVersion(version: string, local: TagInfo | undefined, remote: TagInfo | undefined) {
    if (!local && !remote) {
        return;
    }
    const isLatest = version === LATEST_VERSION;
    console.log(colors.bold(isLatest ? version : `v${version}`));
    console.log(`\t${colors.green("Local tag:")} ${local ? `${local.name}:${version}` : "N/A"}`);
    if (remote) {
        console.log(`\t${colors.green("published to:")} ${remote.name}:${version}`);
    } else if (isLatest) {
        console.log(colors.dim("\tcannot be published"));
    } else {
        console.log(colors.dim("\tnot published"));
    }
}

interface TagInfo {
    version: string;
    name: string;
}

function getGoogleCredentialsFile() {
    const file = join(os.homedir(), ".config/gcloud/application_default_credentials.json");
    if (fs.existsSync(file)) {
        return file;
    }
    return null;
}
