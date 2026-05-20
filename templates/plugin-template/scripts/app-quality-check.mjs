#!/usr/bin/env node
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const cwd = process.cwd();
const allowAdminShell = process.env.APPGEN_ALLOW_INTERNAL_APP_SHELL === "true";
const blockedAdminShellTokens = [
    String.fromCharCode(65, 100, 109, 105, 110, 65, 112, 112),
    ["@ver", "tesia/", "tools-", "admin-", "ui"].join(""),
];
const report = {
    ok: true,
    scanned_files: 0,
    errors: [],
    warnings: [],
};

function rel(file) {
    return path.relative(cwd, file).replaceAll(path.sep, "/");
}

async function walk(root) {
    if (!existsSync(root)) return [];
    const out = [];
    async function visit(dir) {
        for (const entry of await readdir(dir)) {
            if (entry === "node_modules" || entry === "dist" || entry === ".git") continue;
            const full = path.join(dir, entry);
            const info = await stat(full);
            if (info.isDirectory()) {
                await visit(full);
            } else {
                out.push(full);
            }
        }
    }
    await visit(root);
    return out;
}

function add(kind, rule, message, file) {
    const item = { rule, message, file: file ? rel(file) : undefined };
    report[kind].push(item);
}

function includesAny(text, values) {
    return values.some((value) => text.includes(value));
}

function isSourceFile(file) {
    return /\.(ts|tsx|js|jsx|mjs|cjs|hbs|md|yaml|yml)$/.test(file);
}

const allFiles = (await walk(path.join(cwd, "src"))).filter(isSourceFile);
report.scanned_files = allFiles.length;

const uiFiles = allFiles.filter((file) => rel(file).startsWith("src/ui/"));
const appUiFiles = allFiles.filter((file) => rel(file).startsWith("src/ui/app/"));
const toolServerFiles = allFiles.filter((file) => rel(file).startsWith("src/tool-server/"));
const interactionFiles = toolServerFiles.filter((file) => rel(file).includes("/interactions/"));
const processFiles = toolServerFiles.filter((file) => rel(file).includes("/processes/"));

for (const file of uiFiles) {
    const text = await readFile(file, "utf8");

    if (!allowAdminShell && includesAny(text, blockedAdminShellTokens)) {
        add(
            "errors",
            "no-admin-shell-leakage",
            "Normal app UI must render src/ui/app, not an internal vendor admin shell.",
            file,
        );
    }

    if (/from\s+["']react-router-dom["']|import\s*\(\s*["']react-router-dom["']/.test(text)) {
        add("errors", "no-react-router-dom", "Use @vertesia/ui/router instead of react-router-dom.", file);
    }

    if (/@tanstack\/react-query/.test(text)) {
        add("errors", "no-react-query", "Use the Vertesia UI/session data patterns instead of react-query.", file);
    }

    if (/fetch\s*\(\s*["'`]\/api(?:\/v1|\/interactions|\/tools|\/package|\/processes|\/)?/.test(text)) {
        add(
            "errors",
            "no-same-origin-api-fetch",
            "Normal app screens must use useUserSession().client instead of same-origin /api fetches.",
            file,
        );
    }
}

for (const file of appUiFiles) {
    const text = await readFile(file, "utf8");

    if (/\b[0-9a-f]{24}\b/i.test(text)) {
        add(
            "errors",
            "no-hardcoded-object-ids",
            "Do not hardcode project-local Mongo ObjectIds in app UI; resolve app-owned refs or query data.",
            file,
        );
    }

    if (/\(client\s+as\s+any\)|as\s+any\)\.objects|as\s+any\)\.agents|as\s+any\)\.interactions/.test(text)) {
        add("errors", "no-client-any", "Do not use broad client as any/introspection shortcuts in final UI code.", file);
    }

    if (/\bconsole\.(log|debug)\s*\(/.test(text)) {
        add("errors", "no-debug-console", "Remove console.log/console.debug from final UI code.", file);
    }

    if (/window\.location\.href\s*=/.test(text)) {
        add(
            "errors",
            "mount-safe-navigation",
            "Avoid window.location.href redirects; use app router/navigation that stays under the /app/ mount.",
            file,
        );
    }
}

for (const file of interactionFiles) {
    const text = await readFile(file, "utf8");

    if (/TemplateType\.(jst|text)|content_type\s*:\s*["'](?:jst|text)["']/.test(text)) {
        add(
            "errors",
            "hbs-prompts-required",
            "App-owned interactions/prompts must use Handlebars content_type, not JST or plain text.",
            file,
        );
    }

    if (/prompts\s*:\s*\[/.test(text) && !/\.hbs\?prompt/.test(text)) {
        add(
            "warnings",
            "prefer-hbs-prompt-files",
            "Prefer .hbs?prompt files with YAML frontmatter over inline TypeScript prompt arrays.",
            file,
        );
    }

    if (/PromptRole\.system|role\s*:\s*["']system["']/.test(text) && !text.includes("{{_now}}")) {
        add(
            "warnings",
            "system-prompt-now",
            "Agent/system prompts should include Today's date is {{_now}}.",
            file,
        );
    }
}

for (const file of toolServerFiles.filter((item) => item.endsWith(".hbs"))) {
    const text = await readFile(file, "utf8");
    const looksLikeSystemPrompt = /role:\s*system|PromptRole\.system|You are\b/i.test(text);
    if (looksLikeSystemPrompt && !text.includes("{{_now}}")) {
        add(
            "warnings",
            "system-prompt-now",
            "Agent/system prompt files should include Today's date is {{_now}}.",
            file,
        );
    }
}

const hasProcessYaml = processFiles.some((file) => /\.(ya?ml)$/.test(file));
const hasProcessTs = processFiles.some((file) => /\.(ts|tsx)$/.test(file));
if (hasProcessTs && !hasProcessYaml) {
    add(
        "warnings",
        "prefer-process-yaml",
        "Prefer YAML/YML source definitions for non-trivial app-owned processes and register the parsed definition.",
        path.join(cwd, "src/tool-server/processes"),
    );
}

report.ok = report.errors.length === 0;

await mkdir(path.join(cwd, "dist"), { recursive: true });
await writeFile(path.join(cwd, "dist", "app-quality-report.json"), `${JSON.stringify(report, null, 2)}\n`);

for (const item of report.errors) {
    console.error(`[app-quality:error] ${item.rule}${item.file ? ` ${item.file}` : ""}: ${item.message}`);
}
for (const item of report.warnings) {
    console.warn(`[app-quality:warning] ${item.rule}${item.file ? ` ${item.file}` : ""}: ${item.message}`);
}

if (!report.ok) {
    console.error(
        `[app-quality] failed with ${report.errors.length} error(s) and ${report.warnings.length} warning(s). See dist/app-quality-report.json.`,
    );
    process.exit(1);
}

console.log(
    `[app-quality] passed (${report.scanned_files} files, ${report.warnings.length} warning(s)). Report: dist/app-quality-report.json`,
);
