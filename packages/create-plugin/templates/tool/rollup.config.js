import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';

export default {
    input: './dist/server.js',
    output: {
        file: './dist/bundle.js',
        format: 'es',
        sourcemap: false
    },
    plugins: [
        resolve({
            preferBuiltins: true,
            exportConditions: ['node']
        }),
        commonjs(),
        json()
    ],
    external: [
        // Keep these as external dependencies
        'hono',
        'jose',
        'dotenv',
        '@vertesia/client',
        '@vertesia/common',
        '@vertesia/tools-sdk',
        '@hono/node-server'
    ]
};
