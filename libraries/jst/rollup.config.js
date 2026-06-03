import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';

const TARGET_FILE = 'lib/vertesia-jst.js';

export default {
    input: 'src/index.ts',
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
