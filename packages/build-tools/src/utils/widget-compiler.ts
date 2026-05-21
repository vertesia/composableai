/**
 * Widget compilation utility using Rolldown
 */

import { rolldown, type InputOptions, type OutputOptions } from 'rolldown';
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
    'react-dom/client',
    '@vertesia/ui/core'
];

/**
 * Compile widgets using Rolldown
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
        minify = false
    } = config;

    // Build each widget separately to get individual bundles
    const buildPromises = widgets.map(async (widget) => {
        const output: OutputOptions = {
            file: path.join(outputDir, `${widget.name}.js`),
            format: 'es',
            sourcemap: true,
            codeSplitting: false,
            minify,
        };

        const rolldownConfig: InputOptions = {
            input: widget.path,
            platform: 'browser',
            tsconfig,
            external,
            resolve: {
                extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
                mainFields: ['browser', 'module', 'main'],
                conditionNames: ['browser', 'import', 'default'],
            },
            // Suppress noisy but benign upstream-library warnings:
            // - MODULE_LEVEL_DIRECTIVE: "use client" directives shipped by
            //   framer-motion, Radix UI, cmdk, etc. for Next.js RSC support.
            //   The bundler safely ignores them.
            // - THIS_IS_UNDEFINED: top-level `this` rewrites in some CJS-style
            //   modules (react-calendar). The bundler rewrites to `undefined` per
            //   the ES module spec; behavior is unchanged.
            // Real warnings (unresolved deps, circular imports, etc.) still surface.
            onwarn(warning, defaultHandler) {
                if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
                if (warning.code === 'THIS_IS_UNDEFINED') return;
                defaultHandler(warning);
            }
        };

        const bundle = await rolldown(rolldownConfig);
        await bundle.write(output);
        await bundle.close();
    });

    await Promise.all(buildPromises);
    return widgets.length;
}
