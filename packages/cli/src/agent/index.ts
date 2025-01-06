import { Command } from "commander";
import { connectToProject } from "./connect.js";
import { getGooglePrincipal, getGoogleToken } from "./registry.js";

export function registerAgentCommand(program: Command) {
    const agent = program.command("agent");

    agent.command("connect [packageDir]")
        .description("Connect a node package to a Vertesia project. If no packageDir is specified the current dir will be used.")
        .action(async (pkgDir: string) => {
            await connectToProject(program, pkgDir);
        });

    agent.command("deploy <file>")
        .description("Deploy a custom workflow worker.")
        .action(async (_options: Record<string, any> = {}) => {
            console.log("TODO: NOT IPLEMENTED");
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