import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

// Bundles the already-built ES output (`lib/index.js`, produced by `tsc`) into a single
// browser-friendly file consumed by composable-ui's CDN runtime. Build script: `tsc && rollup -c`.
// No @rollup/plugin-typescript here — its TS-watcher would leak file/dir watchers and hang turbo.
const TARGET_FILE = 'lib/vertesia-jst.js';

export default {
    input: 'lib/index.js',
    output: {
        file: TARGET_FILE,
        format: 'es',
        sourcemap: true,
    },
    external: [
        // Loaded from CDN via the runtime import map — see cdn/package.json.
        'handlebars',
        'acorn',
        'acorn-walk',
        'dayjs',
        'papaparse',
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
