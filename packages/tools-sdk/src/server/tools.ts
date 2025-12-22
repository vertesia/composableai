import { Context, Hono } from "hono";
import { ToolCollection } from "../ToolCollection.js";
import { ToolCollectionDefinition, ToolDefinition } from "../types.js";
import { ToolServerConfig } from "./types.js";

export function createToolsRoute(app: Hono, basePath: string, config: ToolServerConfig) {

    const { tools = [] } = config;

    // GET /api/tools - Returns all tools from all collections
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
        } satisfies ToolCollectionDefinition & { collections: any[] });
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

    endpoint.get('/', (c) => {
        const importSourceUrl = c.req.query('import') != null;
        const url = new URL(c.req.url);
        return c.json({
            src: importSourceUrl
                ? `${url.origin}/libs/vertesia-tools-${coll.name}.js`
                : `${url.origin}${url.pathname}`,
            title: coll.title || coll.name,
            description: coll.description || '',
            tools: coll.getToolDefinitions()
        } satisfies ToolCollectionDefinition);
    });

    return endpoint;
}