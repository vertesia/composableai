// ================== Content Type Endpoints ==================

import type { InCodeTypeDefinition } from '@vertesia/common';
import { type Context, Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentTypesCollection } from '../ContentTypesCollection.js';
import { toPathName } from '../utils.js';
import type { ToolServerConfig } from './types.js';

export function createContentTypesRoute(app: Hono, basePath: string, config: ToolServerConfig) {
    const { types = [] } = config;

    // GET /api/types - Returns all content types from all collections.
    // A type's public id is its declared BARE name, verbatim (`app:<app>:<type>` once
    // app-prefixed): collections organize code, they are not part of the type identity.
    app.get(basePath, (c) => {
        const allTypes: InCodeTypeDefinition[] = [];

        for (const coll of types) {
            for (const type of coll.types) {
                allTypes.push({ ...type, id: type.name });
            }
        }

        return c.json({
            title: 'All Content Types',
            description: 'All available content types across all collections',
            types: allTypes,
            collections: types.map((i) => ({
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

    // GET /api/types/:name - Direct access to content type.
    // Canonical form is the BARE type name (`<type>`), matching the portable
    // `app:<app>:<type>` ref convention used by objects.create/search — the
    // collection is an in-code grouping, not part of the type's public id.
    // `<collection>:<type>` is also accepted as a backward-compatible alias.
    app.get(`${basePath}/:name`, async (c) => {
        const name = c.req.param('name');
        const parts = name.split(':');
        if (parts.length === 1) {
            // Match the declared name verbatim; fall back to the toPathName variant for
            // leniency with legacy refs that used the path-mangled form.
            const matches = types.flatMap((coll) =>
                coll.types
                    .filter((t) => t.name === name || toPathName(t.name) === name)
                    .map((t) => ({ coll, type: t })),
            );
            if (matches.length === 1) {
                return c.json({ ...matches[0].type, id: matches[0].type.name });
            }
            if (matches.length > 1) {
                const colls = matches.map((m) => m.coll.name).join(', ');
                throw new HTTPException(409, {
                    message:
                        `Ambiguous content type name '${name}': defined in collections ${colls}. ` +
                        'Type names must be unique across collections so the portable ' +
                        `'app:<app>:${name}' ref resolves; rename one of them, or address it as '<collection>:<type>'.`,
                });
            }
            throw new HTTPException(404, {
                message: `No content type found with name: ${name}`,
            });
        }
        if (parts.length !== 2) {
            throw new HTTPException(400, {
                message: "Invalid content type name. Expected '<type>' or 'collection:type'",
            });
        }
        const collName = parts[0];
        const typeName = parts[1];
        const ctype = types
            .find((t) => t.name === collName)
            ?.types.find((t) => t.name === typeName || toPathName(t.name) === toPathName(typeName));
        if (ctype) {
            // Alias lookup still returns the canonical bare id.
            return c.json({ ...ctype, id: ctype.name });
        }

        throw new HTTPException(404, {
            message: `No content type found with name: ${name}`,
        });
    });
}

function createContentTypeEndpoints(coll: ContentTypesCollection): Hono {
    const endpoint = new Hono();

    endpoint.get('/', (c: Context) => {
        return c.json(coll.types.map((t) => ({ ...t, id: t.name })));
    });

    endpoint.get('/:name', (c: Context) => {
        const name = c.req.param('name');
        const ctype = coll.types.find((t) => t.name === name || toPathName(t.name) === name);
        if (!ctype) {
            throw new HTTPException(404, {
                message: `No content type found with name: ${name}`,
            });
        }
        return c.json({
            ...ctype,
            id: ctype.name,
        });
    });

    return endpoint;
}
