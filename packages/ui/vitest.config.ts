import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// Map @vertesia/ui/* subpaths to source so tests stay in the same React
// module graph as the components they exercise (going through the built
// lib/ would import React from a different node_modules and trigger
// "Invalid hook call" detection).
const SUBPATH_INDEX_FILES: Record<string, string> = {
    core: 'src/core/index.ts',
    shell: 'src/shell/index.tsx',
    session: 'src/session/index.ts',
    router: 'src/router/index.ts',
    features: 'src/features/index.ts',
    i18n: 'src/i18n/index.tsx',
    layout: 'src/layout/index.ts',
    'rich-text': 'src/rich-text/index.ts',
    env: 'src/env/index.ts',
    widgets: 'src/widgets/index.ts',
    code: 'src/code/index.ts',
    form: 'src/form/index.ts',
};

export default defineConfig({
    resolve: {
        alias: [
            ...Object.entries(SUBPATH_INDEX_FILES).map(([sub, file]) => ({
                find: `@vertesia/ui/${sub}`,
                replacement: resolve(__dirname, file),
            })),
            {
                find: '@vertesia/rich-text',
                replacement: resolve(__dirname, '../rich-text/src/index.ts'),
            },
        ],
    },
    test: {
        environment: 'jsdom',
        setupFiles: ['./src/__tests__/setup.ts'],
        globals: true,
        css: false,
    },
});
