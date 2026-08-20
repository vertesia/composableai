import type { InferenceBatchStatus } from '@vertesia/common';
import type { Command } from 'commander';
import { getClient } from '../client.js';
import type { CliOptions } from '../utils/options.js';

/** Register the `vertesia batch` command group. */
export function registerBatchCommand(program: Command): void {
    const batch = program.command('batch').description('Inspect and poll provider inference batches');
    batch
        .command('list')
        .description('List submitted inference batches')
        .option('--status <status>', 'Filter by status: queued|running|succeeded|failed|cancelled')
        .action((options: CliOptions<{ status?: InferenceBatchStatus }>) => listBatches(program, options));
    batch
        .command('poll')
        .description('Poll non-terminal provider batches and finalize completed runs')
        .action(() => pollBatches(program));
}

/** `vertesia batch list` — submitted inference batches, optionally filtered by status. */
export async function listBatches(
    program: Command,
    options: CliOptions<{ status?: InferenceBatchStatus }>,
): Promise<void> {
    const client = await getClient(program);
    const batches = await client.runs.batches(options.status ? { status: options.status } : undefined);
    if (batches.length === 0) {
        console.log('No batches.');
        return;
    }
    console.table(
        batches.map((b) => ({
            id: b.id,
            model: b.model,
            status: b.status,
            runs: b.run_count,
            completed: b.completed_count ?? '',
            submitted: b.submitted_at ?? '',
        })),
    );
}

/** `vertesia batch poll` — poll all non-terminal provider batches and finalize completed runs. */
export async function pollBatches(program: Command): Promise<void> {
    const client = await getClient(program);
    const results = await client.runs.pollBatches();
    if (results.length === 0) {
        console.log('No non-terminal batches to poll.');
        return;
    }
    for (const r of results) {
        const parts = [
            r.batch_id,
            `status=${r.status}`,
            `completed=${r.completed ?? '-'}`,
            `failed=${r.failed ?? '-'}`,
        ];
        if (r.error) {
            parts.push(`error=${r.error}`);
        }
        console.log(parts.join(' '));
    }
}
