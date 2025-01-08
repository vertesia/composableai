import { Command } from "commander";
import { build } from "./build.js";
import { connectToProject } from "./connect.js";
import { deploy } from "./deploy.js";
import { getGooglePrincipal, getGoogleToken } from "./registry.js";

export function registerAgentCommand(program: Command) {
    const agent = program.command("agent");

    agent.command("connect [pkgDir]")
        .description("Connect a node package to a Vertesia project. If no packageDir is specified the current dir will be used.")
        .action(async (pkgDir: string) => {
            if (pkgDir) {
                process.chdir(pkgDir);
            }
            await connectToProject(program);
        });

    agent.command("deploy [pkgDir]")
        .description("Deploy a custom workflow worker. The user will be asked for a target image version.")
        .option("-p, --profile [profile]", "The profile name to use. If not specified the one from the package.json will be used.")
        .option("--version [version]", "Deploy the given version of the local docker image. Do not build another image.")
        .option("--latest", "Use the latest version of the local docker image. A shortcut to '--version latest'. If neither --latest nor --version is specified then a new image will be built.")
        .action(async (pkgDir: string, options: Record<string, any> = {}) => {
            if (pkgDir) {
                process.chdir(pkgDir);
            }
            await deploy(program, options);
        });

    agent.command("build [pkgDir]")
        .description("Build a local docker image.")
        .option("-v, --version [version]", "The version to use for the image. By default 'latest' is used.")
        .action(async (pkgDir: string, options: Record<string, any> = {}) => {
            if (pkgDir) {
                process.chdir(pkgDir);
            }
            await build(options);
        });

    agent.command("gtoken")
        .description("Get a google cloud token for the current vertesia project.")
        .option("-p, --profile", "The profile name to use. If specified it will be used instead of the current profile.")
        .action(async (options: Record<string, any> = {}) => {
            await getGoogleToken(program, options.profile);
        });

    agent.command("gprincipal")
        .description("Get the google cloud principal for the current project.")
        .option("-p, --profile", "The profile name to use. If specified it will be used instead of the current profile.")
        .action(async (options: Record<string, any> = {}) => {
            await getGooglePrincipal(program, options.profile);
        });

}