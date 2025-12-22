/**
 * Rollup Configuration for Widget Bundles
 *
 * This configuration:
 * 1. Finds all .tsx files in skill directories
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

const skillsDir = './src/skills';
const outputDir = './dist/widgets';

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

/**
 * Find all .tsx files directly in skill directories (not in subdirectories).
 * Recursively searches through skill collection directories.
 *
 * Structure:
 * skills/
 *   examples/           ← Collection directory
 *     my-skill/         ← Skill directory
 *       widget.tsx      ← Entry point (processed)
 *       SKILL.md
 *       ui/
 *         helper.tsx    ← Helper component (ignored)
 */
function findWidgetFiles(dir, widgets = []) {
    if (!fs.existsSync(dir)) {
        return widgets;
    }

    const entries = fs.readdirSync(dir);

    for (const entry of entries) {
        const entryPath = path.join(dir, entry);
        const stat = fs.statSync(entryPath);

        if (!stat.isDirectory()) {
            continue;
        }

        // Check if this directory contains SKILL.md or SKILL.jst (it's a skill directory)
        const hasSkillFile = fs.existsSync(path.join(entryPath, 'SKILL.md')) ||
                            fs.existsSync(path.join(entryPath, 'SKILL.jst'));

        if (hasSkillFile) {
            // This is a skill directory - look for .tsx files in root only
            const skillFiles = fs.readdirSync(entryPath);

            for (const file of skillFiles) {
                const filePath = path.join(entryPath, file);
                const fileStat = fs.statSync(filePath);

                // Only process .tsx files directly in the skill directory (not subdirectories)
                if (!fileStat.isDirectory() && file.endsWith('.tsx')) {
                    const widgetName = path.basename(file, '.tsx');
                    widgets.push({
                        name: widgetName,
                        path: filePath,
                        skill: entry
                    });
                }
            }
        } else {
            // Not a skill directory, recurse into it (e.g., collection directories)
            findWidgetFiles(entryPath, widgets);
        }
    }

    return widgets;
}

// Find all widget files
const widgets = findWidgetFiles(skillsDir);

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
            sourceMap: true,
            compilerOptions: {
                outDir: './dist/widgets',  // Must match Rollup output dir
                rootDir: './src'
            }
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
    input: 'src/skills/index.ts',  // Dummy input
    output: {
        file: '/dev/null',  // No output
        format: 'es'
    },
    plugins: []
};
