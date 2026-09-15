import { assertType, describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { type ViewExperienceConfiguration, viewExperienceRoute } from '../views.js';
import { ApiSchemaComponents, validateApiRequest, validateApiResponse } from './registry.js';
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

    it('accepts View model options that name no driver, while the shared config still requires one', () => {
        // The regression: a View's `model_options` are authored in the editor and saved before any
        // driver is resolved, so they carry no `_option_id`. Validating them against the
        // `ModelOptions` driver union — every branch of which requires that discriminator — meant a
        // stored View could not satisfy its own response schema, and `GET /views` logged a contract
        // violation on every call.
        const authored = { model_options: { temperature: 0.2, max_tokens: 1024 } };
        expect(validateApiResponse('ViewAgenticExecutionConfiguration', authored).valid).toBe(true);

        // The split is the point: agent runs, events and workflow runs record options a driver
        // already resolved, so the shared component keeps the union. Asserted on the published
        // schema because `InteractionExecutionConfiguration` is not itself a response slot — if it
        // ever stops pointing at `ModelOptions`, the relaxation leaked out of Views.
        const modelOptions = (name: string) =>
            (ApiSchemaComponents[name] as { properties: Record<string, unknown> }).properties.model_options;
        expect(modelOptions('InteractionExecutionConfiguration')).toEqual({
            $ref: '#/components/schemas/ModelOptions',
        });
        expect(modelOptions('ViewAgenticExecutionConfiguration')).toMatchObject({
            type: 'object',
            additionalProperties: true,
        });
    });

    it('keeps the View config otherwise identical to the shared execution configuration', () => {
        // Only `model_options` may differ. Anything else diverging means the two drifted apart
        // rather than the union being deliberately relaxed for authored options.
        const properties = (name: string) =>
            (ApiSchemaComponents[name] as { properties: Record<string, unknown> }).properties;
        const view = properties('ViewAgenticExecutionConfiguration');
        const shared = properties('InteractionExecutionConfiguration');

        expect(Object.keys(view)).toEqual(Object.keys(shared));
        for (const key of Object.keys(shared)) {
            if (key === 'model_options') continue;
            expect(JSON.stringify(view[key]), `${key} drifted from the shared configuration`).toBe(
                JSON.stringify(shared[key]),
            );
        }
    });

    it('builds generic routes for system and app-contributed Views without exposing path material', () => {
        expect(viewExperienceRoute('app:content:document-library')).toBe('/view/app%3Acontent%3Adocument-library');
        expect(viewExperienceRoute('sys:AgenticDocumentExplorer')).toBe('/view/sys%3AAgenticDocumentExplorer');
        expect(viewExperienceRoute('unsafe/id')).toBe('/view/unsafe%2Fid');
    });
});
