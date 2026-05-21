/**
 * Rolldown Configuration for Widget Bundles
 *
 * This configuration:
 * 1. Finds all .tsx files in src/skills/ directories (next to SKILL.md files)
 * 2. Bundles each widget with all dependencies included
 * 3. Outputs browser-ready ES modules flat to dist/widgets/
 *
 * Output: dist/widgets/{widget-name}.js
 */
import { defineConfig } from 'rolldown';
import { globSync } from 'fs';
import path from 'path';
import { typescriptTypecheckPlugin } from '@vertesia/build-tools';

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
const typecheckPlugin = typescriptTypecheckPlugin({
    tsconfig: './tsconfig.widgets.json',
});

console.log(`Found ${widgets.length} widget(s):`, widgets.map(w => w.name).join(', '));

// Create a bundle configuration for each widget
const widgetBundles = widgets.map(({ name, path: widgetPath }) => ({
    input: widgetPath,
    platform: 'browser',
    tsconfig: './tsconfig.widgets.json',
    resolve: {
        extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
        mainFields: ['browser', 'module', 'main'],
        conditionNames: ['browser', 'import', 'default'],
    },
    output: {
        dir: outputDir,
        entryFileNames: `${name}.js`,
        format: 'es',
        sourcemap: true,
        codeSplitting: false,
        minify: true,
    },
    external: [
        // Externalize React dependencies - they should be provided by the host application
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'react-dom/client'
    ],
    plugins: [typecheckPlugin],
}));

export default defineConfig(widgetBundles);
