import type { InCodeViewDefinition } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { createToolServer } from '../server.js';

const view: InCodeViewDefinition = {
    id: 'document-library',
    name: 'document-library',
    title: 'Document Library',
    tags: ['content'],
    definition: {
        name: 'Document Library',
        layout: { mode: 'browse' },
        results: {
            default_display: 'list',
            displays: [
                {
                    id: 'list',
                    label: 'List',
                    type: 'list',
                    title: { field: 'name' },
                },
            ],
        },
    },
};

describe('in-code View app package', () => {
    it('exposes Views through the package scope and direct resource route', async () => {
        const app = createToolServer({ views: [view], disableHtml: true });
        const packageResponse = await app.request('/api/package?scope=views');
        const directResponse = await app.request('/api/views/document-library');

        expect(packageResponse.status).toBe(200);
        expect(await packageResponse.json()).toEqual({ views: [view] });
        expect(directResponse.status).toBe(200);
        expect(await directResponse.json()).toEqual(view);
    });

    it('returns 404 for an unknown View', async () => {
        const app = createToolServer({ views: [view], disableHtml: true });
        const response = await app.request('/api/views/missing');

        expect(response.status).toBe(404);
    });
});
