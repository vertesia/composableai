// ================== Interaction Endpoints ==================

import { CatalogInteractionRef } from "@vertesia/common";
import { Context, Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { authorize } from "../auth.js";
import { InteractionCollection } from "../InteractionCollection.js";
import { ToolServerConfig } from "./types.js";

export function createInteractionsRoute(app: Hono, basePath: string, config: ToolServerConfig) {
    const { interactions = [] } = config;

    // GET /api/interactions - Returns all interactions from all collections
    app.get(basePath, (c) => {
        const allInteractions: CatalogInteractionRef[] = [];

        for (const coll of interactions) {
            for (const inter of coll.interactions) {
                allInteractions.push({
                    type: "app",
                    id: coll.name + ":" + inter.name,
                    name: inter.name,
                    title: inter.title || inter.name,
                    description: inter.description,
                    tags: inter.tags || [],
                });
            }
        }

        return c.json({
            title: 'All Interactions',
            description: 'All available interactions across all collections',
            interactions: allInteractions,
            collections: interactions.map(i => ({
                name: i.name,
                title: i.title,
                description: i.description,
            })),
        });
    });

    // Create interaction collection endpoints
    for (const coll of interactions) {
        app.route(`${basePath}/${coll.name}`, createInteractionEndpoints(coll));
    }

    // GET /api/interactions/:name - Direct access to interaction by name (searches all collections)
    app.get(`${basePath}/:name`, async (c) => {
        await authorize(c);
        const name = c.req.param('name');

        const parts = name.split(':');
        if (parts.length !== 2) {
            throw new HTTPException(400, {
                message: "Invalid interaction name. Expected format 'collection:interaction'"
            });
        }
        const collName = parts[0];
        const interName = parts[1];
        const inter = interactions.find(t => t.name === collName)?.getInteractionByName(interName);
        if (inter) {
            return c.json({ ...inter, id: collName + ":" + interName });
        }

        throw new HTTPException(404, {
            message: "No interaction found with name: " + name
        });
    });

}




function createInteractionEndpoints(coll: InteractionCollection): Hono {
    const endpoint = new Hono();

    endpoint.get('/', (c: Context) => {
        return c.json(coll.interactions.map(inter => ({
            type: "app",
            id: coll.name + ":" + inter.name,
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
        return c.json({
            ...inter,
            id: coll.name + ":" + inter.name,
        });
    });

    return endpoint;
}