import { getDockerCredentials } from "./docker.js";
import fs from "node:fs";

// Function to handle other commands (`store`, `erase`, `list`)
function handleNoOp() {
    // Docker expects these commands to exit with 0
    process.exit(0);
}

// Function to handle the `get` command
async function handleGet(serverUrl: string) {
    console.log(">>>>>>>>> get token for push", serverUrl, process.cwd());
    process.exit(1); //TODO
    try {
        const credentials = await getDockerCredentials(serverUrl);
        process.stdout.write(JSON.stringify(credentials));
    } catch (error: any) {
        console.error("Error fetching credentials:", error.message);
        process.exit(1);
    }
}


// Main function to handle input
function main() {
    const command = process.argv[2];

    if (!command) {
        console.error("No command provided");
        process.exit(1);
    }

    switch (command) {
        case "get":
            const stdin = fs.readFileSync(0, "utf-8");
            const { ServerURL } = JSON.parse(stdin);
            handleGet(ServerURL);
            break;

        case "store":
        case "erase":
        case "list":
            handleNoOp();
            break;

        default:
            console.error(`Unknown command: ${command}`);
            process.exit(1);
    }
}

main();