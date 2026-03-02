/**
 * Rollup Configuration for Widget Bundles
 *
 * This configuration:
 * 1. Finds all .tsx files in src/skills/ directories (next to SKILL.md files)
 * 2. Bundles each widget with all dependencies included
 * 3. Outputs browser-ready ES modules flat to dist/widgets/
 *
 * Output: dist/widgets/{widget-name}.js
 */
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import { globSync } from 'fs';
import path from 'path';

const outputDir = './dist/widgets';

/**
 * Find all .tsx files in skill directories using glob.
 * Widgets are located next to SKILL.md files in skill directories.
 *
 * Structure:
 * src/skills/
 *   examples/
 *     user-select/
 *       SKILL.md           ← Skill definition
 *       user-select.tsx    ← Widget entry point
 */
function findWidgetEntryPoints() {
    // Use glob to find all .tsx files in skill directories
    const files = globSync('src/skills/**/*.tsx');

    const widgets = files.map(file => ({
        name: path.basename(file, '.tsx'),
        path: file
    }));

    // Check for duplicate widget names
    const nameMap = new Map();
    for (const widget of widgets) {
        if (nameMap.has(widget.name)) {
            const existing = nameMap.get(widget.name);
            throw new Error(
                `Duplicate widget name "${widget.name}" found:\n` +
                `  - ${existing}\n` +
                `  - ${widget.path}\n` +
                `Widget names must be unique across all skills.`
            );
        }
        nameMap.set(widget.name, widget.path);
    }

    return widgets;
}

// Find all widget entry points
const widgets = findWidgetEntryPoints();

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