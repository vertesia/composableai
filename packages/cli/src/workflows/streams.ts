import { AgentMessage } from "@vertesia/common";
import chalk from "chalk";
import { getClient } from "../client.js";

export async function streamRun(runId: string, program: any, options: Record<string, any> = {}) {
    const client = getClient(program);
    const since = options.since ? parseInt(options.since, 10) : undefined;

    const onMessage = (message: AgentMessage) => {
        try {
            // Safely format the timestamp
            let timeString;
            try {
                timeString = message.timestamp ? new Date(message.timestamp).toISOString() : new Date().toISOString();
            } catch (err) {
                console.warn(`Invalid timestamp in message: ${message.timestamp}`);
                timeString = new Date().toISOString();
            }

            const time = chalk.gray(timeString);
            const typeColor = {
                system: chalk.cyan,
                error: chalk.red.bold,
                warning: chalk.yellow.bold,
                info: chalk.blue,
                success: chalk.green.bold,
            };
            const type = typeColor[message.type as keyof typeof typeColor]
                ? typeColor[message.type as keyof typeof typeColor](message.type?.toUpperCase())
                : chalk.white(message.type?.toUpperCase());
            const content = chalk.white(message.message);
            console.log(`${time} [${type}]: ${content}`);
            if (message.details) {
                console.log(chalk.gray("↳ Details:"), chalk.dim(JSON.stringify(message.details, null, 2)));
            }
        } catch (err) {
            console.error("Error formatting message:", err);
            console.log("Raw message:", JSON.stringify(message));
        }
    };

    try {
        await client.workflows.streamMessages(runId, onMessage, since);
        console.log("Streaming complete.");
    } catch (err) {
        console.error("Error streaming messages:", err);
    }
}
