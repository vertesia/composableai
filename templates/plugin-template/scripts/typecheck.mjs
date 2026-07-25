#!/usr/bin/env node
/**
 * Run tsc --noEmit on each project that actually has inputs.
 *
 * The widgets project (tsconfig.widgets.json) only globs skill widget `*.tsx`
 * files. If a plugin removes all example skills (or never ships a widget),
 * `tsc --build` errors with TS18003 ("No inputs were found").
 *
 * This script auto-detects widgets and only runs the widgets typecheck when
 * at least one .tsx file is present, so build checks stay green for both
 * new plugins and plugins that keep widgets.
 */
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import ts from 'typescript';

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

const projects = ['tsconfig.ui.json', 'tsconfig.tool-server.json', 'tsconfig.node.json'];

const legacyWidgetsRoot = join(cwd, 'src', 'tool-server', 'skills');
const modulesRoot = join(cwd, 'src', 'modules');
const hasWidgets =
    hasFileMatching(legacyWidgetsRoot, (name) => name.endsWith('.tsx')) ||
    hasFileMatching(
        modulesRoot,
        (name, full) =>
            name.endsWith('.tsx') && relative(cwd, full).replaceAll('\\', '/').includes('/resources/skills/'),
    );
if (hasWidgets) {
    projects.push('tsconfig.widgets.json');
} else {
    console.log('[typecheck] no skill widget .tsx found, skipping tsconfig.widgets.json');
}

for (const project of projects) {
    if (!existsSync(join(cwd, project))) {
        console.log(`[typecheck] ${project} not found, skipping`);
        continue;
    }
    console.log(`[typecheck] tsc -p ${project} --noEmit`);
    execSync(`tsc -p ${project} --noEmit`, { stdio: 'inherit' });
}

/**
 * Surface `@deprecated` usage as advisory `[deprecation]` lines.
 *
 * `tsc --noEmit` above is the blocking gate (type ERRORS fail the build). It does NOT report
 * deprecated-symbol usage — that is a TypeScript *suggestion* (code 6385), produced only by the
 * language service. We collect those here and print them as non-blocking warnings: deprecations
 * never change the exit code, so they advise without blocking. Wrapped in try/catch so a scan
 * failure can never break the typecheck.
 */
function collectDeprecations(tsconfigPaths) {
    const out = [];
    const seen = new Set();
    for (const project of tsconfigPaths) {
        const cfgPath = join(cwd, project);
        if (!existsSync(cfgPath)) continue;
        const read = ts.readConfigFile(cfgPath, ts.sys.readFile);
        if (read.error) continue;
        const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, dirname(cfgPath));
        if (parsed.fileNames.length === 0) continue;
        const host = {
            getScriptFileNames: () => parsed.fileNames,
            getScriptVersion: () => '1',
            getScriptSnapshot: (f) => {
                const text = ts.sys.readFile(f);
                return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
            },
            getCurrentDirectory: () => cwd,
            getCompilationSettings: () => parsed.options,
            getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
            fileExists: ts.sys.fileExists,
            readFile: ts.sys.readFile,
            readDirectory: ts.sys.readDirectory,
            directoryExists: ts.sys.directoryExists,
            getDirectories: ts.sys.getDirectories,
        };
        const ls = ts.createLanguageService(host, ts.createDocumentRegistry());
        for (const fileName of parsed.fileNames) {
            let diags;
            try {
                diags = ls.getSuggestionDiagnostics(fileName);
            } catch {
                continue;
            }
            for (const d of diags) {
                if (!d.reportsDeprecated || !d.file || d.start == null) continue;
                const pos = d.file.getLineAndCharacterOfPosition(d.start);
                const rel = relative(cwd, d.file.fileName).replace(/\\/g, '/');
                const msg = ts.flattenDiagnosticMessageText(d.messageText, ' ');
                const key = `${rel}:${pos.line + 1}:${pos.character + 1}:${msg}`;
                if (seen.has(key)) continue;
                seen.add(key);
                out.push(`[deprecation] ${rel}:${pos.line + 1}:${pos.character + 1} ${msg}`);
            }
        }
    }
    return out;
}

try {
    const deprecations = collectDeprecations(projects);
    for (const line of deprecations) console.log(line);
    if (deprecations.length > 0) {
        console.log(`[typecheck] ${deprecations.length} deprecation warning(s) — advisory, not blocking.`);
    }
} catch (err) {
    console.log(`[typecheck] deprecation scan skipped: ${err?.message ?? err}`);
}
