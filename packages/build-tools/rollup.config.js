import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
    input: 'lib/esm/index.js',
    output: {
        file: 'lib/build-tools.js',
        format: 'es',
        sourcemap: true,
    },
    external: [
        'rollup',
        'gray-matter',
        'zod',
        /^node:/,  // All node: imports
        /^@rollup\//,  // All @rollup/* packages
        'rollup-plugin-terser'
    ],
    plugins: [
        nodeResolve(),
        commonjs(),
    ],
};
