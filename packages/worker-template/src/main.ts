/**
 * Worker entry point.
 *
 * This file initializes and runs the Temporal worker that executes
 * your workflows and activities on the Vertesia platform.
 */
import { resolveScriptFile, run } from "@dglabs/worker";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

interface VertesiaConfig {
    name: string;
    vertesia?: {
        image?: {
            organization?: string;
            name?: string;
        };
    };
}

const pkg = readPackageJson();

// Construct the worker domain from package.json configuration
// Format: agents/{organization}/{worker-name}
let domain = `agents/${pkg.name}`;

if (pkg.vertesia?.image?.organization) {
    if (pkg.vertesia.image.name) {
        domain = `agents/${pkg.vertesia.image.organization}/${pkg.vertesia.image.name}`;
    }
}

// Load the bundled workflow code
const workflowBundle = await resolveScriptFile(
    "./workflows-bundle.js",
    import.meta.url
);

// Import activities module
const activities = await import("./activities.js");

// Start the worker
await run({
    workflowBundle,
    activities,
    domain,
    local: process.env.IS_LOCAL_DEV === "true",
})
    .catch((err: unknown) => {
        console.error(err);
    })
    .finally(() => {
        process.exit(0);
    });

function readPackageJson(): VertesiaConfig {
    const scriptPath = fileURLToPath(import.meta.url);
    const pkgFile = resolve(dirname(scriptPath), "../package.json");
    const content = readFileSync(pkgFile, "utf8");
    return JSON.parse(content) as VertesiaConfig;
}
