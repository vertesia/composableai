import type { AppVersionTarget } from '@vertesia/common';
import type { Command } from 'commander';
import { getClient } from '../client.js';
import { followAppBuild } from './commands.js';
import { readJsonInput } from './inputs.js';

const VERSION_TARGETS: readonly AppVersionTarget[] = ['static', 'service'];
const RECORD_ID_HINT = 'Pass the version record id (the `id` field of `apps versions list <appId>`).';

type BuildOptions = { sourceRef?: string; target?: string; title?: string; follow?: boolean };
type LaunchOptions = { project?: string; settings?: string; settingsFile?: string };

function print(value: unknown) {
    console.log(JSON.stringify(value, null, 2));
}

function assertRecordId(recordId: string) {
    if (!/^[0-9a-f]{24}$/i.test(recordId))
        throw new Error(`'${recordId}' is not a version record id. ${RECORD_ID_HINT}`);
}

/** Follow a build the way the App Builder UI does, and fail with the build's own reason when it fails. */
async function followBuild(program: Command, appId: string, workflowId: string, runId: string) {
    const client = await getClient(program);
    const progress = await followAppBuild(
        () => client.apps.getBuildProgress(appId, workflowId, runId),
        (update) => console.log(`[${update.status}] ${update.step}`),
    );
    if (progress.status === 'failed') throw new Error(`Build failed: ${progress.error || progress.step}`);
    print({ version_id: progress.version_id, app_url: progress.app_url, source_commit: progress.source_commit });
}

/**
 * Commands for the versions of an App Builder app: list them, build one from source, open a temporary launch of
 * one, and promote one so it becomes what end users get.
 */
export function registerAppVersionCommands(apps: Command, program: Command) {
    const versions = apps.command('versions').description('Build, launch and promote versions of an App Builder app');

    versions
        .command('list <appId>')
        .description('List the versions of an app: the promoted one first, then the newest')
        .option('--limit <n>', 'Maximum number of versions to return', (value) => Number.parseInt(value, 10))
        .action(async (appId: string, options: { limit?: number }) => {
            if (options.limit !== undefined && !(options.limit > 0))
                throw new Error('--limit must be a positive number');
            print(await (await getClient(program)).apps.listVersions({ app_id: appId, limit: options.limit }));
        });

    versions
        .command('build <appId>')
        .description('Build an immutable version from the app source, then follow progress until it is ready')
        .option('--source-ref <ref>', "Branch, tag or commit to build (default: the app source's default branch)")
        .option(
            '--target <target>',
            `Build target: ${VERSION_TARGETS.join(' or ')} (default: service, as App Builder builds in Studio)`,
        )
        .option('--title <title>', 'Version title')
        .option('--no-follow', 'Return after starting instead of following build progress')
        .action(async (appId: string, options: BuildOptions) => {
            // Studio's App Builder builds the service target; a static build refuses apps with same-origin /api calls.
            const target = (options.target ?? 'service') as AppVersionTarget;
            if (!VERSION_TARGETS.includes(target)) {
                throw new Error(`--target must be one of: ${VERSION_TARGETS.join(', ')}`);
            }
            const run = await (await getClient(program)).apps.startBuild(appId, {
                trigger: 'api',
                ...(options.sourceRef ? { source_ref: options.sourceRef } : {}),
                target,
                ...(options.title ? { title: options.title } : {}),
            });
            print(run);
            if (options.follow === false) return;
            await followBuild(program, run.app_id, run.workflow_id, run.run_id);
        });

    versions
        .command('launch <versionRecordId>')
        .description('Open a temporary launch of a version, without promoting it, and print its URL')
        .option('--project <projectId>', 'Project where the app is installed to run the launch (default: current)')
        .option('-s, --settings <json>', 'Temporary installation settings as a JSON object')
        .option('-f, --settings-file <file>', 'Temporary installation settings from a JSON file')
        .action(async (recordId: string, options: LaunchOptions) => {
            assertRecordId(recordId);
            const settings = (await readJsonInput(options.settings, options.settingsFile, '--settings')) ?? {};
            print(
                await (await getClient(program)).apps.createVersionLaunch(recordId, {
                    ...(options.project ? { target_project_id: options.project } : {}),
                    settings,
                }),
            );
        });

    versions
        .command('promote <versionRecordId>')
        .description('Promote a ready version so it becomes the version end users get')
        .action(async (recordId: string) => {
            assertRecordId(recordId);
            print(await (await getClient(program)).apps.promoteVersion(recordId));
        });
}
