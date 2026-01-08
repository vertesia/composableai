import { Context, Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { createInteractionsRoute } from "./server/interactions.js";
import { createMcpRoute } from "./server/mcp.js";
import { createSiteRoute } from "./server/site.js";
import { createSkillsRoute } from "./server/skills.js";
import { createToolsRoute } from "./server/tools.js";
import { ToolServerConfig } from "./server/types.js";
import { createWidgetsRoute } from "./server/widgets.js";



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

    // Middleware to extract tool_use_id and tool_name from POST requests for error handling
    app.use('*', async (c, next) => {
        if (c.req.method === 'POST') {
            try {
                // Clone the request to read the body without consuming it
                const clonedReq = c.req.raw.clone();
                const body = await clonedReq.json();
                if (body?.tool_use?.id) {
                    (c as any).toolUseId = body.tool_use.id;
                }
                if (body?.tool_use?.tool_name) {
                    (c as any).toolName = body.tool_use.tool_name;
                }
            } catch {
                // Ignore parsing errors - body might not be JSON
            }
        }
        await next();
    });

    // HTML pages (unless disabled)
    if (!disableHtml) {
        createSiteRoute(app, '', config);
    }

    // Add base API route
    app.get(prefix, (c) => {
        // Skills are exposed as tools, so include them in the tools list
        const allToolEndpoints = [
            ...tools.map(col => `${prefix}/tools/${col.name}`),
            ...skills.map(col => `${prefix}/skills/${col.name}`),
        ];
        return c.json({
            message: 'Vertesia Tools API',
            version: '1.0.0',
            endpoints: {
                tools: allToolEndpoints,
                interactions: interactions.map(col => `${prefix}/interactions/${col.name}`),
                mcp: mcpProviders.map(p => `${prefix}/mcp/${p.name}`),
            }
        });
    });

    createToolsRoute(app, `${prefix}/tools`, config);
    createSkillsRoute(app, `${prefix}/skills`, config);
    createWidgetsRoute(app, `${prefix}/widgets`, config);
    createInteractionsRoute(app, `${prefix}/interactions`, config);
    createMcpRoute(app, `${prefix}/mcp`, config);


    // Global error handler - returns ToolExecutionResponseError format
    app.onError((err, c) => {
        const toolUseId = (c as any).toolUseId as string || 'unknown';
        const toolName = (c as any).toolName as string | undefined;
        const status = err instanceof HTTPException ? err.status : 500;
        const errorMessage = err instanceof HTTPException ? err.message : 'Internal Server Error';

        if (!(err instanceof HTTPException)) {
            console.error('Uncaught Error:', err);
        }

        return c.json({
            tool_use_id: toolUseId,
            status,
            error: errorMessage,
            data: toolName ? { tool_name: toolName } : undefined,
        }, status);
    });

    // Not found handler - returns ToolExecutionResponseError format
    app.notFound((c) => {
        const toolUseId = (c as any).toolUseId as string || 'unknown';
        const toolName = (c as any).toolName as string | undefined;
        return c.json({
            tool_use_id: toolUseId,
            status: 404,
            error: `Not found: ${c.req.method} ${c.req.path}`,
            data: toolName ? { tool_name: toolName } : undefined,
        }, 404);
    });

    return app;
}



// ================== Server Utilities ==================

/**
 * Simple development server with static fimesale handling
 * 
 * @deprecated Use tools server template 
 */
export function createDevServer(config: ToolServerConfig & {
    staticHandler?: (c: Context, next: () => Promise<void>) => Promise<Response | void>;
}): Hono {
    const app = createToolServer(config);

    if (config.staticHandler) {
        app.use('*', config.staticHandler);
    }

    return app;
}

