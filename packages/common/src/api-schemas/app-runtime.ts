// Runtime schemas for the app runtime API domain.

import type { JSONSchema } from '@llumiverse/common';
import { z } from 'zod';
import type { CompositeAppMenuNavItem } from '../apps.js';
import type { PlatformEvent } from '../platform-event.js';
import type { InCodeProcessDefinition } from '../store/process.js';
import { SystemRolesSchema } from './apikey.js';
import {
    AgentToolDefinitionSchema,
    AppInstallationOAuthBindingSchema,
    AppInstallationProviderBindingSchema,
    AppVersionRecordSchema,
    EventRefSchema,
} from './app-lifecycle.js';
import {
    AppAccessControlSchema,
    AppCapabilitiesSchema,
    AppManifestSourceSchema,
    AppSourceConfigSchema,
    AppUIConfigSchema,
    MCPOAuthConfigSchema,
    ToolCollectionObjectSchema,
} from './apps.js';
import { AuditMeterSchema } from './audit-trail.js';
import {
    DashboardDataSourceSchema,
    DashboardLayoutSchema,
    DashboardPanelSchema,
    DashboardQuerySchema,
} from './dashboard.js';
import { EventPrioritySchema, EventSubscriptionFilterSchema } from './events.js';
import { StringValueMapSchema } from './files.js';
import { RemoteActivityDefinitionSchema } from './integrations.js';
import { CatalogInteractionRefSchema } from './interaction.js';
import { ProcessDefinitionBodySchema } from './process.js';
import { RenderingTemplateDefinitionRefSchema } from './project.js';
import { EditRevisionSchema, ExpectedEditRevisionSchema } from './schema-primitives.js';
import { InCodeTypeDefinitionSchema } from './store.js';
import { ViewExperienceConfigurationSchema } from './view-execution.js';

const JSONSchemaRefSchema: z.ZodType<JSONSchema> = z.any().meta({
    $ref: '#/components/schemas/JSONSchema',
});

export const ProjectPluginArraySchema = z.array(z.string()).meta({ id: 'ProjectPluginArray' });

export const BinaryFileResponseSchema = z.string().meta({ id: 'BinaryFileResponse', format: 'binary' });

export const CompositeAppNavItemPermissionsSchema = z
    .strictObject({
        groupsAllowed: z
            .array(z.string())
            .meta({ description: 'Group IDs whose members can see this item.' })
            .optional(),
        usersAllowed: z.array(z.string()).meta({ description: 'User IDs who can see this item.' }).optional(),
        rolesAllowed: z
            .array(z.string())
            .meta({ description: 'SystemRoles values (e.g. "developer", "manager") whose holders can see this item.' })
            .optional(),
    })
    .meta({
        id: 'CompositeAppNavItemPermissions',
        description:
            'Access control settings for a composite app nav item.\n\nIf any of `groupsAllowed`, `usersAllowed`, or `rolesAllowed` are set, access is granted when the user matches ANY list (OR logic). All empty/absent means visible to everyone. Admin users bypass all checks.',
    });

export const CompositeAppEntrySchema = z
    .strictObject({
        appName: z.string().meta({ description: 'App installation name (must match an installed app)' }),
    })
    .meta({
        id: 'CompositeAppEntry',
        description:
            'Configuration entry for an individual app in the CompositeApp shell. References an app installation by name.',
    });

export const CompositeAppHomePluginSchema = z
    .strictObject({
        appName: z.string().meta({ description: 'The app name to use as the home page' }),
        appRoute: z
            .string()
            .meta({ description: 'Optional route within the app (e.g. "/dashboard"). Defaults to "/"' })
            .optional(),
    })
    .meta({ id: 'CompositeAppHomePlugin' });

export const CompositeAppThemeOverridesSchema = z
    .strictObject({
        disableDarkMode: z
            .boolean()
            .meta({ description: 'When true, forces light mode and disables dark mode (defaults to false)' })
            .optional(),
    })
    .meta({ id: 'CompositeAppThemeOverrides', description: 'Theme overrides for the CompositeApp.' });

export const CompositeAppHeaderItemTargetSchema = z
    .enum(['_self', '_blank'])
    .meta({ id: 'CompositeAppHeaderItemTarget', description: 'Where a header link opens.' });

export const CompositeAppHeaderItemKindSchema = z.enum(['app_portal', 'docs', 'help', 'user_menu', 'custom']).meta({
    id: 'CompositeAppHeaderItemKind',
    description:
        'Discriminator for a header item. The four built-ins (`app_portal`, `docs`, `help`, `user_menu`) seed the default header and cannot be deleted (only hidden/customized); `custom` items are fully user-defined buttons.',
});

export const CompositeAppUserMenuOverridesSchema = z
    .strictObject({
        hidden: z.boolean().meta({ description: 'Whether to hide the User Menu (defaults to false)' }).optional(),
    })
    .meta({ id: 'CompositeAppUserMenuOverrides', description: 'User menu overrides for the CompositeApp.' });

export const CompositeAppHeaderOverridesSchema = z
    .strictObject({
        hideAppPortal: z
            .boolean()
            .meta({ description: 'Whether to hide the App Portal button (defaults to false)' })
            .optional(),
        hideDocs: z.boolean().meta({ description: 'Whether to hide the Docs button (defaults to false)' }).optional(),
        hideHelp: z.boolean().meta({ description: 'Whether to hide the Help button (defaults to false)' }).optional(),
    })
    .meta({
        id: 'CompositeAppHeaderOverrides',
        description: 'Header button visibility overrides for the CompositeApp header.',
    });

export const CompositeAppSidebarOverridesSchema = z
    .strictObject({
        hideSectionHeaders: z
            .boolean()
            .meta({ description: 'Whether to hide section title headers in the sidebar (defaults to false)' })
            .optional(),
        autoCollapse: z
            .boolean()
            .meta({
                description:
                    'Whether menu items auto-collapse when navigating (accordion behavior). When false, all items stay expanded. Defaults to true.',
            })
            .optional(),
        autoCollapseSettings: z
            .boolean()
            .meta({
                description:
                    'Whether settings section items auto-collapse when navigating. Independent of autoCollapse which handles all other items. Defaults to true.',
            })
            .optional(),
        autoCollapseFooter: z
            .boolean()
            .meta({
                description:
                    'Whether footer section items auto-collapse when navigating. Independent of autoCollapse which handles all other items. Defaults to true.',
            })
            .optional(),
    })
    .meta({ id: 'CompositeAppSidebarOverrides', description: 'Sidebar display overrides for the CompositeApp.' });

export const CompositeAppSwitchersOverridesSchema = z
    .strictObject({
        hideOrganization: z
            .boolean()
            .meta({ description: 'Whether to hide the organization switcher (defaults to false)' })
            .optional(),
        hideProject: z
            .boolean()
            .meta({ description: 'Whether to hide the project switcher (defaults to false)' })
            .optional(),
    })
    .meta({
        id: 'CompositeAppSwitchersOverrides',
        description: 'Switcher visibility overrides for the CompositeApp header.',
    });

export const CompositeAppMessageStyleSchema = z
    .enum(['foreground', 'info', 'success', 'attention', 'destructive'])
    .meta({ id: 'CompositeAppMessageStyle', description: 'Message banner overrides for the shell header.' });

export const CompositeAppLogoOverridesSchema = z
    .strictObject({
        lightModeUrl: z
            .string()
            .meta({ description: 'URL for light mode logo (overrides default Vertesia logo)' })
            .optional(),
        darkModeUrl: z
            .string()
            .meta({ description: 'URL for dark mode logo (overrides default Vertesia logo)' })
            .optional(),
        hideFooterLogo: z
            .boolean()
            .meta({
                description:
                    'Whether to hide the Vertesia footer logo in the sidebar when header logo is overridden (defaults to false)',
            })
            .optional(),
    })
    .meta({
        id: 'CompositeAppLogoOverrides',
        description:
            'Logo overrides for the CompositeApp shell header. When provided, these URLs replace the default Vertesia logo.',
    });

export const CompositeAppCardOverridesSchema = z
    .strictObject({
        visible: z
            .boolean()
            .meta({ description: 'Whether to show the CompositeApp card in App Portal (default: false)' })
            .optional(),
        label: z.string().meta({ description: 'Override the card label (default: "Composite App")' }).optional(),
        description: z.string().meta({ description: 'Override the card description' }).optional(),
        icon: z
            .string()
            .meta({ description: 'Override the card icon (Lucide icon name or SVG content string)' })
            .optional(),
        color: z.string().meta({ description: 'Override the card color (e.g., "blue", "red", "purple")' }).optional(),
    })
    .meta({
        id: 'CompositeAppCardOverrides',
        description:
            'Card display overrides for the CompositeApp in the App Portal. Similar to AppManifest display properties, but specific to the CompositeApp card. Allows customers to customize the app portal card (not otherwise possible if using a shared, Vertesia-managed manifest across accounts).',
    });

export const MCPOAuthConfigMapSchema = z.object({}).catchall(MCPOAuthConfigSchema).meta({ id: 'MCPOAuthConfigMap' });

export const InCodeViewDefinitionSchema = z
    .strictObject({
        id: z.string().meta({ description: 'App-local id. The platform normalizes it to app:<app-name>:<id>.' }),
        name: z.string().meta({ description: 'App-local name used for lookup and diagnostics.' }),
        title: z.string().optional(),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
        definition: ViewExperienceConfigurationSchema,
    })
    .meta({
        id: 'InCodeViewDefinition',
        description: 'A View definition contributed by application code through the app package endpoint.',
    });

export const InCodeTypeDefinitionArraySchema = z
    .array(InCodeTypeDefinitionSchema)
    .meta({ id: 'InCodeTypeDefinitionArray' });

export const RenderingTemplateDefinitionRefArraySchema = z
    .array(RenderingTemplateDefinitionRefSchema)
    .meta({ id: 'RenderingTemplateDefinitionRefArray' });

export const InCodeProcessDefinitionSchema: z.ZodType<InCodeProcessDefinition> = z
    .strictObject({
        id: z.string().meta({
            description:
                'Process identifier exposed by an app package. App-local ids are normalized by the platform to `app:<app-name>:<id>` when returned to callers.',
        }),
        name: z.string().meta({ description: 'Human-readable or app-local process name.' }),
        title: z.string().optional(),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
        definition: ProcessDefinitionBodySchema as z.ZodType<InCodeProcessDefinition['definition']>,
    })
    .meta({ id: 'InCodeProcessDefinition' });

export const AppInstallationSchema = z
    .strictObject({
        id: z.string(),
        project: z.string(),
        manifest: z.string(),
        settings: z.looseObject({}).optional(),
        tool_allowlist: z
            .array(z.string())
            .meta({
                description:
                    'Admin-managed allowlist of tool names permitted for this installation. When undefined, all tools from the app are permitted. When set, only listed tool names are available for agent configuration and execution.',
            })
            .optional(),
        oauth_bindings: z
            .array(AppInstallationOAuthBindingSchema)
            .meta({
                description:
                    'OAuth bindings created at install time via oauth_config provisioning. Maps collection identity (id or name) → OAuth provider ObjectId. Used by the runtime to resolve the correct OAuth provider without relying on manifest names.',
            })
            .optional(),
        provider_bindings: z
            .array(AppInstallationProviderBindingSchema)
            .meta({
                description:
                    'OAuth bindings created at install time via oauth_providers provisioning. Maps provider key → OAuth provider ObjectId. Multiple collections sharing the same provider all resolve to the same OAuth provider.',
            })
            .optional(),
        access_control: AppAccessControlSchema.meta({
            description:
                "Per-installation override of the manifest's access_control policy. When set, takes precedence over the manifest value. When undefined, the manifest value (or 'all' default) applies.",
        }).optional(),
        created_at: z.string(),
        updated_at: z.string(),
    })
    .meta({ id: 'AppInstallation' });

export const AppWidgetInfoSchema = z
    .strictObject({
        collection: z.string(),
        skill: z.string(),
        url: z.string(),
    })
    .meta({ id: 'AppWidgetInfo' });

export const AppDashboardDefinitionSchema = z
    .strictObject({
        id: z.string().meta({ description: 'Local app dashboard ID.' }),
        name: z.string().meta({ description: 'Machine-friendly dashboard name. Defaults to `id`.' }).optional(),
        title: z.string().meta({ description: 'Display title. Defaults to `name` or `id`.' }).optional(),
        description: z.string().meta({ description: 'User-facing description.' }).optional(),
        tags: z.array(z.string()).meta({ description: 'Tags for discovery and filtering.' }).optional(),
        dataSource: DashboardDataSourceSchema.meta({
            description: 'Data source used to populate Vega `data.values`.',
        }).optional(),
        query: z
            .string()
            .meta({ description: 'SQL query shortcut for app dashboards backed by data stores.' })
            .optional(),
        queryLimit: z.number().meta({ description: 'Maximum SQL rows to return.' }).optional(),
        queryParameters: StringValueMapSchema.meta({
            description: 'Default values for SQL {{param}} placeholders.',
        }).optional(),
        spec: z.looseObject({}).meta({ description: 'Complete Vega-Lite specification for the dashboard.' }).optional(),
        queries: z.array(DashboardQuerySchema).meta({ description: 'Legacy named SQL queries.' }).optional(),
        panels: z.array(DashboardPanelSchema).meta({ description: 'Legacy panel definitions.' }).optional(),
        layout: DashboardLayoutSchema.meta({ description: 'Legacy dashboard layout.' }).optional(),
    })
    .meta({
        id: 'AppDashboardDefinition',
        description:
            'Dashboard definition contributed by an app package.\n\nApp dashboard IDs are local to the app. The platform exposes them as `app:<app_name>:<id>` when listing or retrieving dashboards.',
    });

export const AppManifestDataSchema = z
    .strictObject({
        name: z.string().meta({
            description: 'The name of the app, used as the id in the system. Must be in kebab case (e.g. my-app).',
        }),
        visibility: z.enum(['public', 'private', 'vertesia']).meta({
            description:
                'Visibility level of the app:\n- "public": visible to all accounts\n- "private": visible only to the owning account\n- "vertesia": visible only to Vertesia team members (any project)',
        }),
        title: z.string(),
        description: z.string(),
        publisher: z.string(),
        icon: z.string().meta({ description: 'A svg icon for the app.' }).optional(),
        color: z
            .string()
            .meta({
                description:
                    'A color name to be used as the color of the app card (e.g. blue, red, green, etc.) If not specified a random color will be picked.',
            })
            .optional(),
        preview_screenshot: z
            .strictObject({
                agent_run_id: z
                    .string()
                    .meta({ description: 'Agent run id whose artifact storage holds the screenshot.' }),
                artifact: z.string().meta({
                    description: 'Artifact path within that storage, e.g. "preview-checks/app-preview-<ts>.png".',
                }),
            })
            .meta({
                description:
                    "Optional preview screenshot for the app-management UI, captured by the builder during a build/QA run. Resolved client-side from the owning agent run's artifact storage, so it carries both the run id and the artifact path.",
            })
            .optional(),
        status: z.enum(['beta', 'stable', 'deprecated']),
        ui: AppUIConfigSchema.meta({
            description:
                'The UI configuration of the app. If not specified and the app "ui" is in the app capabilities then the ui configuration will be fetched from the endpoint property.',
        }).optional(),
        tool_collections: z
            .array(ToolCollectionObjectSchema)
            .meta({
                description:
                    'A list of tool collections endpoints to be used by this app. Prefer using endpoint over tool_collections.',
            })
            .optional(),
        oauth_providers: MCPOAuthConfigMapSchema.meta({
            description:
                'Named OAuth providers shared across multiple MCP tool collections. Keys must be kebab-case identifiers. Each value is an MCPOAuthConfig blueprint. Collections reference a provider via MCPToolCollectionObject.oauth_provider. One OAuth provider is created per provider at install time; all referencing collections share that app via AppInstallation.provider_bindings.',
        }).optional(),
        interactions: z
            .string()
            .meta({
                description:
                    'An URL providing interactions definitions in JSON format. The URL must provide 2 endpoints: 1. GET URL - must return a JSON array with the list of interactions (as AppInteractionRef[]) 2. GET URL/{interaction_name} - must return the full interaction definition for the specified interaction. This feature is for advanced composition of interactions. Prefer using endpoint.',
            })
            .optional(),
        settings_schema: JSONSchemaRefSchema.meta({
            description:
                'A JSON chema for the app installation settings.\n\nDeprecated: Use endpoint to provide settings_schema instead',
            deprecated: true,
            'x-deprecated-message': 'Use endpoint to provide settings_schema instead',
        }).optional(),
        capabilities: z
            .array(AppCapabilitiesSchema)
            .meta({ description: 'Describe the capabiltities of this app - which kind of contributions it provides.' })
            .optional(),
        endpoint: z
            .string()
            .meta({
                description:
                    'The app endpoint URL This URL should return a JSON object describing the contributions provided by the app. The object shape must satisfies AppPackage interface. The endpoint must support GET method and a `scope` parameter to filter which resources are included in the returned AppPackage: The supported scope values are:\n- ui\n- tools\n- interactions\n- types\n- processes\n- templates\n- dashboards\n- settings\n- all (the default if no scope is provided)  You can also use comma-separated values to combine scopes (e.g. "ui,tools").\n\nExample:\n- ?scope=ui,tools - returns only the UI configuration',
            })
            .optional(),
        endpoint_overrides: StringValueMapSchema.meta({
            description:
                'Optional endpoint overrides keyed by environment name. When resolving the app endpoint, if the current environment name matches a key, the corresponding URL is used instead of the main `endpoint`. Only dev environment names are allowed as keys (starting with "desktop-" or "dev-").',
        }).optional(),
        version: z
            .string()
            .meta({ description: 'Optional app version string (e.g. "1.0.0") — informational.' })
            .optional(),
        source: AppSourceConfigSchema.meta({
            description:
                'Source repository configuration for apps generated and maintained through AppGen. Branches are mutable development lanes; immutable app versions record their exact source commit in AppVersionRecord.source_commit and AppVersionRecord.storage.source_git.',
        }).optional(),
        tags: z
            .array(z.string())
            .meta({
                description:
                    'Free-form tags used for classification and filtering. Platform apps carry `"system"` so UIs can skip install/uninstall/manage-permission controls that don\'t apply to synthetic installations.',
            })
            .optional(),
        access_control: AppAccessControlSchema.meta({
            description:
                "Access control policy for the app. Defaults to 'all' (ACE-gated everywhere) when undefined. See  {@link  AppAccessControl }  for semantics. May be overridden on the AppInstallation.",
        }).optional(),
    })
    .meta({ id: 'AppManifestData' });

export const UpdateAppPayloadSchema = AppManifestDataSchema.extend({
    expected_edit_revision: ExpectedEditRevisionSchema,
}).meta({ id: 'UpdateAppPayload' });

export const CompositeAppMenuNavItemSchema: z.ZodType<CompositeAppMenuNavItem> = z
    .strictObject({
        id: z.string().meta({ description: 'Stable unique identifier' }),
        label: z.string().meta({ description: 'Display label shown in the sidebar' }),
        icon: z.string().meta({ description: 'Lucide icon name or SVG content string' }).optional(),
        appName: z.string().meta({ description: 'Which installed app this item routes to' }).optional(),
        route: z.string().meta({ description: 'Route path within the app (e.g. "/" or "/dashboard")' }).optional(),
        hidden: z.boolean().meta({ description: 'When true, this item is hidden from the sidebar' }).optional(),
        description: z
            .string()
            .nullable()
            .meta({
                anyOf: undefined,
                type: ['string', 'null'],
                description:
                    'Optional description for dashboard cards and summary views. `null` = user explicitly cleared it (show no description, skip fallback). `undefined` / absent = no override (fall back to manifest description).',
            })
            .optional(),
        hideFromDashboard: z
            .boolean()
            .meta({ description: 'When true, this item is excluded from the Composite App dashboard cards' })
            .optional(),
        permissions: CompositeAppNavItemPermissionsSchema.meta({
            description: 'Optional access control settings for this nav item',
        }).optional(),
        get children() {
            return z.array(CompositeAppMenuNavItemSchema).meta({ description: 'Ordered child nav-items' }).optional();
        },
    })
    .meta({
        id: 'CompositeAppMenuNavItem',
        description:
            'A navigable item in the sidebar menu. An "app" is just a nav-item with `appName` + `route: "/"` that has children. Nav-items carry their own `appName` for routing, independent of position in the tree.',
    });

export const CompositeAppHeaderItemSchema = z
    .strictObject({
        id: z
            .string()
            .meta({ description: 'Stable unique identifier. Built-ins use their kind as id (e.g. "app_portal").' }),
        kind: CompositeAppHeaderItemKindSchema.meta({
            description: 'Item kind. `custom` for user-added buttons; otherwise one of the four built-ins.',
        }),
        label: z.string().meta({ description: 'Display label, used as the button tooltip / accessible name.' }),
        icon: z
            .string()
            .meta({ description: 'Lucide icon name or SVG content string. Ignored for `user_menu`.' })
            .optional(),
        href: z
            .string()
            .meta({ description: 'Destination route ("/...") or external URL. Ignored for `user_menu`.' })
            .optional(),
        target: CompositeAppHeaderItemTargetSchema.meta({
            description: 'Where to open the link (defaults to "_self"). Ignored for `user_menu`.',
        }).optional(),
        hidden: z.boolean().meta({ description: 'When true, this item is hidden from the header.' }).optional(),
        permissions: CompositeAppNavItemPermissionsSchema.meta({
            description: 'Optional access control settings for this header item.',
        }).optional(),
    })
    .meta({
        id: 'CompositeAppHeaderItem',
        description:
            'A single button in the CompositeApp header bar.\n\nUnlike sidebar nav-items, header items are free-form and not tied to an installed app: each is a labelled, icon-bearing button linking to a route or external URL. The `user_menu` item is special — it renders the account dropdown, so its `icon`, `href`, and `target` are ignored.',
    });

export const CompositeAppMessageOverridesSchema = z
    .strictObject({
        text: z.string().meta({ description: 'Message text to display' }).optional(),
        visible: z.boolean().meta({ description: 'Whether the message is visible (defaults to true)' }).optional(),
        style: CompositeAppMessageStyleSchema.meta({
            description: 'Text color style. Uses semantic colors',
        }).optional(),
    })
    .meta({ id: 'CompositeAppMessageOverrides' });

export const AppManifestSchema = z
    .strictObject({
        edit_revision: EditRevisionSchema,
        name: z.string().meta({
            description: 'The name of the app, used as the id in the system. Must be in kebab case (e.g. my-app).',
        }),
        visibility: z.enum(['public', 'private', 'vertesia']).meta({
            description:
                'Visibility level of the app:\n- "public": visible to all accounts\n- "private": visible only to the owning account\n- "vertesia": visible only to Vertesia team members (any project)',
        }),
        title: z.string(),
        description: z.string(),
        publisher: z.string(),
        icon: z.string().meta({ description: 'A svg icon for the app.' }).optional(),
        color: z
            .string()
            .meta({
                description:
                    'A color name to be used as the color of the app card (e.g. blue, red, green, etc.) If not specified a random color will be picked.',
            })
            .optional(),
        preview_screenshot: z
            .strictObject({
                agent_run_id: z
                    .string()
                    .meta({ description: 'Agent run id whose artifact storage holds the screenshot.' }),
                artifact: z.string().meta({
                    description: 'Artifact path within that storage, e.g. "preview-checks/app-preview-<ts>.png".',
                }),
            })
            .meta({
                description:
                    "Optional preview screenshot for the app-management UI, captured by the builder during a build/QA run. Resolved client-side from the owning agent run's artifact storage, so it carries both the run id and the artifact path.",
            })
            .optional(),
        status: z.enum(['beta', 'stable', 'deprecated']),
        ui: AppUIConfigSchema.meta({
            description:
                'The UI configuration of the app. If not specified and the app "ui" is in the app capabilities then the ui configuration will be fetched from the endpoint property.',
        }).optional(),
        tool_collections: z
            .array(ToolCollectionObjectSchema)
            .meta({
                description:
                    'A list of tool collections endpoints to be used by this app. Prefer using endpoint over tool_collections.',
            })
            .optional(),
        oauth_providers: MCPOAuthConfigMapSchema.meta({
            description:
                'Named OAuth providers shared across multiple MCP tool collections. Keys must be kebab-case identifiers. Each value is an MCPOAuthConfig blueprint. Collections reference a provider via MCPToolCollectionObject.oauth_provider. One OAuth provider is created per provider at install time; all referencing collections share that app via AppInstallation.provider_bindings.',
        }).optional(),
        interactions: z
            .string()
            .meta({
                description:
                    'An URL providing interactions definitions in JSON format. The URL must provide 2 endpoints: 1. GET URL - must return a JSON array with the list of interactions (as AppInteractionRef[]) 2. GET URL/{interaction_name} - must return the full interaction definition for the specified interaction. This feature is for advanced composition of interactions. Prefer using endpoint.',
            })
            .optional(),
        settings_schema: JSONSchemaRefSchema.meta({
            description:
                'A JSON chema for the app installation settings.\n\nDeprecated: Use endpoint to provide settings_schema instead',
            deprecated: true,
            'x-deprecated-message': 'Use endpoint to provide settings_schema instead',
        }).optional(),
        capabilities: z
            .array(AppCapabilitiesSchema)
            .meta({ description: 'Describe the capabiltities of this app - which kind of contributions it provides.' })
            .optional(),
        endpoint: z
            .string()
            .meta({
                description:
                    'The app endpoint URL This URL should return a JSON object describing the contributions provided by the app. The object shape must satisfies AppPackage interface. The endpoint must support GET method and a `scope` parameter to filter which resources are included in the returned AppPackage: The supported scope values are:\n- ui\n- tools\n- interactions\n- types\n- processes\n- templates\n- dashboards\n- settings\n- all (the default if no scope is provided)  You can also use comma-separated values to combine scopes (e.g. "ui,tools").\n\nExample:\n- ?scope=ui,tools - returns only the UI configuration',
            })
            .optional(),
        endpoint_overrides: StringValueMapSchema.meta({
            description:
                'Optional endpoint overrides keyed by environment name. When resolving the app endpoint, if the current environment name matches a key, the corresponding URL is used instead of the main `endpoint`. Only dev environment names are allowed as keys (starting with "desktop-" or "dev-").',
        }).optional(),
        version: z
            .string()
            .meta({ description: 'Optional app version string (e.g. "1.0.0") — informational.' })
            .optional(),
        source: AppManifestSourceSchema.meta({
            description: 'Source metadata for generated or synced app manifests.',
        }).optional(),
        tags: z
            .array(z.string())
            .meta({
                description:
                    'Free-form tags used for classification and filtering. Platform apps carry `"system"` so UIs can skip install/uninstall/manage-permission controls that don\'t apply to synthetic installations.',
            })
            .optional(),
        access_control: AppAccessControlSchema.meta({
            description:
                "Access control policy for the app. Defaults to 'all' (ACE-gated everywhere) when undefined. See  {@link  AppAccessControl }  for semantics. May be overridden on the AppInstallation.",
        }).optional(),
        id: z.string(),
        account: z
            .string()
            .meta({ description: 'The owning account. Undefined for apps imported from a master region.' })
            .optional(),
        created_at: z.string(),
        updated_at: z.string(),
    })
    .meta({ id: 'AppManifest' });

export const InCodeViewDefinitionArraySchema = z
    .array(InCodeViewDefinitionSchema)
    .meta({ id: 'InCodeViewDefinitionArray' });

export const InCodeProcessDefinitionArraySchema = z
    .array(InCodeProcessDefinitionSchema)
    .meta({ id: 'InCodeProcessDefinitionArray' });

export const AppManifestArraySchema = z.array(AppManifestSchema).meta({ id: 'AppManifestArray' });

export const AppInstallationWithManifestSchema = z
    .strictObject({
        id: z.string(),
        project: z.string(),
        settings: z.looseObject({}).optional(),
        tool_allowlist: z
            .array(z.string())
            .meta({
                description:
                    'Admin-managed allowlist of tool names permitted for this installation. When undefined, all tools from the app are permitted. When set, only listed tool names are available for agent configuration and execution.',
            })
            .optional(),
        oauth_bindings: z
            .array(AppInstallationOAuthBindingSchema)
            .meta({
                description:
                    'OAuth bindings created at install time via oauth_config provisioning. Maps collection identity (id or name) → OAuth provider ObjectId. Used by the runtime to resolve the correct OAuth provider without relying on manifest names.',
            })
            .optional(),
        provider_bindings: z
            .array(AppInstallationProviderBindingSchema)
            .meta({
                description:
                    'OAuth bindings created at install time via oauth_providers provisioning. Maps provider key → OAuth provider ObjectId. Multiple collections sharing the same provider all resolve to the same OAuth provider.',
            })
            .optional(),
        access_control: AppAccessControlSchema.meta({
            description:
                "Per-installation override of the manifest's access_control policy. When set, takes precedence over the manifest value. When undefined, the manifest value (or 'all' default) applies.",
        }).optional(),
        created_at: z.string(),
        updated_at: z.string(),
        manifest: AppManifestSchema,
        oauth_collection_ids: z
            .array(z.string())
            .meta({
                description:
                    "Computed by the server: ids of MCP tool collections for this installation that require OAuth. Accounts for all three signals: manifest auth:'oauth', manifest oauth_app, and oauth_bindings. Populated by the GET /installations/all endpoint.",
            })
            .optional(),
    })
    .meta({ id: 'AppInstallationWithManifest' });

export const AppInstallationArraySchema = z.array(AppInstallationSchema).meta({ id: 'AppInstallationArray' });

export const AppInstallationListEntrySchema = z
    .strictObject({
        id: z.string(),
        project: z.string(),
        settings: z.looseObject({}).optional(),
        tool_allowlist: z
            .array(z.string())
            .meta({
                description:
                    'Admin-managed allowlist of tool names permitted for this installation. When undefined, all tools from the app are permitted. When set, only listed tool names are available for agent configuration and execution.',
            })
            .optional(),
        oauth_bindings: z
            .array(AppInstallationOAuthBindingSchema)
            .meta({
                description:
                    'OAuth bindings created at install time via oauth_config provisioning. Maps collection identity (id or name) → OAuth provider ObjectId. Used by the runtime to resolve the correct OAuth provider without relying on manifest names.',
            })
            .optional(),
        provider_bindings: z
            .array(AppInstallationProviderBindingSchema)
            .meta({
                description:
                    'OAuth bindings created at install time via oauth_providers provisioning. Maps provider key → OAuth provider ObjectId. Multiple collections sharing the same provider all resolve to the same OAuth provider.',
            })
            .optional(),
        access_control: AppAccessControlSchema.meta({
            description:
                "Per-installation override of the manifest's access_control policy. When set, takes precedence over the manifest value. When undefined, the manifest value (or 'all' default) applies.",
        }).optional(),
        created_at: z.string(),
        updated_at: z.string(),
        manifest: z.union([AppManifestSchema, z.null()]),
        oauth_collection_ids: z.array(z.string()).optional(),
    })
    .meta({ id: 'AppInstallationListEntry' });

export const AppWidgetInfoMapSchema = z.object({}).catchall(AppWidgetInfoSchema).meta({ id: 'AppWidgetInfoMap' });

export const CompositeAppMenuSectionSchema = z
    .strictObject({
        id: z.string().meta({ description: 'Stable unique identifier' }),
        label: z.string().meta({ description: 'Section heading label' }),
        hidden: z
            .boolean()
            .meta({ description: 'When true, this section and its items are hidden from the sidebar' })
            .optional(),
        items: z.array(CompositeAppMenuNavItemSchema).meta({ description: 'Ordered nav-items within this section' }),
    })
    .meta({
        id: 'CompositeAppMenuSection',
        description:
            'A top-level section heading in the sidebar menu. Sections are always at root level and contain nav-items.',
    });

export const PromoteAppVersionResponseSchema = z
    .strictObject({
        version: AppVersionRecordSchema,
        app: AppManifestSchema.optional(),
    })
    .meta({ id: 'PromoteAppVersionResponse' });

export const AppInstallationWithManifestArraySchema = z
    .array(AppInstallationWithManifestSchema)
    .meta({ id: 'AppInstallationWithManifestArray' });

export const AppInstallationListEntryArraySchema = z
    .array(AppInstallationListEntrySchema)
    .meta({ id: 'AppInstallationListEntryArray' });

export const CompositeAppConfigSchema = z
    .strictObject({
        edit_revision: EditRevisionSchema,
        id: z
            .string()
            .meta({
                description:
                    "The unique identifier for this CompositeApp configuration Undefined if the configuration doesn't exists yet.",
            })
            .optional(),
        project: z.string().meta({ description: 'The project this CompositeApp belongs to' }),
        card: CompositeAppCardOverridesSchema.meta({
            description: 'Card display overrides (includes visibility)',
        }).optional(),
        logo: CompositeAppLogoOverridesSchema.meta({
            description: 'Optional logo overrides (replaces default Vertesia logo)',
        }).optional(),
        message: CompositeAppMessageOverridesSchema.meta({
            description: 'Optional message banner overrides',
        }).optional(),
        switchers: CompositeAppSwitchersOverridesSchema.meta({
            description: 'Optional switcher visibility overrides',
        }).optional(),
        sidebar: CompositeAppSidebarOverridesSchema.meta({
            description: 'Optional sidebar display overrides',
        }).optional(),
        header: CompositeAppHeaderOverridesSchema.meta({
            description:
                'Deprecated: Use `headerMenu` instead. Optional header button visibility overrides.\nStill read to seed `headerMenu` defaults for configs saved before the header menu existed.',
            deprecated: true,
            'x-deprecated-message':
                'Use `headerMenu` instead. Optional header button visibility overrides.\nStill read to seed `headerMenu` defaults for configs saved before the header menu existed.',
        }).optional(),
        userMenu: CompositeAppUserMenuOverridesSchema.meta({
            description:
                'Deprecated: Use the `user_menu` item in `headerMenu` instead. Optional user menu overrides.\nStill read to seed `headerMenu` defaults for configs saved before the header menu existed.',
            deprecated: true,
            'x-deprecated-message':
                'Use the `user_menu` item in `headerMenu` instead. Optional user menu overrides.\nStill read to seed `headerMenu` defaults for configs saved before the header menu existed.',
        }).optional(),
        headerMenu: z
            .array(CompositeAppHeaderItemSchema)
            .meta({
                description:
                    "Optional free-form header menu. When present, the header renders from this ordered list instead of the legacy `header`/`userMenu` flags. Built-in items (App Portal, Docs, Help, User Menu) can be hidden/relabeled/re-icon'd/redirected; custom items are arbitrary buttons.",
            })
            .optional(),
        theme: CompositeAppThemeOverridesSchema.meta({
            description: 'Optional theme overrides (e.g. disable dark mode)',
        }).optional(),
        homePlugin: z
            .union([CompositeAppHomePluginSchema, z.null()])
            .meta({
                description:
                    'Optional home page override. When set, redirects "/" to the specified app route instead of the dashboard. Send null to unset.',
            })
            .optional(),
        apps: z.array(CompositeAppEntrySchema).meta({
            description:
                'List of apps to include in the CompositeApp (used for installation tracking and fallback sidebar)',
        }),
        menu: z
            .array(CompositeAppMenuSectionSchema)
            .meta({
                description:
                    'Optional sidebar menu. When present, the sidebar renders from this instead of the apps-based pipeline. Top-level array is sections; each section contains nav-items.',
            })
            .optional(),
    })
    .meta({
        id: 'CompositeAppConfig',
        description:
            'CompositeApp shell configuration. This is the main configuration interface for storing CompositeApp settings. Used as the MongoDB model for persisting CompositeApp configurations.',
    });

export const AppPackageEventHookSchema = z
    .strictObject({
        name: z.string().meta({ description: 'Registered event hook name.' }),
        path: z.string().meta({ description: 'Authenticated endpoint that receives the event delivery envelope.' }),
        description: z.string().meta({ description: 'Optional description of the event hook behavior.' }).optional(),
    })
    .meta({
        id: 'AppPackageEventHook',
        description: 'An authenticated event hook exposed by the app runtime.',
    });

export const AppPackageHooksSchema = z
    .strictObject({
        install: z.string().meta({ description: 'Authenticated endpoint for the app install hook.' }).optional(),
        uninstall: z.string().meta({ description: 'Authenticated endpoint for the app uninstall hook.' }).optional(),
        events: z
            .array(AppPackageEventHookSchema)
            .meta({ description: 'Named event hooks exposed by the app runtime.' })
            .optional(),
    })
    .meta({
        id: 'AppPackageHooks',
        description:
            'Lifecycle and event hooks exposed by the app runtime. Lifecycle entries are informational; Studio invokes their conventional sibling endpoints directly.',
    });

const AppEventHookPlatformEventSchema = EventRefSchema.extend({
    timestamp: z.string(),
    source: z.string(),
    audit_trail: z.boolean().optional(),
    replay_of: z.string().optional(),
    replay_root_event_id: z.string().optional(),
    replayed_by: z.string().optional(),
    request_id: z.string().nullable().optional(),
    status: z.number().optional(),
    success: z.boolean().optional(),
    principal_id: z.string().nullable().optional(),
    principal_type: z.string().nullable().optional(),
    effective_principal_id: z.string().nullable().optional(),
    roles: z.array(z.string()).optional(),
    account_name: z.string().nullable().optional(),
    project_name: z.string().nullable().optional(),
    provider: z.string().nullable().optional(),
    meters: z.array(AuditMeterSchema).optional(),
    resource_data: z.record(z.string(), z.unknown()).optional(),
    resource_version: z.string().optional(),
    details: z.record(z.string(), z.unknown()).optional(),
}) satisfies z.ZodType<PlatformEvent>;

export const AppEventHookDeliverySchema = z
    .strictObject({
        id: z.string().meta({ description: 'Event-delivery intent id.' }),
        subscription_id: z.string().meta({ description: 'Event subscription id.' }),
        attempt: z.number().finite().meta({ description: 'Current delivery attempt number.' }),
    })
    .meta({
        id: 'AppEventHookDelivery',
        description: 'Delivery metadata accompanying an app event-hook invocation.',
    });

export const AppEventHookPayloadSchema = z
    .strictObject({
        event: AppEventHookPlatformEventSchema,
        delivery: AppEventHookDeliverySchema,
    })
    .meta({
        id: 'AppEventHookPayload',
        description: 'Canonical platform event envelope delivered to an authenticated app event hook.',
    });

export const AppEventSubscriptionDefinitionSchema = z
    .strictObject({
        id: z
            .string()
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
            .meta({ description: 'Stable app-local subscription id in kebab case.' }),
        name: z.string().meta({ description: 'Human-readable subscription name.' }),
        description: z.string().meta({ description: 'Optional description of the subscription behavior.' }).optional(),
        hook: z.string().meta({ description: 'Name of an event hook registered by the same app package.' }),
        filter: EventSubscriptionFilterSchema,
        run_as_role: SystemRolesSchema.meta({
            description:
                'Identity used for event delivery. Use automation for the standard event-triggered execution identity.',
        }),
        enabled: z.boolean().meta({ description: 'Whether the installed subscription is enabled.' }).optional(),
        priority: EventPrioritySchema.meta({ description: 'Delivery priority for matching events.' }).optional(),
    })
    .meta({
        id: 'AppEventSubscriptionDefinition',
        description:
            'An app-owned event subscription. Studio derives its project scope and delivery target from the app installation and referenced event hook.',
    });

export const AppPackageSchema = z
    .strictObject({
        ui: AppUIConfigSchema.meta({ description: 'The UI configuration of the app' }).optional(),
        tools: z
            .array(AgentToolDefinitionSchema)
            .meta({ description: 'A list of tools exposed by the app.' })
            .optional(),
        skills: z
            .array(AgentToolDefinitionSchema)
            .meta({
                description:
                    "A list of skills (`learn_*` tools) exposed by the app. Kept separate from `tools` so clients can render them distinctly — consumers that don't care (e.g. the worker building a combined tool registry) should concatenate the two lists.",
            })
            .optional(),
        interactions: z
            .array(CatalogInteractionRefSchema)
            .meta({ description: 'A list of interactions exposed by the app' })
            .optional(),
        types: z.array(InCodeTypeDefinitionSchema).meta({ description: 'A list of types.' }).optional(),
        processes: z
            .array(InCodeProcessDefinitionSchema)
            .meta({ description: 'A list of process definitions exposed by the app.' })
            .optional(),
        views: z
            .array(InCodeViewDefinitionSchema)
            .meta({ description: 'View Experiences exposed by the app as in-code definitions.' })
            .optional(),
        templates: z
            .array(RenderingTemplateDefinitionRefSchema)
            .meta({ description: 'Templates provided by the app.' })
            .optional(),
        dashboards: z
            .array(AppDashboardDefinitionSchema)
            .meta({ description: 'Dashboards provided by the app.' })
            .optional(),
        widgets: AppWidgetInfoMapSchema.meta({ description: 'Widgets provided by the app.' }).optional(),
        activities: z
            .array(RemoteActivityDefinitionSchema)
            .meta({
                description:
                    'Remote activities exposed by the app for use in DSL workflows. Activities are discovered via `?scope=activities` and referenced in workflow steps using colon-separated names: `app:<app_name>:<collection>:<activity_name>`.',
            })
            .optional(),
        settings_schema: JSONSchemaRefSchema.meta({
            description: 'A JSON chema for the app installation settings.',
        }).optional(),
        hooks: AppPackageHooksSchema.optional(),
        subscriptions: z
            .array(AppEventSubscriptionDefinitionSchema)
            .meta({ description: 'Event subscriptions contributed by the app.' })
            .optional(),
    })
    .meta({ id: 'AppPackage' });

export const CompositeAppConfigPayloadSchema = z
    .strictObject({
        expected_edit_revision: ExpectedEditRevisionSchema,
        card: CompositeAppCardOverridesSchema.meta({
            description: 'Card display overrides (includes visibility)',
        }).optional(),
        logo: CompositeAppLogoOverridesSchema.meta({
            description: 'Optional logo overrides (replaces default Vertesia logo)',
        }).optional(),
        message: CompositeAppMessageOverridesSchema.meta({
            description: 'Optional message banner overrides',
        }).optional(),
        switchers: CompositeAppSwitchersOverridesSchema.meta({
            description: 'Optional switcher visibility overrides',
        }).optional(),
        sidebar: CompositeAppSidebarOverridesSchema.meta({
            description: 'Optional sidebar display overrides',
        }).optional(),
        header: CompositeAppHeaderOverridesSchema.meta({
            description:
                'Deprecated: Use `headerMenu` instead. Optional header button visibility overrides.\nStill read to seed `headerMenu` defaults for configs saved before the header menu existed.',
            deprecated: true,
            'x-deprecated-message':
                'Use `headerMenu` instead. Optional header button visibility overrides.\nStill read to seed `headerMenu` defaults for configs saved before the header menu existed.',
        }).optional(),
        userMenu: CompositeAppUserMenuOverridesSchema.meta({
            description:
                'Deprecated: Use the `user_menu` item in `headerMenu` instead. Optional user menu overrides.\nStill read to seed `headerMenu` defaults for configs saved before the header menu existed.',
            deprecated: true,
            'x-deprecated-message':
                'Use the `user_menu` item in `headerMenu` instead. Optional user menu overrides.\nStill read to seed `headerMenu` defaults for configs saved before the header menu existed.',
        }).optional(),
        headerMenu: z
            .array(CompositeAppHeaderItemSchema)
            .meta({
                description:
                    "Optional free-form header menu. When present, the header renders from this ordered list instead of the legacy `header`/`userMenu` flags. Built-in items (App Portal, Docs, Help, User Menu) can be hidden/relabeled/re-icon'd/redirected; custom items are arbitrary buttons.",
            })
            .optional(),
        theme: CompositeAppThemeOverridesSchema.meta({
            description: 'Optional theme overrides (e.g. disable dark mode)',
        }).optional(),
        homePlugin: z
            .union([CompositeAppHomePluginSchema, z.null()])
            .meta({
                description:
                    'Optional home page override. When set, redirects "/" to the specified app route instead of the dashboard. Send null to unset.',
            })
            .optional(),
        apps: z
            .array(CompositeAppEntrySchema)
            .meta({
                description:
                    'List of apps to include in the CompositeApp (used for installation tracking and fallback sidebar)',
            })
            .optional(),
        menu: z
            .array(CompositeAppMenuSectionSchema)
            .meta({
                description:
                    'Optional sidebar menu. When present, the sidebar renders from this instead of the apps-based pipeline. Top-level array is sections; each section contains nav-items.',
            })
            .optional(),
    })
    .meta({ id: 'CompositeAppConfigPayload' });
