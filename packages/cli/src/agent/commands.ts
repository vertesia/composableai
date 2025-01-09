import { Command } from "commander";
import { getClient } from "../client.js";
import { runDocker, runDockerWithAgentConfig, runDockerWithOutput } from "./docker.js";
import { AgentProject } from './project.js';
import { tryRrefreshProjectToken } from './refresh.js';
import { validateVersion } from './version.js';

const LATEST_VERSION = "latest";

export async function publish(program: Command, version: string) {
    if (!validateVersion(version)) {
        console.log("Invalid version format: " + version + ". Use major.minor.patch format.");
        process.exit(1);
    }

    const project = new AgentProject();

    // we need to frefresh the profile token if needed since
    // the docker credentials helper are connecting to studio.
    // this will refresh the profile token if needed by asking the user to reconnect
    await tryRrefreshProjectToken(project);

    const localTag = project.getLocalDockerTag(version);
    const remoteTag = project.getVertesiaDockerTag(version);

    // push the image to the registry
    console.log(`Pushing docker image ${remoteTag}`);
    runDocker(['tag', localTag, remoteTag]);
    runDockerWithAgentConfig(['push', remoteTag]);

    console.log("TODO publish to studio")
    const client = getClient(program);
    client; //TODO
    //TODO
    //client.store.agents.deploy();
}

export async function build() {
    const project = new AgentProject();
    const tag = project.getLocalDockerTag(LATEST_VERSION);
    console.log(`Building docker image: ${tag}`);
    runDocker(['buildx', 'build', '-t', tag, '.']);
}

export async function release(version: string) {
    if (!validateVersion(version)) {
        console.log("Invalid version format: " + version + ". Use major.minor.patch format.");
        process.exit(1);
    }
    const project = new AgentProject();
    const latestTag = project.getLocalDockerTag(LATEST_VERSION);
    const versionTag = project.getLocalDockerTag(version);

    runDocker(['tag', latestTag, versionTag]);
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
            } // else igonre
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
    console.log(`${version} - ${local?.name || 'N/A'} => ${remote?.name || 'N/A'}`);
}

interface TagInfo {
    version: string;
    name: string;
}
