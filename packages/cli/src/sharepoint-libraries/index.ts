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
        .description('Manage dedicated projects for verified SharePoint libraries');
    command
        .command('list')
        .action(async () => print(await (await getClient(program)).sharepointLibraries.listLibraries()));
    command
        .command('get <id>')
        .action(async (id: string) => print(await (await getClient(program)).sharepointLibraries.getLibrary(id)));
    command
        .command('current-project')
        .action(async () => print(await (await getClient(program)).sharepointLibraries.getProjectLibrary()));
    command
        .command('approve <id>')
        .requiredOption('--file <path>', 'Approval JSON with manager, group and audience; - reads stdin')
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
        .requiredOption('--file <path>', 'Project reader configuration JSON; - reads stdin')
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
