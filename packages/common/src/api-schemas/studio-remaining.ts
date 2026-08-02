import type { JSONSchema } from '@llumiverse/common';
import { z } from 'zod';
import type { CompositeAppMenuNavItem } from '../apps.js';
import { SupportedIntegrations } from '../integrations.js';
import type { InCodeProcessDefinition } from '../store/process.js';
import {
    AgentToolDefinitionSchema,
    AppInstallationOAuthBindingSchema,
    AppInstallationProviderBindingSchema,
    AppVersionRecordSchema,
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
import {
    DashboardDataSourceSchema,
    DashboardLayoutSchema,
    DashboardPanelSchema,
    DashboardQuerySchema,
} from './dashboard.js';
import { StringValueMapSchema } from './files.js';
import { CatalogInteractionRefSchema } from './interaction.js';
import { RenderingTemplateDefinitionRefSchema } from './project.js';
import { InCodeTypeDefinitionSchema } from './store.js';
import {
    DSLActivityOptionsSchema,
    ProcessDefinitionBodySchema,
    ViewExperienceConfigurationSchema,
} from './zeno-remaining.js';

const JSONSchemaRefSchema: z.ZodType<JSONSchema> = z.any().meta({
    $ref: '#/components/schemas/JSONSchema',
});

/**
 * Generated from the published components by `scripts/convert-to-zod.mjs`, then reviewed.
 *
 * Every schema below was checked against the document it replaces: `--verify` re-emits this
 * module through the registry adapter and diffs it, so the shapes are the shipped ones.
 */
export const WebsiteCredentialTotpAlgorithmSchema = z
    .enum(['SHA1', 'SHA256', 'SHA512'])
    .meta({ id: 'WebsiteCredentialTotpAlgorithm' });

export const WebsiteCredentialTotpMetadataSchema = z
    .strictObject({
        algorithm: WebsiteCredentialTotpAlgorithmSchema.optional(),
        digits: z
            .union([z.literal(6), z.literal(8)])
            .meta({ anyOf: undefined, type: 'number', enum: [6, 8] })
            .optional(),
        period: z.number().optional(),
        issuer: z.string().optional(),
        account: z.string().optional(),
    })
    .meta({ id: 'WebsiteCredentialTotpMetadata' });

export const WebsiteCredentialSecretInputSchema = z
    .strictObject({
        username: z
            .string()
            .meta({
                description:
                    'Optional encrypted username. Prefer metadata.username unless the username itself is sensitive.',
            })
            .optional(),
        password: z.string().optional(),
        totp: z
            .strictObject({
                seed: z.string(),
                algorithm: WebsiteCredentialTotpAlgorithmSchema.optional(),
                digits: z
                    .union([z.literal(6), z.literal(8)])
                    .meta({ anyOf: undefined, type: 'number', enum: [6, 8] })
                    .optional(),
                period: z.number().optional(),
                issuer: z.string().optional(),
                account: z.string().optional(),
            })
            .optional(),
        oauth: z
            .strictObject({
                provider_id: z.string().optional(),
                token_owner: z.enum(['user', 'project']).optional(),
                token_ref: z.string().optional(),
            })
            .meta({
                description: 'Future OAuth materialization hook. The token itself remains in the OAuth secret store.',
            })
            .optional(),
    })
    .meta({ id: 'WebsiteCredentialSecretInput' });

export const WebsiteCredentialCapabilitySchema = z
    .enum(['password', 'totp', 'oauth'])
    .meta({ id: 'WebsiteCredentialCapability' });

export const WebsiteCredentialWebsiteSchema = z
    .strictObject({
        host: z.string().meta({ description: 'Hostname this credential is allowed on. Subdomains match.' }),
        login_url: z.string().meta({ description: 'Optional login URL used by agents as a hint.' }).optional(),
        allowed_origins: z
            .array(z.string())
            .meta({ description: 'Optional narrower origin allowlist for this credential.' })
            .optional(),
    })
    .meta({ id: 'WebsiteCredentialWebsite' });

export const SecretKindSchema = z.literal('website_credential').meta({ id: 'SecretKind' });

export const SecretProjectQuerySchema = z
    .object({
        project_id: z
            .string()
            .meta({
                description: 'Project scope for top-level secret APIs. Must match the authenticated project context.',
            })
            .optional(),
    })
    .meta({ id: 'SecretProjectQuery' });

export const ListSecretsQuerySchema = SecretProjectQuerySchema.extend({
    kind: SecretKindSchema.optional(),
    host: z.string().optional(),
    enabled: z.boolean().optional(),
}).meta({ id: 'ListSecretsQuery' });

export const SecretLookupQuerySchema = SecretProjectQuerySchema.extend({
    kind: SecretKindSchema.optional(),
}).meta({ id: 'SecretLookupQuery' });

export const RenderPromptPayloadSchema = z.looseObject({}).meta({ id: 'RenderPromptPayload' });

export const ProjectPluginArraySchema = z.array(z.string()).meta({ id: 'ProjectPluginArray' });

export const BinaryFileResponseSchema = z.string().meta({ id: 'BinaryFileResponse', format: 'binary' });

export const SupportedIntegrations_ask_user_webhookSchema = z
    .literal(SupportedIntegrations.ask_user_webhook)
    .meta({ id: 'SupportedIntegrations_ask_user_webhook' });

export const SupportedIntegrations_resendSchema = z
    .literal(SupportedIntegrations.resend)
    .meta({ id: 'SupportedIntegrations_resend' });

export const SupportedIntegrations_linkupSchema = z
    .literal(SupportedIntegrations.linkup)
    .meta({ id: 'SupportedIntegrations_linkup' });

export const SupportedIntegrations_exaSchema = z
    .literal(SupportedIntegrations.exa)
    .meta({ id: 'SupportedIntegrations_exa' });

export const SupportedIntegrations_serperSchema = z
    .literal(SupportedIntegrations.serper)
    .meta({ id: 'SupportedIntegrations_serper' });

export const SupportedIntegrations_magic_pdfSchema = z
    .literal(SupportedIntegrations.magic_pdf)
    .meta({ id: 'SupportedIntegrations_magic_pdf' });

export const SupportedIntegrations_awsSchema = z
    .literal(SupportedIntegrations.aws)
    .meta({ id: 'SupportedIntegrations_aws' });

export const SupportedIntegrations_githubSchema = z
    .literal(SupportedIntegrations.github)
    .meta({ id: 'SupportedIntegrations_github' });

export const SupportedIntegrations_gladiaSchema = z
    .literal(SupportedIntegrations.gladia)
    .meta({ id: 'SupportedIntegrations_gladia' });

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

export const WebsiteCredentialRecordSchema = z
    .strictObject({
        id: z.string(),
        credential_ref: z.string(),
        project: z.string(),
        name: z.string(),
        websites: z.array(WebsiteCredentialWebsiteSchema),
        username: z.string().optional(),
        username_hint: z.string().optional(),
        username_secret_enabled: z.boolean(),
        properties: z.looseObject({}).optional(),
        tags: z.array(z.string()).optional(),
        enabled: z.boolean().optional(),
        capabilities: z.array(WebsiteCredentialCapabilitySchema).optional(),
        notes: z.string().optional(),
        totp_metadata: WebsiteCredentialTotpMetadataSchema.optional(),
        expires_at: z
            .string()
            .meta({
                description:
                    'Optional ISO timestamp after which the credential is no longer usable. Expired credentials are hidden from lookup and cannot be filled.',
            })
            .optional(),
        created_at: z.string().optional(),
        updated_at: z.string().optional(),
        has_username_secret: z.boolean(),
        has_password: z.boolean(),
        has_totp: z.boolean(),
        has_oauth: z.boolean(),
        password_hint: z.string().optional(),
    })
    .meta({ id: 'WebsiteCredentialRecord' });

export const InCodeViewDefinitionSchema = z
    .strictObject({
        id: z.string().meta({ description: 'App-local id. Studio normalizes it to app:<app-name>:<id>.' }),
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
                'Process identifier exposed by an app package. App-local ids are normalized by Studio to `app:<app-name>:<id>` when returned to callers.',
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

export const AskUserWebhookConfigurationSchema = z
    .strictObject({
        integration: SupportedIntegrations_ask_user_webhookSchema,
        enabled: z.boolean(),
        webhook_url: z.string().meta({ description: 'Webhook URL to receive ask_user events' }),
        has_webhook_secret: z.boolean().optional(),
        webhook_secret_hint: z.string().optional(),
        events: z
            .array(z.enum(['requested', 'resolved']))
            .meta({ description: "Which events to send: ['requested', 'resolved'] or subset (default: both)" })
            .optional(),
        custom_headers: StringValueMapSchema.meta({
            description: 'Custom headers to include in webhook requests',
        }).optional(),
    })
    .meta({
        id: 'AskUserWebhookConfiguration',
        description:
            'Configuration for ask_user webhook notifications. Sends webhooks when agents call ask_user and when users respond.',
    });

export const ResendConfigurationSchema = z
    .strictObject({
        integration: SupportedIntegrations_resendSchema,
        enabled: z.boolean(),
        has_api_key: z.boolean().optional(),
        api_key_hint: z.string().optional(),
        email_domain: z
            .string()
            .meta({ description: 'Domain for email (both sending and receiving). Must be verified in Resend.' }),
        default_from_name: z
            .string()
            .meta({ description: 'Default display name for outgoing emails (e.g., "Vertesia - Project Name")' })
            .optional(),
        has_webhook_secret: z.boolean().optional(),
        webhook_secret_hint: z.string().optional(),
        allowed_sender_domains: z
            .array(z.string())
            .meta({ description: 'Domains allowed to send emails TO start agents (for inbound validation)' })
            .optional(),
        require_project_access: z
            .boolean()
            .meta({ description: 'Require sender to have project access to start agents via email (default: true)' })
            .optional(),
        require_email_auth: z
            .boolean()
            .meta({ description: 'Require DKIM/SPF authentication to pass for inbound emails (default: true)' })
            .optional(),
    })
    .meta({ id: 'ResendConfiguration' });

export const LinkupConfigurationSchema = z
    .strictObject({
        integration: SupportedIntegrations_linkupSchema,
        enabled: z.boolean(),
        has_api_key: z.boolean().optional(),
        api_key_hint: z.string().optional(),
    })
    .meta({ id: 'LinkupConfiguration' });

export const ExaConfigurationSchema = z
    .strictObject({
        integration: SupportedIntegrations_exaSchema,
        enabled: z.boolean(),
        has_api_key: z.boolean().optional(),
        api_key_hint: z.string().optional(),
    })
    .meta({ id: 'ExaConfiguration' });

export const SerperConfigurationSchema = z
    .strictObject({
        integration: SupportedIntegrations_serperSchema,
        enabled: z.boolean(),
        has_api_key: z.boolean().optional(),
        api_key_hint: z.string().optional(),
        url: z.string().optional(),
    })
    .meta({ id: 'SerperConfiguration' });

export const GithubConfigurationSchema = z
    .strictObject({
        integration: SupportedIntegrations_githubSchema,
        enabled: z.boolean(),
        github_app_id: z
            .string()
            .meta({ description: 'Numeric GitHub App id used to mint installation tokens (non-secret).' })
            .optional(),
        allowed_repositories: z.array(z.string()),
        has_github_app_private_key: z
            .boolean()
            .meta({
                description:
                    'True when a GitHub App private key is stored for the project (the key itself is never returned).',
            })
            .optional(),
    })
    .meta({ id: 'GithubConfiguration' });

export const GladiaConfigurationSchema = z
    .strictObject({
        integration: SupportedIntegrations_gladiaSchema,
        enabled: z.boolean(),
        has_api_key: z.boolean().optional(),
        api_key_hint: z.string().optional(),
        url: z.string().optional(),
    })
    .meta({ id: 'GladiaConfiguration' });

export const RemoteActivityDefinitionSchema = z
    .strictObject({
        name: z.string().meta({ description: 'Activity name (snake_case, unique within the collection)' }),
        collection: z.string().meta({ description: 'Collection name this activity belongs to' }).optional(),
        title: z.string().meta({ description: 'Display title' }).optional(),
        description: z.string().meta({ description: 'Description of what the activity does' }).optional(),
        input_schema: z
            .looseObject({})
            .meta({ description: 'JSON Schema for the activity input parameters' })
            .optional(),
        output_schema: z.looseObject({}).meta({ description: 'JSON Schema for the activity output' }).optional(),
        url: z
            .string()
            .meta({
                description:
                    'The activity execution URL. Can be absolute or relative to the tool server base URL. If not provided, the collection-specific activities endpoint is used.',
            })
            .optional(),
        options: DSLActivityOptionsSchema.meta({ description: 'Suggested timeout and retry configuration' }).optional(),
    })
    .meta({
        id: 'RemoteActivityDefinition',
        description:
            'Definition of a remote activity exposed by a tool server for use in DSL workflows. Remote activities are identified in workflow steps using colon-separated names: `app:<app_name>:<collection>:<activity_name>` (e.g. `app:my-nlp-app:examples:word_count`).',
    });

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

export const WebsiteCredentialFillResponseSchema = z
    .strictObject({
        ok: z.boolean(),
        credential_ref: z.string(),
        url: z.string(),
        title: z.string(),
        filled: z.strictObject({
            username: z.boolean(),
            password: z.boolean(),
            totp: z.boolean(),
            submitted: z.boolean(),
        }),
    })
    .meta({ id: 'WebsiteCredentialFillResponse' });

export const WebsiteCredentialFillRequestSchema = z
    .strictObject({
        username_target_id: z.string().optional(),
        password_target_id: z.string().optional(),
        totp_target_id: z.string().optional(),
        submit_target_id: z.string().optional(),
        browser_workflow_id: z.string().meta({
            description:
                'Browser-use parent workflow id. The API resolves the Daytona sandbox and observes the current page server-side before decrypting the credential.',
        }),
    })
    .meta({ id: 'WebsiteCredentialFillRequest' });

export const ok_booleanSchema = z
    .strictObject({
        ok: z.boolean(),
    })
    .meta({ id: 'ok_boolean' });

export const WebsiteCredentialMetadataSchema = z
    .strictObject({
        name: z.string(),
        websites: z.array(WebsiteCredentialWebsiteSchema),
        username: z.string().optional(),
        username_hint: z.string().optional(),
        username_secret: z.boolean().optional(),
        properties: z.looseObject({}).optional(),
        tags: z.array(z.string()).optional(),
        enabled: z.boolean().optional(),
        capabilities: z.array(WebsiteCredentialCapabilitySchema).optional(),
        notes: z.string().optional(),
        totp: WebsiteCredentialTotpMetadataSchema.optional(),
        expires_at: z
            .string()
            .meta({
                description:
                    'Optional ISO timestamp after which the credential is no longer usable. Expired credentials are hidden from lookup and cannot be filled.',
            })
            .optional(),
    })
    .meta({ id: 'WebsiteCredentialMetadata' });

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

export const Partial_WebsiteCredentialMetadataSchema = z
    .strictObject({
        name: z.string().optional(),
        websites: z.array(WebsiteCredentialWebsiteSchema).optional(),
        username: z.string().optional(),
        username_hint: z.string().optional(),
        username_secret: z.boolean().optional(),
        properties: z.looseObject({}).optional(),
        tags: z.array(z.string()).optional(),
        enabled: z.boolean().optional(),
        capabilities: z.array(WebsiteCredentialCapabilitySchema).optional(),
        notes: z.string().optional(),
        totp: WebsiteCredentialTotpMetadataSchema.optional(),
        expires_at: z
            .string()
            .meta({
                description:
                    'Optional ISO timestamp after which the credential is no longer usable. Expired credentials are hidden from lookup and cannot be filled.',
            })
            .optional(),
    })
    .meta({ id: 'Partial_WebsiteCredentialMetadata' });

export const AskUserWebhookConfigurationInputSchema = z
    .strictObject({
        integration: SupportedIntegrations_ask_user_webhookSchema,
        enabled: z.boolean(),
        webhook_url: z.string().meta({ description: 'Webhook URL to receive ask_user events' }),
        webhook_secret: z
            .string()
            .meta({ description: 'Secret for signing webhook payloads (HMAC-SHA256)' })
            .optional(),
        events: z
            .array(z.enum(['requested', 'resolved']))
            .meta({ description: "Which events to send: ['requested', 'resolved'] or subset (default: both)" })
            .optional(),
        custom_headers: StringValueMapSchema.meta({
            description: 'Custom headers to include in webhook requests',
        }).optional(),
    })
    .meta({
        id: 'AskUserWebhookConfigurationInput',
        description:
            'Configuration for ask_user webhook notifications. Sends webhooks when agents call ask_user and when users respond.',
    });

export const ResendConfigurationInputSchema = z
    .strictObject({
        integration: SupportedIntegrations_resendSchema,
        enabled: z.boolean(),
        api_key: z.string().meta({ description: 'Resend API key for sending emails' }).optional(),
        email_domain: z
            .string()
            .meta({ description: 'Domain for email (both sending and receiving). Must be verified in Resend.' }),
        default_from_name: z
            .string()
            .meta({ description: 'Default display name for outgoing emails (e.g., "Vertesia - Project Name")' })
            .optional(),
        webhook_secret: z
            .string()
            .meta({
                description: 'Webhook secret for validating inbound email webhooks (required for receiving emails)',
            })
            .optional(),
        allowed_sender_domains: z
            .array(z.string())
            .meta({ description: 'Domains allowed to send emails TO start agents (for inbound validation)' })
            .optional(),
        require_project_access: z
            .boolean()
            .meta({ description: 'Require sender to have project access to start agents via email (default: true)' })
            .optional(),
        require_email_auth: z
            .boolean()
            .meta({ description: 'Require DKIM/SPF authentication to pass for inbound emails (default: true)' })
            .optional(),
    })
    .meta({ id: 'ResendConfigurationInput' });

export const LinkupConfigurationInputSchema = z
    .strictObject({
        integration: SupportedIntegrations_linkupSchema,
        enabled: z.boolean(),
        api_key: z.string().optional(),
    })
    .meta({ id: 'LinkupConfigurationInput' });

export const ExaConfigurationInputSchema = z
    .strictObject({
        integration: SupportedIntegrations_exaSchema,
        enabled: z.boolean(),
        api_key: z.string().optional(),
    })
    .meta({ id: 'ExaConfigurationInput' });

export const SerperConfigurationInputSchema = z
    .strictObject({
        integration: SupportedIntegrations_serperSchema,
        enabled: z.boolean(),
        api_key: z.string().optional(),
        url: z.string().optional(),
    })
    .meta({ id: 'SerperConfigurationInput' });

export const MagicPdfConfigurationSchema = z
    .strictObject({
        integration: SupportedIntegrations_magic_pdfSchema,
        enabled: z.boolean(),
        default_features: z.array(z.string()).optional(),
        default_zones: z.array(z.string()).optional(),
    })
    .meta({ id: 'MagicPdfConfiguration' });

export const AwsConfigurationSchema = z
    .strictObject({
        integration: SupportedIntegrations_awsSchema,
        enabled: z.boolean(),
        s3_role_arn: z.string(),
    })
    .meta({ id: 'AwsConfiguration' });

export const GithubConfigurationInputSchema = z
    .strictObject({
        integration: SupportedIntegrations_githubSchema,
        enabled: z.boolean(),
        github_app_id: z
            .string()
            .meta({ description: 'Numeric GitHub App id used to mint installation tokens (non-secret).' })
            .optional(),
        allowed_repositories: z
            .array(z.string())
            .meta({
                description:
                    'Allow-list of `owner/name` repos the bot may mint installation tokens for (default-deny when empty).',
            })
            .optional(),
        private_key: z
            .string()
            .meta({ description: 'GitHub App private key (PEM). Write-only; never returned. Empty string clears it.' })
            .optional(),
    })
    .meta({ id: 'GithubConfigurationInput' });

export const GladiaConfigurationInputSchema = z
    .strictObject({
        integration: SupportedIntegrations_gladiaSchema,
        enabled: z.boolean(),
        api_key: z.string().optional(),
        url: z.string().optional(),
    })
    .meta({ id: 'GladiaConfigurationInput' });

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

export const SecretRecordSchema = z
    .strictObject({
        id: z.string(),
        secret_ref: z.string(),
        kind: SecretKindSchema,
        project: z.string(),
        name: z.string(),
        enabled: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
        properties: z.looseObject({}).optional(),
        created_at: z.string().optional(),
        updated_at: z.string().optional(),
        details: WebsiteCredentialRecordSchema.optional(),
    })
    .meta({ id: 'SecretRecord' });

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

export const ProjectIntegrationConfigResponseSchema = z
    .discriminatedUnion('integration', [
        GladiaConfigurationSchema,
        GithubConfigurationSchema,
        AwsConfigurationSchema,
        MagicPdfConfigurationSchema,
        SerperConfigurationSchema,
        ExaConfigurationSchema,
        LinkupConfigurationSchema,
        ResendConfigurationSchema,
        AskUserWebhookConfigurationSchema,
    ])
    .meta({
        id: 'ProjectIntegrationConfigResponse',
        type: 'object',
        required: ['integration'],
        discriminator: {
            propertyName: 'integration',
            mapping: {
                ask_user_webhook: '#/components/schemas/AskUserWebhookConfiguration',
                aws: '#/components/schemas/AwsConfiguration',
                exa: '#/components/schemas/ExaConfiguration',
                github: '#/components/schemas/GithubConfiguration',
                gladia: '#/components/schemas/GladiaConfiguration',
                linkup: '#/components/schemas/LinkupConfiguration',
                magic_pdf: '#/components/schemas/MagicPdfConfiguration',
                resend: '#/components/schemas/ResendConfiguration',
                serper: '#/components/schemas/SerperConfiguration',
            },
        },
    });

export const AppWidgetInfoMapSchema = z.object({}).catchall(AppWidgetInfoSchema).meta({ id: 'AppWidgetInfoMap' });

export const CreateSecretRequestSchema = z
    .strictObject({
        kind: SecretKindSchema,
        metadata: WebsiteCredentialMetadataSchema,
        secret: WebsiteCredentialSecretInputSchema.optional(),
    })
    .meta({ id: 'CreateSecretRequest' });

export const UpdateSecretRequestSchema = z
    .strictObject({
        kind: SecretKindSchema.optional(),
        metadata: Partial_WebsiteCredentialMetadataSchema.optional(),
        secret: WebsiteCredentialSecretInputSchema.optional(),
        clear_username_secret: z.boolean().optional(),
        clear_password: z.boolean().optional(),
        clear_totp: z.boolean().optional(),
        clear_oauth: z.boolean().optional(),
    })
    .meta({ id: 'UpdateSecretRequest' });

export const ProjectIntegrationConfigRequestSchema = z
    .discriminatedUnion('integration', [
        GladiaConfigurationInputSchema,
        GithubConfigurationInputSchema,
        AwsConfigurationSchema,
        MagicPdfConfigurationSchema,
        SerperConfigurationInputSchema,
        ExaConfigurationInputSchema,
        LinkupConfigurationInputSchema,
        ResendConfigurationInputSchema,
        AskUserWebhookConfigurationInputSchema,
    ])
    .meta({
        id: 'ProjectIntegrationConfigRequest',
        type: 'object',
        required: ['integration'],
        discriminator: {
            propertyName: 'integration',
            mapping: {
                ask_user_webhook: '#/components/schemas/AskUserWebhookConfigurationInput',
                aws: '#/components/schemas/AwsConfiguration',
                exa: '#/components/schemas/ExaConfigurationInput',
                github: '#/components/schemas/GithubConfigurationInput',
                gladia: '#/components/schemas/GladiaConfigurationInput',
                linkup: '#/components/schemas/LinkupConfigurationInput',
                magic_pdf: '#/components/schemas/MagicPdfConfiguration',
                resend: '#/components/schemas/ResendConfigurationInput',
                serper: '#/components/schemas/SerperConfigurationInput',
            },
        },
    });

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

export const ListSecretsResponseSchema = z
    .strictObject({
        secrets: z.array(SecretRecordSchema),
    })
    .meta({ id: 'ListSecretsResponse' });

export const AppInstallationWithManifestArraySchema = z
    .array(AppInstallationWithManifestSchema)
    .meta({ id: 'AppInstallationWithManifestArray' });

export const AppInstallationListEntryArraySchema = z
    .array(AppInstallationListEntrySchema)
    .meta({ id: 'AppInstallationListEntryArray' });

export const CompositeAppConfigSchema = z
    .strictObject({
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
    })
    .meta({ id: 'AppPackage' });

export const Partial_Omit_CompositeAppConfig_id_projectSchema = z
    .strictObject({
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
    .meta({ id: 'Partial_Omit_CompositeAppConfig_id_project' });

export const CompositeAppConfigPayloadSchema = Partial_Omit_CompositeAppConfig_id_projectSchema.meta({
    id: 'CompositeAppConfigPayload',
});
