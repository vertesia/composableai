// ================== Skill Endpoints ==================

import { Context, Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { SkillCollection } from "../SkillCollection.js";
import { SkillDefinition, ToolCollectionDefinition, ToolDefinition } from "../types.js";
import { makeScriptUrl } from "../utils.js";
import { ToolContext, ToolServerConfig } from "./types.js";

export function createSkillsRoute(app: Hono, basePath: string, config: ToolServerConfig) {
    const { skills = [] } = config;

    // Build a map of skill name -> collection for routing
    const skillToCollection = new Map<string, SkillCollection>();
    for (const coll of skills) {
        for (const skill of coll.getSkillDefinitions()) {
            skillToCollection.set(skill.name, coll);
            // Also map the learn_ prefixed name
            skillToCollection.set(`learn_${skill.name}`, coll);
        }
    }

    // GET /api/skills - Returns all skills from all collections
    app.get(basePath, (c) => {
        const url = new URL(c.req.url);
        const allSkills: ToolDefinition[] = [];

        for (const coll of skills) {
            allSkills.push(...coll.getToolDefinitions());
        }

        return c.json({
            src: `${url.origin}${url.pathname}`,
            title: 'All Skills',
            description: 'All available skills across all collections',
            tools: allSkills,
            collections: skills.map(s => ({
                name: s.name,
                title: s.title,
                description: s.description,
            })),
        } satisfies ToolCollectionDefinition & { collections: any[] });
    });

    // POST /api/skills - Route to the correct collection based on tool_name
    app.post(basePath, async (c) => {
        const ctx = c as unknown as ToolContext;

        // Payload is already parsed and validated by middleware
        if (!ctx.payload) {
            throw new HTTPException(400, {
                message: 'Invalid or missing skill execution payload. Expected { tool_use: { id, tool_name, tool_input? }, metadata? }'
            });
        }

        const toolName = ctx.payload.tool_use.tool_name;

        // Find the collection for this skill
        const collection = skillToCollection.get(toolName);
        if (!collection) {
            // Extract skill name for better error message
            const skillName = toolName.startsWith('learn_') ? toolName.slice(6) : toolName;
            throw new HTTPException(404, {
                message: `Skill not found: ${skillName}. Available skills: ${Array.from(skillToCollection.keys()).filter(k => !k.startsWith('learn_')).join(', ')}`
            });
        }

        // Delegate to the collection's execute method with pre-parsed payload
        return collection.execute(c, ctx.payload);
    });

    // Create skill collection endpoints (exposed as tools)
    for (const coll of skills) {
        app.route(`${basePath}/${coll.name}`, createSkillEndpoints(coll));
    }

}

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
        const skillName = name.startsWith('learn_') ? name.slice(6) : name;
        const skill = coll.getSkill(skillName);
        if (!skill) {
            throw new HTTPException(404, {
                message: `Skill not found: ${skillName}`
            });
        }
        const url = new URL(c.req.url);
        return c.json({
            skill_name: skill.name,
            scripts: skill.scripts ? skill.scripts.map(s => makeScriptUrl(url.origin, s)) : []
        });
    });


    // Get a specific skill by name
    endpoint.get('/:name', (c: Context) => {
        const name = c.req.param('name');
        // Handle both "learn_name" and "name" formats
        const skillName = name.startsWith('learn_') ? name.slice(6) : name;
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
