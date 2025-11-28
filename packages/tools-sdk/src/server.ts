import { CatalogInteractionRef } from "@vertesia/common";
import { Context, Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { authorize } from "./auth.js";
import { InteractionCollection } from "./InteractionCollection.js";
import {
    indexPage,
    interactionCollectionPage,
    skillCollectionPage,
    toolCollectionPage
} from "./site/templates.js";
import { SkillCollection } from "./SkillCollection.js";
import { ToolCollection } from "./ToolCollection.js";
import type {
    SkillDefinition,
    ToolCollectionDefinition
} from "./types.js";

/**
 * MCP Provider interface for server configuration
 */
export interface MCPProviderConfig {
    name: string;
    description?: string;
    createMCPConnection: (session: any, config: Record<string, any>) => Promise<{
        name: string;
        url: string;
        token: string;
    }>;
}

/**
 * Server configuration options
 */
export interface ToolServerConfig {
    /**
     * Server title for HTML pages (default: 'Tools Server')
     */
    title?: string;
    /**
     * API prefix (default: '/api')
     */
    prefix?: string;
    /**
     * Tool collections to expose
     */
    tools?: ToolCollection[];
    /**
     * Interaction collections to expose
     */
    interactions?: InteractionCollection[];
    /**
     * Skill collections to expose
     */
    skills?: SkillCollection[];
    /**
     * MCP providers to expose
     */
    mcpProviders?: MCPProviderConfig[];
    /**
     * Disable HTML pages (default: false)
     */
    disableHtml?: boolean;
}

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
        title = 'Tools Server',
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
        // Index page
        app.get('/', (c) => {
            return c.html(indexPage(tools, skills, interactions, title));
        });

        // Tool collection pages
        for (const coll of tools) {
            app.get(`/tools/${coll.name}`, (c) => {
                return c.html(toolCollectionPage(coll));
            });
        }

        // Skill collection pages
        for (const coll of skills) {
            app.get(`/skills/${coll.name}`, (c) => {
                return c.html(skillCollectionPage(coll));
            });
        }

        // Interaction collection pages
        for (const coll of interactions) {
            app.get(`/interactions/${coll.name}`, (c) => {
                return c.html(interactionCollectionPage(coll));
            });
        }
    }

    // Add base API route
    app.get(prefix, (c) => {
        return c.json({
            message: 'Vertesia Tools API',
            version: '1.0.0',
            endpoints: {
                tools: tools.map(col => `${prefix}/tools/${col.name}`),
                interactions: interactions.map(col => `${prefix}/interactions/${col.name}`),
                skills: skills.map(col => `${prefix}/skills/${col.name}`),
                mcp: mcpProviders.map(p => `${prefix}/mcp/${p.name}`),
            }
        });
    });

    // Create tool collection endpoints
    for (const coll of tools) {
        app.route(`${prefix}/tools/${coll.name}`, createToolEndpoints(coll));
        // Also expose at root for backwards compatibility
        app.route(`${prefix}/${coll.name}`, createToolEndpoints(coll));
    }

    // Create interaction collection endpoints
    for (const coll of interactions) {
        app.route(`${prefix}/interactions/${coll.name}`, createInteractionEndpoints(coll));
    }

    // Create skill collection endpoints (exposed as tools)
    for (const coll of skills) {
        app.route(`${prefix}/skills/${coll.name}`, createSkillEndpoints(coll));
    }

    // Create MCP provider endpoints
    if (mcpProviders.length > 0) {
        app.route(`${prefix}/mcp`, createMCPEndpoints(mcpProviders));
    }

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

// ================== Tool Endpoints ==================

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

// ================== Interaction Endpoints ==================

function createInteractionEndpoints(coll: InteractionCollection): Hono {
    const endpoint = new Hono();

    endpoint.get('/', (c: Context) => {
        return c.json(coll.interactions.map(inter => ({
            type: "app",
            id: inter.name,
            name: inter.name,
            title: inter.title || inter.name,
            description: inter.description,
            tags: inter.tags || [],
        } satisfies CatalogInteractionRef)));
    });

    endpoint.get('/:name', async (c: Context) => {
        await authorize(c);
        const name = c.req.param('name');
        const inter = coll.getInteractionByName(name);
        if (!inter) {
            throw new HTTPException(404, {
                message: "No interaction found with name: " + name
            });
        }
        return c.json(inter);
    });

    return endpoint;
}

// ================== Skill Endpoints ==================

function createSkillEndpoints(coll: SkillCollection): Hono {
    const endpoint = new Hono();

    // List skills as tool definitions (tool collection format)
    // This allows skills to be used exactly like tools
    endpoint.get('/', (c: Context) => {
        const url = new URL(c.req.url);
        return c.json({
            src: `${url.origin}${url.pathname}`,
            title: coll.title || coll.name,
            description: coll.description || '',
            tools: coll.getToolDefinitions()
        } satisfies ToolCollectionDefinition);
    });

    // Get scripts for a specific skill
    // Returns all scripts bundled with the skill
    endpoint.get('/:name/scripts', (c: Context) => {
        const name = c.req.param('name');
        const skillName = name.startsWith('skill_') ? name.slice(6) : name;
        const skill = coll.getSkill(skillName);
        if (!skill) {
            throw new HTTPException(404, {
                message: `Skill not found: ${skillName}`
            });
        }
        return c.json({
            skill_name: skill.name,
            scripts: skill.scripts || []
        });
    });

    // Get a specific script file
    endpoint.get('/:name/scripts/:filename', (c: Context) => {
        const name = c.req.param('name');
        const filename = c.req.param('filename');
        const skillName = name.startsWith('skill_') ? name.slice(6) : name;
        const skill = coll.getSkill(skillName);
        if (!skill) {
            throw new HTTPException(404, {
                message: `Skill not found: ${skillName}`
            });
        }
        const script = skill.scripts?.find(s => s.name === filename);
        if (!script) {
            throw new HTTPException(404, {
                message: `Script not found: ${filename}`
            });
        }
        // Return as plain text with appropriate content type
        const contentType = filename.endsWith('.py') ? 'text/x-python'
            : filename.endsWith('.sh') ? 'text/x-shellscript'
            : filename.endsWith('.js') ? 'text/javascript'
            : 'text/plain';
        return c.text(script.content, 200, { 'Content-Type': contentType });
    });

    // Get a specific skill by name
    endpoint.get('/:name', (c: Context) => {
        const name = c.req.param('name');
        // Handle both "skill_name" and "name" formats
        const skillName = name.startsWith('skill_') ? name.slice(6) : name;
        const skill = coll.getSkill(skillName);
        if (!skill) {
            throw new HTTPException(404, {
                message: `Skill not found: ${skillName}`
            });
        }
        return c.json(skill satisfies SkillDefinition);
    });

    // Execute skill (standard tool execution format)
    endpoint.post('/', (c: Context) => {
        return coll.execute(c);
    });

    return endpoint;
}

// ================== MCP Endpoints ==================

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

// ================== Server Utilities ==================

/**
 * Simple development server with static file handling
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
