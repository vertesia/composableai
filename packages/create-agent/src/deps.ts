import { runCommand } from "./utils.js";

const DEPS: string[] = [
    "@dglabs/agent-runner",
    "@temporalio/worker",
    "@temporalio/workflow"
];
const DEV_DEPS: string[] = [
    "typescript",
    "@types/node",
    "vitest",
    "rimraf"
];

function addDependencies(pm: "npm" | "pnpm", deps: string[]) {
    _addDependencies(pm, deps, "runtime");
}
function addDevDependencies(pm: "npm" | "pnpm", deps: string[]) {
    _addDependencies(pm, deps, "dev");
}
function _addDependencies(pm: "npm" | "pnpm", deps: string[], type: "dev" | "runtime" = "runtime") {
    const args = [
        pm === "pnpm" ? "add" : "install"
    ];
    if (type === "dev") {
        args.push('-D');
    }
    for (const dep of deps) {
        args.push(dep)
    }
    runCommand(pm, args);
}

export function installDeps(pm: "npm" | "pnpm") {
    console.log("Installing dependencies");
    addDevDependencies(pm, DEV_DEPS);
    addDependencies(pm, DEPS);
}
