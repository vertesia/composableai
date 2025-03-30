import { AgentMessage } from "@vertesia/common";
import chalk from "chalk";
import { getClient } from "../client.js";
import boxen from "boxen";
import ora from "ora";
import gradient from "gradient-string";
import cliTable from "cli-table3";
import figures from "figures";
import logUpdate from "log-update";
import logSymbols from "log-symbols";

// Define emoji icons for different message types
const typeIcons = {
    init: figures.pointer,
    system: figures.hamburger,
    thought: figures.questionMarkPrefix,
    plan: figures.arrowRight,
    update: figures.arrowUp,
    complete: figures.tick,
    warning: figures.warning,
    error: figures.cross,
};

// Enhanced color palette with gradients
const typeColors = {
    init: gradient.pastel,
    system: gradient.atlas,
    thought: gradient.mind,
    plan: gradient.passion,
    update: gradient.cristal,
    complete: gradient.summer,
    warning: gradient.morning,
    error: gradient.fruit,
    heartbeat: chalk.gray,
};

// Define styles for boxen with proper types
const boxStyles = {
    error: {
        padding: 1,
        margin: 1,
        borderStyle: "round" as const,
        borderColor: "red" as const,
        backgroundColor: "#400",
    },
    warning: {
        padding: 1,
        margin: 1,
        borderStyle: "round" as const,
        borderColor: "yellow" as const,
        backgroundColor: "#440",
    },
    complete: {
        padding: 1,
        margin: 1,
        borderStyle: "round" as const,
        borderColor: "green" as const,
        backgroundColor: "#040",
    },
};

export async function streamRun(runId: string, program: any, options: Record<string, any> = {}) {
    const client = getClient(program);
    const since = options.since ? parseInt(options.since, 10) : undefined;

    // Display run header
    console.log("\n");
    console.log(
        gradient.pastel.multiline(
            "╔═════════════════════════════════════╗\n║                                     ║\n║       AGENT MESSAGE STREAMING       ║\n║                                     ║\n╚═════════════════════════════════════╝",
        ),
    );
    console.log(gradient.atlas(`Run ID: ${runId}\n`));

    let lastHeartbeat = Date.now();
    let heartbeatCount = 0;
    let spinner = ora("Waiting for messages...").start();

    const onMessage = (message: AgentMessage) => {
        try {
            // Stop spinner when a message arrives
            spinner.stop();

            // Check if message is completely empty or malformed (heartbeat)
            if (!message || (message && !message.type && !message.message)) {
                const now = Date.now();
                heartbeatCount++;

                // Only show heartbeat every 5 seconds or if more than 5 have accumulated
                if (now - lastHeartbeat > 5000 || heartbeatCount >= 5) {
                    const heartbeatText = chalk.gray(
                        `${logSymbols.info} ${new Date().toISOString()} [HEARTBEAT]: ${heartbeatCount} pings`,
                    );
                    logUpdate(heartbeatText);
                    lastHeartbeat = now;
                    heartbeatCount = 0;

                    // Reset line after brief pause
                    setTimeout(() => {
                        logUpdate.clear();
                        spinner = ora("Waiting for messages...").start();
                    }, 1000);
                }
                return;
            }

            // Clear any heartbeat displays
            logUpdate.clear();

            // Reset heartbeat count when we get a real message
            heartbeatCount = 0;

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
                spinner = ora("Waiting for messages...").start();
                return;
            }

            const messageType = message.type.toLowerCase();
            const icon = typeIcons[messageType as keyof typeof typeIcons] || figures.bullet;
            const colorGradient = typeColors[messageType as keyof typeof typeColors] || gradient.rainbow;
            const type = colorGradient(`${icon} ${message.type.toUpperCase()}`);

            // Handle undefined message content
            if (message.type && !message.message) {
                console.log(`${time} [${type}]: <no content>`);
                spinner = ora("Waiting for messages...").start();
                return;
            }

            const content = formatMessageContent(message.message);

            // Special message formatting based on type
            if (messageType === "error" || messageType === "warning" || messageType === "complete") {
                const boxStyle = boxStyles[messageType as keyof typeof boxStyles];
                const formattedContent = `${time}\n[${type}]:\n\n${content}`;
                console.log(boxen(formattedContent, boxStyle));
            } else {
                console.log(`${time} [${type}]: ${content}`);
            }

            // Format details with indentation and colorized JSON
            if (message.details) {
                formatDetails(message.details);
            }

            // Restart spinner
            spinner = ora("Waiting for messages...").start();
        } catch (err) {
            console.error("Error formatting message:", err);
            console.log("Raw message:", JSON.stringify(message));
            spinner = ora("Waiting for messages...").start();
        }
    };

    try {
        await client.workflows.streamMessages(runId, onMessage, since);
        spinner.stop();
        console.log(
            gradient.summer.multiline(
                "\n╔═════════════════════════════════════╗\n║                                     ║\n║       STREAMING COMPLETE            ║\n║                                     ║\n╚═════════════════════════════════════╝\n",
            ),
        );
    } catch (err) {
        spinner.stop();
        console.error(
            boxen(gradient.fruit("ERROR STREAMING MESSAGES") + "\n\n" + err, {
                padding: 1,
                margin: 1,
                borderStyle: "round" as const,
                borderColor: "red" as const,
                backgroundColor: "#400",
            }),
        );
    }
}

// Helper function to format message content
function formatMessageContent(content: any): string {
    if (typeof content === "string") {
        // Replace escaped newlines with actual newlines
        return content.replace(/\\n/g, "\n");
    } else {
        // For objects, use pretty-printing with actual newlines
        return JSON.stringify(content, null, 2);
    }
}

// Helper function to format details using cli-table3
function formatDetails(details: any): void {
    // Check if details are empty or minimal
    const detailsStr = typeof details === "string" ? details : JSON.stringify(details);

    if (!detailsStr || detailsStr === "{}" || detailsStr === '""') {
        return;
    }

    console.log("");
    console.log(gradient.atlas("DETAILS:"));

    // Create table for object details
    if (typeof details === "object" && details !== null) {
        try {
            // For simple objects, display as key-value table
            if (!Array.isArray(details)) {
                const table = new cliTable({
                    head: [chalk.cyan("Property"), chalk.cyan("Value")],
                    chars: {
                        top: "═",
                        "top-mid": "╤",
                        "top-left": "╔",
                        "top-right": "╗",
                        bottom: "═",
                        "bottom-mid": "╧",
                        "bottom-left": "╚",
                        "bottom-right": "╝",
                        left: "║",
                        "left-mid": "╟",
                        mid: "─",
                        "mid-mid": "┼",
                        right: "║",
                        "right-mid": "╢",
                        middle: "│",
                    },
                    style: {
                        head: [], // No additional styling needed as we've colored the headers
                        border: [], // Keep borders as default color
                    },
                });

                // Add rows for each property
                Object.entries(details).forEach(([key, value]) => {
                    let displayValue: string;

                    if (typeof value === "object" && value !== null) {
                        displayValue = JSON.stringify(value);
                    } else {
                        displayValue = String(value);
                    }

                    // Colorize values based on type
                    if (typeof value === "string") {
                        displayValue = chalk.green(displayValue);
                    } else if (typeof value === "number") {
                        displayValue = chalk.yellow(displayValue);
                    } else if (typeof value === "boolean") {
                        displayValue = chalk.magenta(displayValue);
                    } else if (value === null) {
                        displayValue = chalk.red("null");
                    }

                    table.push([chalk.cyan(key), displayValue]);
                });

                console.log(table.toString());
            } else {
                // For arrays, just use JSON
                console.log(formatColorizedJSON(details));
            }
        } catch (err) {
            // Fall back to colorized JSON if table creation fails
            console.log(formatColorizedJSON(details));
        }
    } else {
        // For non-objects, just display the value
        console.log(detailsStr);
    }

    console.log("");
}

// Helper function to format JSON with colors
function formatColorizedJSON(obj: any): string {
    const jsonString = JSON.stringify(obj, null, 2);

    // Colorize different parts of the JSON
    return jsonString
        .replace(/"([^"]+)":/g, (_, key) => chalk.cyan(`"${key}":`))
        .replace(/: "([^"]+)"/g, (_, value) => `: ${chalk.green(`"${value}"`)}`)
        .replace(/: (\d+)/g, (_, value) => `: ${chalk.yellow(value)}`)
        .replace(/: (true|false)/g, (_, value) => `: ${chalk.magenta(value)}`)
        .replace(/: null/g, `: ${chalk.red("null")}`);
}
