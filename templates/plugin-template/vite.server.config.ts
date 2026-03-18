import { defineConfig, type PluginOption } from 'vite';
import devServer from '@hono/vite-dev-server';
import { vertesiaDevServerPlugin } from '@vertesia/build-tools/vite';

export default defineConfig({
    plugins: [
        vertesiaDevServerPlugin(),
        devServer({ entry: 'tools/server.ts' }) as PluginOption, //type assertion, helps when TS gets confused between 2 vite installs.
    ],
    build: {
        target: 'esnext',
    }
});
