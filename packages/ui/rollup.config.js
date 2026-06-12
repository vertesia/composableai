import fs from 'node:fs';
import path from 'node:path';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';
import { defineConfig } from 'rollup';
import { EXTERNALS } from './externals.js';

const outputDir = path.resolve('lib');

// Get all directories with an index.js (each becomes a CDN-bundled named export).
const entries = fs.readdirSync(outputDir).filter((name) => {
    const dir = path.join(outputDir, name);
    try {
        if (fs.statSync(dir).isDirectory()) {
            return fs.existsSync(path.join(dir, 'index.js'));
        }
    } catch {
        // ignore
    }
    return false;
});

const jsEntries = entries.map((name) => ({
    input: path.join(outputDir, name, 'index.js'),
    output: {
        file: path.join(outputDir, `vertesia-ui-${name}.js`),
        format: 'es',
        sourcemap: true,
    },
    external: EXTERNALS,
    plugins: [
        // Substitute `process.env.NODE_ENV` at build time so the published bundle
        // never references the Node-only `process` global. Browser consumers (Vite
        // does NOT post-process node_modules) would otherwise crash with
        // `ReferenceError: process is not defined` the first time a code path that
        // reads `process.env.NODE_ENV` actually executes.
        // Pinning to "production" also lets terser dead-code-eliminate the
        // dev-only diagnostic branches (e.g. the FormItem a11y warning).
        replace({
            preventAssignment: true,
            values: {
                'process.env.NODE_ENV': JSON.stringify('production'),
            },
        }),
        nodeResolve({
            browser: true,
            exportConditions: ['browser', 'module', 'import'],
        }),
        json(),
        commonjs(),
        terser(),
    ],
}));

export default defineConfig([...jsEntries]);
