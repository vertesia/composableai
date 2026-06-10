#!/usr/bin/env node

/**
 * `vertesia-build` — Vertesia plugin build CLI.
 *
 * Today this runs the post-`tsc` finalization step: import transformation
 * (`?skill` / `?raw` / `?prompt` / `?template` / `?skills` / `?templates`
 * and bare `SKILL.md` / `TEMPLATE.md` imports), asset copying, and esbuild
 * widget bundling.
 *
 * Reads its configuration from the consuming package's `package.json` under
 * the `vertesia-build` key, then delegates to `transformImports` in
 * `@vertesia/build-tools`.
 *
 * Usage in a plugin's package.json:
 *
 *     {
 *         "scripts": {
 *             "build:server": "tsc -p tsconfig.tool-server.json && vertesia-build"
 *         },
 *         "vertesia-build": {
 *             "libDir": "./lib",
 *             "srcDir": "./src/tool-server",
 *             "transformers": ["skill", "skills", "template", "templates", "prompt", "raw"],
 *             "assetsDir": "./dist",
 *             "widgetsDir": "widgets",
 *             "widgetConfig": { "minify": false }
 *         }
 *     }
 *
 * Available transformer names: skill, skills, template, templates, prompt, raw.
 * The `transformers` field is required so consumers explicitly opt in to each
 * preset (and so missing or misspelled names fail loudly at build time).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { transformImports } from '../import-transform/index.js';
import { resolveConfig, VertesiaBuildConfigError } from './config.js';

function fail(message: string): never {
    console.error(`vertesia-build: ${message}`);
    process.exit(1);
}

function readPackageJson(cwd: string): Record<string, unknown> {
    const pkgPath = path.join(cwd, 'package.json');
    let raw: string;
    try {
        raw = readFileSync(pkgPath, 'utf-8');
    } catch (error) {
        fail(`could not read ${pkgPath}: ${(error as Error).message}`);
    }
    try {
        return JSON.parse(raw) as Record<string, unknown>;
    } catch (error) {
        fail(`could not parse ${pkgPath}: ${(error as Error).message}`);
    }
}

async function main(): Promise<void> {
    const cwd = process.cwd();
    const pkg = readPackageJson(cwd);
    let options;
    try {
        options = resolveConfig(pkg, cwd);
    } catch (error) {
        if (error instanceof VertesiaBuildConfigError) {
            fail(error.message);
        }
        throw error;
    }
    const result = await transformImports(options);
    console.log(
        `vertesia-build: files=${result.filesProcessed} chunks=${result.chunksEmitted} ` +
            `assets=${result.assetsCopied} widgets=${result.widgetsCompiled}`,
    );
}

main().catch((error) => {
    console.error(`vertesia-build: ${(error as Error).stack ?? (error as Error).message}`);
    process.exit(1);
});
