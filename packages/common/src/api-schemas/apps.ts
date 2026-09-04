import { JSONObjectSchema } from '@llumiverse/common/schemas';
import { z } from 'zod';
import type { AppUINavItem } from '../apps.js';
// From the values modules, for the reason `./apikey.js` gives: the enum's members are already
// declared once as a runtime list, and a second spelling here would be the drift this removes.
import { APP_CAPABILITIES, PREFERRED_SECTIONS } from '../apps.js';

/**
 * Runtime API schemas for app manifests and their nested definitions.
 */

export const AppCapabilitiesSchema = z.enum(APP_CAPABILITIES).meta({ id: 'AppCapabilities' });

export const AppAvailableInSchema = z.enum(['app_portal', 'composite_app']).meta({ id: 'AppAvailableIn' });

export const AppAccessControlSchema = z.enum(['all', 'ui', 'none']).meta({
    id: 'AppAccessControl',
    description:
        'Access control policy for an app installation. Declares which access surfaces are gated by ' +
        "per-user ACEs.\n\n- 'all' (default): every surface (UI portal, tool/endpoint use, contributions) " +
        "requires   an explicit app_member ACE — the historical behavior.\n- 'ui': UI portal visibility " +
        'requires an ACE, but tool/endpoint use and contributions   are open to anyone in the project.\n' +
        "- 'none': fully open within the project — no ACE required for any surface.\n\nDeclared on the " +
        "manifest as the app's default. May be overridden per-installation.",
});

// Recursive: a navigation item nests items of its own shape. The getter is Zod's form for a
// self-reference and emits `{"$ref": "#"}`, which the adapter rewrites to this component's own name —
// the same path `JSONSchema` takes. It is annotated rather than inferred for the same reason too:
// `z.infer` bottoms out at depth here, so `AppUINavItem` stays a hand-written type in `../apps.ts`
// and this annotation is what checks the two against each other on every build.
export const AppUINavItemSchema: z.ZodType<AppUINavItem> = z
    .strictObject({
        label: z.string().meta({ description: 'Display label' }),
        icon: z.string().meta({ description: 'Lucide icon name or SVG content string' }),
        route: z.string().meta({ description: 'Route path relative to app base' }),
        description: z
            .string()
            .optional()
            .meta({ description: 'Optional description shown on dashboard cards and other summary views' }),
        get children() {
            return z
                .array(AppUINavItemSchema)
                .optional()
                .meta({ description: "Nested sub-items displayed within this item's collapsible section" });
        },
        topLevel: z.boolean().optional().meta({
            description:
                'When true, this item appears as an independent entry in the sidebar (outside its parent app group)',
        }),
        preferredSection: z
            .enum(PREFERRED_SECTIONS)
            .optional()
            .meta({
                description:
                    'Which sidebar section this item should be placed in when first added.\n- "default" or ' +
                    'unset: normal behavior (child of its app group)\n- "footer": placed in the footer ' +
                    'section\n- "settings": placed in the settings section',
            }),
    })
    .meta({
        id: 'AppUINavItem',
        description:
            "Additional navigation item for an app's UI configuration. Used in AppUIConfig.navigation to " +
            'define sidebar navigation entries in CompositeApp shell contexts. Icon values are Lucide icon ' +
            'component names or SVG content strings.',
    });

export const AppUIConfigSchema = z
    .strictObject({
        src: z.string().meta({
            description:
                'The source URL of the app. The src can be a template which contain a variable named ' +
                '`buildId` which will be replaced with the current build id. For example: ' +
                '`/plugins/vertesia-review-center-${buildId}`',
        }),
        isolation: z
            .enum(['shadow', 'css', 'iframe'])
            .optional()
            .meta({
                description:
                    'The isolation strategy. If not specified it defaults to shadow.\n- shadow - use Shadow ' +
                    "DOM to fully isolate the plugin from the host.\n- css - inject the plugin's styles " +
                    '(minus the preflight) into the host document; lighter but styles may conflict with ' +
                    'the host.\n- iframe - load a standalone application in a sandboxed iframe so it owns its ' +
                    'JavaScript and dependency graph.',
            }),
        css_rebuild: z
            .boolean()
            .optional()
            .meta({
                description:
                    "When true the host modifies the app's css at load time to attempt to fix broken or missing " +
                    'styles. Only takes effect in css isolation mode. Defaults to false.',
            }),
        navigation: z
            .array(AppUINavItemSchema)
            .optional()
            .meta({
                description:
                    "Navigation items for the app's sidebar UI. Only applicable for apps with UI capability " +
                    'in shell contexts (ie. CompositeApp shell).',
            }),
        available_in: z
            .array(AppAvailableInSchema)
            .optional()
            .meta({
                description:
                    "Where this app's UI can be displayed.\n- 'app_portal': Available in the main app portal " +
                    "(standalone)\n- 'composite_app': Available within a CompositeApp shell Defaults to " +
                    "['app_portal', 'composite_app'] for new apps.",
            }),
    })
    .meta({ id: 'AppUIConfig' });

export const ToolCollectionAuthTypeSchema = z.enum(['oauth', 'api_key', 'other']).meta({
    id: 'ToolCollectionAuthType',
    description:
        "Authentication type for tool collections.\n- 'oauth': the runtime resolves a per-user or per-project " +
        "OAuth access token\n- 'api_key': a static key held in the project's secret store is sent as the RFC 6750 " +
        'bearer token (`Authorization: Bearer <key>`)',
});

export const MCPOAuthConfigSchema = z
    .strictObject({
        name: z
            .string()
            .optional()
            .meta({
                description:
                    'Name for the OAuth provider to create at install time. Defaults to the collection id ' +
                    'converted to kebab-case if not specified.',
            }),
        display_name: z
            .string()
            .optional()
            .meta({ description: 'Human-readable display name for the created OAuth provider.' }),
        grant_type: z.enum(['authorization_code', 'client_credentials']).optional(),
        authorization_endpoint: z.string().optional(),
        token_endpoint: z.string().optional(),
        revocation_endpoint: z.string().optional(),
        client_id: z
            .string()
            .optional()
            .meta({
                description:
                    "Pre-configured client_id. Omit if the installer must supply it (include 'client_id' in " +
                    'required_at_install).',
            }),
        use_pkce: z.boolean().optional(),
        default_scopes: z.array(z.string()).optional(),
        required_at_install: z
            .array(z.enum(['client_id', 'client_secret', 'scopes']))
            .optional()
            .meta({
                description:
                    'Parameters the installer must provide at install time. These are shown as form fields ' +
                    "in composable-ui before the install completes.\n- 'client_id': user supplies the OAuth " +
                    "client ID\n- 'client_secret': user supplies the OAuth client secret",
            }),
    })
    .meta({
        id: 'MCPOAuthConfig',
        description:
            'Install-time OAuth provisioning blueprint for an MCP collection. Defines how to auto-create an ' +
            'OAuth provider when the app is installed. Does NOT affect runtime behaviour — the runtime uses ' +
            'oauth_bindings on AppInstallation.',
    });

export const MCPApiKeyConfigSchema = z
    .strictObject({
        required_at_install: z
            .boolean()
            .optional()
            .meta({
                description:
                    'When true, the installer must supply the key in the install dialog. Use this for a manifest ' +
                    'published to projects that each hold their own key. Leave unset when the key was already ' +
                    'stored by whoever registered the server.',
            }),
        instructions: z
            .string()
            .optional()
            .meta({
                description:
                    'Shown in the install dialog above the key field — typically where to generate the key on the ' +
                    'remote service.',
            }),
    })
    .meta({
        id: 'MCPApiKeyConfig',
        description:
            "Install-time provisioning blueprint for an `auth: 'api_key'` MCP collection. Declares whether the " +
            'installer is prompted for the key. Never holds the key itself — manifests are shareable documents.',
    });

/**
 * The two collection kinds share a base interface, so their published components both begin with
 * `url` and `auth`. Spreading one shape is what keeps that true of the emission as well.
 */
const toolCollectionBaseShape = {
    url: z.string().meta({ description: 'The URL endpoint for the tool collection' }),
    auth: ToolCollectionAuthTypeSchema.optional().meta({
        description: 'Optional authentication type required for this tool collection',
    }),
};

export const MCPToolCollectionObjectSchema = z
    .strictObject({
        ...toolCollectionBaseShape,
        type: z.literal('mcp'),
        id: z.string().meta({
            description:
                'Stable identifier for this collection. Used to key oauth_bindings on AppInstallation — ' +
                'protects against collection renames. Required for new manifests.',
        }),
        name: z.string().meta({
            description: 'Name for the tool collection. Human-readable label for the collection. Used in UI.',
        }),
        description: z.string().meta({
            description:
                'Description for the tool collection. Helps users understand what tools this collection ' + 'provides.',
        }),
        namespace: z.string().meta({
            description:
                'Prefix to use for tool names from this collection. Provides clean, readable tool names ' +
                '(e.g., "jira" instead of "https://mcp.atlassian.com/v1/mcp")',
        }),
        oauth_app: z
            .string()
            .optional()
            .meta({
                description:
                    'Reference to an OAuth provider name for this collection (legacy / manual path). When set, ' +
                    "uses the OAuth provider's config (endpoints, client_id, client_secret) instead of MCP " +
                    'dynamic client registration or random fallback. The referenced OAuth provider must exist ' +
                    'in the same project.',
            }),
        oauth_config: MCPOAuthConfigSchema.optional().meta({
            description:
                'Install-time OAuth provisioning blueprint. When present, the platform auto-creates an ' +
                'OAuth provider at install time using these values merged with any user-supplied ' +
                'required_at_install params. The created app is recorded in AppInstallation.oauth_bindings. ' +
                'Mutually exclusive with oauth_provider.',
        }),
        api_key_config: MCPApiKeyConfigSchema.optional().meta({
            description:
                "Install-time provisioning blueprint for auth: 'api_key' collections. Only meaningful alongside " +
                "auth: 'api_key'; ignored otherwise.",
        }),
        oauth_provider: z
            .string()
            .optional()
            .meta({
                description:
                    'Reference to a key in AppManifestData.oauth_providers. When set, this collection shares ' +
                    "the named provider's OAuth provider configuration. Mutually exclusive with oauth_config " +
                    'and oauth_app. Requires auth: "oauth" to be set.',
            }),
        oauth_scopes: z
            .array(z.string())
            .optional()
            .meta({
                description:
                    'Additional OAuth scopes for this collection when using a shared oauth_provider. These ' +
                    "are merged (union) with the provider's default_scopes at install time. Only valid when " +
                    'oauth_provider is set.',
            }),
    })
    .meta({
        id: 'MCPToolCollectionObject',
        description: 'MCP tool collection configuration (requires name, description, and namespace)',
    });

export const VertesiaSDKToolCollectionObjectSchema = z
    .strictObject({
        ...toolCollectionBaseShape,
        type: z.literal('vertesia_sdk'),
        namespace: z
            .string()
            .optional()
            .meta({
                description:
                    'Optional namespace to use for tool names from this collection. If not provided, the tool ' +
                    'server default will be used.',
            }),
        name: z
            .string()
            .optional()
            .meta({
                description:
                    'Optional name for the tool collection. If not provided, the tool server default will be ' +
                    'used.',
            }),
        description: z
            .string()
            .optional()
            .meta({
                description:
                    'Optional description for the tool collection. If not provided, the tool server default ' +
                    'will be used.',
            }),
    })
    .meta({
        id: 'VertesiaSDKToolCollectionObject',
        description: 'Vertesia SDK tool collection configuration',
    });

/**
 * `type` is a real wire field with unique literals in both branches, so the adapter synthesizes the
 * `discriminator` a generated Java or Go client needs to pick a concrete subtype. The published
 * union keeps its mapping; only the key order of the union node changes.
 */
export const ToolCollectionObjectSchema = z
    .discriminatedUnion('type', [MCPToolCollectionObjectSchema, VertesiaSDKToolCollectionObjectSchema])
    .meta({ id: 'ToolCollectionObject' });

export const AppGitSourceConfigSchema = z
    .strictObject({
        url: z.string().optional(),
        default_branch: z.string().optional(),
        production_branch: z.string().optional(),
        development_branch: z.string().optional(),
    })
    .meta({ id: 'AppGitSourceConfig' });

export const AppSourceConfigSchema = z
    .strictObject({
        kind: z.literal('git'),
        git: AppGitSourceConfigSchema.optional(),
    })
    .meta({ id: 'AppSourceConfig' });

/**
 * What `AppManifest.source` narrows to: the same `kind: 'git'` envelope, but with the git block
 * required and inline rather than referenced. Both components deliberately publish these distinct
 * shapes.
 */
export const AppManifestSourceSchema = z
    .strictObject({
        kind: z.literal('git'),
        git: z.strictObject({
            url: z.string(),
            default_branch: z.string().optional(),
            production_branch: z.string().optional(),
            development_branch: z.string().optional(),
        }),
    })
    .meta({ id: 'AppManifestSource' });

/**
 * `AppManifestData`, `AppManifest` and `AppManifestArray` are NOT declared here yet, and the reason
 * is worth recording where the next attempt will read it.
 *
 * `AppManifestData.settings_schema` is a `JSONSchema`. Making the manifest canonical therefore pulls
 * the registry's `JSONSchema` into the studio service, and studio's TypeScript-derived `JSONSchema`
 * publishes `type` as `JSONSchemaTypeName | JSONSchemaTypeName[]` where the canonical one publishes
 * `type: {}`. The generator refuses a name that is both derived and canonical unless the two agree.
 * The combined document already ships the canonical spelling — zeno reaches it through
 * `ContentTypeIntakePolicy` and wins the merge — so the fix is to settle `JSONSchema.type` in
 * `@llumiverse/common`, after which the manifest converts with nothing else to decide: every
 * component it references is above.
 */

// The remote MCP connection contracts.
//
// Eight components covering the OAuth handshake `RemoteMcpConnectionsResource` performs on behalf of
// a tool collection, plus the tool annotations an aggregated tool carries. They live here rather
// than in a module of their own because a remote MCP connection is an app installation's, and
// `MCPToolAnnotations` is referenced from `./tools.js`.
//
// Line comments rather than JSDoc blocks throughout: a JSDoc block immediately preceding an exported
// declaration is picked up by the OpenAPI scanner and published as that component's `description`,
// which would double up with the `description` stated in `.meta()`.

export const MCPToolAnnotationsSchema = z
    .strictObject({
        title: z.string().meta({ description: 'Human-readable display name for the tool' }).optional(),
        readOnlyHint: z.boolean().meta({ description: 'If true, the tool does not modify any state' }).optional(),
        destructiveHint: z
            .boolean()
            .meta({ description: 'If true, the tool may perform irreversible destructive operations' })
            .optional(),
        idempotentHint: z
            .boolean()
            .meta({
                description: 'If true, calling the tool multiple times with the same args has no additional effect',
            })
            .optional(),
        openWorldHint: z
            .boolean()
            .meta({ description: 'If true, the tool interacts with external entities outside the local environment' })
            .optional(),
    })
    .meta({ id: 'MCPToolAnnotations', description: 'Metadata hints from MCP tool annotations (per MCP spec).' });

export const McpOAuthTokenResponseSchema = z
    .strictObject({
        access_token: z.string(),
    })
    .meta({ id: 'McpOAuthTokenResponse' });

export const McpOAuthTokenRequestSchema = z
    .strictObject({
        app_install_id: z.string().optional(),
        collection_id: z.string().optional(),
        mcp_server_url: z.string().optional(),
    })
    .meta({ id: 'McpOAuthTokenRequest' });

export const SetMcpApiKeyRequestSchema = z
    .strictObject({
        // `.regex(/\S/)` rather than `.trim().min(1)` alone: request bodies are validated by AJV
        // against the EMITTED JSON Schema, where a Zod transform like `.trim()` leaves no trace —
        // `minLength: 1` on its own happily accepts "   ". The pattern emits and is enforced, so a
        // whitespace-only key is rejected at the boundary instead of becoming an encrypted empty
        // key that still reports `configured: true`. The trim still normalizes for Zod consumers.
        api_key: z
            .string()
            .trim()
            .min(1)
            .regex(/\S/, 'API key must not be blank')
            .meta({
                description:
                    'The static key issued by the remote MCP server. Surrounding whitespace is stripped. Stored ' +
                    'encrypted in the project secret store and sent as the RFC 6750 bearer token on every request ' +
                    'to the collection URL. Never returned by the API.',
            }),
    })
    .meta({ id: 'SetMcpApiKeyRequest' });

export const McpApiKeyStatusSchema = z
    .strictObject({
        configured: z.boolean().meta({ description: 'Whether a key is stored for this collection.' }),
        // Always present — null when unset, never absent. `.nullable()` rather than `.nullish()`
        // so the published contract says so and generated clients do not treat it as optional.
        hint: z
            .string()
            .nullable()
            .meta({ description: 'Last few characters of the stored key, for display only. Null when unset.' }),
    })
    .meta({ id: 'McpApiKeyStatus', description: 'Whether an API key is configured for an MCP tool collection' });

export const OAuthAuthStatusSchema = z
    .strictObject({
        collection_id: z.string(),
        collection_name: z.string(),
        authenticated: z.boolean(),
        mcp_server_url: z.string(),
        expires_at: z.string().optional(),
        scope: z.string().optional(),
    })
    .meta({ id: 'OAuthAuthStatus', description: 'OAuth authentication status for an MCP tool collection' });

export const OAuthMetadataResponseSchema = z
    .strictObject({
        collection_id: z.string(),
        collection_name: z.string(),
        mcp_server_url: z.string(),
        metadata: JSONObjectSchema,
    })
    .meta({ id: 'OAuthMetadataResponse', description: 'Response from OAuth metadata endpoint' });

export const McpOAuthDisconnectResponseSchema = z
    .strictObject({
        success: z.boolean(),
        message: z.string(),
    })
    .meta({ id: 'McpOAuthDisconnectResponse' });

export const McpOAuthConnectResponseSchema = z
    .strictObject({
        success: z.boolean(),
    })
    .meta({ id: 'McpOAuthConnectResponse' });

export const OAuthAuthorizeResponseSchema = z
    .strictObject({
        authorization_url: z.string().optional(),
        state: z.string().optional(),
        connected: z.boolean().optional(),
    })
    .meta({ id: 'OAuthAuthorizeResponse', description: 'Response from OAuth authorization endpoint' });

export const OAuthAuthStatusArraySchema = z.array(OAuthAuthStatusSchema).meta({ id: 'OAuthAuthStatusArray' });
