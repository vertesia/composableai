import type { z } from 'zod';
import type {
    AgentToolApprovalClassSchema,
    AgentToolDefinitionSchema,
    AppApiKeyCollectionParamsSchema,
    AppBuildProgressSchema,
    AppBuildProgressStatusSchema,
    AppBuildTriggerSchema,
    AppDeleteSummarySchema,
    AppDevelopmentTaskDetailsSchema,
    AppDevelopmentTaskListSchema,
    AppDevelopmentTaskSchema,
    AppInspectionCapabilityReportSchema,
    AppInspectionIssueSchema,
    AppInspectionResultSchema,
    AppInstallationKindSchema,
    AppInstallationOAuthBindingSchema,
    AppInstallationPayloadSchema,
    AppInstallationProjectsQuerySchema,
    AppInstallationProviderBindingSchema,
    AppInstallationsQuerySchema,
    AppListScopeSchema,
    AppOAuthCollectionParamsSchema,
    AppOAuthProviderParamsSchema,
    AppRepoBranchSchema,
    AppRepoCommitSchema,
    AppRepoCommitsSchema,
    AppRepoDocumentCommitSchema,
    AppRepoRefSchema,
    AppRepoRefsSchema,
    AppRepoTreeEntrySchema,
    AppRepoTreeSchema,
    AppScaffoldModuleSchema,
    AppScaffoldProgressSchema,
    AppScaffoldProgressStatusSchema,
    AppsQuerySchema,
    AppToolCollectionSchema,
    AppVersionGitRefTypeSchema,
    AppVersionGitSourceSchema,
    AppVersionKindSchema,
    AppVersionRecordSchema,
    AppVersionStateSchema,
    AppVersionStorageSchema,
    AppVersionTargetSchema,
    AppVersionUrlsSchema,
    DeleteAppVersionResponseSchema,
    McpApiKeyCredentialSchema,
    OAuthClientCredentialsSchema,
    StartAppBuildRequestSchema,
    StartAppBuildResponseSchema,
    StartAppDevelopmentTaskRequestSchema,
    StartAppScaffoldRequestSchema,
    StartAppScaffoldResponseSchema,
    UpdateAppInstallationToolAllowlistPayloadSchema,
    UpsertAppVersionRequestSchema,
    ValidateUrlRequestSchema,
    ValidateUrlResponseSchema,
} from './api-schemas/app-lifecycle.js';
import type {
    AppEventHookDeliverySchema,
    AppEventHookPayloadSchema,
    AppEventSubscriptionDefinitionSchema,
    AppInstallationListEntrySchema,
    AppInstallationSchema,
    AppInstallationWithManifestSchema,
    AppManifestDataSchema,
    AppManifestSchema,
    AppPackageEventHookSchema,
    AppPackageHooksSchema,
    AppPackageSchema,
    AppWidgetInfoSchema,
    CompositeAppCardOverridesSchema,
    CompositeAppConfigPayloadSchema,
    CompositeAppConfigSchema,
    CompositeAppEntrySchema,
    CompositeAppHeaderItemKindSchema,
    CompositeAppHeaderItemSchema,
    CompositeAppHeaderItemTargetSchema,
    CompositeAppHeaderOverridesSchema,
    CompositeAppHomePluginSchema,
    CompositeAppLogoOverridesSchema,
    CompositeAppMenuSectionSchema,
    CompositeAppMessageOverridesSchema,
    CompositeAppMessageStyleSchema,
    CompositeAppNavItemPermissionsSchema,
    CompositeAppSidebarOverridesSchema,
    CompositeAppSwitchersOverridesSchema,
    CompositeAppThemeOverridesSchema,
    CompositeAppUserMenuOverridesSchema,
    PromoteAppVersionResponseSchema,
    UpdateAppPayloadSchema,
} from './api-schemas/app-runtime.js';
import type {
    AppAccessControlSchema,
    AppAvailableInSchema,
    AppCapabilitiesSchema,
    AppGitSourceConfigSchema,
    AppManifestSourceSchema,
    AppSourceConfigSchema,
    AppUIConfigSchema,
    MCPApiKeyConfigSchema,
    MCPOAuthConfigSchema,
    MCPToolAnnotationsSchema,
    MCPToolCollectionObjectSchema,
    McpApiKeyStatusSchema,
    McpOAuthConnectResponseSchema,
    McpOAuthDisconnectResponseSchema,
    McpOAuthTokenRequestSchema,
    McpOAuthTokenResponseSchema,
    OAuthAuthorizeResponseSchema,
    OAuthAuthStatusSchema,
    OAuthMetadataResponseSchema,
    SetMcpApiKeyRequestSchema,
    ToolCollectionAuthTypeSchema,
    ToolCollectionObjectSchema,
    VertesiaSDKToolCollectionObjectSchema,
} from './api-schemas/apps.js';
import type { RemoteActivityDefinitionSchema } from './api-schemas/integrations.js';
import type {
    ProjectToolInfoSchema,
    RenderingTemplateDefinitionRefSchema,
    RenderingTemplateDefinitionSchema,
} from './api-schemas/project.js';

/** Allowed values for AppUINavItem.preferredSection */
export const PREFERRED_SECTIONS = ['default', 'footer', 'settings'] as const;

// The app-manifest closure is declared once, as the Zod schemas in `./api-schemas/apps.ts`, and
// inferred below. The documentation moved with it: what a published component says about a field now
// comes from the schema's own `.meta({ description })` rather than from a TSDoc comment a generator
// had to interpret.
//
// This one type is the exception, and for the same reason `JSONSchema` is: it RECURSES. Zod 4 infers
// a recursive type from a getter, but the inference bottoms out at depth — `children` degrades to
// `Record<string, unknown>[]`, and the composite-app menu code that walks nested items stops
// compiling. So the named type stays hand-written and `z.ZodType<AppUINavItem>` on the schema is what
// keeps the two checked against each other. The runtime schema remains the OpenAPI and AJV authority.
/**
 * Additional navigation item for an app's UI configuration.
 * Used in AppUIConfig.navigation to define sidebar navigation entries in CompositeApp shell contexts.
 * Icon values are Lucide icon component names or SVG content strings.
 */
export interface AppUINavItem {
    /** Display label */
    label: string;
    /** Lucide icon name or SVG content string */
    icon: string;
    /** Route path relative to app base */
    route: string;
    /** Optional description shown on dashboard cards and other summary views */
    description?: string;
    /** Nested sub-items displayed within this item's collapsible section */
    children?: AppUINavItem[];
    /** When true, this item appears as an independent entry in the sidebar (outside its parent app group) */
    topLevel?: boolean;
    /**
     * Which sidebar section this item should be placed in when first added.
     * - "default" or unset: normal behavior (child of its app group)
     * - "footer": placed in the footer section
     * - "settings": placed in the settings section
     */
    preferredSection?: (typeof PREFERRED_SECTIONS)[number];
}

export type AppUIConfig = z.infer<typeof AppUIConfigSchema>;

export type AppInstallationProjectsQuery = z.infer<typeof AppInstallationProjectsQuerySchema>;

export type AppInstallationsQuery = z.infer<typeof AppInstallationsQuerySchema>;

export type AppListScope = z.infer<typeof AppListScopeSchema>;

export type AppsQuery = z.infer<typeof AppsQuerySchema>;

export type ToolCollectionAuthType = z.infer<typeof ToolCollectionAuthTypeSchema>;

export type MCPOAuthConfig = z.infer<typeof MCPOAuthConfigSchema>;

/** Install-time provisioning blueprint for an `auth: 'api_key'` MCP collection. Never holds the key. */
export type MCPApiKeyConfig = z.infer<typeof MCPApiKeyConfigSchema>;

export type MCPToolCollectionObject = z.infer<typeof MCPToolCollectionObjectSchema>;

export type VertesiaSDKToolCollectionObject = z.infer<typeof VertesiaSDKToolCollectionObjectSchema>;

export type ToolCollectionObject = z.infer<typeof ToolCollectionObjectSchema>;

function deriveMCPCollectionId(input: string): string {
    return input
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_+/g, '_');
}

/**
 * Normalizes a tool collection to the object format.
 * Applies optional `{{var}}` substitution to the URL so manifests can reference
 * deployment-time variables like `{{studio_ui}}`.
 *
 * @param collection - ToolCollectionObject
 * @param vars - Optional endpoint variables to substitute in URLs
 * @returns Normalized ToolCollectionObject
 */
export function normalizeToolCollection(collection: ToolCollectionObject, vars?: Endpoints): ToolCollectionObject {
    if (!collection || typeof collection !== 'object') {
        throw new TypeError('Tool collection must be an object');
    }
    const substitutedUrl = vars && collection.url ? substituteEndpoints(collection.url, vars) : collection.url;
    const urlChanged = substitutedUrl !== collection.url;
    if (collection.type === 'mcp') {
        const fallbackId = deriveMCPCollectionId(collection.id || collection.name || collection.url);
        if (urlChanged || !collection.id) {
            return {
                ...collection,
                url: substitutedUrl,
                id: collection.id || fallbackId,
            };
        }
    } else if (urlChanged) {
        return { ...collection, url: substitutedUrl };
    }
    return collection;
}

/**
 * Metadata hints from MCP tool annotations (per MCP spec).
 */
export type MCPToolAnnotations = z.infer<typeof MCPToolAnnotationsSchema>;

/**
 * Approval behavior class for a tool exposed to agents.
 *
 * - `read_only`: reads or inspects state without changing Vertesia, external systems, or user-visible artifacts.
 * - `side_effecting`: can create, update, delete, send, execute, schedule, or otherwise change state.
 * - `control`: affects agent control flow or tool availability, not user data or external systems.
 * - `requires_confirmation`: high-impact action that must ask the user even in interactive full-control mode.
 */
export type AgentToolApprovalClass = z.infer<typeof AgentToolApprovalClassSchema>;

/**
 * Tool definition with optional activation control for agent exposure.
 */
export type AgentToolDefinition = z.infer<typeof AgentToolDefinitionSchema>;

/**
 * Definition of a remote activity exposed by a tool server for use in DSL workflows.
 * Remote activities are identified in workflow steps using colon-separated names:
 * `app:<app_name>:<collection>:<activity_name>` (e.g. `app:my-nlp-app:examples:word_count`).
 */
export type RemoteActivityDefinition = z.infer<typeof RemoteActivityDefinitionSchema>;

/**
 * Canonical app capabilities Studio renders/supports. The public type is derived from
 * this list so runtime validation and TypeScript cannot drift.
 */
export const APP_CAPABILITIES = [
    'ui',
    'tools',
    'interactions',
    'types',
    'processes',
    'views',
    'templates',
    'dashboards',
] as const;

export type AppCapabilities = z.infer<typeof AppCapabilitiesSchema>;

/**
 * Header carrying the app version a generated-app UI is running, so studio/zeno resolve app-owned
 * capability refs (`app:<app>:...`) against that exact version instead of the promoted version.
 * Resolution-time only; never persisted. Set by the generated app template via client.withAppVersion.
 */
export const APP_VERSION_HEADER = 'x-vertesia-app-version';
export type AppAvailableIn = z.infer<typeof AppAvailableInSchema>;

export type AppVersionKind = z.infer<typeof AppVersionKindSchema>;
export type AppVersionState = z.infer<typeof AppVersionStateSchema>;
export type AppVersionTarget = z.infer<typeof AppVersionTargetSchema>;
export type AppVersionGitRefType = z.infer<typeof AppVersionGitRefTypeSchema>;
export type AppBuildTrigger = z.infer<typeof AppBuildTriggerSchema>;

export type AppVersionStorage = z.infer<typeof AppVersionStorageSchema>;

export type AppVersionGitSource = z.infer<typeof AppVersionGitSourceSchema>;

export type AppVersionUrls = z.infer<typeof AppVersionUrlsSchema>;

export type AppVersionRecord = z.infer<typeof AppVersionRecordSchema>;

export type DeleteAppVersionResponse = z.infer<typeof DeleteAppVersionResponseSchema>;

export type UpsertAppVersionRequest = z.infer<typeof UpsertAppVersionRequestSchema>;

export interface AppVersionListQuery {
    app_id?: string;
    kind?: AppVersionKind;
    include_expired?: boolean;
    limit?: number;
}

export type PromoteAppVersionResponse = z.infer<typeof PromoteAppVersionResponseSchema>;

export type StartAppBuildRequest = z.infer<typeof StartAppBuildRequestSchema>;

export type StartAppBuildResponse = z.infer<typeof StartAppBuildResponseSchema>;

export type AppBuildProgressStatus = z.infer<typeof AppBuildProgressStatusSchema>;

export type AppBuildProgress = z.infer<typeof AppBuildProgressSchema>;

export type AppScaffoldModule = z.infer<typeof AppScaffoldModuleSchema>;

export type StartAppScaffoldRequest = z.infer<typeof StartAppScaffoldRequestSchema>;

export type StartAppScaffoldResponse = z.infer<typeof StartAppScaffoldResponseSchema>;

export type StartAppDevelopmentTaskRequest = z.infer<typeof StartAppDevelopmentTaskRequestSchema>;

export type AppScaffoldProgressStatus = z.infer<typeof AppScaffoldProgressStatusSchema>;

export type AppScaffoldProgress = z.infer<typeof AppScaffoldProgressSchema>;

/**
 * Access control policy for an app installation.
 * Declares which access surfaces are gated by per-user ACEs.
 *
 * - 'all' (default): every surface (UI portal, tool/endpoint use, contributions) requires
 *   an explicit app_member ACE — the historical behavior.
 * - 'ui': UI portal visibility requires an ACE, but tool/endpoint use and contributions
 *   are open to anyone in the project.
 * - 'none': fully open within the project — no ACE required for any surface.
 *
 * Declared on the manifest as the app's default. May be overridden per-installation.
 */
export type AppAccessControl = z.infer<typeof AppAccessControlSchema>;

// QUARANTINED from the tenth batch, and the blocker is not in this file. A `//` comment rather than
// TSDoc on purpose: this component is still DERIVED, so a doc comment here would be published as its
// OpenAPI description.
//
// `settings_schema` is a `JSONSchema`, so making this component canonical pulls the registry's
// `JSONSchema` into the studio service — where the TypeScript-derived one publishes `type` as
// `JSONSchemaTypeName | JSONSchemaTypeName[]` while the canonical publishes `type: {}`. The
// generator refuses to publish a name that is both derived and canonical unless the two agree, and
// it is right to. The combined document already ships the canonical spelling (zeno reaches it
// through `ContentTypeIntakePolicy` and wins the merge), so what is left is a disagreement to settle
// in `@llumiverse/common`, not one to work around here.
//
// Everything this interface REFERENCES converted: the fields below now carry canonical components.
export type AppManifestData = z.infer<typeof AppManifestDataSchema>;
export type UpdateAppPayload = z.infer<typeof UpdateAppPayloadSchema>;

export type AppGitSourceConfig = z.infer<typeof AppGitSourceConfigSchema>;

export type AppSourceConfig = z.infer<typeof AppSourceConfigSchema>;

/**
 * Deployment-time URL endpoints that can be referenced in app manifest URLs
 * via `{{key}}` placeholders. The caller (typically studio-server) supplies
 * these from environment config so that system apps can ship a single manifest
 * with endpoints like `{{studio}}/api/package` that resolve per deployment.
 */
export interface Endpoints {
    /** The Studio API (studio-server) base URL */
    studio?: string;
    /** The Store API (zeno-server) base URL */
    store?: string;
    /** The token server base URL */
    token?: string;
    /** The browser-facing Studio UI (composable-ui) base URL */
    ui?: string;
    /** The Smart HTTP app source git server base URL */
    git?: string;
    /** The appgen app-gateway base URL (serves promoted app bundles + their `/api` runtime). */
    gateway?: string;
}

/**
 * Substitutes `{{key}}` placeholders in a URL with the matching endpoint.
 * Unknown placeholders are left untouched (so failures surface as fetch errors
 * with the unresolved placeholder visible, rather than silently pointing nowhere).
 * Trailing slashes on replacement values are stripped to avoid `//api/...` joins.
 */
function substituteEndpoints(url: string, endpoints?: Endpoints): string {
    if (!url || !endpoints) return url;
    return url.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
        const value = (endpoints as Record<string, string | undefined>)[key];
        if (typeof value !== 'string' || !value) return match;
        return trimTrailingSlashes(value);
    });
}

function trimTrailingSlashes(value: string): string {
    let end = value.length;
    while (end > 0 && value[end - 1] === '/') {
        end--;
    }
    return end === value.length ? value : value.slice(0, end);
}

/** One entry in an app git-repo directory listing (see {@link AppRepoTree}). */
export type AppRepoTreeEntry = z.infer<typeof AppRepoTreeEntrySchema>;

/** A non-recursive listing of an app git repo directory at a given ref. */
export type AppRepoTree = z.infer<typeof AppRepoTreeSchema>;

/** Result of committing one or more uploaded documents to an app repository. */
export type AppRepoDocumentCommit = z.infer<typeof AppRepoDocumentCommitSchema>;

/** One commit that inserted or changed a file in an app git repository. */
export type AppRepoCommit = z.infer<typeof AppRepoCommitSchema>;

/** Commit history in an app git repository, optionally filtered to a file. */
export type AppRepoCommits = z.infer<typeof AppRepoCommitsSchema>;

/** A branch or tag in an app git repo, resolved to its latest commit. */
export type AppRepoRef = z.infer<typeof AppRepoRefSchema>;

/** The branches and tags of an app git repo (see {@link AppRepoRef}). */
export type AppRepoRefs = z.infer<typeof AppRepoRefsSchema>;

/** A mutable app development task represented by an `agent/*` Git branch. */
export type AppDevelopmentTask = z.infer<typeof AppDevelopmentTaskSchema>;

/** Git-backed development tasks and the branch used for new tasks by default. */
export type AppDevelopmentTaskList = z.infer<typeof AppDevelopmentTaskListSchema>;

/** Development task details, including the latest parent assistant run when one exists. */
export type AppDevelopmentTaskDetails = z.infer<typeof AppDevelopmentTaskDetailsSchema>;

/** Request to create a branch from an existing branch, tag, or commit. */
export interface CreateAppRepoBranchRequest {
    name: string;
    source_ref: string;
}

/** A newly created app repository branch. */
export type AppRepoBranch = z.infer<typeof AppRepoBranchSchema>;

/**
 * Canonical package scopes, including the catch-all `all`. The public type is derived
 * from this list so request parsing and TypeScript cannot drift.
 */
export const APP_PACKAGE_SCOPES = [
    'ui',
    'tools',
    'interactions',
    'types',
    'processes',
    'views',
    'templates',
    'dashboards',
    'settings',
    'widgets',
    'activities',
    'hooks',
    'subscriptions',
    'all',
] as const;

export type AppPackageScope = (typeof APP_PACKAGE_SCOPES)[number];
export type AppPackageEventHook = z.infer<typeof AppPackageEventHookSchema>;
export type AppPackageHooks = z.infer<typeof AppPackageHooksSchema>;
export type AppEventHookDelivery = z.infer<typeof AppEventHookDeliverySchema>;
export type AppEventHookPayload = z.infer<typeof AppEventHookPayloadSchema>;
export type AppEventSubscriptionDefinition = z.infer<typeof AppEventSubscriptionDefinitionSchema>;
export type AppPackage = z.infer<typeof AppPackageSchema>;

/**
 * A single diagnostic produced while inspecting an app's registration state.
 */
export type AppInspectionIssue = z.infer<typeof AppInspectionIssueSchema>;

/**
 * Per-capability report of what an app's promoted package actually exposes,
 * compared against what its manifest declares.
 */
export type AppInspectionCapabilityReport = z.infer<typeof AppInspectionCapabilityReportSchema>;

/**
 * Result of inspecting an app's registration: the resolved manifest state, what
 * the promoted package actually exposes per capability, and diagnostics. This
 * is the ground truth used by the `app_inspect_registration` agent tool and the
 * Build › App inspection UI to verify what is registered vs declared, instead of
 * inferring it from failed object/import calls.
 */
export type AppInspectionResult = z.infer<typeof AppInspectionResultSchema>;

export type AppWidgetInfo = z.infer<typeof AppWidgetInfoSchema>;

export type RenderingTemplateDefinition = z.infer<typeof RenderingTemplateDefinitionSchema>;

export type RenderingTemplateDefinitionRef = z.infer<typeof RenderingTemplateDefinitionRefSchema>;

export type AppManifest = z.infer<typeof AppManifestSchema>;

export type AppManifestSource = z.infer<typeof AppManifestSourceSchema>;

/**
 * Binding between an MCP collection and an OAuth provider created at install time.
 * Stored on AppInstallation so the runtime can look up the correct OAuth provider by ID,
 * independent of manifest oauth_provider references (which may change).
 */
export type AppInstallationOAuthBinding = z.infer<typeof AppInstallationOAuthBindingSchema>;

/**
 * Binding between a named OAuth provider and the OAuth provider created for it at install time.
 * Stored on AppInstallation so the runtime can resolve the correct OAuth provider for collections
 * that reference a shared provider via MCPToolCollectionObject.oauth_provider.
 */
export type AppInstallationProviderBinding = z.infer<typeof AppInstallationProviderBindingSchema>;

export type AppInstallation = z.infer<typeof AppInstallationSchema>;

export type AppInstallationWithManifest = z.infer<typeof AppInstallationWithManifestSchema>;

/** An installation whose app manifest could not be resolved (the app was deleted or is unpublished). */
export interface OrphanedAppInstallation extends Omit<AppInstallation, 'manifest'> {
    manifest: null;
}

export type AppInstallationListEntry = z.infer<typeof AppInstallationListEntrySchema>;

export type OAuthClientCredentials = z.infer<typeof OAuthClientCredentialsSchema>;

export type AppOAuthCollectionParams = z.infer<typeof AppOAuthCollectionParamsSchema>;

/** One installer-supplied MCP API key. */
export type McpApiKeyCredential = z.infer<typeof McpApiKeyCredentialSchema>;

/** Installer-supplied MCP API keys, keyed by collection id. */
export type AppApiKeyCollectionParams = z.infer<typeof AppApiKeyCollectionParamsSchema>;
export type AppOAuthProviderParams = z.infer<typeof AppOAuthProviderParamsSchema>;

export type AppInstallationPayload = z.infer<typeof AppInstallationPayloadSchema>;

export type UpdateAppInstallationToolAllowlistPayload = z.infer<typeof UpdateAppInstallationToolAllowlistPayloadSchema>;

export type AppInstallationKind = z.infer<typeof AppInstallationKindSchema>;

/**
 * A description of the tools provided by an app
 */
export type AppToolCollection = z.infer<typeof AppToolCollectionSchema>;

/**
 * A tool and the app installation that provides it, inferred from `./api-schemas/project.js` — the
 * module that owns it, because it converted with the Projects batch rather than with Apps.
 */
export type ProjectToolInfo = z.infer<typeof ProjectToolInfoSchema>;

/**
 * OAuth authentication status for an MCP tool collection
 */
export type OAuthAuthStatus = z.infer<typeof OAuthAuthStatusSchema>;

/**
 * Response from OAuth authorization endpoint
 */
export type OAuthAuthorizeResponse = z.infer<typeof OAuthAuthorizeResponseSchema>;

/**
 * Payload for storing the static bearer token of an `auth: 'api_key'` MCP collection.
 * The key is write-only — it is never echoed back by any endpoint.
 */
export type SetMcpApiKeyRequest = z.infer<typeof SetMcpApiKeyRequestSchema>;

/** Whether an `auth: 'api_key'` MCP collection has a key stored, plus a display-only hint. */
export type McpApiKeyStatus = z.infer<typeof McpApiKeyStatusSchema>;

export type McpOAuthTokenRequest = z.infer<typeof McpOAuthTokenRequestSchema>;

export type McpOAuthTokenResponse = z.infer<typeof McpOAuthTokenResponseSchema>;

export type McpOAuthConnectResponse = z.infer<typeof McpOAuthConnectResponseSchema>;

export type McpOAuthDisconnectResponse = z.infer<typeof McpOAuthDisconnectResponseSchema>;

/**
 * Response from OAuth metadata endpoint
 */
export type OAuthMetadataResponse = z.infer<typeof OAuthMetadataResponseSchema>;

// ============================================================================
// CompositeApp Shell Configuration Types
// These types define the configuration for a CompositeApp shell that combines
// multiple apps into a unified experience with shared navigation and branding.
// ============================================================================

/**
 * Configuration entry for an individual app in the CompositeApp shell.
 * References an app installation by name.
 */
export type CompositeAppEntry = z.infer<typeof CompositeAppEntrySchema>;

/**
 * Logo overrides for the CompositeApp shell header.
 * When provided, these URLs replace the default Vertesia logo.
 */
export type CompositeAppLogoOverrides = z.infer<typeof CompositeAppLogoOverridesSchema>;

/**
 * Message banner overrides for the shell header.
 */
export type CompositeAppMessageStyle = z.infer<typeof CompositeAppMessageStyleSchema>;
export type CompositeAppMessageOverrides = z.infer<typeof CompositeAppMessageOverridesSchema>;

/**
 * Switcher visibility overrides for the CompositeApp header.
 */
export type CompositeAppSwitchersOverrides = z.infer<typeof CompositeAppSwitchersOverridesSchema>;

/**
 * Header button visibility overrides for the CompositeApp header.
 *
 * @deprecated Superseded by `CompositeAppConfig.headerMenu` (free-form header items).
 * Retained for backward compatibility and to seed the default header menu when no
 * `headerMenu` has been configured yet.
 */
export type CompositeAppHeaderOverrides = z.infer<typeof CompositeAppHeaderOverridesSchema>;

/**
 * User menu overrides for the CompositeApp.
 *
 * @deprecated Superseded by the `user_menu` item in `CompositeAppConfig.headerMenu`.
 * Retained for backward compatibility and to seed the default header menu when no
 * `headerMenu` has been configured yet.
 */
export type CompositeAppUserMenuOverrides = z.infer<typeof CompositeAppUserMenuOverridesSchema>;

/**
 * Theme overrides for the CompositeApp.
 */
export type CompositeAppThemeOverrides = z.infer<typeof CompositeAppThemeOverridesSchema>;

/**
 * Sidebar display overrides for the CompositeApp.
 */
export type CompositeAppSidebarOverrides = z.infer<typeof CompositeAppSidebarOverridesSchema>;

/**
 * Card display overrides for the CompositeApp in the App Portal.
 * Similar to AppManifest display properties, but specific to the CompositeApp card.
 * Allows customers to customize the app portal card (not otherwise possible if using a
 * shared, Vertesia-managed manifest across accounts).
 */
export type CompositeAppCardOverrides = z.infer<typeof CompositeAppCardOverridesSchema>;

// ============================================================================
// Sidebar Menu Types
// ============================================================================

/**
 * Access control settings for a composite app nav item.
 *
 * If any of `groupsAllowed`, `usersAllowed`, or `rolesAllowed` are set,
 * access is granted when the user matches ANY list (OR logic).
 * All empty/absent means visible to everyone. Admin users bypass all checks.
 */
export type CompositeAppNavItemPermissions = z.infer<typeof CompositeAppNavItemPermissionsSchema>;

/**
 * A navigable item in the sidebar menu.
 * An "app" is just a nav-item with `appName` + `route: "/"` that has children.
 * Nav-items carry their own `appName` for routing, independent of position in the tree.
 */
export interface CompositeAppMenuNavItem {
    /** Stable unique identifier */
    id: string;
    /** Display label shown in the sidebar */
    label: string;
    /** Lucide icon name or SVG content string */
    icon?: string;
    /** Which installed app this item routes to */
    appName?: string;
    /** Route path within the app (e.g. "/" or "/dashboard") */
    route?: string;
    /** When true, this item is hidden from the sidebar */
    hidden?: boolean;
    /**
     * Optional description for dashboard cards and summary views.
     * `null` = user explicitly cleared it (show no description, skip fallback).
     * `undefined` / absent = no override (fall back to manifest description).
     */
    description?: string | null;
    /** When true, this item is excluded from the Composite App dashboard cards */
    hideFromDashboard?: boolean;
    /** Optional access control settings for this nav item */
    permissions?: CompositeAppNavItemPermissions;
    /** Ordered child nav-items */
    children?: CompositeAppMenuNavItem[];
}

/**
 * A top-level section heading in the sidebar menu.
 * Sections are always at root level and contain nav-items.
 */
export type CompositeAppMenuSection = z.infer<typeof CompositeAppMenuSectionSchema>;

export type CompositeAppHomePlugin = z.infer<typeof CompositeAppHomePluginSchema>;

// ============================================================================
// Header Menu Types
// ============================================================================

/**
 * Discriminator for a header item.
 * The four built-ins (`app_portal`, `docs`, `help`, `user_menu`) seed the default
 * header and cannot be deleted (only hidden/customized); `custom` items are fully
 * user-defined buttons.
 */
export type CompositeAppHeaderItemKind = z.infer<typeof CompositeAppHeaderItemKindSchema>;

/** Where a header link opens. */
export type CompositeAppHeaderItemTarget = z.infer<typeof CompositeAppHeaderItemTargetSchema>;

/**
 * A single button in the CompositeApp header bar.
 *
 * Unlike sidebar nav-items, header items are free-form and not tied to an installed
 * app: each is a labelled, icon-bearing button linking to a route or external URL.
 * The `user_menu` item is special — it renders the account dropdown, so its `icon`,
 * `href`, and `target` are ignored.
 */
export type CompositeAppHeaderItem = z.infer<typeof CompositeAppHeaderItemSchema>;

/**
 * CompositeApp shell configuration.
 * This is the main configuration interface for storing CompositeApp settings.
 * Used as the MongoDB model for persisting CompositeApp configurations.
 */
export type CompositeAppConfig = z.infer<typeof CompositeAppConfigSchema>;

export type CompositeAppConfigPayload = z.infer<typeof CompositeAppConfigPayloadSchema>;

export type ValidateUrlRequest = z.infer<typeof ValidateUrlRequestSchema>;

export type ValidateUrlResponse = z.infer<typeof ValidateUrlResponseSchema>;

/**
 * Result of DELETE /api/v1/apps/:id. With `?confirm=true` the cascade runs and
 * `deleted: true` is set; without it the endpoint returns a dry-run summary so
 * the UI can show what would be removed.
 *
 * Inferred from the published component rather than hand-written: the endpoint
 * had been declaring `CountResult`, so response validation reported a missing
 * `count` and every field here as unexpected — and in local development, where
 * the check fails closed, that surfaced as a 500 raised AFTER the app was
 * already deleted. Deriving the type is what keeps the two from drifting again.
 */
export type AppDeleteSummary = z.infer<typeof AppDeleteSummarySchema>;
