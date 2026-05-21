import { defineConfig } from 'rolldown';

const TARGET_FILE = 'lib/vertesia-fusion-ux.js';

export default defineConfig({
    input: 'lib/esm/index.js',
    platform: 'browser',
    transform: {
        define: {
            'process.env.NODE_ENV': JSON.stringify('production'),
            'process.env': JSON.stringify({}),
        },
    },
    resolve: {
        mainFields: ['browser', 'module', 'main'],
        conditionNames: ['browser', 'import', 'default'],
    },
    output: {
        file: TARGET_FILE,
        format: 'es',
        sourcemap: true,
        codeSplitting: false,
        minify: true,
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
    plugins: [],
});
