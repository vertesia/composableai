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
import { resolveTransformerNames } from '../import-transform/builtins.js';
import { type TransformImportsOptions, transformImports } from '../import-transform/index.js';

interface RawConfig {
    libDir?: unknown;
    srcDir?: unknown;
    transformers?: unknown;
    assetsDir?: unknown;
    widgetsDir?: unknown;
    widgetConfig?: unknown;
}

interface ResolvedConfig extends TransformImportsOptions {}

const CONFIG_KEY = 'vertesia-build';

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

function resolveConfig(cwd: string): ResolvedConfig {
    const pkg = readPackageJson(cwd);
    const raw = pkg[CONFIG_KEY];

    if (raw === undefined) {
        fail(`missing "${CONFIG_KEY}" key in package.json at ${cwd}.`);
    }
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        fail(`"${CONFIG_KEY}" must be an object in package.json.`);
    }
    const cfg = raw as RawConfig;

    if (typeof cfg.libDir !== 'string' || cfg.libDir.length === 0) {
        fail(`"${CONFIG_KEY}.libDir" must be a non-empty string.`);
    }
    if (typeof cfg.srcDir !== 'string' || cfg.srcDir.length === 0) {
        fail(`"${CONFIG_KEY}.srcDir" must be a non-empty string.`);
    }
    if (!Array.isArray(cfg.transformers) || cfg.transformers.length === 0) {
        fail(`"${CONFIG_KEY}.transformers" must be a non-empty array of transformer names.`);
    }
    const names: string[] = [];
    for (const entry of cfg.transformers) {
        if (typeof entry !== 'string' || entry.length === 0) {
            fail(`every entry in "${CONFIG_KEY}.transformers" must be a non-empty string.`);
        }
        names.push(entry);
    }

    let transformers: TransformImportsOptions['transformers'];
    try {
        transformers = resolveTransformerNames(names);
    } catch (error) {
        fail((error as Error).message);
    }

    const resolved: ResolvedConfig = {
        libDir: path.resolve(cwd, cfg.libDir),
        srcDir: path.resolve(cwd, cfg.srcDir),
        transformers,
    };

    if (cfg.assetsDir !== undefined) {
        if (cfg.assetsDir === false) {
            resolved.assetsDir = false;
        } else if (typeof cfg.assetsDir === 'string' && cfg.assetsDir.length > 0) {
            resolved.assetsDir = path.resolve(cwd, cfg.assetsDir);
        } else {
            fail(`"${CONFIG_KEY}.assetsDir" must be a string path or false.`);
        }
    }

    if (cfg.widgetsDir !== undefined) {
        if (typeof cfg.widgetsDir !== 'string' || cfg.widgetsDir.length === 0) {
            fail(`"${CONFIG_KEY}.widgetsDir" must be a non-empty string when set.`);
        }
        resolved.widgetsDir = cfg.widgetsDir;
    }

    if (cfg.widgetConfig !== undefined) {
        if (typeof cfg.widgetConfig !== 'object' || cfg.widgetConfig === null || Array.isArray(cfg.widgetConfig)) {
            fail(`"${CONFIG_KEY}.widgetConfig" must be an object when set.`);
        }
        resolved.widgetConfig = cfg.widgetConfig as TransformImportsOptions['widgetConfig'];
    }

    return resolved;
}

async function main(): Promise<void> {
    const cwd = process.cwd();
    const options = resolveConfig(cwd);
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
