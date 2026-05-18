import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// Map @vertesia/ui/* to source so tests don't go through the built lib (which
// resolves React via the consumer's node_modules and triggers "Invalid hook
// call" because the test process already has its own React copy). Mirrors
// the `paths` field in tsconfig.json. Explicit file extensions so the alias
// resolves to the same canonical URL as a sibling relative import would —
// otherwise Vite caches them as two separate modules with separate React
// contexts.
const SUBPATH_INDEX_FILES: Record<string, string> = {
    core: 'src/core/index.ts',
    shell: 'src/shell/index.tsx',
    session: 'src/session/index.ts',
    router: 'src/router/index.ts',
    features: 'src/features/index.ts',
    i18n: 'src/i18n/index.tsx',
    layout: 'src/layout/index.ts',
    env: 'src/env/index.ts',
    widgets: 'src/widgets/index.ts',
    code: 'src/code/index.ts',
    form: 'src/form/index.ts',
};

export default defineConfig({
    resolve: {
        alias: Object.entries(SUBPATH_INDEX_FILES).map(([sub, file]) => ({
            find: `@vertesia/ui/${sub}`,
            replacement: resolve(__dirname, file),
        })),
    },
    test: {
        environment: 'jsdom',
        setupFiles: ['./src/__tests__/setup.ts'],
        globals: true,
        css: false,
    },
});
