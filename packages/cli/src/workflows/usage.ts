import type { Command } from 'commander';
import { getClient } from '../client.js';
export function registerWorkflowUsage(program: Command, workflows: Command) {
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
}
