import { Command } from "commander";
import { createOrUpdateNpmRegistry, getGooglePrincipal, getGoogleToken } from "./registry.js";

export function registerAgentCommand(program: Command) {
    const agent = program.command("agent");

    agent.command("deploy <file>")
        .description("Deploy a custom workflow worker.")
        .action(async (_options: Record<string, any> = {}) => {
            console.log("NOT IPLEMENTED");
        });

    agent.command("gtoken")
        .description("Get a google cloud token for the current vertesia project.")
        .action(async () => {
            await getGoogleToken(program);
        });
    agent.command("gprincipal")
        .description("Get the google cloud principal for the current project.")
        .action(async () => {
            await getGooglePrincipal(program);
        });

    agent.command("npm-registry")
        .description("Create or update the given npmrc file with Vertesia registry entry.")
        .option("-f <npmrc>", "The npmrc file to update. If not specified the generated npmrc content will be printed to stdout")
        .action(async (options: Record<string, any> = {}) => {
            createOrUpdateNpmRegistry(program, options.f);
        });

}