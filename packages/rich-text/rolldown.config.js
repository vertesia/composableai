import { defineConfig } from 'rolldown';

export default defineConfig({
    input: 'lib/index.js',
    output: {
        file: 'lib/vertesia-rich-text.js',
        format: 'es',
        sourcemap: true,
        codeSplitting: false,
        minify: true,
    },
    // Keep the editor runtime together so every extension shares the same ProseMirror
    // classes. React remains external because the host application owns that singleton.
    external: ['react', /^react\/.*/, 'react-dom', /^react-dom\/.*/],
    define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
        'process.env': JSON.stringify({}),
    },
    resolve: {
        mainFields: ['browser', 'module', 'main'],
        conditionNames: ['browser', 'import', 'default'],
    },
});
