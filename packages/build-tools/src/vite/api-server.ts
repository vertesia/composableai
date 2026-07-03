/**
 * Vite plugin set that mounts a Vertesia Hono tool server as middleware on
 * the Vite dev server. Includes the Vertesia import transformers needed by
 * `ssrLoadModule` to handle `?skill` / `?template` / `?prompt` / `?raw`
 * imports in the tool server source.
 *
 *   - `vite dev`     → loads the server entry via `ssrLoadModule` (source,
 *                      with HMR invalidation)
 *   - `vite preview` → loads the compiled server from `lib/` (validates
 *                      production output)
 *
 * The Hono app is served on the same port as Vite under `/api`.
 *
 * @example
 * ```typescript
 * // vite.config.ts
 * import { defineConfig } from 'vite';
 * import { apiServerPlugin } from '@vertesia/build-tools/vite';
 *
 * export default defineConfig({
 *     plugins: [
 *         apiServerPlugin({ entry: './src/tool-server/server.ts' }),
 *     ],
 * });
 * ```
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { getRequestListener } from '@hono/node-server';
import type { Plugin, ViteDevServer } from 'vite';
import { vertesiaDevServerPlugin } from './dev-server.js';

interface HonoApp {
    fetch: (request: Request, env?: unknown, executionCtx?: unknown) => Response | Promise<Response>;
}

type NextHandleFunction = (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => void;

export interface ApiServerPluginOptions {
    /**
     * Tool server entry point (TypeScript source). Resolved by Vite from the
     * project root in dev mode.
     * @default './src/tool-server/server.ts'
     */
    entry?: string;

    /**
     * Compiled server module path used in preview mode. Resolved relative to
     * `process.cwd()` (the consuming project's root when running `vite preview`).
     * @default './lib/server.js'
     */
    compiledEntry?: string;

    /**
     * Path prefix that routes requests to the Hono server. Requests whose URL
     * starts with this prefix are forwarded; others fall through to Vite.
     * @default '/api'
     */
    apiPrefix?: string;

    /**
     * Names of transformers to enable in dev mode. Defaults to all built-ins
     * (`skill`, `skills`, `template`, `templates`, `prompt`, `raw`).
     */
    transformers?: readonly string[];
}

export function apiServerPlugin(options: ApiServerPluginOptions = {}): Plugin[] {
    const {
        entry = './src/tool-server/server.ts',
        compiledEntry = './lib/server.js',
        apiPrefix = '/api',
        transformers,
    } = options;

    // Resolve compiled entry relative to the consumer's cwd. Vite is run from
    // the project root by convention, so this lands at the right file.
    const absoluteCompiledEntry = path.resolve(process.cwd(), compiledEntry);

    return [
        // Vertesia query-import transformer (skill / raw / prompt / template etc.).
        vertesiaDevServerPlugin(transformers ? { transformers } : undefined),

        // Hono middleware bridge for dev + preview.
        {
            name: 'vertesia-api-server',

            configureServer(server: ViteDevServer) {
                server.middlewares.use(createDevListener(server, entry, apiPrefix));
            },

            configurePreviewServer(server) {
                server.middlewares.use(createPreviewListener(absoluteCompiledEntry, apiPrefix));
            },
        },
    ];
}

/**
 * Connect-compatible middleware that loads the Hono app from source via
 * Vite's `ssrLoadModule` (preserving HMR invalidation on changes).
 */
function createDevListener(server: ViteDevServer, entry: string, apiPrefix: string): NextHandleFunction {
    return async (req, res, next) => {
        if (!req.url?.startsWith(apiPrefix)) {
            return next();
        }
        try {
            const mod = await server.ssrLoadModule(entry);
            const app = mod.default as HonoApp;
            const requestListener = getRequestListener(app.fetch);
            void requestListener(req, res);
        } catch (e) {
            next(e);
        }
    };
}

/**
 * Connect-compatible middleware that loads the compiled Hono app from `lib/`
 * for production validation. The compiled module is cached after first load
 * (no HMR in preview mode).
 */
function createPreviewListener(compiledEntry: string, apiPrefix: string): NextHandleFunction {
    let appPromise: Promise<HonoApp> | null = null;
    return async (req, res, next) => {
        if (!req.url?.startsWith(apiPrefix)) {
            return next();
        }
        try {
            if (!appPromise) {
                appPromise = import(compiledEntry).then((mod) => mod.default);
            }
            const app = await appPromise;
            const requestListener = getRequestListener(app.fetch);
            void requestListener(req, res);
        } catch (e) {
            next(e);
        }
    };
}
