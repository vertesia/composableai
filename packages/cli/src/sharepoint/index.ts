import type { BulkImportParams, CreateSharePointSourcePayload, SharePointSource } from '@vertesia/common';
import type { Command } from 'commander';
import { getClient } from '../client.js';

const BULK_IMPORT_WORKFLOW = 'bulkImportWorkflow';

interface CreateOptions {
    name: string;
    oauthProvider: string;
    siteUrl: string;
    library?: string;
    folder?: string;
    locationRoot?: string;
    collection?: string;
    description?: string;
    json?: boolean;
}

interface ImportOptions {
    queue?: string;
    batchSize?: string;
    dryRun?: boolean;
    json?: boolean;
}

function print(value: unknown) {
    console.log(JSON.stringify(value, null, 2));
}

function describeSource(source: SharePointSource): string {
    const folder = source.folder_path ? `/${source.folder_path}` : '';
    return `${source.id}  ${source.name}  ${source.site_url} → ${source.library_name}${folder}  (${source.location_root})`;
}

function parseBatchSize(value: string | undefined): number | undefined {
    if (value === undefined) {
        return undefined;
    }
    const size = Number(value);
    if (!Number.isInteger(size) || size < 1 || size > 999) {
        throw new Error('Invalid batch size: expected an integer from 1 to 999');
    }
    return size;
}

export function registerSharePointCommand(program: Command) {
    const command = program
        .command('sharepoint')
        .description('Index SharePoint document libraries without copying their files.');

    command
        .command('list')
        .description('List the SharePoint sources of the project.')
        .option('--json', 'Print the full sources as JSON')
        .action(async (options: { json?: boolean }) => {
            const sources = await (await getClient(program)).sharePointSources.list();
            if (options.json) {
                print(sources);
                return;
            }
            for (const source of sources) {
                console.log(describeSource(source));
            }
        });

    command
        .command('get <id>')
        .description('Show a SharePoint source.')
        .action(async (id: string) => print(await (await getClient(program)).sharePointSources.retrieve(id)));

    command
        .command('create')
        .description('Register a SharePoint library, or a folder in it, after checking it with Microsoft Graph.')
        .requiredOption('--name <name>', 'Unique name in the project')
        .requiredOption(
            '--oauth-provider <id>',
            'OAuth provider (client credentials against Microsoft Entra ID) that issues Graph tokens',
        )
        .requiredOption('--site-url <url>', 'SharePoint site URL, e.g. https://contoso.sharepoint.com/sites/legal')
        .option('--library <name>', "Document library name (defaults to the site's default library)")
        .option('--folder <path>', 'Folder inside the library to import, e.g. Contracts/2026')
        .option('--location-root <location>', 'Location root for imported documents (defaults to /sharepoint/<name>)')
        .option('--collection <id>', 'Collection to add imported documents to')
        .option('--description <text>', 'Description')
        .option('--json', 'Print the created source as JSON')
        .action(async (options: CreateOptions) => {
            const payload: CreateSharePointSourcePayload = {
                name: options.name,
                oauth_provider_id: options.oauthProvider,
                site_url: options.siteUrl,
                ...(options.library ? { library_name: options.library } : {}),
                ...(options.folder ? { folder_path: options.folder } : {}),
                ...(options.locationRoot ? { location_root: options.locationRoot } : {}),
                ...(options.collection ? { collection_id: options.collection } : {}),
                ...(options.description ? { description: options.description } : {}),
            };
            const source = await (await getClient(program)).sharePointSources.create(payload);
            if (options.json) {
                print(source);
            } else {
                console.log(`Created ${describeSource(source)}`);
            }
        });

    command
        .command('delete <id>')
        .description('Remove a SharePoint source. Documents it imported are kept.')
        .action(async (id: string) => print(await (await getClient(program)).sharePointSources.delete(id)));

    command
        .command('import <id>')
        .description(
            'Import the source: starts bulkImportWorkflow, which reads the library page by page. ' +
                'Running it again only creates missing documents and reprocesses changed files.',
        )
        .option('--queue <queue>', 'Temporal task queue, e.g. zeno-content/production/bulk')
        .option('--batch-size <size>', 'Files per Graph page and import batch (1-999)')
        .option('--dry-run', 'Report what would be imported without changing anything')
        .option('--json', 'Print the workflow start result as JSON')
        .action(async (id: string, options: ImportOptions) => {
            const client = await getClient(program);
            const source = await client.sharePointSources.retrieve(id);
            const batchSize = parseBatchSize(options.batchSize);
            const vars: BulkImportParams = {
                source: { type: 'sharepoint', source_id: source.id },
                ...(batchSize ? { batchSize } : {}),
                ...(options.dryRun ? { dryRun: true } : {}),
            };
            // Each import is its own run: without `unique`, every import of the project gets the same
            // workflow ID, so a second one returns the running import, or reuses the first one's batch
            // idempotency keys and fails on changed input.
            const started = await client.workflows.execute(BULK_IMPORT_WORKFLOW, {
                vars: { ...vars },
                ...(options.queue ? { task_queue: options.queue } : {}),
                unique: true,
            });
            const run = started[0];
            if (!run) {
                throw new Error('The import workflow did not start');
            }
            if (options.json) {
                print(run);
                return;
            }
            console.log(`Importing ${source.name}`);
            console.log('Workflow ID:', run.workflow_id);
            console.log('Run ID:', run.run_id);
        });
}
