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
import server from './server.js';
import type { Context, Next } from 'hono';

const port = parseInt(process.env.PORT || '3000', 10);

console.log(`Starting Tool Server on port ${port}...`);
console.log(`API endpoint: http://localhost:${port}/api`);
console.log(`Web UI: http://localhost:${port}/`);

// Add static file serving for widgets, scripts, and other assets
const staticFile = serveStatic({ root: './dist' });
server.all("*", async (c: Context, next: Next) => {
    // Serve static resources from dist/
    return staticFile(c, next);
});

serve({
    fetch: server.fetch,
    port,
}, (info) => {
    console.log(`✓ Server is running at http://localhost:${info.port}`);
});
