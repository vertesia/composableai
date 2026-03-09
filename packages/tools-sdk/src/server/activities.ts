import { RemoteActivityDefinition, RemoteActivityExecutionPayload } from "@vertesia/common";
import { Context, Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { ActivityCollection } from "../ActivityCollection.js";
import { ToolServerConfig } from "./types.js";

/**
 * Zod-like validation for RemoteActivityExecutionPayload.
 * Returns the parsed payload or throws HTTPException.
 */
function parseActivityPayload(body: unknown): RemoteActivityExecutionPayload {
    if (!body || typeof body !== 'object') {
        throw new HTTPException(400, {
            message: 'Invalid or missing activity execution payload.'
        });
    }
    const obj = body as Record<string, any>;
    if (typeof obj.activity_name !== 'string' || !obj.activity_name) {
        throw new HTTPException(400, {
            message: 'Missing required field: activity_name'
        });
    }
    return {
        activity_name: obj.activity_name,
        params: obj.params || {},
        auth_token: obj.auth_token || '',
        metadata: obj.metadata || {},
    };
}

export function createActivitiesRoute(app: Hono, basePath: string, config: ToolServerConfig) {
    const { activities = [] } = config;

    // Build a map of activity name -> collection for routing
    const activityToCollection = new Map<string, ActivityCollection>();
    for (const coll of activities) {
        for (const def of coll.getActivityDefinitions()) {
            activityToCollection.set(def.name, coll);
        }
    }

    // GET /api/activities - List all activities across all collections
    app.get(basePath, (c) => {
        const allActivities: RemoteActivityDefinition[] = [];
        for (const coll of activities) {
            allActivities.push(...coll.getActivityDefinitions());
        }
        return c.json({
            title: 'All Activities',
            description: 'All available remote activities across all collections',
            activities: allActivities,
            collections: activities.map(a => ({
                name: a.name,
                title: a.title,
                description: a.description,
            })),
        });
    });

    // POST /api/activities - Execute an activity by name (routes to correct collection)
    app.post(basePath, async (c) => {
        const body = await c.req.json();
        const payload = parseActivityPayload(body);

        const collection = activityToCollection.get(payload.activity_name);
        if (!collection) {
            throw new HTTPException(404, {
                message: `Activity not found: ${payload.activity_name}. Available: ${Array.from(activityToCollection.keys()).join(', ')}`
            });
        }

        return collection.execute(c, payload);
    });

    // Per-collection endpoints
    for (const coll of activities) {
        app.route(`${basePath}/${coll.name}`, createActivityEndpoints(coll));
    }
}

function createActivityEndpoints(coll: ActivityCollection): Hono {
    const endpoint = new Hono();

    // GET /api/activities/{collection} - List activities in this collection
    endpoint.get('/', (c) => {
        return c.json({
            name: coll.name,
            title: coll.title,
            description: coll.description,
            activities: coll.getActivityDefinitions(),
        });
    });

    // POST /api/activities/{collection} - Execute activity in this collection
    endpoint.post('/', async (c: Context) => {
        const body = await c.req.json();
        const payload = parseActivityPayload(body);
        return coll.execute(c, payload);
    });

    return endpoint;
}
