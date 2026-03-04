/**
 * Rollup Configuration for building tools as es bundles for import() usage
 *
 * Not used for now.
 * 
 * Creates browser-ready bundles for each tool collection in lib/tools
 * Input: lib/tools/{TOOL_DIR}/index.js (already compiled from TypeScript)
 * Output: dist/libs/tool-server-{name}.js (browser bundles)
 */
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import fs from 'fs';
import path from 'path';

const libToolCollectionsDir = './lib/tools';
const outputDir = './dist/libs';

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Get all directories in lib/tools with an index.js
const entries = fs.existsSync(libToolCollectionsDir)
    ? fs.readdirSync(libToolCollectionsDir).filter((name) => {
        const dir = path.join(libToolCollectionsDir, name);
        return (
            fs.statSync(dir).isDirectory() &&
            fs.existsSync(path.join(dir, 'index.js'))
        );
    })
    : [];

// Create a bundle configuration for each tool collection
const browserBundles = entries.map((name) => ({
    input: path.join(libToolCollectionsDir, name, 'index.js'),
    output: {
        file: path.join(outputDir, `tool-server-${name}.js`),
        format: 'es',
        sourcemap: true,
        inlineDynamicImports: true
    },
    plugins: [
        nodeResolve({
            browser: true,
            preferBuiltins: false
        }),
        json(),
        commonjs(),
        terser({
            compress: {
                drop_console: false
            }
        })
    ]
}));

export default browserBundles;
