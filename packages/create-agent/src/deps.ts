import { spawnSync } from "node:child_process";

const PRIVATE_DEPS = [
    "@dglabs/agent-runner",
]
const DEPS: string[] = [
    "@temporalio/worker",
];
const DEV_DEPS: string[] = [
    "typescript",
    "@types/node",
    "google-artifactregistry-auth",
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
    spawnSync(pm, args, {
        stdio: 'inherit'
    });
}

export function installDeps(pm: "npm" | "pnpm") {
    console.log("Installing dependencies");
    addDevDependencies(pm, DEV_DEPS);
    addDependencies(pm, DEPS);
}

export function installPrivateDeps(pm: "npm" | "pnpm") {
    console.log("Installing dglabs dependencies");
    addDependencies(pm, PRIVATE_DEPS);
}