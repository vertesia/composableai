/**
 * This is a generated file. Do not modify.
 */
import { resolveScriptFile, run } from "@dglabs/agent-runner";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from 'path';

const pkg = readPackageJson();

let domain = `agents/${pkg.name}`;
if (pkg.vertesia?.image?.organization) {
    if (pkg.vertesia.image.name) {
        domain = `agents/${pkg.vertesia.image.organization}/${pkg.vertesia.image.name}`;
    }
}

const workflowBundle = await resolveScriptFile("./workflows-bundle.js", import.meta.url);
const activities = await import("./activities.js");

await run({
    workflowBundle,
    activities,
    domain
}).catch((err: any) => {
    console.error(err);
}).finally(() => {
    process.exit(0);
});


function readPackageJson() {
    const scriptPath = fileURLToPath(import.meta.url);
    const pkgFile = resolve(dirname(scriptPath), '../package.json')
    const content = readFileSync(pkgFile, "utf8");
    return JSON.parse(content);
}
