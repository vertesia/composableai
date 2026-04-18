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

const port = parseInt(process.env.PORT || '3000', 10);

console.log(`Starting Tool Server on port ${port}...`);
console.log(`API endpoint: http://localhost:${port}/api`);
console.log(`Web UI: http://localhost:${port}/`);

// Add static file serving for widgets, scripts, and other assets.
// Cast: Hono 4.12's use() types middleware path as literal "*", which triggers
// structural mismatch with @hono/node-server's generic serveStatic middleware.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
server.use(serveStatic({ root: './dist' }) as any);

serve({
    fetch: server.fetch,
    port,
}, (info) => {
    console.log(`✓ Server is running at http://localhost:${info.port}`);
});
