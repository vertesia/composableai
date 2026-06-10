import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { ContentTypesCollection } from '../ContentTypesCollection.js';
import { createContentTypesRoute } from './content-types.js';
import type { ToolServerConfig } from './types.js';

function makeApp(config: ToolServerConfig): Hono {
    const app = new Hono();
    createContentTypesRoute(app, '/api/types', config);
    return app;
}

const config = {
    types: [
        new ContentTypesCollection({
            name: 'contracts',
            types: [{ name: 'contract' }, { name: 'review_note' }],
        }),
        new ContentTypesCollection({
            name: 'audit',
            types: [{ name: 'audit_event' }],
        }),
    ],
} satisfies ToolServerConfig;

describe('content types route', () => {
    it('lists all types with bare ids (collection is not part of the type identity)', async () => {
        const res = await makeApp(config).request('/api/types');
        expect(res.status).toBe(200);
        const body = (await res.json()) as { types: Array<{ id: string }> };
        expect(body.types.map((t) => t.id)).toEqual(['contract', 'review_note', 'audit_event']);
    });

    it('resolves the canonical bare type name (the app:<app>:<type> ref convention)', async () => {
        const res = await makeApp(config).request('/api/types/contract');
        expect(res.status).toBe(200);
        const body = (await res.json()) as { id: string; name: string };
        expect(body.id).toBe('contract');
        expect(body.name).toBe('contract');
    });

    it('still resolves the legacy collection:type alias, returning the bare id', async () => {
        const res = await makeApp(config).request('/api/types/contracts:contract');
        expect(res.status).toBe(200);
        const body = (await res.json()) as { id: string };
        expect(body.id).toBe('contract');
    });

    it('409s on an ambiguous bare name so the collision is loud, not silent', async () => {
        const ambiguous = {
            types: [
                new ContentTypesCollection({ name: 'a', types: [{ name: 'note' }] }),
                new ContentTypesCollection({ name: 'b', types: [{ name: 'note' }] }),
            ],
        } satisfies ToolServerConfig;
        const res = await makeApp(ambiguous).request('/api/types/note');
        expect(res.status).toBe(409);
    });

    it('404s for an unknown type name', async () => {
        const res = await makeApp(config).request('/api/types/nope');
        expect(res.status).toBe(404);
    });
});
