import { AgentMessage } from "@vertesia/common";
import chalk from "chalk";
import { getClient } from "../client.js";

/*
 * Stream updates for a workflow run.
 */
export async function streamWorkflowRun(runId: string, options: Record<string, any>) {
    const client = getClient();
    const since = options.since ? parseInt(options.since, 10) : undefined;

    console.log(`Streaming updates for workflow run: ${runId}`);
    if (since) console.log(`(Only messages since: ${new Date(since).toISOString()})`);

    const onMessage = (message: AgentMessage) => {
        const time = chalk.gray(new Date(message.timestamp).toISOString());
        const typeColor = {
            system: chalk.cyan,
            error: chalk.red.bold,
            warning: chalk.yellow.bold,
            info: chalk.blue,
            success: chalk.green.bold,
        };

        const type = typeColor[message.type as keyof typeof typeColor]
            ? typeColor[message.type as keyof typeof typeColor](message.type.toUpperCase())
            : chalk.white(message.type.toUpperCase());

        const content = chalk.white(message.message);
        console.log(`${time} [${type}]: ${content}`);

        if (message.details) {
            console.log(chalk.gray("↳ Details:"), chalk.dim(JSON.stringify(message.details, null, 2)));
        }
    };

    try {
        await client.workflows.streamMessages(runId, onMessage, since);
        console.log("Stream completed.");
    } catch (err) {
        console.error("Failed to stream messages:", err);
    }
}

export async function streamRun(runId: string, program: any, options: Record<string, any> = {}) {
    const client = getClient(program);
    const since = options.since ? parseInt(options.since, 10) : undefined;

    const onMessage = (message: AgentMessage) => {
        const time = chalk.gray(new Date(message.timestamp).toISOString());
        const typeColor = {
            system: chalk.cyan,
            error: chalk.red.bold,
            warning: chalk.yellow.bold,
            info: chalk.blue,
            success: chalk.green.bold,
        };

        const type = typeColor[message.type as keyof typeof typeColor]
            ? typeColor[message.type as keyof typeof typeColor](message.type.toUpperCase())
            : chalk.white(message.type.toUpperCase());

        const content = chalk.white(message.message);

        console.log(`${time} [${type}]: ${content}`);

        if (message.details) {
            console.log(chalk.gray("↳ Details:"), chalk.dim(JSON.stringify(message.details, null, 2)));
        }
    };

    try {
        await client.workflows.streamMessages(runId, onMessage, since);
        console.log("Streaming complete.");
    } catch (err) {
        console.error("Error streaming messages:", err);
    }
}
