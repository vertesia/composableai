import { Context, Hono } from "hono";
import { ToolCollection } from "../ToolCollection.js";
import { ToolCollectionDefinition, ToolDefinition } from "../types.js";
import { ToolServerConfig } from "./types.js";

export function createToolsRoute(app: Hono, basePath: string, config: ToolServerConfig) {
    const { tools = [] } = config;
    // GET /api/tools - Returns all tools from all collections
    // Query params:
    //   - defaultOnly=true: Only return tools with default !== false
    //   - unlocked=tool1,tool2: Comma-separated list of unlocked tool names

    app.get(basePath, (c) => {
        const url = new URL(c.req.url);
        const defaultOnly = c.req.query('defaultOnly') === 'true';
        const unlockedParam = c.req.query('unlocked');
        const unlockedTools = unlockedParam ? unlockedParam.split(',').map(t => t.trim()).filter(Boolean) : [];

        const filterOptions = defaultOnly ? { defaultOnly, unlockedTools } : undefined;

        const allTools: ToolDefinition[] = [];
        let reserveToolCount = 0;

        for (const coll of tools) {
            allTools.push(...coll.getToolDefinitions(filterOptions));
            if (defaultOnly) {
                reserveToolCount += coll.getReserveTools(unlockedTools).length;
            }
        }

        return c.json({
            src: `${url.origin}${url.pathname}`,
            title: 'All Tools',
            description: 'All available tools across all collections',
            tools: allTools,
            reserveToolCount: defaultOnly ? reserveToolCount : undefined,
            collections: tools.map(t => ({
                name: t.name,
                title: t.title,
                description: t.description,
            })),
        } satisfies ToolCollectionDefinition & { collections: any[]; reserveToolCount?: number });
    });

    // Create tool collection endpoints
    for (const coll of tools) {
        app.route(`${basePath}/${coll.name}`, createToolEndpoints(coll));
        // Also expose at root for backwards compatibility
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
        const defaultOnly = c.req.query('defaultOnly') === 'true';
        const unlockedParam = c.req.query('unlocked');
        const unlockedTools = unlockedParam ? unlockedParam.split(',').map(t => t.trim()).filter(Boolean) : [];

        const filterOptions = defaultOnly ? { defaultOnly, unlockedTools } : undefined;
        const url = new URL(c.req.url);

        const response: ToolCollectionDefinition & { reserveToolCount?: number } = {
            src: importSourceUrl
                ? `${url.origin}/libs/vertesia-tools-${coll.name}.js`
                : `${url.origin}${url.pathname}`,
            title: coll.title || coll.name,
            description: coll.description || '',
            tools: coll.getToolDefinitions(filterOptions)
        };

        // Include reserve count when filtering
        if (defaultOnly) {
            response.reserveToolCount = coll.getReserveTools(unlockedTools).length;
        }

        return c.json(response);
    });

    return endpoint;
}



