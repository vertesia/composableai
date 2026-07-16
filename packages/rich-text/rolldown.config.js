import { defineConfig } from 'rolldown';

export default defineConfig({
    input: 'lib/index.js',
    output: {
        file: 'lib/vertesia-rich-text.js',
        format: 'es',
        sourcemap: true,
        codeSplitting: false,
        minify: true,
    },
    // Keep the editor runtime together so every extension shares the same ProseMirror
    // classes. React remains external because the host application owns that singleton.
    // use-sync-external-store is CJS-only and requires the external react at runtime,
    // which browsers cannot satisfy from an ESM bundle. Externalize its subpaths so the
    // UI's embedded CDN can provide browser-safe ESM wrappers through the import map.
    external: ['react', /^react\/.*/, 'react-dom', /^react-dom\/.*/, /^use-sync-external-store\//],
    define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
        'process.env': JSON.stringify({}),
    },
    resolve: {
        mainFields: ['browser', 'module', 'main'],
        conditionNames: ['browser', 'import', 'default'],
    },
});
