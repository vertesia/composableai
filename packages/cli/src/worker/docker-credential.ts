import { getDockerCredentials } from "./docker.js";
import fs from "node:fs";

// Function to handle other commands (`store`, `erase`, `list`)
function handleNoOp() {
    // Docker expects these commands to exit with 0
    process.exit(0);
}

// Function to handle the `get` command
async function handleGet(serverUrl: string) {
    // we support us-docker.pkg.dev for now
    if (!serverUrl.endsWith("-docker.pkg.dev")) {
        process.exit(0); // ignore
    }
    try {
        const credentials = await getDockerCredentials(serverUrl);
        if (process.env.DEBUG_DOCKER_CREDS) {
            fs.writeFileSync("./docker-creds-helper.log", "Get token for registry " + serverUrl + " => " + JSON.stringify(credentials, null, 2), "utf8");
        }
        process.stdout.write(JSON.stringify(credentials));
    } catch (error: any) {
        fs.writeFileSync("./docker-creds-helper-error.log", "Get token for registry " + serverUrl + " => " + JSON.stringify(error, null, 2), "utf8");
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
            handleGet(stdin.trim());
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