// ================== MCP Endpoints ==================

import { type Context, Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { authorize } from "../auth.js";
import type { ToolServerConfig } from "../index.js";
import type { MCPProviderConfig } from "./types.js";



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

async function readJsonBody(ctx: Context): Promise<Record<string, unknown>> {
    try {
        const text = await ctx.req.text();
        const jsonContent = text?.trim() || '';
        if (!jsonContent) return {};
        return JSON.parse(jsonContent) as Record<string, unknown>;
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        throw new HTTPException(400, {
            message: `Failed to parse JSON body: ${message}`
        });
    }
}
