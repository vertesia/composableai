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
import { pathToFileURL } from 'node:url';
import { createSkillTransformer, isSkillTransformer } from '../core/transformers/skill.js';
import type { PreprocessSkillMarkdownOptions } from '../core/skill-markdown/preprocess.js';
import type { TransformerRule } from '../core/types.js';
import { transformImports } from '../import-transform/index.js';
import { resolveConfig, resolveSkillCatalogPath, VertesiaBuildConfigError } from './config.js';

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

/**
 * Load the catalog module named by `vertesia-build.skillCatalog`.
 *
 * The module's default export (or its named `tools`/`skills` exports) supplies the sets the
 * preprocessor resolves against. Arrays are accepted for JSON-friendliness.
 */
async function loadSkillCatalog(modulePath: string): Promise<PreprocessSkillMarkdownOptions> {
    const loaded = (await import(pathToFileURL(modulePath).href)) as Record<string, unknown>;
    const source = (loaded.default ?? loaded) as Partial<PreprocessSkillMarkdownOptions> & {
        tools?: Iterable<string>;
        skills?: Iterable<string>;
        ambiguousTools?: Iterable<string>;
        ambiguousSkills?: Iterable<string>;
        unvalidatableTools?: Iterable<string>;
        exampleLanguages?: Iterable<string>;
    };

    if (!source.tools || !source.skills) {
        fail(`skillCatalog module ${modulePath} must export { tools, skills }.`);
    }
    return {
        tools: new Set(source.tools),
        skills: new Set(source.skills),
        ambiguousTools: source.ambiguousTools ? new Set(source.ambiguousTools) : undefined,
        ambiguousSkills: source.ambiguousSkills ? new Set(source.ambiguousSkills) : undefined,
        unvalidatableTools: source.unvalidatableTools ? new Set(source.unvalidatableTools) : undefined,
        validateExample: source.validateExample,
        skillToolPrefix: source.skillToolPrefix,
        exampleLanguages: source.exampleLanguages ? new Set(source.exampleLanguages) : undefined,
    };
}

async function main(): Promise<void> {
    const cwd = process.cwd();
    const pkg = readPackageJson(cwd);
    let options: ReturnType<typeof resolveConfig>;
    let catalogPath: string | undefined;
    try {
        options = resolveConfig(pkg, cwd);
        catalogPath = resolveSkillCatalogPath(pkg, cwd);
    } catch (error) {
        if (error instanceof VertesiaBuildConfigError) {
            fail(error.message);
        }
        throw error;
    }

    if (catalogPath) {
        const markdown = await loadSkillCatalog(catalogPath);
        const bound = createSkillTransformer({ markdown });
        // Swap by identity, not by pattern: a consumer's own transformer registered for the same
        // files must not be silently replaced by ours.
        const replaced = options.transformers.filter(isSkillTransformer).length;
        if (replaced === 0) {
            fail('skillCatalog is configured but "skill" is not in vertesia-build.transformers.');
        }
        options = {
            ...options,
            transformers: options.transformers.map((rule: TransformerRule) =>
                isSkillTransformer(rule) ? bound : rule,
            ),
        };
        console.log(`vertesia-build: skill catalog loaded (${markdown.tools.size} tools, ${markdown.skills.size} skills)`);
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
