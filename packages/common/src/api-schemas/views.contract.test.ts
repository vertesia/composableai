import { assertType, describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { type ViewExperienceConfiguration, viewExperienceRoute } from '../views.js';
import { ApiSchemaComponents, validateApiRequest } from './registry.js';
import type { ViewExperienceConfigurationSchema } from './view-execution.js';

type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/**
 * Lives here rather than next to the JSON Schema artifact that consumes it. Both subjects are
 * declarations of THIS package — the public TypeScript type and the Zod schema it must mirror — and
 * asserting it from the consuming package would have made that package depend on Zod, which it must
 * not: it is loaded in the browser.
 */
describe('ViewExperienceConfiguration', () => {
    it('keeps the temporary named TypeScript bridge identical to the runtime schema', () => {
        assertType<Equals<ViewExperienceConfiguration, z.infer<typeof ViewExperienceConfigurationSchema>>>(true);
    });

    it('publishes selection, app actions, upload drops, generated presentation mode, and reranking', () => {
        expect(Object.keys(ApiSchemaComponents)).toEqual(
            expect.arrayContaining([
                'AgenticViewRerankConfiguration',
                'ViewActionConfiguration',
                'ViewActionsConfiguration',
                'ViewDropConfiguration',
                'ViewExecutionRerankResult',
                'ViewSelectionConfiguration',
            ]),
        );

        expect(
            validateApiRequest('PreviewViewExperienceRequest', {
                configuration: {
                    name: 'Orders',
                    search: {
                        mode: 'agentic',
                        agentic: {
                            mode: 'query_and_view',
                            rerank: { max_candidates: 24, include_why_match: true, timeout_ms: 30_000 },
                        },
                    },
                    results: {
                        default_display: 'table',
                        displays: [{ id: 'table', label: 'Orders', type: 'table', columns: [] }],
                        selection: { mode: 'multiple', select_all: 'page' },
                        actions: {
                            include_defaults: true,
                            items: [{ id: 'approve', label: 'Approve', handler: 'approve-orders' }],
                        },
                        drop: { handler: 'upload', accept: ['files'], params: { type_id: 'sales-order' } },
                    },
                },
            }).valid,
        ).toBe(true);
    });

    it('keeps executable custom drop handlers out of the persisted wire contract', () => {
        expect(
            validateApiRequest('PreviewViewExperienceRequest', {
                configuration: {
                    name: 'Orders',
                    results: {
                        default_display: 'table',
                        displays: [{ id: 'table', label: 'Orders', type: 'table', columns: [] }],
                        drop: { handler: 'custom-drop' },
                    },
                },
            }).valid,
        ).toBe(false);
    });

    it('builds generic routes for system and app-contributed Views without exposing path material', () => {
        expect(viewExperienceRoute('app:content:document-library')).toBe('/view/app%3Acontent%3Adocument-library');
        expect(viewExperienceRoute('sys:AgenticDocumentExplorer')).toBe('/view/sys%3AAgenticDocumentExplorer');
        expect(viewExperienceRoute('unsafe/id')).toBe('/view/unsafe%2Fid');
    });
});
