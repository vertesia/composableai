import type { AppManifestData } from '@vertesia/common';
import type { Command } from 'commander';
import {
    createApp,
    createDevelopmentTask,
    deleteAppInstallation,
    getApp,
    getAppInstallation,
    getDevelopmentTask,
    installApp,
    listApps,
    listDevelopmentTasks,
    listInstalledApps,
    scaffoldApp,
    scaffoldStatus,
    startDevelopmentTask,
    updateApp,
    updateAppInstallationSettings,
} from './commands.js';
import { registerAppCredentialsCommands } from './credentials.js';
import { registerAppVersionCommands } from './versions.js';

const exampleManifest: AppManifestData = {
    name: 'my-app',
    title: 'My App',
    description: 'A sample app',
    publisher: 'your-org',
    visibility: 'private',
    status: 'beta',
    ui: {
        src: '/plugins/my-app',
        isolation: 'shadow',
    },
    tool_collections: [
        {
            url: 'https://example.com/tools',
            type: 'vertesia_sdk',
        },
        {
            url: 'https://example.com/mcp-server',
            type: 'mcp',
            id: 'example_mcp_server',
            name: 'example-mcp-server',
            description: 'Example MCP server for testing',
            namespace: 'example',
            auth: 'oauth',
        },
    ],
    settings_schema: {
        type: 'object',
        properties: {
            apiKey: { type: 'string' },
        },
    },
};

export function registerAppsCommand(program: Command) {
    const apps = program.command('apps').description('Manage applications and app installations');

    const scaffolds = apps.command('scaffolds').description('Create source-backed App Builder applications');
    scaffolds
        .command('create <appName>')
        .description(
            'Create and scaffold a new app package, then follow the live stream and the initial version build until it completes or fails',
        )
        .option('--title <title>', 'App title')
        .option('--description <description>', 'App description')
        .option(
            '--modules <modules>',
            'Comma-separated modules to add: service (app-gateway runtime and routes), assistant (assistant chat UI), ' +
                'content-app (content types, interactions and a process under /content), examples (sample resources). ' +
                'service is always included; with no --modules the app has only service',
        )
        .option('--no-create-version', 'Do not build an initial immutable version')
        .option(
            '--no-follow',
            'Print workflow_id and run_id and return; check later with "apps scaffolds status <workflowId> <runId>"',
        )
        .action(async (appName: string, options) => scaffoldApp(program, appName, options));
    scaffolds
        .command('status <workflowId> <runId>')
        .description(
            'Show a scaffold run and its initial version build (status, step, version_id, app_url) once it has started',
        )
        .action(async (workflowId: string, runId: string) => scaffoldStatus(program, workflowId, runId));

    const developmentTasks = apps
        .command('development-tasks')
        .description(
            'Manage App Builder development tasks. A task is an agent/<taskId> branch: create the branch first, ' +
                'then start the App Builder on it',
        );
    developmentTasks
        .command('create <appId> <taskId>')
        .description('Create an agent/* task branch from an existing ref (step 1 of a new task)')
        .requiredOption('--source-ref <ref>', 'Source branch, tag, or commit')
        .action(async (appId: string, taskId: string, options) =>
            createDevelopmentTask(program, appId, taskId, options),
        );
    developmentTasks
        .command('start <appId> <taskId>')
        .description(
            'Start the App Builder on an existing agent/<taskId> branch and follow its live agent stream. ' +
                'The branch must exist: run "create" first, or pass --source-ref to create it in this call',
        )
        .requiredOption('--prompt <prompt>', 'Development request')
        .option(
            '-e, --env <environment>',
            'Execution environment id (see "envs"). Default: the project agent inference profile environment',
        )
        .option(
            '-m, --model <model>',
            'Model id, as listed by "envs models <environment>". Default: the project agent inference profile model',
        )
        .option(
            '--source-ref <ref>',
            'Create the task branch from this ref before starting. Only for a new task: it fails if the branch exists',
        )
        .option('--build-version', 'Build one immutable version after validation')
        .option('--no-follow', 'Return after starting instead of following live progress')
        .action(async (appId: string, taskId: string, options) =>
            startDevelopmentTask(program, appId, taskId, options),
        );
    developmentTasks
        .command('list <appId>')
        .description('List development-task branches')
        .action(async (appId: string) => listDevelopmentTasks(program, appId));
    developmentTasks
        .command('get <appId> <taskId>')
        .description('Get a development task and its latest App Builder parent run')
        .action(async (appId: string, taskId: string) => getDevelopmentTask(program, appId, taskId));

    apps.command('list')
        .description('List all available app manifests')
        .action(async (options: Record<string, unknown>) => {
            await listApps(program, options);
        });

    apps.command('get <appId>')
        .description('Get an app manifest by ID or name')
        .action(async (appId: string, options: Record<string, unknown>) => {
            await getApp(program, appId, options);
        });

    apps.command('create')
        .description('Create a new app manifest')
        .option('-m, --manifest <json>', 'Manifest as JSON string')
        .option('-f, --manifest-file <file>', 'Manifest from a JSON file')
        .option('-i, --install', 'Install the app after creation and grant permissions to the creator')
        .addHelpText(
            'after',
            `
Example manifest.json:

${JSON.stringify(exampleManifest, null, 2)}
`,
        )
        .action(async (options: Record<string, unknown>) => {
            await createApp(program, options);
        });

    apps.command('update <appId>')
        .description('Update an existing app manifest')
        .option('-m, --manifest <json>', 'Manifest as JSON string')
        .option('-f, --manifest-file <file>', 'Manifest from a JSON file')
        .addHelpText(
            'after',
            `
Example manifest.json:

${JSON.stringify(exampleManifest, null, 2)}
`,
        )
        .action(async (appId: string, options: Record<string, unknown>) => {
            await updateApp(program, appId, options);
        });

    apps.command('install <appId>')
        .description('Install an app in the current project')
        .option('--instance-key <key>', 'Immutable installation key; omitted for the default instance')
        .option('--display-name <name>', 'Display label for this installation')
        .option('--namespaces <json>', 'JSON map of MCP collection IDs to permanent tool prefixes')
        .option('--namespaces-file <file>', 'Namespace map from a JSON file')
        .option(
            '--credentials-file <file>',
            'JSON file containing oauth_params, oauth_provider_params and/or api_key_params',
        )
        .option('--mcp-parameters <json>', 'MCP parameter overrides keyed by collection ID')
        .option('--mcp-parameters-file <file>', 'MCP collection parameter overrides from a JSON file')
        .option('--mcp-shared-parameters <json>', 'Shared MCP parameter overrides')
        .option('--mcp-shared-parameters-file <file>', 'Shared MCP parameter overrides from a JSON file')
        .option('-s, --settings <json>', 'Settings as JSON string')
        .option('-f, --settings-file <file>', 'Settings from a JSON file')
        .action(async (appId: string, options: Record<string, unknown>) => {
            await installApp(program, appId, options);
        });

    apps.command('uninstall <installationId>')
        .alias('remove')
        .description('Uninstall an app from the current project')
        .action(async (installationId: string, options: Record<string, unknown>) => {
            await deleteAppInstallation(program, installationId, options);
        });

    apps.command('list-installed')
        .description('List installed apps you have access to in the current project')
        .option('-k, --kind <kind>', 'Filter by installation kind (e.g., agent, tool)')
        .option('--json', 'Output complete installation records as JSON')
        .action(async (options: Record<string, unknown>) => {
            await listInstalledApps(program, options);
        });

    apps.command('get-installation <appNameOrId>')
        .description('Get the default installation by app name, or select an exact instance')
        .option('--id', 'Treat the argument as an installation ID')
        .option('--instance-key <key>', 'Select this instance of the named app (or manifest ID)')
        .action(async (appName: string, options: Record<string, unknown>) => {
            await getAppInstallation(program, appName, options);
        });

    apps.command('settings <installationId>')
        .description('Update an installation by ID; omitted fields remain unchanged')
        .option('--display-name <name>', 'Update the display label')
        .option(
            '--namespaces <json>',
            'Allocate namespaces for newly added collections; existing prefixes cannot change',
        )
        .option('--namespaces-file <file>', 'Namespace allocations from a JSON file')
        .option('--mcp-parameters <json>', 'MCP parameters by collection ID; null clears a value')
        .option('--mcp-parameters-file <file>', 'MCP collection parameter overrides from a JSON file')
        .option('--mcp-shared-parameters <json>', 'Shared MCP parameters; null clears a value')
        .option('--mcp-shared-parameters-file <file>', 'Shared MCP parameter overrides from a JSON file')
        .option('--access-control <policy>', 'Policy: all, ui, none; null restores the manifest policy')
        .option('-s, --settings <json>', 'Settings as JSON string')
        .option('-f, --settings-file <file>', 'Settings from a JSON file')
        .action(async (appId: string, options: Record<string, unknown>) => {
            await updateAppInstallationSettings(program, appId, options);
        });

    registerAppVersionCommands(apps, program);
    registerAppCredentialsCommands(apps, program);
}
