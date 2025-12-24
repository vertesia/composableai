import { ToolDefinition } from "@llumiverse/common";
import { Context, Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { SkillCollection } from "../SkillCollection.js";
import { SkillDefinition, ToolCollectionDefinition } from "../types.js";
import { ToolServerConfig } from "./types.js";
import { makeScriptUrl } from "../utils.js";

export function createSkillsRoute(app: Hono, basePath: string, config: ToolServerConfig) {
    const { skills = [] } = config;
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
        const skillName = name.startsWith('skill_') ? name.slice(6) : name;
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
        // Handle both "skill_name" and "name" formats
        const skillName = name.startsWith('skill_') ? name.slice(6) : name;
        const skill = coll.getSkill(skillName);
        if (!skill) {
            throw new HTTPException(404, {
                message: `Skill not found: ${skillName}`
            });
        }
        const url = new URL(c.req.url);
        return c.json({
            ...skill,
            scripts: skill.scripts ? skill.scripts.map(s => makeScriptUrl(url.origin, s)) : undefined
        } satisfies SkillDefinition);
    });

    // Execute skill (standard tool execution format)
    endpoint.post('/', (c: Context) => {
        return coll.execute(c);
    });

    return endpoint;
}
