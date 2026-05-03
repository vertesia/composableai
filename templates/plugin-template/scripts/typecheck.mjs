#!/usr/bin/env node
/**
 * Run tsc --noEmit on each project that actually has inputs.
 *
 * The widgets project (tsconfig.widgets.json) only globs `*.tsx` files under
 * `src/tool-server/skills/`. If a plugin removes all example skills (or never
 * ships a widget), `tsc --build` errors with TS18003 ("No inputs were found").
 *
 * This script auto-detects widgets and only runs the widgets typecheck when
 * at least one .tsx file is present, so the prebuild stays green for both
 * new plugins and plugins that keep widgets.
 */
import { execSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const cwd = process.cwd();

function hasFileMatching(dir, predicate) {
    if (!existsSync(dir)) return false;
    const entries = readdirSync(dir);
    for (const name of entries) {
        const full = join(dir, name);
        const st = statSync(full);
        if (st.isDirectory()) {
            if (hasFileMatching(full, predicate)) return true;
        } else if (predicate(name, full)) {
            return true;
        }
    }
    return false;
}

const projects = [
    "tsconfig.ui.json",
    "tsconfig.tool-server.json",
    "tsconfig.node.json",
];

const widgetsRoot = join(cwd, "src", "tool-server", "skills");
const hasWidgets = hasFileMatching(widgetsRoot, (name) => name.endsWith(".tsx"));
if (hasWidgets) {
    projects.push("tsconfig.widgets.json");
} else {
    console.log("[typecheck] no widget .tsx found under src/tool-server/skills/, skipping tsconfig.widgets.json");
}

for (const project of projects) {
    if (!existsSync(join(cwd, project))) {
        console.log(`[typecheck] ${project} not found, skipping`);
        continue;
    }
    console.log(`[typecheck] tsc -p ${project} --noEmit`);
    execSync(`tsc -p ${project} --noEmit`, { stdio: "inherit" });
}
