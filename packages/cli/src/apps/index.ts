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
    startDevelopmentTask,
    updateApp,
    updateAppInstallationSettings,
} from './commands.js';
import { registerAppCredentialsCommands } from './credentials.js';

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
        .description('Create and scaffold a new app package, then follow workflow progress through the live stream')
        .option('--title <title>', 'App title')
        .option('--description <description>', 'App description')
        .option('--modules <modules>', 'Comma-separated modules: service,assistant,content-app,examples')
        .option('--no-create-version', 'Do not build an initial immutable version')
        .option('--no-follow', 'Return after starting instead of following live progress')
        .action(async (appName: string, options) => scaffoldApp(program, appName, options));

    const developmentTasks = apps.command('development-tasks').description('Manage App Builder development tasks');
    developmentTasks
        .command('create <appId> <taskId>')
        .description('Create an agent/* task branch from an existing ref')
        .requiredOption('--source-ref <ref>', 'Source branch, tag, or commit')
        .action(async (appId: string, taskId: string, options) =>
            createDevelopmentTask(program, appId, taskId, options),
        );
    developmentTasks
        .command('start <appId> <taskId>')
        .description('Start the policy-controlled App Builder parent and follow its live agent stream')
        .requiredOption('--prompt <prompt>', 'Development request')
        .requiredOption('-e, --env <environment>', 'Execution environment id')
        .requiredOption('-m, --model <model>', 'Model id')
        .option('--source-ref <ref>', 'Create the task branch from this ref before starting')
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
        .option(
            '--approved-scopes <scopes>',
            'Comma-separated app OAuth scopes to approve; use an empty string to install without granting access',
        )
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

    registerAppCredentialsCommands(apps, program);
}
