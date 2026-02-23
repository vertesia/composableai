// ================== Content Type Endpoints ==================

import { InCodeTypeDefinition } from "@vertesia/common";
import { Context, Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { ContentTypesCollection } from "../ContentTypesCollection.js";
import { ToolServerConfig } from "./types.js";
import { toPathName } from "../utils.js";

export function createContentTypesRoute(app: Hono, basePath: string, config: ToolServerConfig) {
    const { types = [] } = config;

    // GET /api/types - Returns all interactions from all collections
    app.get(basePath, (c) => {
        const allTypes: InCodeTypeDefinition[] = [];

        for (const coll of types) {
            for (const type of coll.types) {
                allTypes.push({ ...type, id: coll.name + ":" + toPathName(type.name) });
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
        const parts = name.split(':');
        if (parts.length !== 2) {
            throw new HTTPException(400, {
                message: "Invalid content type name. Expected format 'collection:type'"
            });
        }
        const collName = parts[0];
        const typeName = toPathName(parts[1]);
        const ctype = types.find(t => t.name === collName)?.getTypeByName(typeName);
        if (ctype) {
            return c.json({ ...ctype, id: collName + ":" + typeName });
        }

        throw new HTTPException(404, {
            message: "No content type found with name: " + name
        });
    });

}




function createContentTypeEndpoints(coll: ContentTypesCollection): Hono {
    const endpoint = new Hono();

    endpoint.get('/', (c: Context) => {
        return c.json(coll.types.map(t => ({ ...t, id: coll.name + ":" + toPathName(t.name) })));
    });

    endpoint.get('/:name', (c: Context) => {
        const name = c.req.param('name');
        const ctype = coll.types.find(t => toPathName(t.name) === name);
        if (!ctype) {
            throw new HTTPException(404, {
                message: "No content type found with name: " + name
            });
        }
        return c.json({
            ...ctype,
            id: coll.name + ":" + toPathName(ctype.name)
        });
    });


    return endpoint;
}