import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import fs from 'fs';
import path from 'path';
import { defineConfig } from 'rollup';
import { EXTERNALS } from './externals.js';

const outputDir = path.resolve('lib');
const esmOutputDir = path.join(outputDir, 'esm');


// Get all directories with index.ts or index.tsx
const entries = fs.readdirSync(esmOutputDir).filter((name) => {
    const dir = path.join(esmOutputDir, name);
    try {
        if (fs.statSync(dir).isDirectory()) {
            return fs.existsSync(path.join(dir, 'index.js'));
        }
    } catch (e) {
        // ignore
    }
    return false;
});


const jsEntries = entries.map((name) => ({
    input: path.join(outputDir, 'esm', name, 'index.js'),
    output: {
        file: path.join(outputDir, `vertesia-ui-${name}.js`),
        format: 'es',
        sourcemap: true,
    },
    external: EXTERNALS,
    plugins: [
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
