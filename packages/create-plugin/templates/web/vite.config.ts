import tailwindcss from '@tailwindcss/vite';
import { vertesiaPluginBuilder } from '@vertesia/plugin-builder';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { defineConfig, type ConfigEnv, type UserConfig } from 'vite';
import serveStatic from "vite-plugin-serve-static";

/**
 * List of external dependencies that should not be bundled when
 * buildiong the plugin library
 */
const EXTERNALS = [
    'react',
    'react-dom',
    'react/jsx-runtime',
    'react-dom/client',
    '@vertesia/common',
    '@vertesia/ui',
    /^@vertesia\/ui\/.*/,
    // add any other external dependencies here
];

/**
 * Vite configuration to build the plugin as a library or as a standalone application or to run the application in dev mode.
 * Use `vite build --mode lib` to build a library (plugin)
 * Use `vite build` or `vite build --mode app`to build a standalone application
 * Use `vite dev` to run the applicaiton in dev mode.
 */
export default defineConfig((env) => {
    if (env.mode === 'lib') {
        return defineLibConfig(env);
    } else {
        return defineAppConfig();
    }
})

/**
 * Vite configuration to build a library (plugin).
 * @param env - Vite configuration environment
 * @returns
 */
function defineLibConfig({ command }: ConfigEnv): UserConfig {
    const isBuildMode = command === 'build';
    if (!isBuildMode) {
        throw new Error("Library config is only available in 'build' mode. Please use 'lib' mode for library builds.");
    }
    return {
        plugins: [
            tailwindcss(),
            react(),
            vertesiaPluginBuilder(),
        ],
        build: {
            outDir: 'lib', // the plugin will be generated in the `lib` directory
            lib: {
                entry: './src/plugin.tsx', // Main entry point of your library
                formats: ['es'], // Build ESM versions
                fileName: "plugin",
            },
            minify: true,
            sourcemap: true,
            rollupOptions: {
                external: EXTERNALS,
            }
        }
    }
}

/**
 * Vite configuration to run the applicaiton in dev mode
 * or to build a standalone application.
 * @returns
 */
function defineAppConfig(): UserConfig {

    return {
        plugins: [
            tailwindcss(),
            react(),
            // we need to use https for the firebase authentication to work
            basicSsl(),
            // serve lib/plugin.js content in dev mode
            serveStatic([
                {
                    pattern: new RegExp("/plugin.js"),
                    resolve: "./lib/plugin.js"
                }
            ]),
        ],
        // for authentication with Firebase
        server: {
            proxy: {
                '/__/auth': {
                    target: 'https://dengenlabs.firebaseapp.com',
                    changeOrigin: true,
                }
            }
        },
    }
}