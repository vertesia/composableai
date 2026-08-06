import { defineConfig } from 'rolldown';

// Bundles the already-built ES output (produced by `tsc`) into browser-friendly files.
// Build script: `tsc && rolldown -c rolldown.config.js`.
// rolldown provides node resolution, CommonJS interop and minification natively,
// so the former @rollup/plugin-{node-resolve,commonjs,terser} are no longer needed.
//
// Two entry points, served to the browser as two separate shared libraries (see
// `apps/composable-ui/build/shared-libs.ts`):
//
//   lib/index.js          -> lib/vertesia-common.js           (`@vertesia/common`)
//   lib/internal/index.js -> lib/vertesia-common-internal.js  (`@vertesia/common/internal`)
//
// They are emitted as independent bundles rather than a code-split pair because the import map
// serves one file per bare specifier and has no way to name a shared chunk. The small overlap
// between the two graphs is therefore duplicated. That is safe here: every value both graphs reach
// is a pure constant, string enum or pure function, none of which is compared by identity.

const shared = {
    output: {
        format: 'es',
        sourcemap: true,
        minify: true,
    },
    external: ['json-schema', 'ajv'],
    resolve: {
        mainFields: ['browser', 'module', 'main'],
        conditionNames: ['browser', 'import', 'default'],
    },
};

export default defineConfig([
    {
        ...shared,
        input: 'lib/index.js',
        output: { ...shared.output, file: 'lib/vertesia-common.js' },
    },
    {
        ...shared,
        input: 'lib/internal/index.js',
        output: { ...shared.output, file: 'lib/vertesia-common-internal.js' },
    },
]);
