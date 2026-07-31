import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import type { ProjectToolInfo, RenderingTemplateDefinitionRef } from '../apps.js';
import type { CountResult } from '../common.js';
import { SupportedIntegrations } from '../integrations.js';
import type {
    ICreateProjectPayload,
    ListProjectsQuery,
    ProjectIntegrationListEntry,
    ProjectIntegrationListResponse,
    ProjectPluginsUpdatePayload,
    ProjectTagQuery,
} from '../project.js';
import type { JsonObject } from './adapter.js';
import type {
    CountResultFromSchema,
    CreateProjectPayloadFromSchema,
    ListProjectsQueryFromSchema,
    ProjectIntegrationListEntryFromSchema,
    ProjectIntegrationListResponseFromSchema,
    ProjectPluginsUpdatePayloadFromSchema,
    ProjectTagQueryFromSchema,
    ProjectToolInfoArrayFromSchema,
    ProjectToolInfoFromSchema,
} from './project.js';
import { ApiSchemaComponents, apiComponentRef, validateApiRequest, validateApiResponse } from './registry.js';

/** Exact type identity — `extends` in both directions is too weak (any/unknown slip through). */
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
function assertType<T extends true>(_ok: T): void {}

function compile(name: string) {
    const ajv = new Ajv2020({ strictSchema: false, allErrors: true });
    ajv.addSchema({ $id: 'vertesia://openapi', components: { schemas: ApiSchemaComponents } });
    return ajv.compile({ $ref: `vertesia://openapi${apiComponentRef(name as never)}` });
}

const VALID_TOOL = {
    tool_name: 'web_search',
    app_name: 'Search',
    app_install_id: '68b1779130afe5403a1589bc',
};

describe('gate 1 — the schema is the single source of truth for the converted Projects types', () => {
    it('publishes the exact schema-derived type, not a hand-written twin', () => {
        assertType<Equals<ListProjectsQuery, ListProjectsQueryFromSchema>>(true);
        assertType<Equals<ProjectTagQuery, ProjectTagQueryFromSchema>>(true);
        assertType<Equals<ICreateProjectPayload, CreateProjectPayloadFromSchema>>(true);
        assertType<Equals<ProjectPluginsUpdatePayload, ProjectPluginsUpdatePayloadFromSchema>>(true);
        assertType<Equals<CountResult, CountResultFromSchema>>(true);
        assertType<Equals<ProjectIntegrationListEntry, ProjectIntegrationListEntryFromSchema>>(true);
        assertType<Equals<ProjectIntegrationListResponse, ProjectIntegrationListResponseFromSchema>>(true);
        assertType<Equals<ProjectToolInfo, ProjectToolInfoFromSchema>>(true);
        assertType<Equals<ProjectToolInfoArrayFromSchema, ProjectToolInfo[]>>(true);
        expect(true).toBe(true);
    });

    it('types the plugin list as strings, which is what the collection has always held', () => {
        // The wire type always said `string[]`; `IProject` in @dglabs/server-common said
        // `Types.ObjectId[]`, and the Mongoose schema says `{ type: [String] }`. Validating the
        // payload is what forced the three to agree.
        assertType<Equals<ProjectPluginsUpdatePayload['plugins'], string[]>>(true);
        expect(true).toBe(true);
    });
});

/**
 * The batch is deliberately partial, and these two tests pin WHY — so the boundary is a checked fact
 * rather than a claim in a comment that quietly stops being true.
 */
describe('gate 2 — the batch boundary is where the closure rule puts it', () => {
    it('leaves Project and ProjectConfiguration derived, because they reach @llumiverse/common', () => {
        // `ProjectConfiguration.interaction_execution.model_options` is `ModelOptions`, the union of
        // every llumiverse driver's options. A canonical component may not `$ref` a TypeScript-derived
        // one, so converting Project means converting a separately published package.
        expect(Object.keys(ApiSchemaComponents)).not.toContain('Project');
        expect(Object.keys(ApiSchemaComponents)).not.toContain('ProjectConfiguration');
        expect(Object.keys(ApiSchemaComponents)).not.toContain('ModelOptions');
    });

    it('leaves the rendering templates derived, because AppManifest still embeds the ref', () => {
        // `AppManifestData.templates` is `RenderingTemplateDefinitionRef[]`, and the Ref is an
        // `Omit<>` — which the scanner emits with alphabetized `required` and `additionalProperties`
        // before `properties`, an ordering Zod cannot reproduce. The generator requires a
        // canonical/derived pair to be byte-identical, so this one converts when AppManifest does.
        expect(Object.keys(ApiSchemaComponents)).not.toContain('RenderingTemplateDefinition');
        expect(Object.keys(ApiSchemaComponents)).not.toContain('RenderingTemplateDefinitionRef');
        // Still a public type, still hand-written, still reachable — just not canonical yet.
        const ref: RenderingTemplateDefinitionRef = {
            path: '/api/v1/projects/p/apps/templates/deck',
            id: 'acme:deck',
            name: 'deck',
            description: 'A deck',
            type: 'presentation',
            assets: [],
        };
        expect(ref.name).toBe('deck');
    });
});

describe('gate 3 — the published components match the closure the types come from', () => {
    it('keeps SupportedIntegrations as the shared enum component it already was', () => {
        const props = ApiSchemaComponents.ProjectIntegrationListEntry.properties as Record<string, JsonObject>;
        expect(props.id).toEqual({ $ref: '#/components/schemas/SupportedIntegrations' });
        // Still referenced by the unconverted integration-config union, which is only safe because
        // the emitted enum is byte-identical to what the scanner derives.
        expect(ApiSchemaComponents.SupportedIntegrations.enum).toEqual(Object.values(SupportedIntegrations));
    });

    it('publishes the tool settings as the open map the earlier batches established', () => {
        const props = ApiSchemaComponents.ProjectToolInfo.properties as Record<string, JsonObject>;
        expect(props.settings).toEqual({
            type: 'object',
            propertyNames: { type: 'string' },
            additionalProperties: {},
            description: expect.stringContaining('may contain API keys'),
        });
        // Same emission as Account.feature_flags and User.properties, which have shipped since the
        // first two batches — `additionalProperties: true` and this accept exactly the same values.
        expect((ApiSchemaComponents.Account.properties as Record<string, JsonObject>).feature_flags).toMatchObject({
            propertyNames: { type: 'string' },
            additionalProperties: {},
        });
    });

    it('closes every component in the batch', () => {
        for (const name of [
            'ListProjectsQuery',
            'ProjectTagQuery',
            'ICreateProjectPayload',
            'ProjectPluginsUpdatePayload',
            'CountResult',
            'ProjectIntegrationListResponse',
            'ProjectIntegrationListEntry',
            'ProjectToolInfo',
        ] as const) {
            expect([name, ApiSchemaComponents[name].additionalProperties]).toEqual([name, false]);
        }
    });
});

describe('gate 4 — AJV validates the same canonical objects that are published', () => {
    it('requires name and namespace on a create payload and rejects anything else', () => {
        const validate = compile('ICreateProjectPayload');
        expect(validate({ name: 'Acme', namespace: 'acme' })).toBe(true);
        expect(validate({ name: 'Acme', namespace: 'acme', description: 'x', auto_config: true })).toBe(true);
        // The two hand-written presence checks the handler used to run, now enforced before it does.
        expect(validate({ name: 'Acme' })).toBe(false);
        expect(validate({ namespace: 'acme' })).toBe(false);
        expect(validate({ name: 'Acme', namespace: 'acme', rogue_field: 1 })).toBe(false);
    });

    it('rejects a plugin list that is not an array of strings', () => {
        const validate = compile('ProjectPluginsUpdatePayload');
        expect(validate({ plugins: [] })).toBe(true);
        expect(validate({ plugins: ['data-platform'] })).toBe(true);
        // All three were accepted by `payload.plugins || []` off an `any` and written to the document.
        expect(validate({ plugins: 'data-platform' })).toBe(false);
        expect(validate({ plugins: [1, 2] })).toBe(false);
        expect(validate({})).toBe(false);
    });

    it('validates the two query components the scanner expands into parameters', () => {
        expect(compile('ListProjectsQuery')({})).toBe(true);
        expect(compile('ListProjectsQuery')({ account: '68b1779130afe5403a1589ba' })).toBe(true);
        // A repeated `?account=` reaches Koa as an array; the handler used to cast it to string.
        expect(compile('ListProjectsQuery')({ account: ['a', 'b'] })).toBe(false);
        expect(compile('ProjectTagQuery')({ tag: 'release' })).toBe(true);
        expect(compile('ProjectTagQuery')({})).toBe(true);
    });

    it('accepts a minimal tool and rejects a missing required field', () => {
        const validate = compile('ProjectToolInfo');
        expect(validate(VALID_TOOL)).toBe(true);
        expect(validate({ ...VALID_TOOL, tool_description: 'Searches the web' })).toBe(true);
        expect(validate({ ...VALID_TOOL, settings: { api_key: 'sk-x', nested: { a: [1] } } })).toBe(true);
        const { app_install_id: _dropped, ...incomplete } = VALID_TOOL;
        expect(validate(incomplete)).toBe(false);
        expect(validate({ ...VALID_TOOL, rogue_field: 1 })).toBe(false);
    });

    it('constrains the integration id to the supported catalog', () => {
        const validate = compile('ProjectIntegrationListResponse');
        expect(validate({ integrations: [{ id: SupportedIntegrations.github, enabled: true }] })).toBe(true);
        expect(validate({ integrations: [] })).toBe(true);
        expect(validate({ integrations: [{ id: 'dropbox', enabled: true }] })).toBe(false);
        // An envelope, not a bare array — which is what the document already published.
        expect(validate([{ id: SupportedIntegrations.github, enabled: true }])).toBe(false);
    });
});

describe('gate 5 — runtime enforcement uses the published components', () => {
    it('checks the shared count response the same way for every service that returns it', () => {
        // Four slots across three resources and two servers, so this component had to move as a unit.
        expect(validateApiResponse('CountResult', { count: 0 }).valid).toBe(true);
        expect(validateApiResponse('CountResult', { count: 3, ids: ['a'] }).valid).toBe(false);
        expect(validateApiResponse('CountResult', {}).valid).toBe(false);
    });

    it('checks every member of the tool listing against the same component', () => {
        expect(validateApiResponse('ProjectToolInfoArray', [VALID_TOOL, VALID_TOOL]).valid).toBe(true);
        expect(validateApiResponse('ProjectToolInfoArray', []).valid).toBe(true);
        expect(validateApiResponse('ProjectToolInfoArray', [VALID_TOOL, { tool_name: 'x' }]).valid).toBe(false);
    });

    it('rejects an undeclared create field without removing it', () => {
        const payload: Record<string, unknown> = { name: 'Acme', namespace: 'acme', rogue_field: 42 };
        const result = validateApiRequest('ICreateProjectPayload', payload);
        expect(result.valid).toBe(false);
        expect(payload.rogue_field).toBe(42);
    });

    it('hands back the component type on the valid branch', () => {
        const result = validateApiResponse('ProjectToolInfo', VALID_TOOL);
        expect(result.valid).toBe(true);
        if (result.valid) {
            assertType<Equals<typeof result.data, ProjectToolInfo>>(true);
        }
    });
});
