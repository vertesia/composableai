import { defineConfig } from 'rolldown';
// Imported from source: @vertesia/build-tools depends on this workspace's packages, so a package
// dependency on it would be a build cycle.
import { thirdPartyLicenses } from '../build-tools/src/licenses/index.ts';

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
    // Writes the notices of the packages this bundle inlines beside it.
    plugins: [
        thirdPartyLicenses({
            title: 'vertesia-rich-text.js',
            noticesFileName: 'vertesia-rich-text.THIRD-PARTY-NOTICES.txt',
            jsonFileName: 'vertesia-rich-text.third-party-licenses.json',
        }),
    ],
    external: ['react', /^react\/.*/, 'react-dom', /^react-dom\/.*/, /^use-sync-external-store\//],
    define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
        'process.env': JSON.stringify({}),
    },
    resolve: {
        mainFields: ['browser', 'module', 'main'],
        conditionNames: ['browser', 'import', 'default'],
    },
    // @tiptap/react starts with "use client", which bundling drops and warns about. It only means
    // something to a React Server Components bundler, and this file is loaded in the browser.
    checks: {
        moduleLevelDirective: false,
    },
});
