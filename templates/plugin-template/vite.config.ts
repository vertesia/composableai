import tailwindcss from '@tailwindcss/vite';
import { vertesiaPluginBuilder } from '@vertesia/plugin-builder';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { defineConfig, type ConfigEnv, type UserConfig } from 'vite';
import serveStatic from "vite-plugin-serve-static";
import { apiServerPlugin } from './vite-api-server.js';


/**
 * List of dependencies that must be bundled in the plugin bundle
 */
const INTERNALS: (string | RegExp)[] = [
];

function isExternal(id: string) {
    // If it matches INTERNALS → bundle it
    if (INTERNALS.some(pattern =>
        pattern instanceof RegExp ? pattern.test(id) : id === pattern
    )) {
        return false;
    }

    // Otherwise → treat all bare imports (node_modules deps) as external
    return !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('@/') && !id.startsWith('virtual:');
}


/**
 * if you want to debug vertesia ui sources define a relative path to the vertesia ui package root
 */
const VERTESIA_UI_PATH = ""

/**
 * Set to true to extract the css utility layer and inject it in the plugin js file.
 * If you use shadow dom isolation for the plugin you must set this to false.
 */
const CONFIG__inlineCss = false;

/**
 * Vite configuration to build the plugin as a library or as a standalone application or to run the application in dev mode.
 * Use `vite build --mode lib` to build a library (plugin)
 * Use `vite build` or `vite build --mode app`to build a standalone application
 * Use `vite dev` to run the application in dev mode.
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
            vertesiaPluginBuilder({ inlineCss: CONFIG__inlineCss, input: 'src/ui/index.css' }),
        ],
        build: {
            outDir: 'dist/lib', // the plugin will be generated in the `dist/lib` directory
            lib: {
                entry: './src/ui/plugin.tsx', // Main entry point of your library
                formats: ['es'], // Build ESM versions
                fileName: "plugin",
            },
            minify: true,
            sourcemap: true,
            rollupOptions: {
                external: isExternal,
            }
        }
    }
}

/**
 * Vite configuration to run the application in dev mode
 * or to build a standalone application.
 * @returns
 */
function defineAppConfig(): UserConfig {

    return {
        base: './', // Use relative paths for assets
        plugins: [
            tailwindcss(),
            react(),
            // we need to use https for the firebase authentication to work
            basicSsl(),
            // serve lib/plugin.js content in dev mode
            serveStatic([
                {
                    pattern: new RegExp("/plugin.(js|css)"),
                    resolve: (groups: string[]) => `./dist/lib/plugin.${groups[1]}`
                },
            ]),
            // Mount the Hono tool server API as middleware (includes import transformers)
            ...apiServerPlugin(),
        ],
        build: {
            outDir: 'dist/ui', // UI app build goes to dist/ui/
        },
        // for authentication with Firebase
        server: {
            proxy: {
                '/__/auth': {
                    target: 'https://dengenlabs.firebaseapp.com',
                    changeOrigin: true,
                }
            }
        },
        resolve: {
            // For debug support in vertesia ui sources - link to the vertesia/ui location
            alias: VERTESIA_UI_PATH ? {
                "@vertesia/ui": resolve(`${VERTESIA_UI_PATH}/src`)
            } : undefined,
            // Deduplicate React to prevent multiple instances
            dedupe: ['react', 'react-dom']
        }
    }
}

function resolve(path: string) {
    return new URL(path, import.meta.url).pathname
}
