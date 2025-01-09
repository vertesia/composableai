import { Command } from "commander";
import { build, listVersions, publish, release, run } from "./commands.js";
import { connectToProject } from "./connect.js";
import { getGooglePrincipal, getGoogleToken } from "./registry.js";

export function registerAgentCommand(program: Command) {
    const agent = program.command("agent");

    agent.command("connect [pkgDir]")
        .description("Connect a node package to a Vertesia project. If no packageDir is specified the current dir will be used.")
        .action(async (pkgDir: string) => {
            if (pkgDir) {
                process.chdir(pkgDir);
            }
            await connectToProject();
        });

    agent.command("publish <version>")
        .description("Deploy a custom workflow worker. The user will be asked for a target image version.")
        .option("-d, --dir [project_dir]", "Use this as the current directory.")
        //.option("-p, --profile [profile]", "The profile name to use. If not specified the one from the package.json will be used.")
        .action(async (version: string, options: Record<string, any> = {}) => {
            if (options.dir) {
                process.chdir(options.dir);
            }
            await publish(program, version);
        });

    agent.command("build")
        .description("Build a local docker image using 'latest' as version.")
        .option("-d, --dir [project_dir]", "Use this as the current directory.")
        .action(async (options: Record<string, any>) => {
            if (options.dir) {
                process.chdir(options.dir);
            }
            await build();
        });

    agent.command("release [version]")
        .description("Promote the latest version to a named version (tag it).")
        .option("-d, --dir [project_dir]", "Use this as the current directory.")
        .action(async (version: string, options: Record<string, any>) => {
            if (options.dir) {
                process.chdir(options.dir);
            }
            await release(version);
        });

    agent.command("run [version]")
        .description("Run the docker image identified by the given version or the 'latest' version if no version is given.")
        .option("-d, --dir [project_dir]", "Use this as the current directory.")
        .action(async (version: string, options: Record<string, any>) => {
            if (options.dir) {
                process.chdir(options.dir);
            }
            await run(version);
        });

    agent.command("versions")
        .description("List existing versions.")
        .action(async (_options: Record<string, any>) => {
            await listVersions();
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