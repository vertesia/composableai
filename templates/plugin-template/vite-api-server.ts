/**
 * Vite plugin that mounts the Hono tool server as middleware.
 *
 * - `vite dev`     → loads the server entry via ssrLoadModule (from source, with hot reload)
 * - `vite preview` → loads the compiled server from lib/ (validates production output)
 *
 * In both modes the API is served on the same port as the UI under /api.
 *
 * Includes the Rollup-compatible import transformers (?skill, ?template, ?prompt, ?raw)
 * needed by ssrLoadModule to process tool server source files.
 */
import type { Plugin, ViteDevServer } from 'vite';
import { getRequestListener } from '@hono/node-server';
import {
    vertesiaImportPlugin,
    skillTransformer,
    skillCollectionTransformer,
    templateTransformer,
    templateCollectionTransformer,
    promptTransformer,
    rawTransformer,
} from '@vertesia/build-tools';

export interface ApiServerPluginOptions {
    /**
     * The tool server entry point (TypeScript source).
     * Used in dev mode with ssrLoadModule.
     * @default './src/tool-server/server.ts'
     */
    entry?: string;

    /**
     * The compiled server module path.
     * Used in preview mode.
     * @default './lib/server.js'
     */
    compiledEntry?: string;
}

export function apiServerPlugin(options: ApiServerPluginOptions = {}): Plugin[] {
    const {
        entry = './src/tool-server/server.ts',
        compiledEntry = './lib/server.js',
    } = options;

    return [
        // Rollup-compatible transformers for tool server imports (?skill, ?template, etc.)
        vertesiaImportPlugin({
            transformers: [
                skillTransformer,
                skillCollectionTransformer,
                templateTransformer,
                templateCollectionTransformer,
                promptTransformer,
                rawTransformer,
            ],
            assetsDir: false, // don't copy assets in dev/preview
        }) as Plugin,

        // API server middleware
        {
            name: 'vite-api-server',

            // Dev mode: load server from source via ssrLoadModule
            configureServer(server: ViteDevServer) {
                const listener = createDevListener(server, entry);
                server.middlewares.use(listener);
            },

            // Preview mode: load compiled server from lib/
            configurePreviewServer(server) {
                const listener = createPreviewListener(compiledEntry);
                server.middlewares.use(listener);
            },
        },
    ];
}

/**
 * Creates a Connect-compatible middleware that loads the Hono app
 * from source via Vite's ssrLoadModule (with HMR invalidation).
 */
function createDevListener(server: ViteDevServer, entry: string) {
    return async (
        req: Parameters<Connect.NextHandleFunction>[0],
        res: Parameters<Connect.NextHandleFunction>[1],
        next: Parameters<Connect.NextHandleFunction>[2],
    ) => {
        // Only handle /api requests
        if (!req.url?.startsWith('/api')) {
            return next();
        }

        try {
            const mod = await server.ssrLoadModule(entry);
            const app = mod.default;
            const requestListener = getRequestListener(app.fetch);
            requestListener(req, res);
        } catch (e) {
            next(e);
        }
    };
}

/**
 * Creates a Connect-compatible middleware that loads the compiled
 * Hono app from lib/ for production validation.
 */
function createPreviewListener(compiledEntry: string) {
    // Cache the app — no hot reload in preview mode
    let appPromise: Promise<any> | null = null;

    return async (
        req: Parameters<Connect.NextHandleFunction>[0],
        res: Parameters<Connect.NextHandleFunction>[1],
        next: Parameters<Connect.NextHandleFunction>[2],
    ) => {
        if (!req.url?.startsWith('/api')) {
            return next();
        }

        try {
            if (!appPromise) {
                appPromise = import(compiledEntry).then(mod => mod.default);
            }
            const app = await appPromise;
            const requestListener = getRequestListener(app.fetch);
            requestListener(req, res);
        } catch (e) {
            next(e);
        }
    };
}

// Connect types from Vite's internals
declare namespace Connect {
    type NextHandleFunction = (
        req: import('node:http').IncomingMessage,
        res: import('node:http').ServerResponse,
        next: (err?: any) => void,
    ) => void;
}
