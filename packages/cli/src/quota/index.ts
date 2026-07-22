import type { Command } from 'commander';
import { showStanding } from './commands.js';

export function registerQuotaCommand(program: Command) {
    const quota = program.command('quota').description('Inspect your quota / rate-limit standing');

    quota
        .command('show')
        .description('Show your current API rate-limit standing (effective limits + usage)')
        .option('--json', 'Print machine-readable JSON')
        .action(async (options: { json?: boolean }) => {
            await showStanding(program, options);
        });

    // Friendly alias.
    quota
        .command('standing', { hidden: true })
        .option('--json', 'Print machine-readable JSON')
        .action(async (options: { json?: boolean }) => {
            await showStanding(program, options);
        });

    return quota;
}
