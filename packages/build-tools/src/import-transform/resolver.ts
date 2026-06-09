/**
 * Resolves a query-style import specifier to:
 *   1. the source file path in `src/` (where the original asset lives), and
 *   2. the chunk path in `lib/` (where the generated module will be written),
 *      and the new relative specifier to write back into the importing file.
 *
 * Path mapping rule: lib/ and src/ are mirror trees, so a file at
 * `<libDir>/<rel>` corresponds to `<srcDir>/<rel>`.
 */

import path from 'node:path';

export interface ResolvedImport {
    /** Specifier with any `?query` suffix stripped. */
    cleanSpecifier: string;

    /** Absolute lib/ path of the resolved (extension-preserved) target. */
    resolvedLibPath: string;

    /** Absolute src/ path of the same target. */
    resolvedSrcPath: string;

    /** Absolute lib/ path where the generated chunk will be written. */
    chunkLibPath: string;

    /** Relative specifier (importer-relative) that should replace the original. */
    chunkSpecifier: string;
}

export function resolveImport(
    importerLibPath: string,
    specifier: string,
    libDir: string,
    srcDir: string,
): ResolvedImport {
    const queryIndex = specifier.indexOf('?');
    const cleanSpecifier = queryIndex >= 0 ? specifier.substring(0, queryIndex) : specifier;

    const importerDir = path.dirname(importerLibPath);
    const resolvedLibPath = path.resolve(importerDir, cleanSpecifier);

    const libRoot = path.resolve(libDir);
    const srcRoot = path.resolve(srcDir);
    const relFromLib = path.relative(libRoot, resolvedLibPath);
    const resolvedSrcPath = path.join(srcRoot, relFromLib);

    const chunkLibPath = `${resolvedLibPath}.js`;
    const chunkSpecifier = `${cleanSpecifier}.js`;

    return {
        cleanSpecifier,
        resolvedLibPath,
        resolvedSrcPath,
        chunkLibPath,
        chunkSpecifier,
    };
}
