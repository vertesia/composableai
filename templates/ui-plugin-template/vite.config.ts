import tailwindcss from '@tailwindcss/vite';
import { vertesiaPluginBuilder } from '@vertesia/plugin-builder';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { defineConfig, type ConfigEnv, type UserConfig } from 'vite';
import serveStatic from "vite-plugin-serve-static";


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
        return defineAppConfig(env);
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
            vertesiaPluginBuilder({ inlineCss: CONFIG__inlineCss }),
        ],
        build: {
            outDir: 'dist/lib', // the plugin will be generated in the `dist/lib` directory
            lib: {
                entry: './src/plugin.tsx', // Main entry point of your library
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
function defineAppConfig({ command }: ConfigEnv): UserConfig {
    // DEV_MODE is used by appgen/sandbox previews. Vercel also proxies to the
    // framework dev server over HTTP, so both modes disable HTTPS.
    const useHttps = process.env.DEV_MODE !== '1' && process.env.VERCEL !== '1';
    const base = command === 'build' ? '/app/' : '/';
    const devApiTarget = process.env.VERTESIA_STUDIO_PROXY_TARGET
        ?? process.env.VITE_VERTESIA_STUDIO_PROXY_TARGET
        ?? 'https://api.dev1.vertesia.io';

    return {
        base,
        plugins: [
            tailwindcss(),
            react(),
            // HTTPS is required for Firebase auth but must be disabled under appgen/Vercel dev.
            ...(useHttps ? [basicSsl()] : []),
            // serve lib/plugin.js content in dev mode
            serveStatic([
                {
                    pattern: new RegExp("/plugin.(js|css)"),
                    resolve: (groups: string[]) => `./dist/lib/plugin.${groups[1]}`
                },
            ]),
        ],
        optimizeDeps: process.env.DEV_MODE === '1'
            ? { include: ['html-parse-stringify', 'use-sync-external-store/shim'] }
            : undefined,
        // for authentication with Firebase
        server: {
            hmr: process.env.APPGEN_DISABLE_HMR === '1' ? false : undefined,
            proxy: {
                '/vertesia-api': {
                    target: devApiTarget,
                    changeOrigin: true,
                    secure: true,
                    rewrite: (path) => path.replace(/^\/vertesia-api/, ''),
                },
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
