import type { Command } from 'commander';
import { exportEmbeddings } from './commands.js';

export function registerEmbeddingsCommand(program: Command) {
    const embeddings = program.command('embeddings').description('Manage and export project embeddings');

    embeddings
        .command('export')
        .description('Export stored project embeddings as paged JSONL or JSONL.GZ')
        .option(
            '-o, --output [path]',
            'Output file path. Defaults to embed-export-<projectid>-<projectname>-<timestamp>.jsonl.gz',
        )
        .option('--compression [compression]', 'Compression: gzip or none', 'gzip')
        .option('--embedding-types [types]', 'Comma-separated embedding types: text,image,properties')
        .option('-l, --limit [limit]', 'Records to fetch per API page', '500')
        .option('--query [json]', 'Additional content object query as JSON')
        .option('--object-type [type]', 'Filter by content object type id or in-code type')
        .option('--status [status]', 'Filter by content object status')
        .option('--path [path]', 'Filter by content object location/path')
        .option('--name [name]', 'Filter by content object name')
        .option('--all-revisions', 'Export all revisions instead of only head revisions')
        .option('--include-properties', 'Include content object properties')
        .option('--include-metadata', 'Include content object metadata')
        .option('--quiet', 'Suppress progress output')
        .action(async (options: Record<string, unknown>) => {
            await exportEmbeddings(program, options);
        });
}
