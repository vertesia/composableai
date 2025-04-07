import { AgentMessage, UserInputSignal } from "@vertesia/common";
import chalk from "chalk";
import { getClient } from "../client.js";
import boxen from "boxen";
import ora from "ora";
import gradient from "gradient-string";
import figures from "figures";
import logUpdate from "log-update";
import logSymbols from "log-symbols";
import { initSpeechSynthesis, speakText, voiceSynthConfig } from "./voice.js";
import * as readline from "readline";

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

export async function streamRun(workflowId: string, runId: string, program: any, options: Record<string, any> = {}) {
    const client = getClient(program);
    const since = options.since ? parseInt(options.since, 10) : undefined;
    const interactive = options.interactive === true;

    // Setup cleanup resources
    let spinner: ReturnType<typeof ora> | null = null;
    let isTerminating = false;
    let cleanupTimeouts: NodeJS.Timeout[] = [];
    let streamController: AbortController | null = null;

    // Signal handler function for proper cleanup - use a variable that can be redefined
    let cleanupFn = () => {
        isTerminating = true;

        // Clean up spinner
        if (spinner) {
            spinner.stop();
            spinner = null;
        }

        // Clean up any pending timeouts
        for (const timeout of cleanupTimeouts) {
            clearTimeout(timeout);
        }
        cleanupTimeouts = [];

        // Clear any log update
        logUpdate.clear();

        // Abort any active streams
        if (streamController) {
            streamController.abort();
        }

        // If interactive mode was on, restore stdin to normal mode
        if (interactive) {
            process.stdin.setRawMode?.(false);
            process.stdin.pause();
        }

        // Console message about termination
        console.log(chalk.yellow("\nStream terminated by user (Ctrl+C)"));

        // Ensure the process exits cleanly
        process.exit(0);
    };

    // Set up signal handlers
    const sigintHandler = () => cleanupFn();
    process.on("SIGINT", sigintHandler);
    process.on("SIGTERM", sigintHandler);

    // Initialize speech synthesis
    const speechAvailable = initSpeechSynthesis();
    if (speechAvailable && options.voice === false) {
        voiceSynthConfig.enabled = false;
    } else if (options.voiceSynthesis === true) {
        voiceSynthConfig.enabled = true;
    }

    // Configure voice synthesis if options provided
    if (options.speakTypes) {
        voiceSynthConfig.speakTypes = options.speakTypes.split(",");
    }
    if (options.voiceRate) {
        voiceSynthConfig.rate = parseFloat(options.voiceRate);
    }
    if (options.voicePitch) {
        voiceSynthConfig.pitch = parseFloat(options.voicePitch);
    }
    if (options.voiceVolume) {
        voiceSynthConfig.volume = parseFloat(options.voiceVolume);
    }
    if (options.voiceName) {
        voiceSynthConfig.voice = options.voiceName;
    }

    // Display run header
    console.log("\n");
    console.log(
        gradient.pastel.multiline(
            "╔═════════════════════════════════════╗\n║                                     ║\n║       AGENT MESSAGE STREAMING       ║\n║                                     ║\n╚═════════════════════════════════════╝",
        ),
    );
    console.log(gradient.atlas(`Run ID: ${runId}\n`));

    // Show voice synthesis status
    if (voiceSynthConfig.enabled) {
        console.log(
            gradient.cristal(`Voice Synthesis: Enabled (speaking: ${voiceSynthConfig.speakTypes.join(", ")})\n`),
        );
    } else {
        console.log(chalk.gray(`Voice Synthesis: Disabled\n`));
    }

    let lastHeartbeat = Date.now();
    let heartbeatCount = 0;
    spinner = ora("Waiting for messages...").start();

    const onMessage = (message: AgentMessage) => {
        // Skip processing if we're terminating
        if (isTerminating) return;

        try {
            // Stop spinner when a message arrives
            if (spinner) spinner.stop();

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
                    const timeout = setTimeout(() => {
                        if (isTerminating) return;
                        logUpdate.clear();
                        spinner = ora("Waiting for messages...").start();
                    }, 1000);
                    cleanupTimeouts.push(timeout);
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

            // Speak the message if voice synthesis is enabled
            if (voiceSynthConfig.enabled) {
                speakText(content, messageType);
            }

            // Special message formatting based on type
            if (messageType === "error" || messageType === "warning" || messageType === "complete") {
                const boxStyle = boxStyles[messageType as keyof typeof boxStyles];
                const formattedContent = `${time}\n[${type}]:\n\n${content}`;
                console.log(boxen(formattedContent, boxStyle));
                return Promise.resolve();
            } else {
                console.log(`${time} [${type}]: ${content}`);
            }

            // Check if message details are long plan or complex data
            if (message.details) {
                // Special handling for plans - they can be very long
                if (messageType === "plan" && typeof message.details === "object" && message.details.plan) {
                    console.log(gradient.passion("\n▸ Plan Summary"));

                    try {
                        const plan = Array.isArray(message.details.plan)
                            ? message.details.plan
                            : JSON.parse(message.details.plan);
                        plan.forEach((task: any, index: number) => {
                            console.log(chalk.bold.cyan(`\n${index + 1}. ${task.goal}`));
                            if (task.instructions && Array.isArray(task.instructions)) {
                                task.instructions.forEach((instruction: string) => {
                                    console.log(`   ${chalk.gray("•")} ${instruction}`);
                                });
                            }
                        });
                        console.log(""); // add spacing
                    } catch (e) {
                        // If parsing fails, fall back to standard formatting
                        formatDetails(message.details);
                    }
                } else {
                    formatDetails(message.details);
                }
            }

            // Restart spinner
            if (!isTerminating) {
                spinner = ora("Waiting for messages...").start();
            }
        } catch (err) {
            console.error("Error formatting message:", err);
            console.log("Raw message:", JSON.stringify(message));
            if (!isTerminating) {
                spinner = ora("Waiting for messages...").start();
            }
        }
    };

    streamController = new AbortController();

    // Setup for interactive mode if enabled
    if (interactive) {
        // Initialize readline interface
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: gradient.passion("> "),
        });

        // Set up handler for user input
        rl.on("line", async (input: string) => {
            // Stop the spinner while processing input
            if (spinner) spinner.stop();

            if (input.trim() === "") {
                // Prompt again for empty input
                rl.prompt();
                return;
            }

            try {
                console.log(gradient.atlas(`\nSending message to workflow...`));

                // Send the user input to the workflow run
                const signal = "userInput";
                const payload: UserInputSignal = {
                    message: input,
                };
                await client.workflows.sendSignal(workflowId, runId, signal, payload);

                console.log(gradient.mind(`Message sent successfully!\n`));
            } catch (err) {
                console.error(chalk.red(`Error sending message: ${err}`));
            }

            // Restart spinner and prompt
            if (!isTerminating) {
                spinner = ora("Waiting for messages...").start();
                rl.prompt();
            }
        });

        // Add cleanup for readline interface
        const origCleanup = cleanupFn;
        cleanupFn = () => {
            rl.close();
            origCleanup(); // This includes process.exit(0), so anything after won't execute
            // Never reached due to process.exit in origCleanup
            process.exit(0);
        };

        // Show initial instructions
        console.log(
            gradient.passion("\nInteractive mode enabled. Type messages and press Enter to send to the workflow."),
        );
        console.log(gradient.cristal("Press Ctrl+C to exit.\n"));

        // Start the prompt
        rl.prompt();
    }

    try {
        // Pass abort signal to streamMessages if the API supports it
        // Note: You might need to modify the client implementation to accept this parameter
        await client.workflows.streamMessages(runId, onMessage, since);

        if (!isTerminating) {
            if (spinner) spinner.stop();
            console.log(
                gradient.summer.multiline(
                    "\n╔═════════════════════════════════════╗\n║                                     ║\n║       STREAMING COMPLETE            ║\n║                                     ║\n╚═════════════════════════════════════╝\n",
                ),
            );

            // Close readline if interactive mode was on
            if (interactive) {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout,
                });
                rl.close();
            }
        }
    } catch (err) {
        if (!isTerminating) {
            if (spinner) spinner.stop();
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
    } finally {
        // Always clean up signal handlers when done
        process.off("SIGINT", sigintHandler);
        process.off("SIGTERM", sigintHandler);
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

// Helper function to format details in a cleaner way
function formatDetails(details: any): void {
    // Check if details are empty or minimal
    const detailsStr = typeof details === "string" ? details : JSON.stringify(details);

    if (!detailsStr || detailsStr === "{}" || detailsStr === '""') {
        return;
    }

    console.log("");
    console.log(gradient.atlas("▸ Details"));

    // Create a cleaner display for object details
    if (typeof details === "object" && details !== null) {
        try {
            // For simple objects with small values, display as simple key-value pairs
            if (!Array.isArray(details) && Object.keys(details).length < 10) {
                const longestKey = Math.max(...Object.keys(details).map((k) => k.length));
                const padding = longestKey + 2;

                Object.entries(details).forEach(([key, value]) => {
                    let displayValue: string;
                    let paddedKey = key.padEnd(padding);

                    // Format the value based on its type
                    if (typeof value === "object" && value !== null) {
                        if (JSON.stringify(value).length < 80) {
                            displayValue = JSON.stringify(value);
                        } else {
                            // For longer objects, format with indentation
                            displayValue =
                                "\n" +
                                formatColorizedJSON(value)
                                    .split("\n")
                                    .map((line) => "  " + line)
                                    .join("\n");
                        }
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

                    console.log(`${chalk.cyan(paddedKey)}: ${displayValue}`);
                });
            } else if (Array.isArray(details)) {
                // For arrays with simple values, show in a compact form
                if (details.length > 0 && typeof details[0] !== "object") {
                    console.log(chalk.cyan("["));
                    details.forEach((item, i) => {
                        const displayValue =
                            typeof item === "string"
                                ? chalk.green(`"${item}"`)
                                : typeof item === "number"
                                  ? chalk.yellow(item)
                                  : typeof item === "boolean"
                                    ? chalk.magenta(item)
                                    : item;
                        console.log(`  ${displayValue}${i < details.length - 1 ? "," : ""}`);
                    });
                    console.log(chalk.cyan("]"));
                } else {
                    // For more complex arrays, use the colorized JSON
                    console.log(formatColorizedJSON(details));
                }
            } else {
                // For complex objects, fall back to pretty-printed JSON
                console.log(formatColorizedJSON(details));
            }
        } catch (err) {
            // Fall back to colorized JSON if formatting fails
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
