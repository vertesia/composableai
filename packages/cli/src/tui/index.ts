import { Command } from 'commander';
import { registerAgentCliCommands } from './cli.js';

/**
 * Register the `vertesia agent` command group.
 * - Subcommands (list, run, status, output, etc.) are plain CLI (Phase 0)
 * - `vertesia agent tui` launches the ink-based TUI via dynamic import
 */
export function registerAgentCommand(program: Command) {
    const agent = program.command('agent')
        .description('Agent management: list, run, stream, and interact with agents');

    // Register all plain CLI subcommands
    registerAgentCliCommands(agent);

    // TUI subcommand — dynamic import to avoid loading React for non-TUI commands
    agent.command('tui')
        .description('Launch the interactive agent TUI')
        .action(async () => {
            const { launchTui } = await import('./launch.js');
            await launchTui();
        });

    // If `vertesia agent` is called with no subcommand, show help
    agent.action(() => {
        agent.help();
    });
}
