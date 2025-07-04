import { Command } from "commander";
import {
    createOrUpdateWorkflowDefinition,
    createOrUpdateWorkflowRule,
    createWorkflowRule,
    deleteWorkflowDefinition,
    deleteWorkflowRule,
    executeWorkflowByName,
    executeWorkflowRule,
    getWorkflowDefinition,
    getWorkflowRule,
    listWorkflowsDefinition,
    listWorkflowsRule,
    transpileWorkflow,
} from "./commands.js";
import { streamRun } from "./streams.js";

export function registerWorkflowsCommand(program: Command) {
    const workflows = program.command("workflows");
    const rules = workflows.command("rules");

    rules
        .command("create")
        .description("Create a new workflow rule.")
        .option("--name [name]", "The name of the workflow rule to create.")
        .option(
            "--on [event]",
            'The event which trigger this rule. Format: "eventName[:objectType]" where objectType is optional.',
        )
        .option("--run [endpoint]", "The workflow to run.")
        .action(async (options: Record<string, any>) => {
            await createWorkflowRule(program, options);
        });

    rules
        .command("get <ruleId>")
        .description("Get a workflow rule by ID")
        .option("-f, --file [file]", "The file to save the workflow rule to.")
        .action(async (ruleId: string, options: Record<string, any>) => {
            await getWorkflowRule(program, ruleId, options);
        });

    rules
        .command("apply")
        .description("Create or update a workflow rule using a file")
        .option("-f, --file <file>", "The file containing the workflow rule to apply.")
        .action(async (options: Record<string, any>) => {
            await createOrUpdateWorkflowRule(program, options);
        });

    rules
        .command("list")
        .description("List all workflow rules")
        .action(async (options: Record<string, any>) => {
            await listWorkflowsRule(program, options);
        });

    rules
        .command("execute <ruleId>")
        .description("Execute a workflow rule")
        .option("-o, --objectId [objectIds...]", "The object to execute the rule on.")
        .option("--vars [vars]", "workflow vars as an inlined JSON string.")
        .option("-f, --file [file]", "The file containing workflow execution payload.")
        .action(async (workflowId: string, options: Record<string, any>) => {
            await executeWorkflowRule(program, workflowId, options);
        });

    rules
        .command("delete <ruleId>")
        .description("Delete a workflow rule given its ID")
        .action(async (ruleId: string, options: Record<string, any>) => {
            await deleteWorkflowRule(program, ruleId, options);
        });

    workflows
        .command("execute <workflowName>")
        .description("Execute a workflow by name")
        .option("-o, --objectId [objectIds...]", "Optional object to execute the workflow on.")
        .option("-v, --vars [vars]", "The workflow vars as an inline JSON.")
        .option("--queue [queue]", "The task queue name. Defaults to zeno-content","zeno-content")
        .option("-f, --file [file]", "A file containing workflow execution payload.")
        .option("-s, --stream", "Stream the execution")
        .option("-i, --interactive", "Enable interactive mode to send messages during workflow execution", false)
        .option("--output [output]", "Output file for the workflow execution")
        .action(async (workflowName: string, options: Record<string, any>) => {
            // If interactive is true, make sure stream is also enabled
            if (options.interactive) {
                options.stream = true;
            }
            console.debug("Executing workflow", workflowName, "with options", options);
            await executeWorkflowByName(program, workflowName, options);
        });
    const definitions = workflows.command("definitions");

    workflows
        .command("stream <workflowId> <runId>")
        .description("Stream messages for an existing workflow run")
        .option("--since <timestamp>", "Stream only messages after this timestamp")
        .option("-i, --interactive", "Enable interactive mode to send messages to the workflow", false)
        .action((workflowId, runId, options) => streamRun(workflowId, runId, program, options));

    definitions
        .command("transpile <files...>")
        .description("Transpile a typescript workflow definition to JSON.")
        .option(
            "-o, --out [file]",
            "An output file or directory. When multiple files are specified it must be a directory. If not specified the transpiled files are printed to stdout.",
        )
        .action(async (files: string[], options: Record<string, any>) => {
            await transpileWorkflow(program, files, options);
        });

    definitions
        .command("create")
        .description("Create a new workflow definition.")
        .option("-f, --file <file>", "The file containing the workflow definition.")
        .action(async (options: Record<string, any>) => {
            await createOrUpdateWorkflowDefinition(program, undefined, options);
        });

    definitions
        .command("apply [workflowId]")
        .description("Create or update a workflow definition using a file.")
        .option("-f, --file <file>", "The file containing the workflow definition.")
        .option("--skip-validation", "Skip the validation of the workflow definition.")
        .action(async (workflowId, options: Record<string, any>) => {
            await createOrUpdateWorkflowDefinition(program, workflowId, options);
        });

    definitions
        .command("list")
        .description("List all workflow definitions.")
        .action(async (options: Record<string, any>) => {
            await listWorkflowsDefinition(program, options);
        });

    definitions
        .command("get <objectId>")
        .description("Get a workflow definition given its ID.")
        .option("-f, --file [file]", "The file to save the workflow definition to.")
        .action(async (objectId: string, options: Record<string, any>) => {
            await getWorkflowDefinition(program, objectId, options);
        });

    definitions
        .command("delete <objectId>")
        .description("Delete a workflow definition given its ID.")
        .action(async (objectId: string, options: Record<string, any>) => {
            await deleteWorkflowDefinition(program, objectId, options);
        });
}
