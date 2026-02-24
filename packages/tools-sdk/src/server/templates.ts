// ================== Template Endpoints ==================

import { Context, Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { RenderingTemplateCollection } from "../RenderingTemplateCollection.js";
import { ToolServerConfig } from "./types.js";

export function createTemplatesRoute(app: Hono, basePath: string, config: ToolServerConfig) {
    const { templates = [] } = config;

    // GET /api/templates - Returns all templates from all collections
    app.get(basePath, (c) => {
        const allTemplates = templates.flatMap(coll => coll.templates);

        return c.json({
            title: 'All Templates',
            description: 'All available templates across all collections',
            templates: allTemplates,
            collections: templates.map(t => ({
                name: t.name,
                title: t.title,
                description: t.description,
            })),
        });
    });

    // Create template collection endpoints
    for (const coll of templates) {
        app.route(`${basePath}/${coll.name}`, createTemplateEndpoints(coll));
    }

    // GET /api/templates/:name - Direct access by "collection:name" id format
    app.get(`${basePath}/:id`, async (c) => {
        const id = c.req.param('id');
        const parts = id.split(':');
        if (parts.length !== 2) {
            throw new HTTPException(400, {
                message: "Invalid template id. Expected format 'collection:name'"
            });
        }
        const collName = parts[0];
        const templateName = parts[1];
        const template = templates.find(t => t.name === collName)?.getTemplate(templateName);
        if (template) {
            return c.json(template);
        }

        throw new HTTPException(404, {
            message: "No template found with id: " + id
        });
    });
}

function createTemplateEndpoints(coll: RenderingTemplateCollection): Hono {
    const endpoint = new Hono();

    endpoint.get('/', (c: Context) => {
        return c.json(coll.templates);
    });

    endpoint.get('/:name', (c: Context) => {
        const name = c.req.param('name');
        const template = coll.templates.find(t => t.name === name);
        if (!template) {
            throw new HTTPException(404, {
                message: "No template found with name: " + name
            });
        }
        return c.json(template);
    });

    return endpoint;
}
