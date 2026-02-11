// ================== Content Type Endpoints ==================

import { InCodeTypeDefinition } from "@vertesia/common";
import { Context, Hono } from "hono";
import { ContentTypesCollection } from "../ContentTypesCollection.js";
import { ToolServerConfig } from "./types.js";
import { HTTPException } from "hono/http-exception";

export function createContentTypesRoute(app: Hono, basePath: string, config: ToolServerConfig) {
    const { types = [] } = config;

    // GET /api/types - Returns all interactions from all collections
    app.get(basePath, (c) => {
        const allTypes: InCodeTypeDefinition[] = [];

        for (const coll of types) {
            for (const type of coll.types) {
                allTypes.push(type);
            }
        }

        return c.json({
            title: 'All Content Types',
            description: 'All available content types across all collections',
            types: allTypes,
            collections: types.map(i => ({
                name: i.name,
                title: i.title,
                description: i.description,
            })),
        });
    });

    // Create interaction collection endpoints
    for (const coll of types) {
        app.route(`${basePath}/${coll.name}`, createContentTypeEndpoints(coll));
    }

    // GET /api/types/:name - Direct access to content type
    app.get(`${basePath}/:name`, async (c) => {
        const name = c.req.param('name');

        // Search across all collections for the interaction
        for (const coll of types) {
            const inter = coll.getTypeByName(name);
            if (inter) {
                return c.json(inter);
            }
        }

        throw new HTTPException(404, {
            message: "No interaction found with name: " + name
        });
    });

}




function createContentTypeEndpoints(coll: ContentTypesCollection): Hono {
    const endpoint = new Hono();

    endpoint.get('/', (c: Context) => {
        return c.json(coll.types);
    });



    return endpoint;
}