import { z } from 'zod';
// From the values module, for the reason `./apikey.js` gives.
import { SupportedIntegrations } from '../integrations.js';

/**
 * Runtime API schemas for the Projects resources — the sixth batch.
 *
 * This batch is deliberately PARTIAL, and the reason is worth stating precisely, because it is the
 * first time the closure rule has stopped a resource rather than merely enlarged it.
 *
 * `ProjectResource` publishes 33 slots. Sixteen of them are here. The other seventeen hang off four
 * closures that cannot convert yet:
 *
 *  - `Project`, `Partial_Project`, `ProjectConfiguration` and `Partial_ProjectConfiguration` reach
 *    `InteractionExecutionConfiguration.model_options`, which is `ModelOptions` — the union of every
 *    llumiverse driver's options, declared in `@llumiverse/common`. A canonical component may not
 *    `$ref` a TypeScript-derived one, so converting `Project` means converting a separately
 *    published package in a nested submodule with its own release cadence. That is a release
 *    decision, not a refactor.
 *  - `InCodeTypeDefinition` and `InCodeViewDefinition` reach the same union by the same route.
 *  - `InCodeProcessDefinition` reaches `JSONSchema`, also from `@llumiverse/common`.
 *  - `RenderingTemplateDefinition` and its `Ref` are embedded in `AppManifestData.templates`, so the
 *    scanner still derives them for `AppManifest`. The derived `Ref` is an `Omit<>`, which the
 *    scanner emits with alphabetized `required` and `additionalProperties` before `properties` — an
 *    ordering Zod cannot reproduce, and the generator requires a canonical/derived pair to be
 *    byte-identical. It converts when `AppManifest` does.
 *
 * `CompositeAppConfig` (18 components) and the integration config union (20) are self-contained in
 * this package and blocked by nothing but size; they are the natural next slice.
 */

/**
 * `ListProjects` and the four app-asset listings expand these into `in: query` parameters rather
 * than referencing them, so what has to survive is the optionality, not the component identity.
 */
export const ListProjectsQuerySchema = z
    .object({
        account: z.string().optional(),
    })
    .meta({ id: 'ListProjectsQuery' });

export const ProjectTagQuerySchema = z
    .object({
        tag: z.string().optional(),
    })
    .meta({ id: 'ProjectTagQuery' });

export const CreateProjectPayloadSchema = z
    .object({
        name: z.string(),
        namespace: z.string(),
        description: z.string().optional(),
        auto_config: z.boolean().optional(),
    })
    .meta({ id: 'ICreateProjectPayload' });

export const ProjectPluginsUpdatePayloadSchema = z
    .object({
        plugins: z.array(z.string()),
    })
    .meta({ id: 'ProjectPluginsUpdatePayload' });

/**
 * The shared "how many rows did that touch" response.
 *
 * Four slots across three resources and TWO services — `UpdateProjectPlugins`, `DeleteApp` and
 * `UninstallApp` on studio, `CountObjects` on zeno — so like `DeleteByIdResult` it has to move as a
 * unit or the generator sees a canonical and a derived component under one name.
 *
 * `count` stays `type: number` rather than `integer`, because that is what the derived component
 * said. Reproducing the contract, not renegotiating it.
 */
export const CountResultSchema = z
    .object({
        count: z.number(),
    })
    .meta({ id: 'CountResult' });

export const SupportedIntegrationsSchema = z.enum(SupportedIntegrations).meta({ id: 'SupportedIntegrations' });

export const ProjectIntegrationListEntrySchema = z
    .object({
        id: SupportedIntegrationsSchema,
        enabled: z.boolean(),
    })
    .meta({ id: 'ProjectIntegrationListEntry' });

/** An envelope rather than a bare array, which is what the document already publishes. */
export const ProjectIntegrationListResponseSchema = z
    .object({
        integrations: z.array(ProjectIntegrationListEntrySchema),
    })
    .meta({ id: 'ProjectIntegrationListResponse' });

/**
 * A tool and the app installation that provides it.
 *
 * `settings` is the reason this one is worth converting on its own: it holds the installation's
 * configuration, which can contain provider API keys, and the handler includes it only for agent
 * tokens. The component declares it optional and unconstrained — publishing it is a decision the
 * handler makes per request, so the schema cannot express the rule, but it can at least stop the
 * shape drifting while the rule is enforced elsewhere.
 */
export const ProjectToolInfoSchema = z
    .object({
        tool_name: z.string().meta({ description: 'The tool name' }),
        tool_description: z.string().optional().meta({ description: 'Optional tool description' }),
        app_name: z.string().meta({ description: 'The app name that provides this tool' }),
        app_install_id: z.string().meta({ description: 'The app installation ID' }),
        settings: z
            .record(z.string(), z.unknown())
            .optional()
            .meta({
                description:
                    'The app installation settings. Only included for agent tokens, not user tokens ' +
                    '(security: may contain API keys).',
            }),
    })
    .meta({
        id: 'ProjectToolInfo',
        description:
            'Information about a tool and its associated app installation. Used to look up which app ' +
            'provides a specific tool.',
    });

export const ProjectToolInfoArraySchema = z.array(ProjectToolInfoSchema).meta({ id: 'ProjectToolInfoArray' });

export type ListProjectsQueryFromSchema = z.infer<typeof ListProjectsQuerySchema>;
export type ProjectTagQueryFromSchema = z.infer<typeof ProjectTagQuerySchema>;
export type CreateProjectPayloadFromSchema = z.infer<typeof CreateProjectPayloadSchema>;
export type ProjectPluginsUpdatePayloadFromSchema = z.infer<typeof ProjectPluginsUpdatePayloadSchema>;
export type CountResultFromSchema = z.infer<typeof CountResultSchema>;
export type ProjectIntegrationListEntryFromSchema = z.infer<typeof ProjectIntegrationListEntrySchema>;
export type ProjectIntegrationListResponseFromSchema = z.infer<typeof ProjectIntegrationListResponseSchema>;
export type ProjectToolInfoFromSchema = z.infer<typeof ProjectToolInfoSchema>;
export type ProjectToolInfoArrayFromSchema = z.infer<typeof ProjectToolInfoArraySchema>;

/**
 * The rendering templates an app ships, and the reference form the manifest embeds.
 *
 * These were deferred once for a reason that no longer holds. `RenderingTemplateDefinitionRef` is an
 * `Omit<>`, and the scanner emits an `Omit<>` with `additionalProperties` ahead of `properties` and
 * an alphabetized `required` — an ordering Zod does not reproduce. The conflict check compares
 * OBJECTS order-insensitively now, so the property order no longer matters; `required` is an array
 * and is still compared in order, which is why the shape below is declared alphabetically while
 * {@link RenderingTemplateDefinitionSchema} is declared in its interface's order. Neither ordering
 * carries meaning in JSON Schema — they exist so a canonical component and the one the scanner still
 * derives for `AppManifestData.templates` agree exactly.
 */
const RenderingTemplateTypeSchema = z.enum(['presentation', 'document']).meta({ description: 'Template type' });

const renderingTemplateFields = {
    id: z.string().meta({ description: 'Unique template id: "collection:name"' }),
    name: z.string().meta({ description: 'Unique template name (kebab-case)' }),
    title: z.string().optional().meta({ description: 'Display title' }),
    description: z.string().meta({ description: 'Short description' }),
    type: RenderingTemplateTypeSchema,
    tags: z.array(z.string()).optional().meta({ description: 'Tags for categorization' }),
    assets: z.array(z.string()).meta({ description: 'Absolute paths to asset files' }),
};

export const RenderingTemplateDefinitionSchema = z
    .object({
        ...renderingTemplateFields,
        instructions: z.string().meta({ description: 'The template instructions (markdown)' }),
    })
    .meta({ id: 'RenderingTemplateDefinition' });

export const RenderingTemplateDefinitionRefSchema = z
    .object({
        assets: renderingTemplateFields.assets,
        description: renderingTemplateFields.description,
        id: renderingTemplateFields.id,
        name: renderingTemplateFields.name,
        path: z.string().meta({ description: 'Absolute API path to fetch the full template definition' }),
        type: renderingTemplateFields.type,
        title: renderingTemplateFields.title,
        tags: renderingTemplateFields.tags,
    })
    .meta({ id: 'RenderingTemplateDefinitionRef' });
