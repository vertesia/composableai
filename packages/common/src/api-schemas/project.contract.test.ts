import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import type { ProjectToolInfo, RenderingTemplateDefinitionRef } from '../apps.js';
import {
    type AskUserWebhookConfigurationInput,
    type AwsConfiguration,
    type ExaConfigurationInput,
    type GithubConfigurationInput,
    type GladiaConfigurationInput,
    type LinkupConfigurationInput,
    type MagicPdfConfiguration,
    type ResendConfigurationInput,
    type SerperConfigurationInput,
    SupportedIntegrations,
} from '../integrations.js';
import {
    type ICreateProjectPayload,
    type ModelDefault,
    type Project,
    type ProjectPluginsUpdatePayload,
    SYSTEM_INTERACTION_CATEGORIES,
    type SystemDefaults,
    SystemInteractionCategory,
} from '../project.js';
import type { JsonObject } from './adapter.js';
import type { CreateProjectPayloadFromSchema, ProjectToolInfoArrayFromSchema } from './project.js';
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
        assertType<Equals<ICreateProjectPayload, CreateProjectPayloadFromSchema>>(true);
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

    it('preserves enum-member discriminator types in inferred integration configurations', () => {
        assertType<Equals<AskUserWebhookConfigurationInput['integration'], SupportedIntegrations.ask_user_webhook>>(
            true,
        );
        assertType<Equals<AwsConfiguration['integration'], SupportedIntegrations.aws>>(true);
        assertType<Equals<ExaConfigurationInput['integration'], SupportedIntegrations.exa>>(true);
        assertType<Equals<GithubConfigurationInput['integration'], SupportedIntegrations.github>>(true);
        assertType<Equals<GladiaConfigurationInput['integration'], SupportedIntegrations.gladia>>(true);
        assertType<Equals<LinkupConfigurationInput['integration'], SupportedIntegrations.linkup>>(true);
        assertType<Equals<MagicPdfConfiguration['integration'], SupportedIntegrations.magic_pdf>>(true);
        assertType<Equals<ResendConfigurationInput['integration'], SupportedIntegrations.resend>>(true);
        assertType<Equals<SerperConfigurationInput['integration'], SupportedIntegrations.serper>>(true);
        expect(true).toBe(true);
    });

    it('accepts an AWS integration that is declared but not configured', () => {
        // `getIntegrationConfig` reads `integrations?.[integrationId] ?? {}`, so a project that has
        // never set up AWS answers with the discriminator and `enabled` alone. `s3_role_arn` was
        // required, which made that answer fail its own response contract on every call.
        expect(
            validateApiResponse('ProjectIntegrationConfigResponse', {
                integration: SupportedIntegrations.aws,
                enabled: false,
            }).valid,
        ).toBe(true);
        expect(
            validateApiResponse('ProjectIntegrationConfigResponse', {
                integration: SupportedIntegrations.aws,
                enabled: true,
                s3_role_arn: 'arn:aws:iam::123456789012:role/vertesia',
            }).valid,
        ).toBe(true);
    });

    it('accepts an ask_user_webhook integration that is declared but not configured', () => {
        // Same defect as the AWS case above: `webhook_url` was required on the response, so an
        // unconfigured project failed its own contract on every GET of this integration.
        expect(
            validateApiResponse('ProjectIntegrationConfigResponse', {
                integration: SupportedIntegrations.ask_user_webhook,
                enabled: false,
                webhook_secret: null,
            }).valid,
        ).toBe(true);
        expect(
            validateApiResponse('ProjectIntegrationConfigResponse', {
                integration: SupportedIntegrations.ask_user_webhook,
                enabled: true,
                webhook_url: 'https://example.test/hooks/ask-user',
                webhook_secret: null,
            }).valid,
        ).toBe(true);
    });

    it('still requires webhook_url when the integration is being configured', () => {
        // The request schema must not follow the response into optionality — you cannot set this
        // integration up without a URL.
        expect(
            validateApiRequest('ProjectIntegrationConfigRequest', {
                integration: SupportedIntegrations.ask_user_webhook,
                enabled: true,
            }).valid,
        ).toBe(false);
    });
});

/**
 * The batch is deliberately partial, and these two tests pin WHY — so the boundary is a checked fact
 * rather than a claim in a comment that quietly stops being true.
 */
describe('gate 2 — the closure is closed, bottom-up', () => {
    it('converts Project only after everything it reaches', () => {
        // The order was forced, not chosen. `ProjectConfiguration` reaches
        // `InteractionExecutionConfiguration.model_options`, which is `ModelOptions` — the union of
        // every llumiverse driver's options — and a canonical component may not `$ref` a
        // TypeScript-derived one. So `ModelOptions` converted first, then the intake policy tree,
        // The registry owns the whole reference closure. Asserting the chain prevents a schema
        // group edit from leaving a published `$ref` without its component.
        for (const name of [
            'ModelOptions',
            'InteractionExecutionConfiguration',
            'ContentTypeIntakePolicy',
            'ProjectIntakeConfiguration',
            'ProjectConfiguration',
            'Project',
        ]) {
            expect(Object.keys(ApiSchemaComponents), name).toContain(name);
        }
    });

    it('publishes dedicated, optional update projections', () => {
        for (const name of ['UpdateProjectPayload', 'UpdateProjectConfigurationPayload']) {
            expect(Object.keys(ApiSchemaComponents), name).toContain(name);
        }
        // `.partial()` of the root, not a restatement: same properties, none required.
        const project = ApiSchemaComponents.Project as JsonObject;
        const partial = ApiSchemaComponents.UpdateProjectPayload as JsonObject;
        expect(Object.keys(partial.properties as JsonObject)).toEqual(Object.keys(project.properties as JsonObject));
        expect(partial.required).toBeUndefined();
        expect(partial.additionalProperties).toBe(false);
    });

    it('says what JSON can carry, which the TypeScript declaration did not', () => {
        // `integrations` was `Map<string, unknown>` and the timestamps `Date`. No HTTP response has
        // ever contained either — Mongoose flattens maps in `toJSON` and `JSON.stringify` turns a
        // Date into a string — so a caller writing `.get(id)` or `.getTime()` got a TypeError. The
        // published document is unchanged; only the TypeScript was wrong.
        assertType<Equals<Project['integrations'], Record<string, unknown> | undefined>>(true);
        assertType<Equals<Project['created_at'], string>>(true);

        const properties = (ApiSchemaComponents.Project as JsonObject).properties as Record<string, JsonObject>;
        // Still `format: date-time`, which is what makes the generated clients emit
        // `OffsetDateTime` / `time.Time` rather than a bare string. A plain `z.string()` here would
        // have dropped it silently.
        expect(properties.created_at).toEqual({ type: 'string', format: 'date-time' });
        expect(properties.updated_at).toEqual({ type: 'string', format: 'date-time' });
        // The same open-map emission as Account.feature_flags and User.properties, normalized to the
        // spelling the document has always used — `z.record`'s `{}` and `propertyNames` say the same
        // thing but generate a different Go map type. `tenant_id` is absent, as it always was — the
        // model computes it and the handler used to ship it anyway, which is what the response mapper
        // now stops.
        expect(properties.integrations).toEqual({ type: 'object', additionalProperties: true });
        expect(properties).not.toHaveProperty('tenant_id');
    });

    it('converts the vision-profile map, because a canonical alias cannot be a mapped-type key', () => {
        // `vision_profiles` was `Partial<Record<IntakeVisionDetail, …>>`. Once `IntakeVisionDetail`
        // became a canonical alias the schema generator could no longer enumerate the mapped type's
        // keys — it failed with `Unexpected key type "def-canonical-alias-IntakeVisionDetail"`, and
        // `Project` then fell back to a source-text inference that silently dropped `configuration`
        // and `integrations` from the published document. Converting the map is what removed the
        // mapped type; this asserts the components it produces still exist under their old names.
        expect(Object.keys(ApiSchemaComponents)).toContain('ProjectIntakeConfiguration');
        const intake = ApiSchemaComponents.ProjectIntakeConfiguration as JsonObject;
        const properties = intake.properties as Record<string, JsonObject>;
        expect(properties.vision_profiles.$ref).toBe(apiComponentRef('IntakeVisionProfileSettingsMap' as never));
        const map = ApiSchemaComponents.IntakeVisionProfileSettingsMap as JsonObject;
        // The three keys are restated in the schema rather than derived from the enum, so this is
        // what fails if a detail name is added to `IntakeVisionDetail` and not to the map.
        expect(Object.keys(map.properties as JsonObject).sort()).toEqual(['high', 'low', 'standard']);
    });

    it('converts every configuration leaf that depends on nothing outside this module', () => {
        // Sixteen components, none of them named by an endpoint — they are hoisted by
        // `ProjectConfiguration`, which is still derived. Converting them changes no slot; it makes
        // the `$ref`s that the two remaining configuration components have to satisfy canonical, so
        // the closure rule stops applying to them one level at a time.
        for (const name of [
            'ModelDefault',
            'ModalityDefaults',
            'SystemDefaults',
            'ProjectModelDefaults',
            'ResourceVisibility',
            'ProjectSearchTier',
            'ElasticsearchBackend',
            'ProjectSearchPropertyType',
            'ProjectSearchPropertyMapping',
            'ProjectSearchPropertyMappingMap',
            'ProjectIndexingConfiguration',
            'ProjectConfigurationEmbedding',
            'BrowserUseRiskPolicy',
            'BrowserUseScreenshotCapture',
            'BrowserUseProjectConfiguration',
            'MemoryProjectConfiguration',
            'ProjectIntakeSniffConfiguration',
        ]) {
            expect(Object.keys(ApiSchemaComponents), name).toContain(name);
        }
    });

    it('keeps SystemDefaults covering every system interaction category', () => {
        // The interface was `{ [K in SystemInteractionCategory]?: ModelDefault }`, so a new category
        // widened it for free. A Zod object cannot map over an enum and still infer useful keys, so
        // the categories are written out — and this is what makes forgetting one a compile error
        // rather than a silently unpublishable default. The template literal turns the enum's member
        // union into its string values, which is what the schema's keys are.
        assertType<Equals<keyof SystemDefaults, `${SystemInteractionCategory}`>>(true);
        assertType<Equals<SystemDefaults['intake'], ModelDefault | undefined>>(true);
        expect(true).toBe(true);
    });

    it('uses the analysis model default for both content query planning and reranking', () => {
        expect(SYSTEM_INTERACTION_CATEGORIES.ContentSearchAgent).toBe(SystemInteractionCategory.analysis);
        expect(SYSTEM_INTERACTION_CATEGORIES.ContentSearchReranker).toBe(SystemInteractionCategory.analysis);
    });

    it('publishes the property-mapping map without the propertyNames z.record adds', () => {
        // `Record<string, ProjectSearchPropertyMapping>` is inline in the interface and has no
        // TypeScript name, so it never becomes a canonical alias — it stays canonical AND derived,
        // and the two have to agree forever. `z.record` emits a `propertyNames: {type: 'string'}`
        // that the scanner never did, which is why the schema is a catchall-only object instead.
        expect(ApiSchemaComponents.ProjectSearchPropertyMappingMap).toEqual({
            type: 'object',
            additionalProperties: { $ref: '#/components/schemas/ProjectSearchPropertyMapping' },
        });
    });

    it('publishes geo_point as an explicit project property mapping type', () => {
        expect(ApiSchemaComponents.ProjectSearchPropertyType.enum).toContain('geo_point');
    });

    it('enforces the browser-use configuration the deleted AJV schema only described', () => {
        // A `JSONSchemaType<BrowserUseProjectConfiguration>` used to sit beside the interface with
        // descriptions that had already drifted from the TSDoc, and nothing compiled it. This is the
        // same shape, and it is enforced.
        expect(validateApiRequest('BrowserUseProjectConfiguration', { max_policy: 'low_write' }).valid).toBe(true);
        expect(validateApiRequest('BrowserUseProjectConfiguration', { max_policy: 'god_mode' }).valid).toBe(false);
        expect(validateApiRequest('BrowserUseProjectConfiguration', { capture_screenshots: 'always' }).valid).toBe(
            false,
        );
        expect(validateApiRequest('BrowserUseProjectConfiguration', { unknown_switch: true }).valid).toBe(false);
    });

    it('publishes a closed project Memory default configuration', () => {
        expect(validateApiRequest('MemoryProjectConfiguration', { default_brain_id: 'sol-medium' }).valid).toBe(true);
        expect(validateApiRequest('MemoryProjectConfiguration', {}).valid).toBe(true);
        expect(validateApiRequest('MemoryProjectConfiguration', { default_brain_id: '' }).valid).toBe(false);
        expect(
            validateApiRequest('MemoryProjectConfiguration', { default_brain_id: 'sol', brain_id: 'glm' }).valid,
        ).toBe(false);
    });

    it('converts the rendering templates ahead of the AppManifest that embeds them', () => {
        // This pair was previously held back because the Ref is an `Omit<>`, which the scanner emits
        // with `additionalProperties` before `properties` — an ordering Zod cannot reproduce. The
        // canonical/derived comparison is no longer spelling-sensitive: `schemasAgree` compares
        // objects key-order-insensitively and arrays index-by-index, so only the `required` ARRAY
        // order still has to match, and the schema declares its fields to produce it.
        expect(Object.keys(ApiSchemaComponents)).toContain('RenderingTemplateDefinition');
        expect(Object.keys(ApiSchemaComponents)).toContain('RenderingTemplateDefinitionRef');
        expect(ApiSchemaComponents.RenderingTemplateDefinitionRef.required).toEqual([
            'assets',
            'description',
            'id',
            'name',
            'path',
            'type',
        ]);
        // `AppManifestData.templates` stays derived and now `$ref`s the canonical Ref — the closure
        // rule only forbids the other direction.
        expect(Object.keys(ApiSchemaComponents)).toContain('AppManifest');
        const ref: RenderingTemplateDefinitionRef = {
            path: '/api/v1/projects/p/apps/templates/deck',
            id: 'acme:deck',
            name: 'deck',
            description: 'A deck',
            type: 'presentation',
            assets: [],
        };
        expect(validateApiResponse('RenderingTemplateDefinitionRef', ref).valid).toBe(true);
        // The instructions body belongs to the full definition, not the listing entry.
        expect(validateApiResponse('RenderingTemplateDefinitionRef', { ...ref, instructions: '# Deck' }).valid).toBe(
            false,
        );
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
            additionalProperties: true,
            description: expect.stringContaining('may contain API keys'),
        });
        // Same emission as Account.feature_flags and User.properties, which have shipped since the
        // first two batches. `z.record` writes this as `{}` plus a `propertyNames` that constrains
        // nothing; both are normalized away so the document keeps one spelling for an open map.
        expect((ApiSchemaComponents.Account.properties as Record<string, JsonObject>).feature_flags).toMatchObject({
            additionalProperties: true,
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
    it('accepts decrypted integration credentials only on the response contract', () => {
        expect(
            validateApiResponse('ProjectIntegrationConfigResponse', {
                integration: SupportedIntegrations.exa,
                enabled: true,
                api_key: 'agent-runtime-secret',
            }).valid,
        ).toBe(true);
        expect(
            validateApiResponse('ProjectIntegrationConfigResponse', {
                integration: SupportedIntegrations.ask_user_webhook,
                enabled: true,
                webhook_secret: 'agent-runtime-secret',
            }).valid,
        ).toBe(true);
    });

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
