import { defineConfig } from 'rolldown';

// Bundles the already-built ES output (`lib/index.js`, produced by `tsc`) into a single
// browser-friendly file. rolldown handles node resolution, CommonJS interop and
// minification natively; `define` replaces the former @rollup/plugin-replace.
const TARGET_FILE = 'lib/vertesia-fusion-ux.js';

export default defineConfig({
    input: 'lib/index.js',
    output: {
        file: TARGET_FILE,
        format: 'es',
        sourcemap: true,
        inlineDynamicImports: true,
        minify: true,
    },
    external: [
        // React packages (handled by CDN react-all bundle)
        'react',
        'react/jsx-runtime',
        // Vertesia packages (handled by shared libs)
        '@vertesia/common',
        // Third-party packages (handled by CDN)
        'ajv',
    ],
    define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
        'process.env': JSON.stringify({}),
    },
    resolve: {
        mainFields: ['browser', 'module', 'main'],
        conditionNames: ['browser', 'import', 'default'],
    },
});
