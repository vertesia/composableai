import { Command } from "commander";
import { getClient } from "../client.js";
import { ExecutionEnvironment } from "@vertesia/common";
import colors from "ansi-colors";


export function listEnvirnments(program: Command, envId: string | undefined, options: Record<string, any>) {
    if (envId) {
        getClient(program).environments.retrieve(envId).then((env) => {
            printEnv(env, options);
        });
    } else {
        getClient(program).environments.list().then((environments) => {
            environments.map(env => {
                console.log(env.name + ` [${env.id}]`);
            })
        })
    }
}


function printEnv(env: ExecutionEnvironment, _options: Record<string, any>) {
    console.log(colors.bold(env.name) + " [" + env.id + "]")
    console.log(colors.bold("Provider:"), env.provider);
    console.log(colors.bold("Description:"), env.description || 'n/a');
    console.log(colors.bold("Default Model:"), env.default_model);
    console.log(colors.bold("Enabled Models:"), env.enabled_models && env.enabled_models.length > 0 ? env.enabled_models.map(model => model.name).join(", ") : "n/a");
}
