import { ToolCollection, ToolCollectionDefinition } from "@vertesia/tools-sdk";
import { Context, Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { collections } from "./collections/index.js";

function createServer(collections: ToolCollection[], prefix = '/api') {
    prefix = prefix.trim();
    const app = new Hono();

    // Add CORS middleware globally
    app.use('*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'OPTIONS'] }));

    // Add base API route
    app.get(prefix, (c) => {
        return c.json({
            message: 'Tool Collections API',
            version: '1.0.0',
            endpoints: {
                collections: collections.map(col => `${prefix}/${col.name}`)
            }
        });
    });

    // Create endpoints for tool collections
    for (const col of collections) {
        app.route(`${prefix}/${col.name}`, createCollectionEndpoints(col));
    }

    // Global error handler
    app.onError((err, c) => {
        if (err instanceof HTTPException) {
            return c.json({
                error: err.message,
            }, err.status);
        }
        console.error('Uncaught Error:', err);
        return c.json({
            error: 'Internal Server Error',
        }, 500)
    })

    return app;
}

const server = createServer(collections);

export default server;

/**
 * Create endpoints for a tool collection
 */
function createCollectionEndpoints(coll: ToolCollection) {
    const endpoint = new Hono();

    // POST endpoint to execute tools
    endpoint.post('/', (c: Context) => {
        return coll.execute(c);
    });

    // GET endpoint to retrieve collection metadata and tool definitions
    endpoint.get('/', (c) => {
        const url = new URL(c.req.url);
        return c.json({
            src: `${url.origin}${url.pathname}`,
            title: coll.title || coll.name,
            description: coll.description,
            tools: coll.getToolDefinitions()
        } satisfies ToolCollectionDefinition);
    });

    return endpoint;
}
