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

        const plugins: Plugin[] = [
            typescript({
                tsconfig,
                declaration: false,
                sourceMap: true,
                ...typescriptOptions
            }),
            nodeResolve({
                browser: true,
                preferBuiltins: false,
                extensions: ['.tsx', '.ts', '.jsx', '.js']
            }),
            commonjs()
        ];

        // Add minification if requested
        if (minify) {
            const { terser } = await import('rollup-plugin-terser' as any);
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
            plugins
        };

        const bundle = await rollup(rollupConfig);
        await bundle.write(rollupConfig.output as any);
        await bundle.close();
    });

    await Promise.all(buildPromises);
    return widgets.length;
}
