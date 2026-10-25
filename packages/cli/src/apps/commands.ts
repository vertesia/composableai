import { readFile } from 'node:fs/promises';
import {
    AccessControlPrincipalType,
    AccessControlResourceType,
    type AgentMessage,
    AgentMessageType,
    type AppInstallationKind,
    type AppInstallationPayload,
    type AppManifestData,
    type AppScaffoldModule,
    type AppScaffoldProgress,
    SystemRoles,
} from '@vertesia/common';
import colors from 'ansi-colors';
import type { Command } from 'commander';
import { getClient } from '../client.js';
import { type CliOptions, hasErrorCode } from '../utils/options.js';
import { collectionParameters, parameterMap, readCredentials, readJsonInput, stringMap } from './inputs.js';

type ManifestOptions = CliOptions<{
    manifest?: string;
    manifestFile?: string;
    install?: boolean;
}>;

type SettingsOptions = CliOptions<{
    settings?: string;
    settingsFile?: string;
    instanceKey?: string;
    displayName?: string;
    namespaces?: string;
    namespacesFile?: string;
    credentialsFile?: string;
    mcpParameters?: string;
    mcpParametersFile?: string;
    mcpSharedParameters?: string;
    mcpSharedParametersFile?: string;
    accessControl?: string;
}>;

type InstalledAppsOptions = CliOptions<{
    kind?: AppInstallationKind;
    json?: boolean;
}>;

export type ScaffoldOptions = CliOptions<{
    title?: string;
    description?: string;
    modules?: string;
    createVersion?: boolean;
    follow?: boolean;
}>;

export type DevelopmentTaskOptions = CliOptions<{
    sourceRef?: string;
    prompt?: string;
    env?: string;
    model?: string;
    buildVersion?: boolean;
    follow?: boolean;
}>;

const DEVELOPMENT_TASK_PROGRESS_TYPES = new Set<AgentMessageType>([
    AgentMessageType.PLAN,
    AgentMessageType.UPDATE,
    AgentMessageType.COMPLETE,
    AgentMessageType.WARNING,
    AgentMessageType.ERROR,
    AgentMessageType.ANSWER,
    AgentMessageType.QUESTION,
    AgentMessageType.REQUEST_INPUT,
    AgentMessageType.TERMINATED,
    AgentMessageType.BATCH_PROGRESS,
    AgentMessageType.RESTARTING,
]);

function messageProgress(message: AgentMessage): AppScaffoldProgress | undefined {
    const details = message.details as { app_scaffold_progress?: AppScaffoldProgress } | undefined;
    return details?.app_scaffold_progress;
}

export async function scaffoldApp(program: Command, appName: string, options: ScaffoldOptions) {
    const client = await getClient(program);
    const modules = options.modules
        ?.split(',')
        .map((module) => module.trim())
        .filter(Boolean) as AppScaffoldModule[] | undefined;
    const run = await client.apps.startScaffold({
        app_id: appName,
        title: options.title,
        description: options.description,
        modules,
        create_version: options.createVersion !== false,
    });
    console.log(JSON.stringify(run, null, 2));
    if (options.follow === false) return;

    await client.workflows.streamMessages(run.workflow_id, run.run_id, (message) => {
        const progress = messageProgress(message);
        if (progress) console.log(`[${progress.status}] ${progress.step}`);
    });
}

export async function createDevelopmentTask(
    program: Command,
    appId: string,
    taskId: string,
    options: DevelopmentTaskOptions,
) {
    const sourceRef = options.sourceRef?.trim();
    if (!sourceRef) throw new Error('--source-ref is required');
    const branch = await (await getClient(program)).apps.createRepoBranch(appId, {
        name: `agent/${taskId}`,
        source_ref: sourceRef,
    });
    console.log(JSON.stringify(branch, null, 2));
}

export async function startDevelopmentTask(
    program: Command,
    appId: string,
    taskId: string,
    options: DevelopmentTaskOptions,
) {
    const prompt = options.prompt?.trim();
    const environment = options.env?.trim();
    const model = options.model?.trim();
    if (!prompt) throw new Error('--prompt is required');
    if (!environment) throw new Error('--env is required');
    if (!model) throw new Error('--model is required');
    const client = await getClient(program);
    if (options.sourceRef) {
        await client.apps.createRepoBranch(appId, { name: `agent/${taskId}`, source_ref: options.sourceRef });
    }
    const run = await client.apps.startDevelopmentTask(appId, taskId, {
        prompt,
        environment,
        model,
        build_version: options.buildVersion ?? false,
    });
    console.log(
        JSON.stringify(
            {
                id: run.id,
                status: run.status,
                workflow_id: run.workflow_id,
                run_id: run.first_workflow_run_id,
                ...('interaction' in run ? { interaction: run.interaction } : {}),
            },
            null,
            2,
        ),
    );
    if (options.follow === false) return;
    let inputRequired = false;
    await client.agents.streamMessages(
        run.id,
        (message, exit) => {
            if (message.message && DEVELOPMENT_TASK_PROGRESS_TYPES.has(message.type)) {
                console.log(`[${AgentMessageType[message.type] ?? message.type}] ${message.message}`);
            }
            if (message.type === AgentMessageType.REQUEST_INPUT) {
                inputRequired = true;
                exit?.({ status: 'input_required', message: message.message });
            }
        },
        undefined,
        undefined,
        { closeOnIdle: true },
    );
    if (inputRequired) {
        console.log('The App Builder run is still open. Continue it in Studio to answer the question.');
    }
}

export async function listDevelopmentTasks(program: Command, appId: string) {
    console.log(JSON.stringify(await (await getClient(program)).apps.listDevelopmentTasks(appId), null, 2));
}

export async function getDevelopmentTask(program: Command, appId: string, taskId: string) {
    console.log(JSON.stringify(await (await getClient(program)).apps.getDevelopmentTask(appId, taskId), null, 2));
}

export async function listApps(program: Command, _options: Record<string, unknown>) {
    const client = await getClient(program);
    const apps = await client.apps.list();

    if (apps.length === 0) {
        console.log('No apps found.');
        return;
    }

    console.log(`Found ${apps.length} app(s):\n`);
    apps.forEach((app) => {
        console.log(`${colors.bold(app.name)} [${app.id}]`);
        if (app.description) {
            console.log(`  ${colors.dim(app.description)}`);
        }
        console.log();
    });
}

export async function getApp(program: Command, appId: string, _options: Record<string, unknown>) {
    const client = await getClient(program);
    const apps = await client.apps.list();

    const app = apps.find((a) => a.id === appId || a.name === appId);

    if (!app) {
        console.log(`No app found with ID or name: ${appId}`);
        return;
    }

    console.log(JSON.stringify(app, null, 2));
}

export async function createApp(program: Command, options: ManifestOptions) {
    const client = await getClient(program);

    let manifest: AppManifestData;

    if (options.manifestFile) {
        try {
            const content = await readFile(options.manifestFile, 'utf-8');
            manifest = JSON.parse(content) as AppManifestData;
        } catch (err: unknown) {
            if (hasErrorCode(err, 'ENOENT')) {
                console.error(`${colors.red('✗')} File not found: ${options.manifestFile}`);
                process.exit(1);
            }
            throw err;
        }
    } else if (options.manifest) {
        try {
            manifest = JSON.parse(options.manifest) as AppManifestData;
        } catch {
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

        if (jwt?.sub) {
            // Grant app_member role to the current user
            await client.iam.aces.create({
                principal: jwt.sub,
                principal_type: AccessControlPrincipalType.user,
                resource: installation.id,
                resource_type: AccessControlResourceType.app,
                role: SystemRoles.app_member,
            });

            console.log(`${colors.green('✓')} Permissions granted to ${jwt.email || jwt.sub}`);
        }
    }
}

export async function updateApp(program: Command, appId: string, options: ManifestOptions) {
    const client = await getClient(program);

    let manifest: AppManifestData;

    if (options.manifestFile) {
        try {
            const content = await readFile(options.manifestFile, 'utf-8');
            manifest = JSON.parse(content) as AppManifestData;
        } catch (err: unknown) {
            if (hasErrorCode(err, 'ENOENT')) {
                console.error(`${colors.red('✗')} File not found: ${options.manifestFile}`);
                process.exit(1);
            }
            throw err;
        }
    } else if (options.manifest) {
        try {
            manifest = JSON.parse(options.manifest) as AppManifestData;
        } catch {
            console.error(`${colors.red('✗')} Invalid JSON in manifest option`);
            process.exit(1);
        }
    } else {
        console.error(`${colors.red('✗')} Either --manifest or --manifest-file must be provided`);
        process.exit(1);
    }

    const current = (await client.apps.list()).find((app) => app.id === appId);
    if (!current) {
        console.error(`${colors.red('✗')} App not found: ${appId}`);
        process.exit(1);
    }
    const result = await client.apps.update(appId, {
        ...manifest,
        expected_edit_revision: current.edit_revision,
    });
    console.log(`${colors.green('✓')} App updated successfully`);
    console.log(`  ID: ${result.id}`);
    console.log(`  Name: ${result.name}`);
}

async function installationInput(options: SettingsOptions) {
    const settings = await readJsonInput(options.settings, options.settingsFile, '--settings');
    const namespace_overrides = stringMap(
        await readJsonInput(options.namespaces, options.namespacesFile, '--namespaces'),
        '--namespaces',
    );
    const mcp_parameters = collectionParameters(
        await readJsonInput(options.mcpParameters, options.mcpParametersFile, '--mcp-parameters'),
    );
    const mcp_shared_parameters = parameterMap(
        await readJsonInput(options.mcpSharedParameters, options.mcpSharedParametersFile, '--mcp-shared-parameters'),
    );
    if (options.displayName !== undefined && !options.displayName.trim()) {
        throw new Error('--display-name must not be empty');
    }
    return {
        ...(settings !== undefined ? { settings } : {}),
        ...(namespace_overrides !== undefined ? { namespace_overrides } : {}),
        ...(options.displayName !== undefined ? { display_name: options.displayName } : {}),
        ...(mcp_parameters !== undefined ? { mcp_parameters } : {}),
        ...(mcp_shared_parameters !== undefined ? { mcp_shared_parameters } : {}),
    };
}

export async function installApp(program: Command, appId: string, options: SettingsOptions) {
    const input = await installationInput(options);
    const credentials = await readCredentials(options.credentialsFile);
    const client = await getClient(program);
    const result = await client.apps.install(
        appId,
        input.settings,
        credentials.oauth_params,
        credentials.oauth_provider_params,
        credentials.api_key_params,
        input.mcp_parameters,
        input.mcp_shared_parameters,
        {
            instance_key: options.instanceKey,
            display_name: input.display_name,
            namespace_overrides: input.namespace_overrides,
        },
    );
    console.log(`${colors.green('✓')} App installed successfully`);
    console.log(`  Installation ID: ${result.id}`);
    console.log(`  App Manifest ID: ${result.manifest}`);
    console.log(`  Instance Key: ${result.instance_key ?? 'default'}`);
    if (result.display_name) console.log(`  Display Name: ${result.display_name}`);
}

export async function deleteAppInstallation(
    program: Command,
    installationId: string,
    _options: Record<string, unknown>,
) {
    const client = await getClient(program);

    await client.apps.uninstall(installationId);
    console.log(`${colors.green('✓')} App uninstalled successfully`);
}

export async function listInstalledApps(program: Command, options: InstalledAppsOptions) {
    const client = await getClient(program);
    const kind = options.kind;

    const apps = await client.apps.getInstalledApps(kind);

    if (options.json) {
        console.log(JSON.stringify(apps, null, 2));
        return;
    }

    if (apps.length === 0) {
        console.log('No installed apps found that you have access to.');
        return;
    }

    console.log(`Found ${apps.length} installed app(s):\n`);
    apps.forEach((app) => {
        console.log(`${colors.bold(app.manifest.name)} [${app.manifest.id}]`);
        console.log(`  Installation ID: ${app.id}`);
        console.log(`  Instance Key: ${app.instance_key ?? 'default'}`);
        if (app.display_name) console.log(`  Display Name: ${app.display_name}`);
        if (app.namespace_overrides) console.log(`  Namespaces: ${JSON.stringify(app.namespace_overrides)}`);
        if (app.manifest.description) {
            console.log(`  ${colors.dim(app.manifest.description)}`);
        }
        console.log();
    });
}

export async function getAppInstallation(
    program: Command,
    appName: string,
    options: CliOptions<{ id?: boolean; instanceKey?: string }>,
) {
    if (options.id && options.instanceKey !== undefined) throw new Error('--id and --instance-key cannot be combined');
    const client = await getClient(program);

    const candidates =
        options.instanceKey === undefined
            ? undefined
            : (await client.apps.getInstalledApps()).filter(
                  (app) =>
                      (app.manifest.name === appName || app.manifest.id === appName) &&
                      (app.instance_key ?? 'default') === options.instanceKey,
              );
    if (candidates && candidates.length > 1) {
        throw new Error(
            'App name is ambiguous; select the manifest ID with --instance-key or the installation ID with --id',
        );
    }
    const installation = options.id
        ? await client.apps.getAppInstallation(appName)
        : candidates !== undefined
          ? candidates[0]
          : await client.apps.getAppInstallationByName(appName);

    if (!installation) {
        if (!options.id && options.instanceKey === undefined) {
            console.log(`${colors.yellow('⚠')} App "${appName}" is not installed in this project.`);
            return;
        }
        throw new Error('App installation not found or not accessible in this project');
    }

    const permissions = await client.iam.aces.list({
        level: 'resource',
        resource: installation.id,
    });

    // Fetch user or group details for each permission
    const enrichedPermissions = await Promise.all(
        permissions.map(async (perm) => {
            let principalDetails: unknown;
            try {
                if (perm.principal_type === 'user') {
                    principalDetails = await client.users.get(perm.principal);
                } else if (perm.principal_type === 'group') {
                    principalDetails = await client.iam.groups.get(perm.principal);
                }
            } catch {
                // If we can't fetch details, just use the ID
                principalDetails = null;
            }

            return {
                ...perm,
                principal_details: principalDetails,
            };
        }),
    );

    console.log(
        JSON.stringify(
            {
                ...installation,
                permissions: enrichedPermissions,
            },
            null,
            2,
        ),
    );
}

export async function updateAppInstallationSettings(
    program: Command,
    installationId: string,
    options: SettingsOptions,
) {
    const input = await installationInput(options);
    let access_control: AppInstallationPayload['access_control'];
    if (options.accessControl !== undefined) {
        if (!['all', 'ui', 'none', 'null'].includes(options.accessControl)) {
            throw new Error('--access-control must be all, ui, none or null');
        }
        access_control = options.accessControl === 'null' ? null : (options.accessControl as 'all' | 'ui' | 'none');
    }
    if (!Object.keys(input).length && options.accessControl === undefined) {
        throw new Error('Provide settings, a display name, namespaces, MCP parameters or an access-control policy');
    }
    const client = await getClient(program);
    const result = await client.apps.updateInstallationSettings({
        app_id: installationId,
        ...input,
        ...(options.accessControl !== undefined ? { access_control } : {}),
    });
    console.log(`${colors.green('✓')} App settings updated successfully`);
    console.log(`  Installation ID: ${result.id}`);
    console.log(`  App Name: ${result.manifest.name}`);
}
