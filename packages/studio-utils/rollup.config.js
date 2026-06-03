import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';

const TARGET_FILE = 'lib/vertesia-studio-utils.js';

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
    ],
};
