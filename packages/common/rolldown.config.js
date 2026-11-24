import { defineConfig } from 'rolldown';
// Imported from source: @vertesia/build-tools depends on this workspace's packages, so a package
// dependency on it would be a build cycle.
import { thirdPartyLicenses } from '../build-tools/src/licenses/index.ts';

// Bundles the already-built ES output (`lib/index.js`, produced by `tsc`) into a single
// browser-friendly file. Build script: `tsc && rolldown -c rolldown.config.js`.
// rolldown provides node resolution, CommonJS interop and minification natively,
// so the former @rollup/plugin-{node-resolve,commonjs,terser} are no longer needed.
const TARGET_FILE = 'lib/vertesia-common.js';

export default defineConfig({
    input: 'lib/index.js',
    output: {
        file: TARGET_FILE,
        format: 'es',
        sourcemap: true,
        minify: true,
    },
    // Writes the notices of the packages this bundle inlines beside it.
    plugins: [
        thirdPartyLicenses({
            title: 'vertesia-common.js',
            noticesFileName: 'vertesia-common.THIRD-PARTY-NOTICES.txt',
            jsonFileName: 'vertesia-common.third-party-licenses.json',
        }),
    ],
    external: ['json-schema', 'ajv'],
    resolve: {
        mainFields: ['browser', 'module', 'main'],
        conditionNames: ['browser', 'import', 'default'],
    },
});
