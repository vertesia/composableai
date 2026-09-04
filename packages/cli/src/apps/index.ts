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
        .action(async (options: Record<string, unknown>) => {
            await listInstalledApps(program, options);
        });

    apps.command('get-installation <appName>')
        .description('Get an app installation by name')
        .action(async (appName: string, options: Record<string, unknown>) => {
            await getAppInstallation(program, appName, options);
        });

    apps.command('settings <appId>')
        .description('Update app installation settings')
        .option('-s, --settings <json>', 'Settings as JSON string')
        .option('-f, --settings-file <file>', 'Settings from a JSON file')
        .action(async (appId: string, options: Record<string, unknown>) => {
            await updateAppInstallationSettings(program, appId, options);
        });
}
