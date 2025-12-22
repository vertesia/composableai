import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { createInteractionsRoute } from "./server/interactions.js";
import { createMcpRoute } from "./server/mcp.js";
import { createSkillsRoute } from "./server/skills.js";
import { createToolsRoute } from "./server/tools.js";
import { ToolServerConfig } from "./server/types.js";


/**
 * Create a Hono server for tools, interactions, and skills.
 *
 * @example
 * ```typescript
 * import { createToolServer, ToolCollection, SkillCollection } from "@vertesia/tools-sdk";
 *
 * const server = createToolServer({
 *     tools: [myToolCollection],
 *     skills: [mySkillCollection],
 * });
 *
 * export default server;
 * ```
 */
export function createToolServer(config: ToolServerConfig): Hono {
    const {
        prefix = '/api',
        tools = [],
        interactions = [],
        skills = [],
        mcpProviders = [],
        disableHtml = false,
    } = config;

    const app = new Hono();

    // Add CORS middleware globally
    app.use('*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'OPTIONS'] }));

    // HTML pages (unless disabled)
    if (!disableHtml) {
        //createSitePages(app, '', config);
    }

    // Skills are exposed as tools, so include them in the tools list
    const allToolEndpoints = [
        ...tools.map(col => `${prefix}/tools/${col.name}`),
        ...skills.map(col => `${prefix}/skills/${col.name}`),
    ];

    const allWidgets = skills.flatMap(col => col.getWidgets());

    // Add base API route
    app.get(prefix, (c) => {
        return c.json({
            message: 'Vertesia Tools API',
            version: '1.0.0',
            widgets: allWidgets,
            endpoints: {
                tools: allToolEndpoints,
                interactions: interactions.map(col => `${prefix}/interactions/${col.name}`),
                mcp: mcpProviders.map(p => `${prefix}/mcp/${p.name}`),
            }
        });
    });

    createToolsRoute(app, `${prefix}/tools`, config);
    createSkillsRoute(app, `${prefix}/skills`, config);
    createInteractionsRoute(app, `${prefix}/interactions`, config);
    createMcpRoute(app, `${prefix}/mcp`, config);

    // Global error handler
    app.onError((err, c) => {
        if (err instanceof HTTPException) {
            return c.json({ error: err.message }, err.status);
        }
        console.error('Uncaught Error:', err);
        return c.json({ error: 'Internal Server Error' }, 500);
    });

    return app;
}

