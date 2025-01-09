import { Command } from "commander";
import enquirer from "enquirer";
import { getClient } from "../client.js";
import { Version } from "./Version.js";
import { runDocker, runDockerWithAgentConfig } from "./docker.js";
import { AgentProject } from "./project.js";

const { prompt } = enquirer;

export interface DeployOptions {
    version?: string;
    latest?: boolean;
    profile?: string;
}

export async function deploy(program: Command, options: DeployOptions) {
    const project = new AgentProject();
    const pkg = project.packageJson;
    const version = options.version ? options.version : options.latest ? 'latest' : undefined;
    let localTag: string;
    if (!version) { // build a new image
        localTag = project.buildDockerImage(); // use latest version
    } else {
        //TDOO check if image exists locally?
        //Ex: docker images --filter "reference=vertesia/test:latest" --format "{{.Repository}}:{{.Tag}}"
        localTag = pkg.getLocalDockerTag(version);
    }

    // ask user for the target image version
    let message = "Target image version";
    let latestVersion: string | undefined = pkg.latestPublishedVersion;
    let initialVersion: string;
    if (latestVersion) {
        initialVersion = Version.parse(latestVersion).nextMinor().toString();
        message + " (latest published was " + latestVersion + ")";
    } else {
        initialVersion = pkg.version;
    }

    const answers: any = prompt({
        type: 'input',
        name: 'version',
        message,
        initial: initialVersion
    })

    if (!answers.version) {
        console.log("No version specified. Aborting.");
        process.exit(1);
    }

    // push the image to the registry
    const remoteTag = pkg.getVertesiaDockerTag(answers.version);
    console.log(`Tagging ${remoteTag}`);
    runDocker(['tag', localTag, remoteTag]);
    console.log(`Pushing ${remoteTag}`);
    runDockerWithAgentConfig(['push', remoteTag]);

    const client = getClient(program);
    client; //TODO
    //TODO
    //client.store.agents.deploy();
}