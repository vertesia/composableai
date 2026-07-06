/**
 * Widget bundler using esbuild.
 *
 * Takes already-compiled JavaScript widget entries (produced by `tsc` from
 * `.tsx` sources) and emits a single-file ESM bundle with React-family
 * packages left as external imports.
 *
 * No TypeScript / JSX transformation happens here — `tsc` does that during
 * the main build step. This module is a pure module concatenator.
 */

import path from 'node:path';
import { build } from 'esbuild';

const DEFAULT_EXTERNALS = ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom/client'];

export interface WidgetCompilerConfig {
    /** External package names that should not be bundled. */
    external?: string[];

    /** Minify the output. Default: false */
    minify?: boolean;

    /** Emit source maps. Default: true */
    sourcemap?: boolean | 'inline' | 'external';
}

export interface WidgetInput {
    /** Widget name (used for the output file name, without extension). */
    name: string;

    /** Absolute path to the already-compiled `.js` entry to bundle. */
    entry: string;
}

export async function compileWidget(
    widget: WidgetInput,
    outputDir: string,
    config: WidgetCompilerConfig = {},
): Promise<string> {
    const { external = DEFAULT_EXTERNALS, minify = false, sourcemap = true } = config;
    const outfile = path.join(outputDir, `${widget.name}.js`);

    await build({
        entryPoints: [widget.entry],
        outfile,
        bundle: true,
        format: 'esm',
        platform: 'browser',
        external,
        minify,
        sourcemap,
        logLevel: 'silent',
    });

    return outfile;
}

export async function compileWidgets(
    widgets: WidgetInput[],
    outputDir: string,
    config: WidgetCompilerConfig = {},
): Promise<number> {
    if (widgets.length === 0) {
        return 0;
    }
    await Promise.all(widgets.map((widget) => compileWidget(widget, outputDir, config)));
    return widgets.length;
}
