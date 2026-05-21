import { defineConfig, type PluginOption } from 'vite';
import devServer from '@hono/vite-dev-server';
import { vertesiaDevServerPlugin } from '@vertesia/build-tools/vite';

export default defineConfig({
    plugins: [
        vertesiaDevServerPlugin(),
        devServer({ entry: 'src/tool-server/server.ts' }) as PluginOption, // type assertion helps when TS gets confused between two Vite installs.
    ],
    build: {
        target: 'esnext',
    }
});
