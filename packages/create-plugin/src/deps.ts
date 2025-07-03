import { runCommand } from "./utils.js";

export function addDevDependencies(pm: "npm" | "pnpm", deps: string[]) {
    _addDependencies(pm, deps, "dev");
}
export function addRuntimeDependencies(pm: "npm" | "pnpm", deps: string[]) {
    _addDependencies(pm, deps, "runtime");
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
