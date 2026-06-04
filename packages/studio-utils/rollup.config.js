import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';

const TARGET_FILE = 'lib/vertesia-studio-utils.js';

/**
 * Force the Node process to exit cleanly once the build has finished writing.
 *
 * `@rollup/plugin-typescript` is known to keep a TypeScript worker thread alive after the
 * bundle is closed, which prevents the rollup process from exiting and causes turbo to
 * hang on this task in CI (the same workaround exists in `templates/plugin-template/rollup.config.js`).
 */
function forceExitPlugin() {
    return {
        name: 'force-exit-after-build',
        writeBundle() {
            process.exit(0);
        },
        closeBundle() {
            process.exit(0);
        },
    };
}

export default {
    input: 'src/index.ts',
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
    onwarn(warning, defaultHandler) {
        if (warning.plugin === 'typescript') {
            throw new Error(warning.message ?? String(warning));
        }
        defaultHandler(warning);
    },
    plugins: [
        nodeResolve({
            browser: true,
            exportConditions: ['browser', 'module', 'import'],
        }),
        commonjs(),
        typescript({
            tsconfig: './tsconfig.web.json',
            sourceMap: true,
            declaration: false,
        }),
        terser(),
        forceExitPlugin(),
    ],
};
