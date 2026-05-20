/**
 * Node.js HTTP Server Entry Point
 *
 * This file starts a standalone Node.js HTTP server using @hono/node-server.
 * Use this for:
 * - Local development and testing
 * - Deploying to Cloud Run, Railway, Fly.io, etc.
 * - Running in Docker containers
 */
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import type { Context, Next } from 'hono';
import server from './server.js';

const port = parseInt(process.env.PORT || '3000', 10);

console.log(`Starting Tool Server on port ${port}...`);
console.log(`API endpoint: http://localhost:${port}/api`);
console.log(`Web UI: http://localhost:${port}/`);

const staticFile = serveStatic({ root: './dist' });
const appShell = serveStatic({ root: './dist', path: 'app/index.html' });

function shouldServeAppShell(c: Context): boolean {
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
        return false;
    }
    if (c.req.path.startsWith('/api')) {
        return false;
    }
    return !/\.[^/]+$/.test(c.req.path);
}

// Hono's SDK notFound handler returns API-shaped JSON. Keep API misses on that path,
// but serve the SPA shell for deep links so published app routes work directly.
server.all('*', async (c: Context, next: Next) => {
    if (c.req.path.startsWith('/api')) {
        return next();
    }

    const response = await staticFile(c, async () => undefined);
    if (response) {
        return response;
    }

    if (shouldServeAppShell(c)) {
        return appShell(c, next);
    }

    return next();
});

serve({
    fetch: server.fetch,
    port,
}, (info) => {
    console.log(`✓ Server is running at http://localhost:${info.port}`);
});
