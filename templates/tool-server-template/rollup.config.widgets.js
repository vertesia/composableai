/**
 * Rollup Configuration for Widget Bundles
 *
 * This configuration:
 * 1. Finds all .tsx files in src/widgets/ (top-level only)
 * 2. Bundles each widget with all dependencies included
 * 3. Outputs browser-ready ES modules to dist/widgets/
 *
 * Output: dist/widgets/{widget-name}.js
 */
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';
import fs from 'fs';
import path from 'path';

const widgetsDir = './src/widgets';
const outputDir = './dist/widgets';

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

/**
 * Find all .tsx files in src/widgets/ (top-level only).
 * Subdirectories are ignored - they contain helper components.
 *
 * Structure:
 * src/widgets/
 *   poll.tsx           ← Entry point (bundled)
 *   poll/              ← Helper components (imported, not entry points)
 *     Chart.tsx
 *     utils.ts
 */
function findWidgetEntryPoints(dir) {
    const widgets = [];

    if (!fs.existsSync(dir)) {
        return widgets;
    }

    const files = fs.readdirSync(dir);

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        // Only top-level .tsx files (not directories)
        if (!stat.isDirectory() && file.endsWith('.tsx')) {
            const widgetName = path.basename(file, '.tsx');
            widgets.push({
                name: widgetName,
                path: filePath
            });
        }
    }

    return widgets;
}

// Find all widget entry points
const widgets = findWidgetEntryPoints(widgetsDir);

console.log(`Found ${widgets.length} widget(s):`, widgets.map(w => w.name).join(', '));

// Create a bundle configuration for each widget
const widgetBundles = widgets.map(({ name, path: widgetPath }) => ({
    input: widgetPath,
    output: {
        dir: outputDir,
        entryFileNames: `${name}.js`,
        format: 'es',
        sourcemap: true,
        inlineDynamicImports: true
    },
    external: [
        // Externalize React dependencies - they should be provided by the host application
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'react-dom/client'
    ],
    plugins: [
        typescript({
            tsconfig: './tsconfig.widgets.json',
            declaration: false,
            sourceMap: true
        }),
        nodeResolve({
            browser: true,
            preferBuiltins: false,
            extensions: ['.tsx', '.ts', '.jsx', '.js']
        }),
        commonjs(),
        terser({
            compress: {
                drop_console: false
            }
        })
    ]
}));

// Rollup requires at least one config, so export empty config if no widgets found
export default widgetBundles.length > 0 ? widgetBundles : {
    input: 'src/widgets/index.ts',  // Dummy input
    output: {
        file: '/dev/null',  // No output
        format: 'es'
    },
    plugins: []
};
