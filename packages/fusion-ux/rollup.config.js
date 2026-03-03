import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';

const TARGET_FILE = 'lib/vertesia-fusion-ux.js';

export default {
    input: 'lib/esm/index.js',
    output: {
        file: TARGET_FILE,
        format: 'es',
        sourcemap: true,
        inlineDynamicImports: true,
    },
    external: [
        // React packages (handled by CDN react-all bundle)
        'react',
        'react/jsx-runtime',
        // Vertesia packages (handled by shared libs)
        '@vertesia/common',
        // Third-party packages (handled by CDN)
        'ajv',
    ],
    plugins: [
        replace({
            preventAssignment: true,
            'process.env.NODE_ENV': JSON.stringify('production'),
            'process.env': JSON.stringify({}),
        }),
        nodeResolve({
            browser: true,
            exportConditions: ['browser', 'module', 'import'],
        }),
        commonjs(),
        terser(),
    ],
};
