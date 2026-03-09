import { defineConfig } from 'vite';
import devServer from '@hono/vite-dev-server';
import { vertesiaDevServerPlugin } from '@vertesia/build-tools';

export default defineConfig({
    plugins: [
        vertesiaDevServerPlugin(),
        devServer({
            entry: 'tools/server.ts'
        }),
    ],
    build: {
        target: 'esnext',
    }
});
