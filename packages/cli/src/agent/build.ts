import { AgentProject } from './project.js';

export interface BuildOptions {
    /**
     * The version to use for the locla image. By default 'latest' is used.
     */
    version?: string;
}

export async function build(options: BuildOptions) {
    const project = new AgentProject();
    console.log("Building project sources");
    project.buildSources();
    console.log("Building docker image version " + options.version);
    const tag = project.buildDockerImage(options.version);
    console.log("Docker image is:", tag);
}
