import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import server from './server.js';

const port = parseInt(process.env.PORT || '3000', 10);
console.log(`Starting Tool Server on port ${port}...`);
console.log(`API endpoint: http://localhost:${port}/api`);
console.log(`Web UI: http://localhost:${port}/`);
const staticFile = serveStatic({ root: './dist' });
server.all("*", async (c, next) => {
    return staticFile(c, next);
});
serve({
    fetch: server.fetch,
    port,
}, (info) => {
    console.log(`✓ Server is running at http://localhost:${info.port}`);
});
//# sourceMappingURL=server-node.js.map
