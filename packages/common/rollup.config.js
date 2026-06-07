import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import ts from 'typescript';

// Equivalent of @vertesia/build-tools' createRollupTypescript(), inlined here because
// build-tools depends on @vertesia/common — importing it would create a build cycle.
// @rollup/plugin-typescript spins up a TS watch program even for one-shot builds; its
// file/dir watchers keep the process alive and hang turbo. No-op the watchers so rollup
// can exit cleanly after writing output.
const isWatchMode =
    process.env.ROLLUP_WATCH === 'true' || process.argv.includes('--watch') || process.argv.includes('-w');
let buildTypescript = ts;
if (!isWatchMode) {
    buildTypescript = Object.create(ts);
    Object.defineProperty(buildTypescript, 'sys', {
        enumerable: true,
        value: {
            ...ts.sys,
            watchFile: () => ({ close() {} }),
            watchDirectory: () => ({ close() {} }),
        },
    });
}

const TARGET_FILE = 'lib/vertesia-common.js';

export default {
    input: 'src/index.ts',
    output: {
        file: TARGET_FILE, // ES module output for browser
        format: 'es',
        sourcemap: true,
    },
    external: [
        // Add any packages you want to keep external (e.g., use via import map)
        'json-schema',
        'ajv',
    ],
    // Treat TypeScript diagnostics from @rollup/plugin-typescript as build errors
    // instead of warnings, so type issues fail the build.
    onwarn(warning, defaultHandler) {
        if (warning.plugin === 'typescript') {
            throw new Error(warning.message ?? String(warning));
        }
        defaultHandler(warning);
    },
    plugins: [
        nodeResolve({
            browser: true, // Prefer browser-compatible versions of packages
            exportConditions: ['browser', 'module', 'import'],
        }),
        commonjs(), // Convert CommonJS modules to ES6
        typescript({
            tsconfig: './tsconfig.web.json',
            typescript: buildTypescript,
            sourceMap: true,
            declaration: false,
        }),
        terser(), // Optional: minify for production
    ],
};
