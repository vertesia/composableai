import { defineConfig } from 'rolldown';

// Bundles the already-built ES output (`lib/index.js`, produced by `tsc`) into a single
// browser-friendly file. Build script: `tsc && rolldown -c rolldown.config.js`.
// rolldown provides node resolution, CommonJS interop and minification natively,
// so the former @rollup/plugin-{node-resolve,commonjs,terser} are no longer needed.
const TARGET_FILE = 'lib/vertesia-client.js';

export default defineConfig({
    input: 'lib/index.js',
    output: {
        file: TARGET_FILE,
        format: 'es',
        sourcemap: true,
        minify: true,
    },
    // Node built-ins and the optional storage SDKs are loaded on demand by the Node-only upload paths
    // (store/node-request, store/chunked-upload), which a browser never calls.
    external: [
        '@vertesia/common',
        'eventsource',
        'ajv',
        /^node:/,
        '@azure/storage-blob',
        '@google-cloud/storage',
        'google-auth-library',
    ],
    resolve: {
        mainFields: ['browser', 'module', 'main'],
        conditionNames: ['browser', 'import', 'default'],
    },
});
