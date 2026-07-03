/**
 * Runs a transformer against a source file and writes the resulting module
 * as a standalone `.js` chunk inside the lib output.
 *
 * The generated module mirrors the historical code produced by the legacy
 * rollup `load()` hook — it supports `imports`, `code`, and default
 * `export default <data>` payloads — so the runtime behavior of
 * import-transformed builds matches the legacy rollup-based pipeline
 * byte-for-byte.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { AssetFile, TransformerRule } from '../core/types.js';
import type { WidgetMetadata } from '../core/utils/asset-discovery.js';

export interface EmittedChunk {
    /** Absolute path of the written chunk. */
    chunkPath: string;

    /** Generated module source (the same bytes written to `chunkPath`). */
    content: string;

    /** Assets returned by the transformer that should be copied. */
    assets: AssetFile[];

    /** Widget entries returned by the transformer that should be bundled. */
    widgets: WidgetMetadata[];
}

export async function emitChunk(
    srcPath: string,
    chunkPath: string,
    transformer: TransformerRule,
): Promise<EmittedChunk> {
    const content = transformer.virtual ? '' : readFileSync(srcPath, 'utf-8');
    const result = await transformer.transform(content, srcPath);

    if (transformer.schema) {
        const validation = transformer.schema.safeParse(result.data);
        if (!validation.success) {
            const errors = validation.error.issues.map((err) => `  - ${err.path.join('.')}: ${err.message}`).join('\n');
            throw new Error(`Validation failed for ${srcPath}:\n${errors}`);
        }
    }

    const importsBlock = result.imports && result.imports.length > 0 ? `${result.imports.join('\n')}\n\n` : '';
    const body = result.code ?? `export default ${JSON.stringify(result.data, null, 2)};`;
    const moduleCode = importsBlock + body;

    mkdirSync(path.dirname(chunkPath), { recursive: true });
    writeFileSync(chunkPath, moduleCode, 'utf-8');

    return {
        chunkPath,
        content: moduleCode,
        assets: result.assets ?? [],
        widgets: result.widgets ?? [],
    };
}
