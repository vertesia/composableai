import { runCommand } from "./utils.js";

const DEV_DEPS: string[] = [
    "@vertesia/ui",
    "@vertesia/vite-plugin-export-css",
    "@eslint/js",
    "@tailwindcss/vite",
    "@types/node",
    "@types/react",
    "@types/react-dom",
    "@vitejs/plugin-react",
    "eslint",
    "eslint-plugin-react-hooks",
    "eslint-plugin-react-refresh",
    "globals",
    "react",
    "react-dom",
    "tailwindcss",
    "typescript",
    "typescript-eslint",
    "vite",
    "vite-plugin-dts",
];

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
}
