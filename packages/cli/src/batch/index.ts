import type { InferenceBatchStatus } from '@vertesia/common';
import type { Command } from 'commander';
import { getClient } from '../client.js';
import type { CliOptions } from '../utils/options.js';

/** Register the `vertesia batch` command group. */
export function registerBatchCommand(program: Command): void {
    const batch = program.command('batch').description('Inspect the inference batch accumulator');
    batch
        .command('pools')
        .description('List pending batch-accumulator pools (created runs grouped by env:model)')
        .action(() => listBatchPools(program));
    batch
        .command('list')
        .description('List submitted inference batches')
        .option('--status [status]', 'Filter by status: queued|running|succeeded|failed|cancelled')
        .action((options: CliOptions<{ status?: InferenceBatchStatus }>) => listBatches(program, options));
}

/** `vertesia batch pools` — the pending accumulator pools (created batch runs by env:model). */
export async function listBatchPools(program: Command): Promise<void> {
    const client = await getClient(program);
    const pools = await client.runs.batchPools();
    if (pools.length === 0) {
        console.log('No pending batch pools.');
        return;
    }
    console.table(
        pools.map((p) => ({
            environment: p.environment,
            model: p.model,
            pending: p.size,
            oldest_age_s: Math.round(p.oldest_age_ms / 1000),
            batch_only: p.batch_only,
            batch_preferred: p.batch_preferred,
        })),
    );
}

/** `vertesia batch list` — submitted inference batches, optionally filtered by status. */
export async function listBatches(
    program: Command,
    options: CliOptions<{ status?: InferenceBatchStatus }>,
): Promise<void> {
    const client = await getClient(program);
    const batches = await client.runs.batches(options.status);
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
