import { AppManifestData } from "@vertesia/common";
import { Command } from "commander";
import {
    createApp,
    deleteAppInstallation,
    getApp,
    getAppInstallation,
    installApp,
    listApps,
    listInstalledApps,
    updateApp,
    updateAppInstallationSettings
} from "./commands.js";

const exampleManifest: AppManifestData = {
    name: "my-app",
    title: "My App",
    description: "A sample app",
    publisher: "your-org",
    visibility: 'private',
    status: "beta",
    ui: {
        src: "/plugins/my-app",
        isolation: "shadow"
    },
    tool_collections: [
        "https://example.com/tools"
    ],
    settings_schema: {
        type: "object",
        properties: {
            apiKey: { type: "string" }
        }
    }
};

export function registerAppsCommand(program: Command) {
    const apps = program.command("apps")
        .description("Manage applications and app installations");

    apps.command("list")
        .description("List all available app manifests")
        .action(async (options: Record<string, any>) => {
            await listApps(program, options);
        });

    apps.command("get <appId>")
        .description("Get an app manifest by ID or name")
        .action(async (appId: string, options: Record<string, any>) => {
            await getApp(program, appId, options);
        });

    apps.command("create")
        .description('Create a new app manifest')
        .option('-m, --manifest <json>', 'Manifest as JSON string')
        .option('-f, --manifest-file <file>', 'Manifest from a JSON file')
        .option('-i, --install', 'Install the app after creation and grant permissions to the creator')
        .addHelpText('after', `
Example manifest.json:

${JSON.stringify(exampleManifest, null, 2)}
`)
        .action(async (options: Record<string, any>) => {
            await createApp(program, options);
        });

    apps.command("update <appId>")
        .description('Update an existing app manifest')
        .option('-m, --manifest <json>', 'Manifest as JSON string')
        .option('-f, --manifest-file <file>', 'Manifest from a JSON file')
        .addHelpText('after', `
Example manifest.json:

${JSON.stringify(exampleManifest, null, 2)}
`)
        .action(async (appId: string, options: Record<string, any>) => {
            await updateApp(program, appId, options);
        });

    apps.command("install <appId>")
        .description("Install an app in the current project")
        .option('-s, --settings <json>', 'Settings as JSON string')
        .option('-f, --settings-file <file>', 'Settings from a JSON file')
        .action(async (appId: string, options: Record<string, any>) => {
            await installApp(program, appId, options);
        });

    apps.command("uninstall <installationId>")
        .alias("remove")
        .description("Uninstall an app from the current project")
        .action(async (installationId: string, options: Record<string, any>) => {
            await deleteAppInstallation(program, installationId, options);
        });

    apps.command("list-installed")
        .description("List installed apps you have access to in the current project")
        .option('-k, --kind <kind>', 'Filter by installation kind (e.g., agent, tool)')
        .action(async (options: Record<string, any>) => {
            await listInstalledApps(program, options);
        });

    apps.command("get-installation <appName>")
        .description("Get an app installation by name")
        .action(async (appName: string, options: Record<string, any>) => {
            await getAppInstallation(program, appName, options);
        });

    apps.command("settings <appId>")
        .description("Update app installation settings")
        .option('-s, --settings <json>', 'Settings as JSON string')
        .option('-f, --settings-file <file>', 'Settings from a JSON file')
        .action(async (appId: string, options: Record<string, any>) => {
            await updateAppInstallationSettings(program, appId, options);
        });
}
