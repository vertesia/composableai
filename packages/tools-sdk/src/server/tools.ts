import { Context, Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { ToolCollection } from "../ToolCollection.js";
import { ToolCollectionDefinition, ToolDefinition } from "../types.js";
import { ToolContext, ToolServerConfig } from "./types.js";

export function createToolsRoute(app: Hono, basePath: string, config: ToolServerConfig) {
    const { tools = [] } = config;

    // Build a map of tool name -> collection for routing
    const toolToCollection = new Map<string, ToolCollection>();
    for (const coll of tools) {
        for (const toolDef of coll.getToolDefinitions()) {
            toolToCollection.set(toolDef.name, coll);
        }
    }

    // GET /api/tools - Returns all tools from all collections
    // Query params:
    //   - defaultOnly=true: Only return tools with default !== false
    //   - unlocked=tool1,tool2: Comma-separated list of unlocked tool names

    app.get(basePath, (c) => {
        const url = new URL(c.req.url);

        const allTools: ToolDefinition[] = [];

        for (const coll of tools) {
            allTools.push(...coll.getToolDefinitions());
        }

        return c.json({
            src: `${url.origin}${url.pathname}`,
            title: 'All Tools',
            description: 'All available tools across all collections',
            tools: allTools,
            collections: tools.map(t => ({
                name: t.name,
                title: t.title,
                description: t.description,
            })),
        } satisfies ToolCollectionDefinition & { collections: any[]; reserveToolCount?: number });
    });

    // POST /api/tools - Route to the correct collection based on tool_name
    app.post(basePath, async (c) => {
        const ctx = c as unknown as ToolContext;

        // Payload is already parsed and validated by middleware
        if (!ctx.payload) {
            throw new HTTPException(400, {
                message: 'Invalid or missing tool execution payload. Expected { tool_use: { id, tool_name, tool_input? }, metadata? }'
            });
        }

        const toolName = ctx.payload.tool_use.tool_name;

        // Find the collection for this tool
        const collection = toolToCollection.get(toolName);
        if (!collection) {
            throw new HTTPException(404, {
                message: `Tool not found: ${toolName}. Available tools: ${Array.from(toolToCollection.keys()).join(', ')}`
            });
        }

        // Delegate to the collection's execute method with pre-parsed payload
        return collection.execute(c, ctx.payload);
    });

    // Create tool collection endpoints
    for (const coll of tools) {
        app.route(`${basePath}/${coll.name}`, createToolEndpoints(coll));
    }
}

function createToolEndpoints(coll: ToolCollection): Hono {
    const endpoint = new Hono();

    endpoint.post('/', (c: Context) => {
        return coll.execute(c);
    });

    // GET /api/tools/{collection}
    // Query params:
    //   - import: Return import source URL instead of API URL
    //   - defaultOnly=true: Only return tools with default !== false
    //   - unlocked=tool1,tool2: Comma-separated list of unlocked tool names
    endpoint.get('/', (c) => {
        const importSourceUrl = c.req.query('import') != null;

        const url = new URL(c.req.url);

        const response: ToolCollectionDefinition = {
            src: importSourceUrl
                ? `${url.origin}/libs/vertesia-tools-${coll.name}.js`
                : `${url.origin}${url.pathname}`,
            title: coll.title || coll.name,
            description: coll.description || '',
            tools: coll.getToolDefinitions()
        };

        return c.json(response);
    });

    return endpoint;
}



