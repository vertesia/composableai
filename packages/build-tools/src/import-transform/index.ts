/**
 * Standalone import transformer for Vertesia query-style imports.
 *
 * Replaces the build-time work that `vertesiaImportPlugin` used to perform
 * inside a rollup pipeline. Operates directly on the JavaScript output of
 * `tsc`:
 *
 *   1. Walk `libDir` for `.js` files containing query imports.
 *   2. For each occurrence, resolve back to the corresponding source asset
 *      under `srcDir`, run the transformer, and write the generated module
 *      as a sibling chunk in `libDir`.
 *   3. Rewrite the importing file in place so the original `?skill` /
 *      `SKILL.md` specifier points at the new chunk.
 *   4. Copy any transformer-declared assets (scripts, handlebars, …) and
 *      bundle any discovered widget `.tsx` siblings via esbuild.
 *
 * Emitted chunks are re-scanned for nested query imports (e.g. a `?skills`
 * collection chunk that imports `SKILL.md` siblings), so the pipeline
 * matches rollup's recursive resolveId/load behavior.
 */

import path from 'node:path';
import { compileWidgets, type WidgetCompilerConfig } from '../core/compilers/widget.js';
import type { AssetFile, TransformerRule } from '../core/types.js';
import { copyAssets } from '../core/utils/asset-copy.js';
import type { WidgetMetadata } from '../core/utils/asset-discovery.js';
import { emitChunk } from './chunk-emitter.js';
import { detectQueryImports } from './detector.js';
import { SNIFF_PATTERN } from './patterns.js';
import { resolveImport } from './resolver.js';
import { type ImportReplacement, writeRewrittenFile } from './rewriter.js';
import { scanLibForQueryImports } from './scanner.js';

export interface TransformImportsOptions {
    /** Root of the compiled JavaScript output (e.g. `./lib`). */
    libDir: string;

    /** Root of the original sources, mirroring `libDir` (e.g. `./src`). */
    srcDir: string;

    /** Transformers to apply. */
    transformers: TransformerRule[];

    /**
     * Root directory where script assets are copied and widgets are written.
     * - String: assets and widgets are emitted under this directory.
     * - `false`: asset copying and widget compilation are skipped.
     * - Default: `libDir` (so widgets land in `lib/<widgetsDir>/`).
     */
    assetsDir?: string | false;

    /** Sub-directory under `assetsDir` for widget bundles. Default: 'widgets'. */
    widgetsDir?: string;

    /** Configuration forwarded to the esbuild widget bundler. */
    widgetConfig?: WidgetCompilerConfig;
}

export interface TransformImportsResult {
    filesProcessed: number;
    chunksEmitted: number;
    assetsCopied: number;
    widgetsCompiled: number;
}

interface WorkItem {
    path: string;
    content: string;
}

export async function transformImports(opts: TransformImportsOptions): Promise<TransformImportsResult> {
    const { libDir, srcDir, transformers, widgetsDir = 'widgets', widgetConfig } = opts;
    const assetsDir = opts.assetsDir === undefined ? libDir : opts.assetsDir;
    const shouldCopyAssets = assetsDir !== false;
    const shouldCompileWidgets = assetsDir !== false;

    if (!transformers || transformers.length === 0) {
        throw new Error('transformImports: At least one transformer must be configured');
    }

    const seenFiles = new Set<string>();
    const workQueue: WorkItem[] = [];

    for (const file of scanLibForQueryImports(libDir)) {
        if (!seenFiles.has(file.path)) {
            seenFiles.add(file.path);
            workQueue.push(file);
        }
    }

    const emittedChunks = new Set<string>();
    const seenWidgets = new Map<string, WidgetMetadata>();
    const assetsToCopy: AssetFile[] = [];
    let chunksEmitted = 0;
    let filesProcessed = 0;

    while (workQueue.length > 0) {
        const file = workQueue.shift() as WorkItem;
        const occurrences = detectQueryImports(file.content, transformers);
        if (occurrences.length === 0) {
            continue;
        }

        const replacements: ImportReplacement[] = [];

        for (const occ of occurrences) {
            const resolved = resolveImport(file.path, occ.specifier, libDir, srcDir);

            if (!emittedChunks.has(resolved.chunkLibPath)) {
                const emitted = await emitChunk(resolved.resolvedSrcPath, resolved.chunkLibPath, occ.transformer);
                emittedChunks.add(resolved.chunkLibPath);
                chunksEmitted++;

                if (emitted.assets.length > 0 && shouldCopyAssets) {
                    assetsToCopy.push(...emitted.assets);
                }
                if (emitted.widgets.length > 0 && shouldCompileWidgets) {
                    for (const widget of emitted.widgets) {
                        if (!seenWidgets.has(widget.path)) {
                            seenWidgets.set(widget.path, widget);
                        }
                    }
                }

                // Chunks may themselves contain query imports (e.g. ?skills
                // collection chunks emit `import './foo/SKILL.md'` lines).
                if (SNIFF_PATTERN.test(emitted.content) && !seenFiles.has(resolved.chunkLibPath)) {
                    seenFiles.add(resolved.chunkLibPath);
                    workQueue.push({ path: resolved.chunkLibPath, content: emitted.content });
                }
            }

            replacements.push({
                quoteStart: occ.quoteStart,
                quoteEnd: occ.quoteEnd,
                quote: occ.quote,
                newSpecifier: resolved.chunkSpecifier,
            });
        }

        if (writeRewrittenFile(file.path, file.content, replacements)) {
            filesProcessed++;
        }
    }

    let assetsCopied = 0;
    if (shouldCopyAssets && assetsToCopy.length > 0) {
        assetsCopied = copyAssets(assetsToCopy, assetsDir as string);
    }

    let widgetsCompiled = 0;
    if (shouldCompileWidgets && seenWidgets.size > 0) {
        const widgetInputs = Array.from(seenWidgets.values()).map((widget) => ({
            name: widget.name,
            entry: mapSrcWidgetToLib(widget.path, srcDir, libDir),
        }));
        const widgetOutput = path.join(assetsDir as string, widgetsDir);
        widgetsCompiled = await compileWidgets(widgetInputs, widgetOutput, widgetConfig);
    }

    return { filesProcessed, chunksEmitted, assetsCopied, widgetsCompiled };
}

/**
 * Map a widget `.tsx` source path to its tsc-compiled `.js` counterpart in lib/.
 */
function mapSrcWidgetToLib(srcTsxPath: string, srcDir: string, libDir: string): string {
    const srcRoot = path.resolve(srcDir);
    const libRoot = path.resolve(libDir);
    const rel = path.relative(srcRoot, srcTsxPath);
    const libRel = rel.replace(/\.tsx$/, '.js');
    return path.join(libRoot, libRel);
}
