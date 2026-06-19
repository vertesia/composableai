import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

const TARGET_FILE = 'lib/vertesia-studio-utils.js';

/**
 * Bundle the pre-built ESM output (`lib/index.js`, produced by the preceding `tsc` step)
 * into a single browser-ready file. No TypeScript plugin needed — `tsc` already handled
 * the .ts → .js transformation, so rollup just glues things together and minifies.
 *
 * This avoids the `@rollup/plugin-typescript` worker-leak that causes turbo's task graph
 * to hang in CI (worker threads keep the Node process alive past `closeBundle`).
 */
export default {
    input: 'lib/index.js',
    output: {
        file: TARGET_FILE,
        format: 'es',
        sourcemap: true,
    },
    external: [
        // Workspace shared libs — loaded from /libs/ via the runtime import map.
        '@llumiverse/common',
        '@vertesia/common',
        '@vertesia/jst',
        // CDN-served third-party — also resolved via the import map.
        'handlebars',
    ],
    plugins: [
        nodeResolve({
            browser: true,
            exportConditions: ['browser', 'module', 'import'],
        }),
        commonjs(),
        terser(),
    ],
};
