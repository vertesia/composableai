/**
 * Vite plugin that transforms Vertesia query-style imports
 * (`?skill`, `?skills`, `?prompt`, `?template`, `?templates`, `?raw`) on the
 * fly during development, plus bare `SKILL.md` / `TEMPLATE.md` imports.
 *
 * This is the dev-mode counterpart to the standalone `transformImports` CLI
 * used at build time. It runs Vite's `resolveId` + `load` hooks against the
 * configured transformers, so the same source files work in both `vite dev`
 * and post-`tsc` build modes.
 *
 * Asset copying and widget bundling are skipped in dev — they're build-time
 * concerns only.
 *
 * @example
 * ```typescript
 * // vite.config.ts
 * import { defineConfig } from 'vite';
 * import { vertesiaDevServerPlugin } from '@vertesia/build-tools/vite';
 *
 * export default defineConfig({
 *     plugins: [vertesiaDevServerPlugin()],
 * });
 * ```
 *
 * Default transformers include all built-ins (skill / skills / template /
 * templates / prompt / raw). Pass `transformers` to restrict the set:
 *
 * ```typescript
 * vertesiaDevServerPlugin({ transformers: ['skill', 'raw'] });
 * ```
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { loadSkillCatalog, readPackageJson, resolveSkillCatalogPath } from '../core/skill-markdown/load-catalog.js';
import type { PreprocessSkillMarkdownOptions } from '../core/skill-markdown/preprocess.js';
import { createSkillTransformer, isSkillTransformer } from '../core/transformers/skill.js';
import type { TransformerRule } from '../core/types.js';
import { BUILTIN_TRANSFORMER_NAMES, resolveTransformerNames } from '../import-transform/builtins.js';

export interface VertesiaDevServerPluginOptions {
    /**
     * Names of transformers to activate. Defaults to all built-ins:
     * `['skill', 'skills', 'template', 'templates', 'prompt', 'raw']`.
     * Pass a subset to disable transformers you don't use.
     */
    transformers?: readonly string[];

    /**
     * Catalog used to resolve `{@tool …}` / `{@skill …}` and validate `tool=`-tagged examples.
     *
     * Defaults to the module named by `vertesia-build.skillCatalog` in the package.json of the
     * Vite root, which is the same key the CLI reads — so dev, test and build agree without the
     * setting being written twice. Pass a path to override it, or an object to supply a catalog
     * directly (useful in tests).
     */
    skillCatalog?: string | PreprocessSkillMarkdownOptions | false;
}

export function vertesiaDevServerPlugin(options: VertesiaDevServerPluginOptions = {}): Plugin {
    const names = options.transformers ?? BUILTIN_TRANSFORMER_NAMES;
    const transformers = resolveTransformerNames([...names]);

    // Resolved once, lazily: the catalog module is compiled output, so it may not exist when the
    // config is first evaluated.
    let root = process.cwd();

    let boundPromise: Promise<TransformerRule | null> | undefined;

    /** The catalog-bound skill transformer, or null when this package configures no catalog. */
    const boundSkillTransformer = (): Promise<TransformerRule | null> => {
        if (!boundPromise) {
            boundPromise = (async () => {
                if (options.skillCatalog === false) return null;
                const markdown =
                    typeof options.skillCatalog === 'object'
                        ? options.skillCatalog
                        : await (async () => {
                              const modulePath =
                                  typeof options.skillCatalog === 'string'
                                      ? path.resolve(root, options.skillCatalog)
                                      : resolveSkillCatalogPath(readPackageJson(root) ?? {}, root);
                              return modulePath ? await loadSkillCatalog(modulePath) : null;
                          })();
                return markdown ? createSkillTransformer({ markdown }) : null;
            })();
        }
        return boundPromise;
    };

    return {
        name: 'vertesia-dev-server',
        enforce: 'pre',

        configResolved(config: { root?: string }) {
            if (config.root) root = config.root;
        },

        /**
         * Map relative query-style imports to absolute paths so Vite's loader
         * sees a stable id keyed by the original file location. The query
         * suffix is preserved in the id and used by `load` to pick the right
         * transformer.
         */
        resolveId(source: string, importer: string | undefined) {
            for (const transformer of transformers) {
                if (!transformer.pattern.test(source)) continue;
                // Only relative specifiers can be resolved meaningfully against an importer.
                if (source.startsWith('.') && importer) {
                    const cleanSource = source.replace(transformer.pattern, '');
                    const cleanImporter = importer.includes('?')
                        ? importer.substring(0, importer.indexOf('?'))
                        : importer;
                    const baseDir = path.dirname(cleanImporter);
                    const resolved = path.resolve(baseDir, cleanSource);
                    const suffix = source.match(transformer.pattern)?.[0] ?? '';
                    return resolved + suffix;
                }
                // Bare or absolute matches are returned as-is.
                return source;
            }
            return null;
        },

        /**
         * Read the source file (skipping reads for virtual transformers),
         * run the matched transformer, and return ES module source code.
         */
        async load(id: string) {
            const matched = findMatchingTransformer(id, transformers);
            if (!matched) return null;

            // Bind the skill transformer to the catalog on first use. Matched by identity rather
            // than by pattern so a consumer's own transformer for the same files is left alone.
            const active = isSkillTransformer(matched) ? ((await boundSkillTransformer()) ?? matched) : matched;

            const cleanId = stripQuery(id);
            try {
                const content = active.virtual ? '' : readFileSync(cleanId, 'utf-8');
                const result = await active.transform(content, cleanId);

                if (active.schema) {
                    const validation = active.schema.safeParse(result.data);
                    if (!validation.success) {
                        const errors = validation.error.issues
                            .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
                            .join('\n');
                        throw new Error(`Validation failed for ${id}:\n${errors}`);
                    }
                }

                const importsBlock =
                    result.imports && result.imports.length > 0 ? `${result.imports.join('\n')}\n\n` : '';
                const body = result.code ?? `export default ${JSON.stringify(result.data, null, 2)};`;
                return importsBlock + body;
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                // Vite/Rollup plugin context: `this.error` halts the load with a meaningful message.
                this.error(`vertesia-dev-server: failed to transform ${id}: ${message}`);
            }
        },
    };
}

function findMatchingTransformer(id: string, transformers: TransformerRule[]): TransformerRule | undefined {
    for (const t of transformers) {
        if (t.pattern.test(id)) return t;
    }
    return undefined;
}

function stripQuery(id: string): string {
    const i = id.indexOf('?');
    return i >= 0 ? id.substring(0, i) : id;
}
