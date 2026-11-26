import { validateApiRequest } from '@vertesia/common/api-contract';
import type { Command } from 'commander';
import { getClient } from '../client.js';
import { readFile, readStdin } from '../utils/stdio.js';

function print(value: unknown): void {
    console.log(JSON.stringify(value, null, 2));
}

async function readConfiguration(path: string): Promise<unknown> {
    return JSON.parse(path === '-' ? await readStdin() : readFile(path));
}

export function registerSharePointLibrariesCommand(program: Command): void {
    const command = program
        .command('sharepoint-libraries')
        .description('Manage verified SharePoint libraries in dedicated or existing projects');
    command
        .command('list')
        .action(async () => print(await (await getClient(program)).sharepointLibraries.listLibraries()));
    command
        .command('get <id>')
        .action(async (id: string) => print(await (await getClient(program)).sharepointLibraries.getLibrary(id)));
    command
        .command('current-project')
        .option('--all', 'List every SharePoint library attached to the current project')
        .action(async ({ all }: { all?: boolean }) => {
            const { sharepointLibraries } = await getClient(program);
            print(await (all ? sharepointLibraries.getProjectLibraries() : sharepointLibraries.getProjectLibrary()));
        });
    command
        .command('approve <id>')
        .requiredOption(
            '--file <path>',
            'Approval JSON with project_id and audience, or manager_id, reader_group_id and audience; - reads stdin',
        )
        .action(async (id: string, options: { file: string }) => {
            const approval = validateApiRequest(
                'ApproveSharePointLibraryPayload',
                await readConfiguration(options.file),
            );
            if (!approval.valid) throw new Error('Invalid SharePoint library approval');
            print(await (await getClient(program)).sharepointLibraries.approveLibrary(id, approval.data));
        });
    command
        .command('configure-reader <id>')
        .requiredOption(
            '--file <path>',
            'Reader configuration JSON. Use {} for uniform permissions. For mirrored permissions, include permissions and site_policy_confirmed: true after the SharePoint administrator verifies both site policies are off. Optionally include scim_connection_id in permissions for provisioned Entra groups and supported username-only grants. Use - to read stdin.',
        )
        .action(async (id: string, options: { file: string }) => {
            const reader = validateApiRequest(
                'ConfigureSharePointLibraryReaderPayload',
                await readConfiguration(options.file),
            );
            if (!reader.valid) throw new Error('Invalid SharePoint library reader configuration');
            print(await (await getClient(program)).sharepointLibraries.configureLibraryReader(id, reader.data));
        });
    command
        .command('disconnect <id>')
        .option('--yes', 'Confirm that indexed library access and sync should be stopped')
        .action(async (id: string, options: { yes?: boolean }) => {
            if (!options.yes) throw new Error('Use --yes to confirm disconnecting the library');
            print(await (await getClient(program)).sharepointLibraries.disconnectLibrary(id));
        });
}
