import { AccessControlPrincipalType, AccessControlResourceType, AppInstallationKind, AppManifestData, ProjectRoles } from "@vertesia/common";
import colors from "ansi-colors";
import { Command } from "commander";
import { readFile } from "fs/promises";
import { getClient } from "../client.js";

export async function listApps(program: Command, _options: Record<string, any>) {
    const client = getClient(program);
    const apps = await client.apps.list();

    if (apps.length === 0) {
        console.log("No apps found.");
        return;
    }

    console.log(`Found ${apps.length} app(s):\n`);
    apps.forEach(app => {
        console.log(`${colors.bold(app.name)} [${app.id}]`);
        if (app.description) {
            console.log(`  ${colors.dim(app.description)}`);
        }
        console.log();
    });
}

export async function getApp(program: Command, appId: string, _options: Record<string, any>) {
    const client = getClient(program);
    const apps = await client.apps.list();

    const app = apps.find(a => a.id === appId || a.name === appId);

    if (!app) {
        console.log(`No app found with ID or name: ${appId}`);
        return;
    }

    console.log(JSON.stringify(app, null, 2));
}

export async function createApp(program: Command, options: Record<string, any>) {
    const client = getClient(program);

    let manifest: AppManifestData;

    if (options.manifestFile) {
        try {
            const content = await readFile(options.manifestFile, 'utf-8');
            manifest = JSON.parse(content);
        } catch (err: any) {
            if (err.code === 'ENOENT') {
                console.error(`${colors.red('✗')} File not found: ${options.manifestFile}`);
                process.exit(1);
            }
            throw err;
        }
    } else if (options.manifest) {
        try {
            manifest = JSON.parse(options.manifest);
        } catch (err) {
            console.error(`${colors.red('✗')} Invalid JSON in manifest option`);
            process.exit(1);
        }
    } else {
        console.error(`${colors.red('✗')} Either --manifest or --manifest-file must be provided`);
        process.exit(1);
    }

    const result = await client.apps.create(manifest);
    console.log(`${colors.green('✓')} App created successfully`);
    console.log(`  ID: ${result.id}`);
    console.log(`  Name: ${result.name}`);

    // If --install flag is set, install the app and grant permissions
    if (options.install) {
        console.log();

        // Install the app
        const installation = await client.apps.install(result.id);
        console.log(`${colors.green('✓')} App installed successfully`);
        console.log(`  Installation ID: ${installation.id}`);

        // Get current user ID from JWT
        const jwt = await client.getDecodedJWT();
        
        if (jwt && jwt.sub) {
            // Grant app_member role to the current user
            await client.iam.aces.create({
                principal: jwt.sub,
                principal_type: AccessControlPrincipalType.user,
                resource: installation.id,
                resource_type: AccessControlResourceType.app,
                role: ProjectRoles.app_member,
            });

            console.log(`${colors.green('✓')} Permissions granted to ${jwt.email || jwt.sub}`);
        }
    }
}

export async function updateApp(program: Command, appId: string, options: Record<string, any>) {
    const client = getClient(program);

    let manifest: AppManifestData;

    if (options.manifestFile) {
        try {
            const content = await readFile(options.manifestFile, 'utf-8');
            manifest = JSON.parse(content);
        } catch (err: any) {
            if (err.code === 'ENOENT') {
                console.error(`${colors.red('✗')} File not found: ${options.manifestFile}`);
                process.exit(1);
            }
            throw err;
        }
    } else if (options.manifest) {
        try {
            manifest = JSON.parse(options.manifest);
        } catch (err) {
            console.error(`${colors.red('✗')} Invalid JSON in manifest option`);
            process.exit(1);
        }
    } else {
        console.error(`${colors.red('✗')} Either --manifest or --manifest-file must be provided`);
        process.exit(1);
    }

    const result = await client.apps.update(appId, manifest);
    console.log(`${colors.green('✓')} App updated successfully`);
    console.log(`  ID: ${result.id}`);
    console.log(`  Name: ${result.name}`);
}

export async function installApp(program: Command, appId: string, options: Record<string, any>) {
    const client = getClient(program);

    let settings: Record<string, any> | undefined;

    if (options.settingsFile) {
        try {
            const content = await readFile(options.settingsFile, 'utf-8');
            settings = JSON.parse(content);
        } catch (err: any) {
            if (err.code === 'ENOENT') {
                console.error(`${colors.red('✗')} File not found: ${options.settingsFile}`);
                process.exit(1);
            }
            throw err;
        }
    } else if (options.settings) {
        try {
            settings = JSON.parse(options.settings);
        } catch (err) {
            console.error(`${colors.red('✗')} Invalid JSON in settings option`);
            process.exit(1);
        }
    }

    const result = await client.apps.install(appId, settings);
    console.log(`${colors.green('✓')} App installed successfully`);
    console.log(`  Installation ID: ${result.id}`);
    console.log(`  App Manifest ID: ${result.manifest}`);
}

export async function deleteAppInstallation(program: Command, installationId: string, _options: Record<string, any>) {
    const client = getClient(program);

    await client.apps.uninstall(installationId);
    console.log(`${colors.green('✓')} App uninstalled successfully`);
}

export async function listInstalledApps(program: Command, options: Record<string, any>) {
    const client = getClient(program);
    const kind = options.kind as AppInstallationKind | undefined;

    const apps = await client.apps.getInstalledApps(kind);

    if (apps.length === 0) {
        console.log("No installed apps found that you have access to.");
        return;
    }

    console.log(`Found ${apps.length} installed app(s):\n`);
    apps.forEach(app => {
        console.log(`${colors.bold(app.manifest.name)} [${app.manifest.id}]`);
        console.log(`  Installation ID: ${app.id}`);
        if (app.manifest.description) {
            console.log(`  ${colors.dim(app.manifest.description)}`);
        }
        console.log();
    });
}

export async function getAppInstallation(program: Command, appName: string, _options: Record<string, any>) {
    const client = getClient(program);

    const installation = await client.apps.getAppInstallationByName(appName);

    if (!installation) {
        console.log(`${colors.yellow('⚠')} App "${appName}" is not installed in this project.`);
        return;
    }

    const permissions = await client.iam.aces.list({
        level: 'resource',
        resource: installation.id,
    });

    // Fetch user or group details for each permission
    const enrichedPermissions = await Promise.all(
        permissions.map(async (perm) => {
            let principalDetails;
            try {
                if (perm.principal_type === 'user') {
                    principalDetails = await client.users.get(perm.principal);
                } else if (perm.principal_type === 'group') {
                    principalDetails = await client.iam.groups.get(perm.principal);
                }
            } catch (err) {
                // If we can't fetch details, just use the ID
                principalDetails = null;
            }

            return {
                ...perm,
                principal_details: principalDetails
            };
        })
    );

    console.log(JSON.stringify({
        ...installation,
        permissions: enrichedPermissions
    }, null, 2));
}

export async function updateAppInstallationSettings(program: Command, appId: string, options: Record<string, any>) {
    const client = getClient(program);

    let settings: Record<string, any>;

    if (options.settingsFile) {
        try {
            const content = await readFile(options.settingsFile, 'utf-8');
            settings = JSON.parse(content);
        } catch (err: any) {
            if (err.code === 'ENOENT') {
                console.error(`${colors.red('✗')} File not found: ${options.settingsFile}`);
                process.exit(1);
            }
            throw err;
        }
    } else if (options.settings) {
        try {
            settings = JSON.parse(options.settings);
        } catch (err) {
            console.error(`${colors.red('✗')} Invalid JSON in settings option`);
            process.exit(1);
        }
    } else {
        console.error(`${colors.red('✗')} Either --settings or --settings-file must be provided`);
        process.exit(1);
    }

    const result = await client.apps.updateInstallationSettings({
        app_id: appId,
        settings
    });

    console.log(`${colors.green('✓')} App settings updated successfully`);
    console.log(`  Installation ID: ${result.id}`);
    console.log(`  App Name: ${result.manifest.name}`);
}
