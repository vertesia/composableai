import { AgentMessage } from "@vertesia/common";
import chalk from "chalk";
import { getClient } from "../client.js";

export async function streamRun(runId: string, program: any, options: Record<string, any> = {}) {
    const client = getClient(program);
    const since = options.since ? parseInt(options.since, 10) : undefined;
    const onMessage = (message: AgentMessage) => {
        try {
            // Check if message is completely empty or malformed
            if (!message || (message && !message.type && !message.message)) {
                console.log(`${new Date().toISOString()} [HEARTBEAT]: ping`);
                return;
            }

            // Safely format the timestamp
            let timeString;
            try {
                timeString = message.timestamp ? new Date(message.timestamp).toISOString() : new Date().toISOString();
            } catch (err) {
                console.warn(`Invalid timestamp in message: ${message.timestamp}`);
                timeString = new Date().toISOString();
            }
            const time = chalk.gray(timeString);

            // Handle undefined message type
            if (!message.type) {
                console.log(`${time} [HEARTBEAT]: ping`);
                return;
            }

            const typeColor = {
                init: chalk.cyan,
                error: chalk.red.bold,
                warning: chalk.yellow.bold,
                update: chalk.blue,
                success: chalk.green.bold,
                complete: chalk.magenta.bold,
            };

            const type = typeColor[message.type.toLowerCase() as keyof typeof typeColor]
                ? typeColor[message.type.toLowerCase() as keyof typeof typeColor](message.type?.toUpperCase())
                : chalk.white(message.type?.toUpperCase());

            // Handle undefined message content
            if (message.type && !message.message) {
                console.log(`${time} [${type}]: <no content>`);
                return;
            }

            const content = formatMessageContent(message.message);

            // Special handling for COMPLETE messages
            if (message.type.toLowerCase() === "complete") {
                console.log(`${time} [${type}]:`, chalk.white(content));
                return;
            }

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

function formatMessageContent(content: any) {
    if (typeof content === "string") {
        console.log("we have a string");
        // Replace escaped newlines with actual newlines
        return content.replace(/\\n/g, "\n");
    } else {
        console.log("we have an object", content);
        // For objects, use pretty-printing with actual newlines
        return JSON.stringify(content, null, 2);
    }
}
