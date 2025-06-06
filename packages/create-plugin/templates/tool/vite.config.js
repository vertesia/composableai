import { defineConfig } from 'vite';
import devServer from '@hono/vite-dev-server';

export default defineConfig({
    plugins: [
        devServer({
            entry: 'src/server.ts', // Adjust the path to your server entry file
        }),
    ],
});