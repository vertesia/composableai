import { mkdir, writeFile } from "node:fs/promises";
import { buildAppPackage } from "@vertesia/tools-sdk";
import { ServerConfig } from "../lib/config.js";

function names(items, selector) {
    return (items || []).map(selector).filter(Boolean).sort();
}

function summarizeAppPackage(pkg) {
    const tools = names(pkg.tools, (tool) => tool.name);
    return {
        ui: Boolean(pkg.ui),
        settings: Boolean(pkg.settings_schema),
        tools: tools.filter((name) => !name.startsWith("learn_")),
        skills: tools.filter((name) => name.startsWith("learn_")),
        interactions: names(pkg.interactions, (interaction) => interaction.id || interaction.name),
        types: names(pkg.types, (type) => type.id || type.name),
        processes: names(pkg.processes, (process) => process.id || process.name),
        templates: names(pkg.templates, (template) => template.id || template.name || template.path),
        dashboards: names(pkg.dashboards, (dashboard) => dashboard.id || dashboard.name),
        widgets: Object.keys(pkg.widgets || {}).sort(),
        activities: names(pkg.activities, (activity) =>
            activity.collection ? `${activity.collection}:${activity.name}` : activity.name
        ),
    };
}

function printSummary(summary) {
    console.log("App package artifacts:");
    for (const [key, value] of Object.entries(summary)) {
        if (Array.isArray(value)) {
            console.log(`  ${key}: ${value.length}${value.length > 0 ? ` (${value.join(", ")})` : ""}`);
        } else {
            console.log(`  ${key}: ${value ? "yes" : "no"}`);
        }
    }
}

await mkdir("dist", { recursive: true });

const pkg = await buildAppPackage(ServerConfig, {
    scope: "all",
    origin: "https://app-package-build.local",
});
const summary = summarizeAppPackage(pkg);

await writeFile("dist/app-package.json", `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile("dist/app-package-summary.json", `${JSON.stringify(summary, null, 2)}\n`);
printSummary(summary);
