/**
 * Widget compilation utility using Rollup
 */

import path from 'node:path';
import type { RollupJsonOptions } from '@rollup/plugin-json';
import type { RollupNodeResolveOptions } from '@rollup/plugin-node-resolve';
import type { Options as TerserOptions } from '@rollup/plugin-terser';
import type { RollupTypescriptOptions } from '@rollup/plugin-typescript';
import { type OutputOptions, type Plugin, type RollupOptions, rollup } from 'rollup';
import type { WidgetConfig } from '../core/types.js';
import type { WidgetMetadata } from '../core/utils/asset-discovery.js';
import { createRollupTypescript } from './typescript.js';

type PluginFactory<TOptions = undefined> = (options?: TOptions) => Plugin;

function getPluginFactory<TOptions>(module: unknown, packageName: string): PluginFactory<TOptions> {
    if (typeof module === 'function') {
        return module as PluginFactory<TOptions>;
    }
    if (module && typeof module === 'object' && 'default' in module) {
        const defaultExport = module.default;
        if (typeof defaultExport === 'function') {
            return defaultExport as PluginFactory<TOptions>;
        }
    }
    throw new Error(`Rollup plugin ${packageName} does not export a plugin factory`);
}

/**
 * Default external dependencies for widgets
 */
const DEFAULT_EXTERNALS = ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom/client'];

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
    config: WidgetConfig = {},
): Promise<number> {
    if (widgets.length === 0) {
        return 0;
    }

    const {
        external = DEFAULT_EXTERNALS,
        tsconfig = './tsconfig.json',
        typescript: typescriptOptions = {},
        minify = false,
    } = config;

    // Build each widget separately to get individual bundles
    const buildPromises = widgets.map(async (widget) => {
        const typescript = getPluginFactory<RollupTypescriptOptions>(
            await import('@rollup/plugin-typescript'),
            '@rollup/plugin-typescript',
        );
        const ts = await import('typescript');
        const nodeResolve = getPluginFactory<RollupNodeResolveOptions>(
            await import('@rollup/plugin-node-resolve'),
            '@rollup/plugin-node-resolve',
        );
        const commonjs = getPluginFactory(await import('@rollup/plugin-commonjs'), '@rollup/plugin-commonjs');
        // @rollup/plugin-json — required when widgets transitively import JSON files,
        // e.g. @vertesia/ui pulls in i18n locale JSON via lib/esm/i18n/locales/*.json.
        // Without this, Rollup tries to parse JSON as JS and bails.
        const json = getPluginFactory<RollupJsonOptions>(await import('@rollup/plugin-json'), '@rollup/plugin-json');

        const plugins: Plugin[] = [
            typescript({
                tsconfig,
                declaration: false,
                sourceMap: true,
                typescript: createRollupTypescript(ts, { watchMode: false }),
                ...typescriptOptions,
            }),
            // Order matters: json must come before node-resolve so .json imports
            // are handled by it rather than fed to the default loader.
            json(),
            nodeResolve({
                browser: true,
                preferBuiltins: false,
                extensions: ['.tsx', '.ts', '.jsx', '.js'],
            }),
            commonjs(),
        ];

        // Add minification if requested
        if (minify) {
            const terser = getPluginFactory<TerserOptions>(
                await import('@rollup/plugin-terser'),
                '@rollup/plugin-terser',
            );
            plugins.push(
                terser({
                    compress: {
                        drop_console: false,
                    },
                }),
            );
        }

        const output: OutputOptions = {
            file: path.join(outputDir, `${widget.name}.js`),
            format: 'es',
            sourcemap: true,
            inlineDynamicImports: true,
        };

        const rollupConfig: RollupOptions = {
            input: widget.path,
            output,
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
            },
        };

        const bundle = await rollup(rollupConfig);
        await bundle.write(output);
        await bundle.close();
    });

    await Promise.all(buildPromises);
    return widgets.length;
}
