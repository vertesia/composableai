import { defineConfig } from 'rolldown';

export default defineConfig({
    input: 'lib/esm/index.js',
    platform: 'node',
    output: {
        file: 'lib/build-tools.js',
        format: 'es',
        sourcemap: true,
    },
    external: [
        'rolldown',
        'vite',
        'gray-matter',
        'zod',
        /^node:/,  // All node: imports
    ],
    plugins: [],
});
