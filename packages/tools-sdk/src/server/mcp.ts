// ================== MCP Endpoints ==================

import { Context, Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { authorize } from "../auth.js";
import { ToolServerConfig } from "../index.js";
import { MCPProviderConfig } from "./types.js";



export function createMcpRoute(app: Hono, basePath: string, config: ToolServerConfig) {
    const { mcpProviders = [] } = config;
    // Create MCP provider endpoints
    if (mcpProviders.length > 0) {
        app.route(basePath, createMCPEndpoints(mcpProviders));
    }

}

function createMCPEndpoints(providers: MCPProviderConfig[]): Hono {
    const endpoint = new Hono();

    for (const p of providers) {
        endpoint.post(`/${p.name}`, async (c: Context) => {
            const session = await authorize(c);
            const config = await readJsonBody(c);
            const info = await p.createMCPConnection(session, config);
            return c.json(info);
        });

        endpoint.get(`/${p.name}`, (c: Context) => c.json({
            name: p.name,
            description: p.description,
        }));
    }

    return endpoint;
}

async function readJsonBody(ctx: Context): Promise<Record<string, any>> {
    try {
        const text = await ctx.req.text();
        const jsonContent = text?.trim() || '';
        if (!jsonContent) return {};
        return JSON.parse(jsonContent) as Record<string, any>;
    } catch (err: any) {
        throw new HTTPException(400, {
            message: "Failed to parse JSON body: " + err.message
        });
    }
}
