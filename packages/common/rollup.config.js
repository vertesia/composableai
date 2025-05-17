import typescript from '@rollup/plugin-typescript';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';

const TARGET_FILE = 'lib/vertesia-common.js';

export default {
    input: 'src/index.ts',
    output: {
        file: TARGET_FILE,         // ES module output for browser
        format: 'es',
        sourcemap: true,
    },
    external: [
        // Add any packages you want to keep external (e.g., use via import map)
        "json-schema", "ajv", "mime",
    ],
    plugins: [
        nodeResolve({
            browser: true,  // Prefer browser-compatible versions of packages
            exportConditions: ['browser', 'module', 'import'],
        }),
        commonjs(),        // Convert CommonJS modules to ES6
        typescript({
            tsconfig: './tsconfig.web.json',
            sourceMap: true,
            declaration: false,
        }),
        terser(),          // Optional: minify for production
    ],
};