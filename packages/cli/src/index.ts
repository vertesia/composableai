import { Command } from 'commander';
import { registerAppsCommand } from './apps/index.js';
import { registerAgentsCommand } from './agents/index.js';
import { listEnvironments } from './envs/index.js';
import { listInteractions } from './interactions/index.js';
import { registerObjectsCommand } from './objects/index.js';
import { getVersion, upgrade } from './package.js';
import { createProfile, deleteProfile, listProfiles, showActiveAuthToken, showProfile, tryRefreshToken, updateCurrentProfile, updateProfile, useProfile, type CreateProfileOptions } from './profiles/commands.js';
import { AVAILABLE_REGIONS, DEFAULT_REGION, getConfigFile } from './profiles/index.js';
import { listProjects } from './projects/index.js';
import runInteraction from './run/index.js';
import { runHistory } from './runs/index.js';
import { registerWorkflowsCommand } from './workflows/index.js';
//warnIfNotLatest();

const program = new Command();

program.version(getVersion());

program.command("upgrade")
    .description("Upgrade to the latest version of the CLI")
    .option("-y, --yes", "Skip the confirmation prompt")
    .action((options: Record<string, any> = {}) => upgrade(options.yes))

program.command("projects")
    .description("List the projects you have access to")
    .action(() => {
        listProjects(program);
    })

const authRoot = program.command("auth")
    .description("Manage authentication")

authRoot.command("token")
    .description("Show the auth token used by the current selected profile.")
    .action(() => showActiveAuthToken())

authRoot.command("refresh")
    .description("Refresh the auth token used by the current profile. An alias to 'vertesia profiles refresh'.")
    .action(() => updateCurrentProfile())

program.command("envs [envId]")
    .description("List the environments you have access to")
    .action((envId: string | undefined, options: Record<string, any>) => {
        listEnvironments(program, envId, options);
    })
program.command("interactions [interaction]")
    .description("List the interactions available in the current project")
    .action((interactionId: string | undefined, options: Record<string, any>) => {
        listInteractions(program, interactionId, options);
    })
program.command("run <interaction>")
    .description("Run an interaction by full name. The full name is composed by an optional namespace, a required endpoint name and an optional tag or version. Examples: name, namespace:name, namespace:name@version")
    .option('-i, --input [file]', 'The input data if any. If no file path is specified it will read from stdin')
    .option('-o, --output [file]', 'The output file if any. If not specified it will print to stdout')
    .option('-d, --data [json]', 'Inline data as a JSON string. If specified takes precedence over --input')
    .option('-T, --tags [tags]', 'A comma separated list of tags to add to the execution run')
    .option('-t, --temperature [temperature]', 'The temperature to use')
    .option('--max-tokens [max-tokens]', 'The maximum number of tokens to generate')
    .option('--top-p [top-p]', 'The top P value to use')
    .option('--top-k [top-k]', 'The top K value to use')
    .option('--presence-penalty [presence-penalty]', 'The presence penalty value to use')
    .option('--frequency-penalty [frequency-penalty]', 'The frequency penalty value to use')
    .option('--stop-sequence [stop-sequence]', 'A comma separated list of sequences to stop the generation')
    .option('--config-mode [config-mode]', 'The configuration mode to use.Possible values are: "run_and_interaction_config", "run_config_only", "interaction_config_only". Optional. If not specified, "run_and_interaction_config" is used.')
    .option('-m, --model [model]', 'The model to use. Optional.')
    .option('-e, --env [environmentId]', 'The environment Id to use. Optional.')
    .option('-S, --no-stream', 'When used, the output will be printed only when the execution is complete')
    .option('-c, --count [count]', 'The number of times to run the interaction', '1')
    .option('-v, --verbose', 'Only used in no streaming mode. Instead of printing a progress it will print details about each executed run.')
    .option('--jsonl', 'Write output in jsonl. The default is to write the json. Ignored when only one run is executed')
    .option('--data-only', 'Write down only the data returned by the LLM and not the entire execution run. This mode is forced when streaming', false)
    .option('-r, --run-data [level]', 'Override the level of storage for the run data. Possible values are: "standard", "restricted", or "debug". Optional. If not specified, it uses the level defined in Studio.')
    .option('--by-id', 'When used, the interaction is selected by ID instead of by name')
    .action((interaction: string, options: Record<string, any>) => runInteraction(program, interaction, options));
program.command("runs [interactionId]")
    .description('Search the run history for specific execution runs')
    .option('-t, --tags [tags]', 'A comma separated list of tags to filter the run history')
    .option('--status [status]', 'A status to filter on')
    .option('-e, --env [environmentId]', 'Filter by environment')
    .option('-m, --model [model]', 'Filter by model')
    .option('-q, --query [query]', 'A lucene query')
    .option('-l, --limit [limit]', 'The maximum number of runs to return in a page', "100")
    .option('-P, --page [page]', 'The page number to return (starting from 0)', "0")
    .option('-f, --format [format]', 'The output format: json, jsonl or csv.', 'json')
    .option("-o, --output [file]", "The output file if any. If not specified it will print to stdout")
    .option("--before [date]", "Filter runs before the given date. The date must be in ISO format")
    .option("--after [date]", "Filter runs after the given date. The date must be in ISO format")
    .action((interactionId: string | undefined, options: Record<string, any>) => {
        runHistory(program, interactionId, options);
    });

registerAppsCommand(program);
registerAgentsCommand(program);

const profilesRoot = program.command("profiles")
    .description("Manage configuration profiles")
    .action(() => {
        listProfiles();
    });

profilesRoot.command('show [name]')
    .description("Show the configured profiles or the profile with the given name")
    .action((name?: string) => {
        showProfile(name);
    });
profilesRoot.command('use [name]')
    .description("Switch to another configuration profile")
    .action((name) => {
        useProfile(name);
    });
profilesRoot.command('add [name]')
    .alias('create')
    .option("-t, --target <env>", "The target environment for the profile. Possible values are: local, dev-main, dev-preview, preview, prod or a custom URL.")
    .option("-r, --region <region>", `Deployment region: ${AVAILABLE_REGIONS.join(', ')}. Defaults to ${DEFAULT_REGION}. Only applies to preview and prod targets.`)
    .option("-k, --apikey <key>", "The API key or auth token to use for the profile")
    .option("-p, --project <project>", "The project ID to use for the profile")
    .option("-a, --account <account>", "The account ID to use for the profile")
    .description("Create a new configuration profile")
    .action(async (name: string | undefined, options: CreateProfileOptions) => {
        await createProfile(name, options);
    });
profilesRoot.command('edit [name]')
    .alias('update')
    .description("Edit an existing configuration profile")
    .action((name: string | undefined) => {
        updateProfile(name);
    });
profilesRoot.command('refresh')
    .description("Refresh token for the current configuration profile")
    .action(() => {
        updateCurrentProfile();
    });
profilesRoot.command('delete <name>')
    .description("delete an existing configuration profile")
    .action((name) => {
        deleteProfile(name);
    });
profilesRoot.command('file')
    .description("print the configuration file path")
    .action(() => {
        console.log(getConfigFile('profiles.json'));
    });

registerObjectsCommand(program);
registerWorkflowsCommand(program);

program.parseAsync(process.argv).catch(err => {
    console.error(err);
    process.exit(1);
});

process.on("unhandledRejection", (err: any) => {
    if (err.status === 401) { // token expired?
        console.error("ERROR", err);
        tryRefreshToken();
    }
})
