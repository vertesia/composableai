import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

const TARGET_FILE = 'lib/vertesia-content-export.js';

export default {
    input: 'lib/index.js',
    output: {
        file: TARGET_FILE,
        format: 'es',
        sourcemap: true,
    },
    external: ['@vertesia/client', '@vertesia/common'],
    plugins: [
        nodeResolve({
            browser: true,
            exportConditions: ['browser', 'module', 'import'],
        }),
        commonjs(),
        terser(),
    ],
};
