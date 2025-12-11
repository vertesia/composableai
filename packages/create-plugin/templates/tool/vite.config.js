import devServer from '@hono/vite-dev-server';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    // Load env files
    const env = loadEnv(mode, process.cwd(), '');

    // Dev config
    if (mode === 'development') {
        return {
            base: '/api',
            plugins: [
                devServer({
                    entry: './src/server.ts',
                }),
            ],
        }
    }

    // Build config
    return {
        build: {
            minify: false,
            lib: {
                entry: {
                    server: './src/server.ts',
                },
                formats: ['es']
            },
            rollupOptions: {
                external: (id) => {
                    // Keep relative imports as part of the bundle
                    if (id.startsWith('.') || id.startsWith('/')) {
                        return false;
                    }
                    // Externalize all node modules and absolute imports
                    return true;
                },
                output: {
                    preserveModules: true,
                    preserveModulesRoot: 'src',
                    entryFileNames: '[name].js'
                }
            },
            outDir: 'dist'
        },
    }
});
