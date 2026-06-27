import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

// Bundles the already-built ES output (`lib/index.js`, produced by `tsc`) into a single
// browser-friendly file. Build script: `tsc -p tsconfig.json && rollup -c`.
const TARGET_FILE = 'lib/vertesia-common.js';

export default {
    input: 'lib/index.js',
    output: {
        file: TARGET_FILE,
        format: 'es',
        sourcemap: true,
    },
    external: ['json-schema', 'ajv'],
    plugins: [
        nodeResolve({
            browser: true,
            exportConditions: ['browser', 'module', 'import'],
        }),
        commonjs(),
        terser(),
    ],
};
