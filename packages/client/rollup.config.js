import { defineConfig } from 'rolldown';

const TARGET_FILE = 'lib/vertesia-client.js';

export default defineConfig({
    input: 'src/index.ts',
    platform: 'browser',
    tsconfig: './tsconfig.web.json',
    resolve: {
        mainFields: ['browser', 'module', 'main'],
        conditionNames: ['browser', 'import', 'default'],
    },
    output: {
        file: TARGET_FILE,         // ES module output for browser
        format: 'es',
        sourcemap: true,
        minify: true,
    },
    external: [
        // Add any packages you want to keep external (e.g., use via import map)
        "@vertesia/common", "eventsource", "ajv"
    ],
    plugins: [],
});
