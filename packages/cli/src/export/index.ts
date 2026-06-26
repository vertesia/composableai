import type { Command } from 'commander';
import { exportContentObjects } from './commands.js';

export function registerExportCommand(program: Command) {
    program
        .command('export')
        .description('Export project content objects as JSONL or JSONL.GZ')
        .option('-o, --output [path]', 'Output file path. Defaults to the generated export filename. Use - for stdout.')
        .option('--no-compress', 'Write uncompressed JSONL instead of JSONL.GZ')
        .option('--include-embeddings', 'Include stored embeddings')
        .option('--embedding-types [types]', 'Comma-separated embedding types: text,image,properties')
        .option('--type [type]', 'Filter by content object type id or in-code type')
        .option('--created-from [date]', 'Filter by created_at lower bound')
        .option('--created-to [date]', 'Filter by created_at upper bound')
        .option('--updated-from [date]', 'Filter by updated_at lower bound')
        .option('--updated-to [date]', 'Filter by updated_at upper bound')
        .option('--all-revisions', 'Export all revisions instead of only head revisions')
        .option('--no-content', 'Exclude content source metadata')
        .option('--no-status', 'Exclude content object status')
        .option('--no-properties', 'Exclude content object properties')
        .option('--include-metadata', 'Include content object metadata')
        .option('--no-revision', 'Exclude object revision details')
        .option('--json', 'Print final workflow status as JSON')
        .option('--quiet', 'Suppress progress output')
        .action(async (options: Record<string, unknown>) => {
            await exportContentObjects(program, options);
        });
}
