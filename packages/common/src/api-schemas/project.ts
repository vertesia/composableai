import { z } from 'zod';
// From the values module, for the reason `./apikey.js` gives.
import { SupportedIntegrations } from '../integrations.js';
import { ProjectConfigurationSchema } from './project-configuration.js';

/**
 * Runtime API schemas for projects and project-scoped definitions.
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

/**
 * The project itself — the component `GetProject`, `UpdateProject` and `CreateProject` all return.
 *
 * This schema corrects two declarations that no HTTP response ever matched. `integrations` was
 * `Map<string, unknown>` and the timestamps were `Date`; JSON carries neither, so a caller writing
 * `project.integrations.get(id)` or `project.created_at.getTime()` got a `TypeError` against a shape
 * TypeScript had promised. Both are source-breaking corrections for SDK consumers and wire-neutral —
 * proved by `apps/studio-server/src/api/projects/project-wire-shape.test.ts`, which serializes a real
 * `ProjectModel` document the way the handler does. Operation 24 of the 1.5 deployment runbook.
 *
 * The published wire shape remains the same. `Map<string, unknown>` was already emitted
 * as an open object, and the timestamps as `format: date-time` strings — which is why they carry
 * `.meta({ format: 'date-time' })`: a bare `z.string()` would silently drop the format and narrow
 * `OffsetDateTime`/`time.Time` to `String` in the generated clients. `z.iso.datetime()` would keep
 * the format but also publish its validation regex as a `pattern`, which is a new constraint on a
 * component that never had one — the same class of change as the intake bounds, and not one to make
 * accidentally.
 *
 * `integrations` stays an open `z.record()` on purpose. Its values are per-integration configuration
 * objects with no common shape, and `SupportedIntegrations` is not a closed key set for stored data —
 * a project can hold configuration for an integration this build no longer knows about.
 *
 * The persistence type is NOT this: `IProject` in `@dglabs/server-common` keeps the `Map` and the
 * `Date`s, because that is what Mongo really holds, and `toProjectResponse()` in studio-server is the
 * single place that converts — and the single place `tenant_id` is dropped, which the model computes
 * and this component has never declared.
 */
export const ProjectSchema = z
    .strictObject({
        id: z.string(),
        name: z.string(),
        namespace: z.string(),
        description: z.string().optional(),
        account: z.string(),
        configuration: ProjectConfigurationSchema,
        integrations: z.record(z.string(), z.unknown()).optional(),
        plugins: z.array(z.string()),
        created_by: z.string(),
        updated_by: z.string(),
        created_at: z.string().meta({ format: 'date-time' }),
        updated_at: z.string().meta({ format: 'date-time' }),
    })
    .meta({ id: 'Project' });

/**
 * The `UpdateProject` and `UpdateProjectConfiguration` request bodies.
 *
 * `.partial()` keeps both update contracts tied to the corresponding response contract, so a field
 * added to either source schema is available to its update payload without a hand-written twin.
 */
export const UpdateProjectPayloadSchema = ProjectSchema.partial().meta({ id: 'UpdateProjectPayload' });

export const UpdateProjectConfigurationPayloadSchema = ProjectConfigurationSchema.partial().meta({
    id: 'UpdateProjectConfigurationPayload',
});
