import type { Command } from 'commander';
import {
    type CancelProcessTestRunOptions,
    cancelProcessTestRun,
    type GetProcessTestRunOptions,
    getProcessTestRun,
    type RunProcessTestsOptions,
    runProcessTests,
} from './commands.js';

export function registerProcessTestsCommand(program: Command) {
    const processTests = program
        .command('process-tests')
        .description('Run deterministic process test scenarios declared next to an in-code process');

    processTests
        .command('run <file>')
        .description(
            'Submit the scenarios in a JSON file against an app/sys process or an inline definition, ' +
                'and wait for the result. Exits 0 when every scenario passed, 1 on a failed or cancelled ' +
                'run, and 2 when the tests could not be started.',
        )
        .option('--no-wait', 'Submit the run and return its id without waiting for the result')
        .option('--timeout <seconds>', 'How long to wait for the run to finish (default: 900)')
        .option('--poll-interval <seconds>', 'Delay between status polls while waiting (default: 5)')
        .option('--app-version <version>', 'Override the app package version pinned in the file')
        .option('--json', 'Print the run as JSON on stdout; progress goes to stderr')
        .action((file: string, options: RunProcessTestsOptions) => runProcessTests(program, file, options));

    processTests
        .command('get <run-id>')
        .description('Show a process test run and its scenario results')
        .option('--watch', 'Keep polling until the run reaches a terminal status')
        .option('--timeout <seconds>', 'How long to wait when watching (default: 900)')
        .option('--poll-interval <seconds>', 'Delay between status polls while watching (default: 5)')
        .option('--json', 'Print the run as JSON on stdout; progress goes to stderr')
        .action((runId: string, options: GetProcessTestRunOptions) => getProcessTestRun(program, runId, options));

    processTests
        .command('cancel <run-id>')
        .description('Cancel a pending or running process test run')
        .option('--json', 'Print the run as JSON')
        .action((runId: string, options: CancelProcessTestRunOptions) => cancelProcessTestRun(program, runId, options));

    return processTests;
}
