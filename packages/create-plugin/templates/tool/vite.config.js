import { defineConfig } from 'vite'
import { VitePluginNode } from 'vite-plugin-node'

export default defineConfig({
    plugins: [
        VitePluginNode({
            adapter: 'hono',
            appPath: './src/server.ts',
            exportName: 'app', // default is 'app', you can also export your app as "app" instead of calling listen()
            tsCompiler: 'esbuild',
        }),
    ],
    server: {
        watch: {
            usePolling: true,
        },
    },
})