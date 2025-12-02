import colors from "ansi-colors";
import fs from "fs";
import os from "os";
import { join } from "path";
import { getClient } from "../client.js";
import { config, getCloudTypeFromConfigUrl, Profile } from "../profiles/index.js";
import { runDocker, runDockerWithAgentConfig, runDockerWithOutput } from "./docker.js";
import { AgentProject } from './project.js';
import { tryRefreshProjectToken } from './refresh.js';
import { updateNpmrc } from "./registry.js";
import { validateVersion } from './version.js';

export enum PublishMode {
    Push = 1,
    Deploy = 2,
    PushAndDeploy = 3
}

function shouldDeploy(mode: PublishMode) {
    return mode & PublishMode.Deploy;
}

function shouldPush(mode: PublishMode) {
    return mode & PublishMode.Push;
}

// we need to build for the linux/amd64 platform (this is the platform used in Vertesia k8s)
const TARGET_PLATFORM = "linux/amd64";
const LATEST_VERSION = "latest";

async function pushImage(project: AgentProject, version: string) {

    // we need to refresh the profile token if needed since
    // the docker credentials helper are connecting to studio.
    // this will refresh the profile token if needed by asking the user to reconnect
    await tryRefreshProjectToken(project);

    const localTag = project.getLocalDockerTag(version);
    const remoteTag = project.getVertesiaDockerTag(version);

    // push the image to the registry
    console.log(`Pushing docker image ${remoteTag}`);
    runDocker(['tag', localTag, remoteTag]);
    runDockerWithAgentConfig(['push', remoteTag]);
}

async function triggerDeploy(profile: Profile, project: AgentProject, version: string) {
    const environment = getCloudTypeFromConfigUrl(profile.config_url);
    const client = await getClient();
    const agentId = project.getAgentId();
    console.log(`Deploy agent ${agentId}:${version} to ${environment}`);
    await client.store.agents.deploy({
        environment,
        agentId: project.getAgentId(),
        version,
    });
}

export async function publish(version: string, mode: PublishMode) {
    if (!validateVersion(version)) {
        console.log("Invalid version format: " + version + ". Use major.minor.patch[-modifier] format.");
        process.exit(1);
    }
    if (!config.current) {
        console.log("No active profile is defined.");
        process.exit(1);
    }
    const profile = config.current;
    const project = new AgentProject();
    if (shouldPush(mode)) {
        await pushImage(project, version);
    }
    if (shouldDeploy(mode)) {
        await triggerDeploy(profile, project, version);
    }
}

export async function build(contextDir = '.') {
    const project = new AgentProject();

    const refreshResult = await tryRefreshProjectToken(project);
    if (refreshResult) {
        await updateNpmrc(project, refreshResult.profile);
    }

    const tag = project.getLocalDockerTag(LATEST_VERSION);
    const args = ['buildx', 'build', '--platform', TARGET_PLATFORM, '-t', tag];
    if (contextDir !== '.') { // not the working directory
        // use the dockerfile in the current working directory
        args.push('-f', 'Dockerfile')
    }
    console.log(`Building docker image: ${tag}`);
    runDocker([...args, contextDir]);
}

export async function release(version: string) {
    if (!validateVersion(version)) {
        console.log("Invalid version format: " + version + ". Use major.minor.patch[-modifier] format.");
        process.exit(1);
    }
    const project = new AgentProject();
    const latestTag = project.getLocalDockerTag(LATEST_VERSION);
    const versionTag = project.getLocalDockerTag(version);

    runDocker(['tag', latestTag, versionTag]);
}

export function run(version: string = LATEST_VERSION) {
    if (version !== LATEST_VERSION && !validateVersion(version)) {
        console.log("Invalid version format: " + version + ". Use major.minor.patch[-modifier] format.");
        process.exit(1);
    }
    const project = new AgentProject();
    const tag = project.getLocalDockerTag(version);
    // we need to inject the .env file into the container
    // and to get the google credentials needed by the worker
    // TODO: the google credentials will only work with vertesia users ...
    // we need to specify the target platform to force qemu emulation for user on other platforms
    const args = ['run', '--platform', TARGET_PLATFORM, '--env-file', '.env'];
    const googleCredsFile = getGoogleCredentialsFile();
    if (googleCredsFile) {
        args.push('-v', `${googleCredsFile}:/tmp/google-credentials.json`);
        args.push('-e', 'GOOGLE_APPLICATION_CREDENTIALS=/tmp/google-credentials.json');
    }
    args.push(tag)
    runDocker(args);
}

export async function listVersions() {
    const project = new AgentProject();
    if (!project.packageJson.vertesia?.image) {
        console.error("Invalid package.json. Missing vertesia.image configuration.");
        process.exit(1);
    }
    const out = runDockerWithOutput(["images", "--format", "{{.Repository}}:{{.Tag}}"]);
    const lines = out.trim().split('\n');
    const localTagPrefix = project.getLocalDockerTag("");
    const remoteTagPrefix = project.getVertesiaDockerTag("");
    const localTags: Record<string, TagInfo> = {};
    const remoteTags: Record<string, TagInfo> = {};
    const versions = new Set<string>();
    for (const line of lines) {
        const i = line.indexOf(':');
        if (i > 0) {
            const name = line.substring(0, i);
            const version = line.substring(i + 1);
            if (line.startsWith(localTagPrefix)) {
                localTags[version] = { version, name };
                versions.add(version);
            } else if (line.startsWith(remoteTagPrefix)) {
                remoteTags[version] = { version, name };
                versions.add(version);
            } // else ignore
        }
    }

    versions.delete(LATEST_VERSION);
    printVersion(LATEST_VERSION, localTags[LATEST_VERSION], remoteTags[LATEST_VERSION]);
    // sort desc
    Array.from(versions).sort((a, b) => b.localeCompare(a)).forEach(v => {
        printVersion(v, localTags[v], remoteTags[v]);
    });

}

function printVersion(version: string, local: TagInfo | undefined, remote: TagInfo | undefined) {
    if (!local && !remote) return;
    const isLatest = version === LATEST_VERSION;
    console.log(colors.bold(isLatest ? version : `v${version}`));
    console.log(`\t${colors.green("Local tag:")} ${local ? local.name + ':' + version : 'N/A'}`);
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
    const file = join(os.homedir(), '.config/gcloud/application_default_credentials.json');
    if (fs.existsSync(file)) {
        return file;
    } else {
        return null;
    }
}