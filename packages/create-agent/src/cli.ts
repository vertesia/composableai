import enquirer from "enquirer";
import { hasBin } from "./hasBin.js";
import { runCommand } from "./utils.js";

const { prompt } = enquirer;

const VERTESIA_CLI_PKGNAME = "@vertesia/cli";
const VERTESIA_CLI = "vertesia";

export { VERTESIA_CLI };

export async function installOrUpdateCli(pm: string) {
    const hasCli = await hasBin(VERTESIA_CLI);
    if (hasCli) {
        // try update cli if needed
        console.log("Checking new versions for Vertesia CLI");
        runCommand(VERTESIA_CLI, ["upgrade", "-y"]);
    } else {
        // install cli
        console.log("Installing Vertesia CLI");
        runCommand(pm, ["add", "-g", VERTESIA_CLI_PKGNAME]);
    }
}

export async function connectToVertesia() {
    // use existing profile or create a new one

    const answer: any = await prompt({
        name: "auth",
        type: "confirm",
        initial: true,
        message: "You must connect to a Vertesia project. Do you want to proceed?"
    })

    if (!answer.auth) {
        console.log('Bye.');
        process.exit(2);
    }

    runCommand(VERTESIA_CLI, ["agent", "connect"]);
}