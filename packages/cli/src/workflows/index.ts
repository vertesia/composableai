import type { Command } from 'commander';
import {
    cancelWorkflowRun,
    createOrUpdateWorkflowDefinition,
    deleteWorkflowDefinition,
    executeWorkflowByName,
    getWorkflowDefinition,
    listWorkflowsDefinition,
    signalWorkflowRun,
    terminateWorkflowRun,
    transpileWorkflow,
} from './commands.js';
import { streamRun } from './streams.js';

export function registerWorkflowsCommand(program: Command) {
    const workflows = program.command('workflows');

    workflows
        .command('execute <workflowName>')
        .description('Execute a workflow by name')
        .option('-o, --objectId [objectIds...]', 'Optional object to execute the workflow on.')
        .option('-v, --vars [vars]', 'The workflow vars as an inline JSON.')
        .option('--queue [queue]', 'The task queue name. Defaults to zeno-content', 'zeno-content')
        .option('-f, --file [file]', 'A file containing workflow execution payload.')
        .option('-s, --stream', 'Stream the execution')
        .option('-i, --interactive', 'Enable interactive mode to send messages during workflow execution', false)
        .option('--output [output]', 'Output file for the workflow execution')
        .action(async (workflowName: string, options: Record<string, unknown>) => {
            // If interactive is true, make sure stream is also enabled
            if (options.interactive) {
                options.stream = true;
            }
            console.debug('Executing workflow', workflowName, 'with options', options);
            await executeWorkflowByName(program, workflowName, options);
        });
    const definitions = workflows.command('definitions');

    workflows
        .command('stream <workflowId> <runId>')
        .description('Stream messages for an existing workflow run')
        .option('--since <timestamp>', 'Stream only messages after this timestamp')
        .option('-i, --interactive', 'Enable interactive mode to send messages to the workflow', false)
        .action((workflowId, runId, options) => streamRun(workflowId, runId, program, options));

    workflows
        .command('terminate <workflowId> <runId>')
        .description('Terminate a running workflow (forceful; no cleanup handlers run)')
        .option('-r, --reason [reason]', 'Optional reason recorded on the termination')
        .action((workflowId, runId, options) => terminateWorkflowRun(program, workflowId, runId, options));

    workflows
        .command('cancel <workflowId> <runId>')
        .description('Cancel a running workflow (graceful; cancellation handlers run)')
        .option('-r, --reason [reason]', 'Optional reason recorded on the cancellation')
        .action((workflowId, runId, options) => cancelWorkflowRun(program, workflowId, runId, options));

    workflows
        .command('signal <workflowId> <runId> <signal>')
        .description('Send a named signal to a running workflow')
        .option('-d, --data [json]', 'Optional JSON payload to send with the signal')
        .action((workflowId, runId, signal, options) => signalWorkflowRun(program, workflowId, runId, signal, options));

    definitions
        .command('transpile <files...>')
        .description('Transpile a typescript workflow definition to JSON.')
        .option(
            '-o, --out [file]',
            'An output file or directory. When multiple files are specified it must be a directory. If not specified the transpiled files are printed to stdout.',
        )
        .action(async (files: string[], options: Record<string, unknown>) => {
            await transpileWorkflow(program, files, options);
        });

    definitions
        .command('create')
        .description('Create a new workflow definition.')
        .option('-f, --file <file>', 'The file containing the workflow definition.')
        .action(async (options: Record<string, unknown>) => {
            await createOrUpdateWorkflowDefinition(program, undefined, options);
        });

    definitions
        .command('apply [workflowId]')
        .description('Create or update a workflow definition using a file.')
        .option('-f, --file <file>', 'The file containing the workflow definition.')
        .option('--skip-validation', 'Skip the validation of the workflow definition.')
        .action(async (workflowId, options: Record<string, unknown>) => {
            await createOrUpdateWorkflowDefinition(program, workflowId, options);
        });

    definitions
        .command('list')
        .description('List all workflow definitions.')
        .action(async (options: Record<string, unknown>) => {
            await listWorkflowsDefinition(program, options);
        });

    definitions
        .command('get <objectId>')
        .description('Get a workflow definition given its ID.')
        .option('-f, --file [file]', 'The file to save the workflow definition to.')
        .action(async (objectId: string, options: Record<string, unknown>) => {
            await getWorkflowDefinition(program, objectId, options);
        });

    definitions
        .command('delete <objectId>')
        .description('Delete a workflow definition given its ID.')
        .action(async (objectId: string, options: Record<string, unknown>) => {
            await deleteWorkflowDefinition(program, objectId, options);
        });
}
