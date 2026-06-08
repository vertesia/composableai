import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';

export default {
    input: 'lib/index.js',
    output: {
        file: 'lib/build-tools.js',
        format: 'es',
        sourcemap: true,
    },
    external: [
        'rollup',
        'gray-matter',
        'zod',
        'typescript',
        /^node:/, // All node: imports
        /^@rollup\//, // All @rollup/* packages
        'rollup-plugin-terser',
    ],
    plugins: [nodeResolve(), commonjs()],
};
