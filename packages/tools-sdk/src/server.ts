import { Context, Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { createInteractionsRoute } from "./server/interactions.js";
import { createMcpRoute } from "./server/mcp.js";
import { createSiteRoute } from "./server/site.js";
import { createSkillsRoute } from "./server/skills.js";
import { createToolsRoute } from "./server/tools.js";
import { ToolContext, ToolServerConfig } from "./server/types.js";
import { ToolExecutionPayload } from "./types.js";
import { createTemplatesRoute } from "./server/templates.js";
import { createWidgetsRoute } from "./server/widgets.js";
import { createPackageRoute } from "./server/app-package.js";
import { createContentTypesRoute } from "./server/content-types.js";

// Schema for tool execution payload
const ToolExecutionPayloadSchema = z.object({
    tool_use: z.object({
        id: z.string(),
        tool_name: z.string(),
        tool_input: z.record(z.string(), z.any()).default({}),
    }),
    metadata: z.record(z.string(), z.any()).optional(),
});



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
        templates = [],
        mcpProviders = [],
        disableHtml = false,
    } = config;

    const app = new Hono();

    // Add CORS middleware globally
    app.use('*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'OPTIONS'] }));

    // Middleware to parse and validate body, store on context for reuse
    app.use('*', async (c, next) => {
        const ctx = c as unknown as ToolContext;
        if (c.req.method === 'POST') {
            try {
                const text = await c.req.text();
                const body = JSON.parse(text);
                const result = ToolExecutionPayloadSchema.safeParse(body);
                if (result.success) {
                    ctx.payload = result.data as ToolExecutionPayload<any>;
                    ctx.toolUseId = result.data.tool_use.id;
                    ctx.toolName = result.data.tool_use.tool_name;
                }
                // If validation fails, still store raw body for error reporting
                // but don't set payload - handlers will return validation error
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
                templates: templates.map(col => `${prefix}/templates/${col.name}`),
                mcp: mcpProviders.map(p => `${prefix}/mcp/${p.name}`),
            }
        });
    });


    createPackageRoute(app, `${prefix}/package`, config);
    createToolsRoute(app, `${prefix}/tools`, config);
    createSkillsRoute(app, `${prefix}/skills`, config);
    createWidgetsRoute(app, `${prefix}/widgets`, config);
    createInteractionsRoute(app, `${prefix}/interactions`, config);
    createTemplatesRoute(app, `${prefix}/templates`, config);
    createContentTypesRoute(app, `${prefix}/types`, config);
    createMcpRoute(app, `${prefix}/mcp`, config);


    // Global error handler - returns ToolExecutionResponseError format
    app.onError((err, c) => {
        const ctx = c as unknown as ToolContext;
        const status = err instanceof HTTPException ? err.status : 500;
        const errorMessage = err instanceof HTTPException ? err.message : 'Internal Server Error';

        if (!(err instanceof HTTPException)) {
            console.error('Uncaught Error:', err);
        }

        return c.json({
            tool_use_id: ctx.toolUseId || 'unknown',
            status,
            error: errorMessage,
            data: ctx.toolName ? { tool_name: ctx.toolName } : undefined,
        }, status);
    });

    // Not found handler - returns ToolExecutionResponseError format
    app.notFound((c) => {
        const ctx = c as unknown as ToolContext;
        return c.json({
            tool_use_id: ctx.toolUseId || 'unknown',
            status: 404,
            error: `Not found: ${c.req.method} ${c.req.path}`,
            data: ctx.toolName ? { tool_name: ctx.toolName } : undefined,
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

