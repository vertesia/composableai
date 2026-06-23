import type { Command } from 'commander';
import { exportEmbeddings } from './commands.js';

export function registerEmbeddingsCommand(program: Command) {
    const embeddings = program.command('embeddings').description('Manage and export project embeddings');

    embeddings
        .command('export')
        .description('Export stored project embeddings as paged JSONL or JSONL.GZ')
        .option(
            '-o, --output [path]',
            'Output file path. Defaults to content-export-<projectid>-<projectname>-<timestamp>.jsonl.gz',
        )
        .option('--compression [compression]', 'Compression: gzip or none', 'gzip')
        .option('--embedding-types [types]', 'Comma-separated embedding types: text,image,properties')
        .option('--object-type [type]', 'Filter by content object type id or in-code type')
        .option('--created-from [date]', 'Filter by created_at lower bound')
        .option('--created-to [date]', 'Filter by created_at upper bound')
        .option('--updated-from [date]', 'Filter by updated_at lower bound')
        .option('--updated-to [date]', 'Filter by updated_at upper bound')
        .option('--all-revisions', 'Export all revisions instead of only head revisions')
        .option('--include-properties', 'Include content object properties')
        .option('--include-metadata', 'Include content object metadata')
        .option('--quiet', 'Suppress progress output')
        .action(async (options: Record<string, unknown>) => {
            await exportEmbeddings(program, options);
        });
}
