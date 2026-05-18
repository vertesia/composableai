/**
 * Widget compilation utility using Rollup
 */

import { rollup, type RollupOptions, type Plugin } from 'rollup';
import path from 'node:path';
import type { WidgetConfig } from '../types.js';
import type { WidgetMetadata } from './asset-discovery.js';

/**
 * Default external dependencies for widgets
 */
const DEFAULT_EXTERNALS = [
    'react',
    'react-dom',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    'react-dom/client'
];

/**
 * Compile widgets using Rollup
 *
 * @param widgets - Array of widget metadata to compile
 * @param outputDir - Directory to write compiled widgets
 * @param config - Widget compilation configuration
 * @returns Number of widgets compiled
 */
export async function compileWidgets(
    widgets: WidgetMetadata[],
    outputDir: string,
    config: WidgetConfig = {}
): Promise<number> {
    if (widgets.length === 0) {
        return 0;
    }

    const {
        external = DEFAULT_EXTERNALS,
        tsconfig = './tsconfig.json',
        typescript: typescriptOptions = {},
        minify = false
    } = config;

    // Build each widget separately to get individual bundles
    const buildPromises = widgets.map(async (widget) => {
        // Dynamically import plugins - use any to bypass TypeScript module resolution issues
        const typescript = (await import('@rollup/plugin-typescript' as any)).default as any;
        const nodeResolve = (await import('@rollup/plugin-node-resolve' as any)).default as any;
        const commonjs = (await import('@rollup/plugin-commonjs' as any)).default as any;
        // @rollup/plugin-json — required when widgets transitively import JSON files,
        // e.g. @vertesia/ui pulls in i18n locale JSON via lib/esm/i18n/locales/*.json.
        // Without this, Rollup tries to parse JSON as JS and bails.
        const json = (await import('@rollup/plugin-json' as any)).default as any;

        const plugins: Plugin[] = [
            typescript({
                tsconfig,
                declaration: false,
                sourceMap: true,
                ...typescriptOptions
            }),
            // Order matters: json must come before node-resolve so .json imports
            // are handled by it rather than fed to the default loader.
            json(),
            nodeResolve({
                browser: true,
                preferBuiltins: false,
                extensions: ['.tsx', '.ts', '.jsx', '.js']
            }),
            commonjs()
        ];

        // Add minification if requested
        if (minify) {
            const terser = (await import('@rollup/plugin-terser' as any)).default as any;
            plugins.push(
                terser({
                    compress: {
                        drop_console: false
                    }
                })
            );
        }

        const rollupConfig: RollupOptions = {
            input: widget.path,
            output: {
                file: path.join(outputDir, `${widget.name}.js`),
                format: 'es',
                sourcemap: true,
                inlineDynamicImports: true
            },
            external,
            plugins,
            // Suppress noisy but benign upstream-library warnings:
            // - MODULE_LEVEL_DIRECTIVE: "use client" directives shipped by
            //   framer-motion, Radix UI, cmdk, etc. for Next.js RSC support.
            //   Rollup can't process them and safely ignores them.
            // - THIS_IS_UNDEFINED: top-level `this` rewrites in some CJS-style
            //   modules (react-calendar). Rollup rewrites to `undefined` per
            //   the ES module spec; behavior is unchanged.
            // Real warnings (unresolved deps, circular imports, etc.) still surface.
            onwarn(warning, defaultHandler) {
                if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
                if (warning.code === 'THIS_IS_UNDEFINED') return;
                defaultHandler(warning);
            }
        };

        const bundle = await rollup(rollupConfig);
        await bundle.write(rollupConfig.output as any);
        await bundle.close();
    });

    await Promise.all(buildPromises);
    return widgets.length;
}
