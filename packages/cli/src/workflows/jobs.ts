import { readFile } from 'node:fs/promises';
import type { CreateWorkflowJobPayload } from '@vertesia/common';
import type { Command } from 'commander';
import { getClient } from '../client.js';

export function registerWorkflowJobs(program: Command, workflows: Command) {
    workflows
        .command('usage')
        .option('--class <name>', 'One workflow admission class')
        .option('--json', 'Print full JSON')
        .action(async (options: { class?: string; json?: boolean }) => {
            const usage = await (await getClient(program)).store.workflows.usage({ workflow_class: options.class });
            if (options.json) console.log(JSON.stringify(usage, null, 2));
            else
                console.table(
                    usage.classes.map((row) => ({
                        class: row.workflow_class,
                        mode: row.mode,
                        strategy: row.strategy,
                        freshness: row.freshness,
                        starts: row.start_window?.used,
                        active: row.occupancy?.tenant_active,
                        deferred: row.backlog.deferred,
                        confirmed_starts: row.actual_starts.count,
                    })),
                );
        });
    const jobs = workflows.command('jobs').description('Durable multi-object execution jobs');
    jobs.command('create')
        .requiredOption('--file <path>', 'JSON CreateWorkflowJobPayload, including finite expires_at')
        .option('--json', 'Print full JSON')
        .action(async (options: { file: string; json?: boolean }) => {
            const payload: CreateWorkflowJobPayload = JSON.parse(await readFile(options.file, 'utf8'));
            const job = await (await getClient(program)).store.workflows.jobs.create(payload);
            if (options.json) console.log(JSON.stringify(job, null, 2));
            else console.log(`${job.id} ${job.status} (${job.progress.total} children)`);
        });
    jobs.command('get <id>')
        .option('--json', 'Print full JSON')
        .action(async (id: string, options: { json?: boolean }) => {
            const job = await (await getClient(program)).store.workflows.jobs.retrieve(id);
            if (options.json) console.log(JSON.stringify(job, null, 2));
            else console.table([{ id: job.id, status: job.status, ...job.progress }]);
        });
    jobs.command('children <id>')
        .option('--after <id>', 'Pagination cursor')
        .option('--limit <count>', 'Page size', '100')
        .option('--json', 'Print full JSON')
        .action(async (id: string, options: { after?: string; limit: string; json?: boolean }) => {
            const page = await (await getClient(program)).store.workflows.jobs.children(id, {
                after: options.after,
                limit: Number(options.limit),
            });
            if (options.json) console.log(JSON.stringify(page, null, 2));
            else {
                console.table(page.items);
                if (page.next) console.log(`Next: --after ${page.next}`);
            }
        });
    jobs.command('revoke <id>')
        .option('--json', 'Print full JSON')
        .action(async (id: string, options: { json?: boolean }) => {
            const job = await (await getClient(program)).store.workflows.jobs.revoke(id);
            if (options.json) console.log(JSON.stringify(job, null, 2));
            else console.log(`Revoked ${job.id}; ${job.status}`);
        });
}
