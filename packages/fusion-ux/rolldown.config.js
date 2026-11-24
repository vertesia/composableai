import { defineConfig } from 'rolldown';
// Imported from source: @vertesia/build-tools depends on this workspace's packages, so a package
// dependency on it would be a build cycle.
import { thirdPartyLicenses } from '../build-tools/src/licenses/index.ts';

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
        codeSplitting: false,
        minify: true,
    },
    // Writes the notices of the packages this bundle inlines beside it.
    plugins: [
        thirdPartyLicenses({
            title: 'vertesia-fusion-ux.js',
            noticesFileName: 'vertesia-fusion-ux.THIRD-PARTY-NOTICES.txt',
            jsonFileName: 'vertesia-fusion-ux.third-party-licenses.json',
        }),
    ],
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
