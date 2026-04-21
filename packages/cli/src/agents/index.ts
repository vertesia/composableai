import {
    AgentMessage,
    AgentMessageType,
    AgentRunResponse,
    CreateAgentRunPayload,
    CreateProcessRunPayload,
    InteractionExecutionConfiguration,
    ProcessDefinitionBody,
    ProcessRun,
    ProcessRunConfig,
    ProcessRunType,
    Task,
    UserInputSignal,
} from "@vertesia/common";
import chalk from "chalk";
import { Command } from "commander";
import { setTimeout as delay } from "node:timers/promises";
import * as readline from "readline";
import { getClient } from "../client.js";
import { readFile, readStdin, writeFile } from "../utils/stdio.js";

type StartOptions = {
    data?: unknown;
    input?: unknown;
    output?: unknown;
    processId?: unknown;
    processDefinition?: unknown;
    runType?: unknown;
    model?: unknown;
    env?: unknown;
    userMessage?: unknown;
    tags?: unknown;
    categories?: unknown;
    visibility?: unknown;
    tools?: unknown;
    collection?: unknown;
    inspect?: boolean;
    json?: unknown;
    stream?: boolean;
    interactive?: boolean;
};

type StreamOptions = {
    since?: unknown;
    interactive?: boolean;
};

type ReplyOptions = {
    input?: unknown;
    json?: boolean;
    output?: unknown;
};

type AnswerTaskOptions = {
    data?: unknown;
    input?: unknown;
    json?: boolean;
    output?: unknown;
};

type CancelOptions = {
    reason?: unknown;
    json?: boolean;
    output?: unknown;
};

type ListTasksOptions = {
    runId?: unknown;
    status?: unknown;
    assignee?: unknown;
    sourceType?: unknown;
    limit?: unknown;
    json?: boolean;
    output?: unknown;
};

type InspectOptions = {
    details?: boolean;
    history?: boolean;
    messages?: boolean;
    tasks?: boolean;
    json?: boolean;
    output?: unknown;
    limit?: unknown;
};

export function registerAgentsCommand(program: Command) {
    const agents = program.command("agents")
        .description("Start, stream, and inspect durable agent runs");

    agents.command("start [interaction]")
        .description("Start a conversation agent or process run through the Agent Runs API")
        .option("-d, --data <json>", "Inline input data as a JSON object")
        .option("-i, --input [file]", "Input data file. Reads stdin when no file is provided")
        .option("-o, --output <file>", "Write the created run JSON to a file")
        .option("--process-id <id>", "Start a stored process definition instead of a conversation agent")
        .option("--process-definition <file>", "Start an inline process definition from a JSON file")
        .option("--run-type <type>", "Process run type: programmatic or supervised", "programmatic")
        .option("-e, --env <environmentId>", "Environment ID for conversation agents")
        .option("-m, --model <model>", "Model override")
        .option("--user-message <message>", "Process run intent passed to supervised mode")
        .option("-T, --tags <tags>", "Comma-separated tags")
        .option("-C, --categories <categories>", "Comma-separated categories")
        .option("--visibility <visibility>", "Run visibility: project or private")
        .option("--tools <tools>", "Comma-separated tool names for conversation agents")
        .option("--collection <collectionId>", "Collection ID for conversation agents")
        .option("--no-stream", "Do not stream the feed after starting")
        .option("--no-inspect", "Do not print a short run summary before streaming")
        .option("--json", "Print machine-readable JSON for non-streaming output")
        .option("--interactive", "Send UserInput signals while streaming")
        .action(async (interaction: string | undefined, options: StartOptions) => {
            await startAgentRun(program, interaction, options);
        });

    agents.command("stream <runId>")
        .description("Stream the message feed for an existing agent or process run")
        .option("--since <timestamp>", "Only stream messages after this timestamp")
        .option("-i, --interactive", "Send UserInput signals while streaming")
        .action(async (runId: string, options: StreamOptions) => {
            await streamAgentRun(program, runId, options);
        });

    agents.command("message <runId> [message]")
        .alias("reply")
        .description("Send a UserInput signal to a running conversation agent or supervised process run")
        .option("-i, --input [file]", "Reply text file. Reads stdin when no file is provided")
        .option("--json", "Print machine-readable JSON")
        .option("-o, --output <file>", "Write JSON output to a file")
        .action(async (runId: string, message: string | undefined, options: ReplyOptions) => {
            await replyToAgentRun(program, runId, message, options);
        });

    const tasks = agents.command("tasks")
        .description("List durable tasks for agent and process runs");

    tasks.command("list [runId]")
        .description("List tasks, optionally scoped to a run id")
        .option("--run-id <id>", "Filter by run id")
        .option("--status <status>", "Filter by status")
        .option("--assignee <principal>", "Filter by assignee principal ref")
        .option("--source-type <type>", "Filter by source type: agent or process")
        .option("-l, --limit <limit>", "Maximum tasks to return", "50")
        .option("--json", "Print raw JSON")
        .option("-o, --output <file>", "Write JSON output to a file")
        .action(async (runId: string | undefined, options: ListTasksOptions) => {
            await listAgentTasks(program, runId, options);
        });

    agents.command("answer-task <taskId> [response]")
        .description("Complete a task with a JSON result object or a shorthand response string")
        .option("-d, --data <json>", "Inline task result as a JSON object")
        .option("-i, --input [file]", "Task result JSON file. Reads stdin when no file is provided")
        .option("--json", "Print machine-readable JSON")
        .option("-o, --output <file>", "Write JSON output to a file")
        .action(async (taskId: string, response: string | undefined, options: AnswerTaskOptions) => {
            await answerTask(program, taskId, response, options);
        });

    agents.command("cancel <runId>")
        .alias("terminate")
        .description("Cancel a running agent or process run")
        .option("-r, --reason <reason>", "Optional cancellation reason")
        .option("--json", "Print machine-readable JSON")
        .option("-o, --output <file>", "Write JSON output to a file")
        .action(async (runId: string, options: CancelOptions) => {
            await cancelAgentRun(program, runId, options);
        });

    agents.command("inspect <runId>")
        .description("Inspect a durable agent or process run")
        .option("--details", "Include workflow details")
        .option("--history", "Include process node history")
        .option("--messages", "Include stored stream messages")
        .option("--tasks", "Include tasks for the run")
        .option("-l, --limit <limit>", "Message/task limit", "50")
        .option("--json", "Print raw JSON")
        .option("-o, --output <file>", "Write JSON output to a file")
        .action(async (runId: string, options: InspectOptions) => {
            await inspectAgentRun(program, runId, options);
        });
}

async function startAgentRun(program: Command, interaction: string | undefined, options: StartOptions) {
    const client = await getClient(program);
    const data = await readOptionalRecordInput(options);
    const processId = readOptionalString(options.processId);
    const processDefinitionPath = readOptionalString(options.processDefinition);
    const stream = options.stream !== false;

    let run: AgentRunResponse<Record<string, unknown>, Record<string, unknown>>;
    if (processId || processDefinitionPath) {
        const payload = buildProcessStartPayload(options, data, processId, processDefinitionPath);
        run = await client.agents.start(payload);
    } else {
        if (!interaction) {
            throw new Error("Missing interaction. Provide an interaction name, --process-id, or --process-definition.");
        }
        const payload = buildAgentStartPayload(interaction, options, data);
        run = await client.agents.start(payload);
    }

    const runJson = JSON.stringify(run, null, 2);
    const outputFile = readOptionalString(options.output);
    if (outputFile) {
        writeFile(outputFile, runJson);
    }

    if (options.json || !stream) {
        console.log(runJson);
    } else if (options.inspect !== false) {
        printRunSummary(run);
    }

    if (stream) {
        await streamAgentRun(program, run.id, { interactive: options.interactive });
    }
}

function buildAgentStartPayload(
    interaction: string,
    options: StartOptions,
    data: Record<string, unknown> | undefined,
): CreateAgentRunPayload<Record<string, unknown>, Record<string, unknown>> {
    return {
        interaction,
        data,
        config: buildInteractionConfig(options),
        interactive: options.interactive !== false,
        tool_names: readStringList(options.tools),
        collection_id: readOptionalString(options.collection),
        visibility: readVisibility(options.visibility),
        tags: readStringList(options.tags),
        categories: readStringList(options.categories),
    };
}

function buildProcessStartPayload(
    options: StartOptions,
    data: Record<string, unknown> | undefined,
    processId: string | undefined,
    processDefinitionPath: string | undefined,
): CreateProcessRunPayload<Record<string, unknown>> {
    const runType = readProcessRunType(options.runType);
    return {
        process_id: processId,
        process_definition: processDefinitionPath ? readProcessDefinition(processDefinitionPath) : undefined,
        run_type: runType,
        data,
        config: buildProcessConfig(options),
        visibility: readVisibility(options.visibility),
        tags: readStringList(options.tags),
        categories: readStringList(options.categories),
    };
}

async function streamAgentRun(program: Command, runId: string, options: StreamOptions) {
    const client = await getClient(program);
    const since = readOptionalInteger(options.since);
    const abortController = new AbortController();
    let isStopping = false;
    let rl: readline.Interface | undefined;

    const stop = () => {
        if (isStopping) {
            return;
        }
        isStopping = true;
        abortController.abort();
        rl?.close();
        process.off("SIGINT", stop);
        process.off("SIGTERM", stop);
    };

    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);

    console.log(chalk.bold(`Streaming AgentRun ${runId}`));
    if (options.interactive) {
        rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: "> ",
        });
        rl.on("line", (line: string) => {
            const message = line.trim();
            if (!message) {
                rl?.prompt();
                return;
            }
            const payload: UserInputSignal = { message };
            client.agents.sendSignal(runId, "UserInput", payload)
                .then(() => {
                    if (!isStopping) {
                        rl?.prompt();
                    }
                })
                .catch(error => {
                    console.error(chalk.red(formatError(error)));
                    if (!isStopping) {
                        rl?.prompt();
                    }
                });
        });
        rl.prompt();
    }

    try {
        await client.agents.streamMessages(
            runId,
            message => printAgentMessage(message),
            since,
            abortController.signal,
        );
    } finally {
        stop();
    }
}

async function replyToAgentRun(
    program: Command,
    runId: string,
    message: string | undefined,
    options: ReplyOptions,
) {
    const client = await getClient(program);
    const payload: UserInputSignal = {
        message: await readReplyMessage(message, options),
    };
    const response = await client.agents.sendSignal(runId, "UserInput", payload);
    printCommandResult(response, options);
}

async function answerTask(
    program: Command,
    taskId: string,
    response: string | undefined,
    options: AnswerTaskOptions,
) {
    const client = await getClient(program);
    const task = await client.tasks.retrieve(taskId);
    const result = await readTaskResult(response, options);
    const completed = task.source.type === "process"
        ? await completeProcessTask(client, task.source.run_id, taskId, result)
        : await client.tasks.complete(taskId, { result });
    printCommandResult(completed, options);
}

async function cancelAgentRun(program: Command, runId: string, options: CancelOptions) {
    const client = await getClient(program);
    const response = await client.agents.terminate(runId, readOptionalString(options.reason));
    printCommandResult(response, options);
}

async function listAgentTasks(
    program: Command,
    runId: string | undefined,
    options: ListTasksOptions,
) {
    const client = await getClient(program);
    const tasks = await client.tasks.list({
        run_id: readOptionalString(options.runId) ?? runId,
        status: readOptionalTaskStatus(options.status),
        assignee: readOptionalString(options.assignee),
        source_type: readOptionalTaskSourceType(options.sourceType),
        limit: readOptionalInteger(options.limit) ?? 50,
    });

    const outputFile = readOptionalString(options.output);
    if (options.json || outputFile) {
        const json = JSON.stringify(tasks, null, 2);
        if (outputFile) {
            writeFile(outputFile, json);
        } else {
            console.log(json);
        }
        return;
    }

    printTasks(tasks);
}

async function inspectAgentRun(program: Command, runId: string, options: InspectOptions) {
    const client = await getClient(program);
    const run = await client.agents.retrieveRun(runId);
    const includeMessages = options.messages === true;
    const includeTasks = options.tasks === true || isProcessRun(run);
    const includeHistory = options.history === true || isProcessRun(run);
    const limit = readOptionalInteger(options.limit) ?? 50;

    const result: Record<string, unknown> = { run };
    if (options.details) {
        result.details = await client.agents.getRunDetails(runId, { includeHistory: true });
    }
    if (includeHistory && isProcessRun(run)) {
        result.history = await client.agents.getHistory(runId);
        result.context = await client.agents.getContext(runId);
    }
    if (includeMessages) {
        result.messages = (await client.agents.retrieveMessages(runId)).slice(-limit);
    }
    if (includeTasks) {
        result.tasks = await client.tasks.list({ run_id: runId, limit });
    }

    const outputFile = readOptionalString(options.output);
    if (options.json || outputFile) {
        const json = JSON.stringify(result, null, 2);
        if (outputFile) {
            writeFile(outputFile, json);
        } else {
            console.log(json);
        }
        return;
    }

    printRunSummary(run);
    if (Array.isArray(result.tasks)) {
        printTasks(result.tasks);
    }
    if (isProcessRun(run)) {
        const state = run.process_state;
        console.log(chalk.bold("Process"));
        console.log(`  current_node: ${state.current_node}`);
        console.log(`  sequence: ${state.sequence ?? 0}`);
        console.log(`  history_entries: ${state.node_history?.length ?? 0}`);
    }
}

async function readOptionalRecordInput(options: StartOptions): Promise<Record<string, unknown> | undefined> {
    const inline = readOptionalString(options.data);
    if (inline) {
        return parseJsonRecord(inline, "--data");
    }

    if (options.input === true) {
        return parseJsonRecord(await readStdin(), "stdin");
    }

    const inputFile = readOptionalString(options.input);
    if (inputFile) {
        return parseJsonRecord(readFile(inputFile), inputFile);
    }

    return undefined;
}

async function readReplyMessage(message: string | undefined, options: ReplyOptions): Promise<string> {
    if (typeof message === "string" && message.length > 0) {
        return message;
    }

    if (options.input === true) {
        return (await readStdin()).trim();
    }

    const inputFile = readOptionalString(options.input);
    if (inputFile) {
        return readFile(inputFile).trim();
    }

    throw new Error("Missing reply message. Provide a positional message or --input.");
}

async function readTaskResult(
    response: string | undefined,
    options: AnswerTaskOptions,
): Promise<Record<string, unknown>> {
    const inline = readOptionalString(options.data);
    if (inline) {
        return parseJsonRecord(inline, "--data");
    }

    if (options.input === true) {
        return parseJsonRecord(await readStdin(), "stdin");
    }

    const inputFile = readOptionalString(options.input);
    if (inputFile) {
        return parseJsonRecord(readFile(inputFile), inputFile);
    }

    if (typeof response === "string" && response.length > 0) {
        return { response };
    }

    throw new Error("Missing task result. Provide a positional response, --data, or --input.");
}

async function completeProcessTask(
    client: Awaited<ReturnType<typeof getClient>>,
    runId: string,
    taskId: string,
    result: Record<string, unknown>,
): Promise<Task> {
    await client.agents.answerTask(runId, taskId, result);
    return waitForTaskUpdate(client, taskId);
}

async function waitForTaskUpdate(
    client: Awaited<ReturnType<typeof getClient>>,
    taskId: string,
): Promise<Task> {
    let latest = await client.tasks.retrieve(taskId);
    if (latest.status !== "pending" && latest.status !== "in_progress") {
        return latest;
    }

    for (let attempt = 0; attempt < 20; attempt += 1) {
        await delay(250);
        latest = await client.tasks.retrieve(taskId);
        if (latest.status !== "pending" && latest.status !== "in_progress") {
            return latest;
        }
    }

    return latest;
}

function buildInteractionConfig(options: StartOptions): InteractionExecutionConfiguration | undefined {
    const config: InteractionExecutionConfiguration = {};
    const environment = readOptionalString(options.env);
    const model = readOptionalString(options.model);
    if (environment) {
        config.environment = environment;
    }
    if (model) {
        config.model = model;
    }
    return Object.keys(config).length ? config : undefined;
}

function buildProcessConfig(options: StartOptions): ProcessRunConfig | undefined {
    const config: ProcessRunConfig = {};
    const model = readOptionalString(options.model);
    const userMessage = readOptionalString(options.userMessage);
    if (model) {
        config.model = model;
    }
    if (userMessage) {
        config.user_message = userMessage;
    }
    return Object.keys(config).length ? config : undefined;
}

function readProcessDefinition(file: string): ProcessDefinitionBody {
    const parsed = JSON.parse(readFile(file));
    if (!isProcessDefinitionBody(parsed)) {
        throw new Error(`Invalid process definition in ${file}`);
    }
    return parsed;
}

function parseJsonRecord(input: string, label: string): Record<string, unknown> {
    const parsed = JSON.parse(input);
    if (!isRecord(parsed)) {
        throw new Error(`${label} must be a JSON object`);
    }
    return parsed;
}

function readOptionalString(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readStringList(value: unknown): string[] | undefined {
    const raw = readOptionalString(value);
    if (!raw) {
        return undefined;
    }
    const items = raw.split(",").map(item => item.trim()).filter(Boolean);
    return items.length ? items : undefined;
}

function readOptionalInteger(value: unknown): number | undefined {
    const raw = readOptionalString(value);
    if (!raw) {
        return undefined;
    }
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function readVisibility(value: unknown): "project" | "private" | undefined {
    const raw = readOptionalString(value);
    if (!raw) {
        return undefined;
    }
    if (raw !== "project" && raw !== "private") {
        throw new Error("visibility must be project or private");
    }
    return raw;
}

function readProcessRunType(value: unknown): ProcessRunType {
    const raw = readOptionalString(value) ?? "programmatic";
    if (raw !== "programmatic" && raw !== "supervised") {
        throw new Error("run-type must be programmatic or supervised");
    }
    return raw;
}

function readOptionalTaskStatus(value: unknown): Task["status"] | undefined {
    const raw = readOptionalString(value);
    if (!raw) {
        return undefined;
    }
    if (raw !== "pending" && raw !== "in_progress" && raw !== "completed" && raw !== "cancelled") {
        throw new Error("status must be pending, in_progress, completed, or cancelled");
    }
    return raw;
}

function readOptionalTaskSourceType(value: unknown): Task["source"]["type"] | undefined {
    const raw = readOptionalString(value);
    if (!raw) {
        return undefined;
    }
    if (raw !== "agent" && raw !== "process") {
        throw new Error("source-type must be agent or process");
    }
    return raw;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isProcessDefinitionBody(value: unknown): value is ProcessDefinitionBody {
    return isRecord(value)
        && typeof value.process === "string"
        && typeof value.initial === "string"
        && isRecord(value.context)
        && isRecord(value.nodes);
}

function isProcessRun(run: AgentRunResponse<Record<string, unknown>, Record<string, unknown>>): run is ProcessRun {
    return run.run_kind === "process";
}

function printRunSummary(run: AgentRunResponse<Record<string, unknown>, Record<string, unknown>>) {
    console.log(chalk.bold("AgentRun"));
    console.log(`  id: ${run.id}`);
    console.log(`  kind: ${run.run_kind}`);
    console.log(`  run_type: ${run.run_type}`);
    console.log(`  status: ${run.status}`);
    console.log(`  title: ${run.title ?? "n/a"}`);
    if (run.run_kind === "agent") {
        console.log(`  interaction: ${run.interaction_name ?? run.interaction}`);
    }
    if (isProcessRun(run)) {
        console.log(`  process: ${run.process_definition_snapshot.process}`);
        console.log(`  current_node: ${run.process_state.current_node}`);
    }
}

function printAgentMessage(message: AgentMessage) {
    const timestamp = message.timestamp ? new Date(message.timestamp).toISOString() : new Date().toISOString();
    const type = message.type != null ? AgentMessageType[message.type] ?? String(message.type) : "MESSAGE";
    const body = typeof message.message === "string"
        ? message.message
        : JSON.stringify(message.message, null, 2);
    console.log(`${chalk.gray(timestamp)} ${chalk.cyan(type)} ${body ?? ""}`);
    if (message.details) {
        console.log(chalk.gray(JSON.stringify(message.details, null, 2)));
    }
}

function printTasks(tasks: Task[]) {
    if (!tasks.length) {
        console.log("No tasks found");
        return;
    }
    console.log(chalk.bold("Tasks"));
    for (const task of tasks) {
        const source = `${task.source.type}:${task.source.run_id}`;
        const assignee = task.assignee ? ` assignee=${task.assignee}` : "";
        console.log(`  ${task.id} ${task.status} ${task.title} (${source})${assignee}`);
    }
}

function printCommandResult(result: unknown, options: { json?: boolean; output?: unknown }) {
    const json = JSON.stringify(result, null, 2);
    const outputFile = readOptionalString(options.output);
    if (outputFile) {
        writeFile(outputFile, json);
    }

    if (options.json || outputFile) {
        if (!outputFile) {
            console.log(json);
        }
        return;
    }

    if (isRecord(result) && typeof result.message === "string") {
        console.log(result.message);
        return;
    }

    console.log(json);
}

function formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
