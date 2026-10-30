import type { AuthTokenPayload } from './apikey.js';
import type * as Wire from './wire-types.generated.js';

/** Allowed values for AppUINavItem.preferredSection */
export const PREFERRED_SECTIONS = ['default', 'footer', 'settings'] as const;

function trimBoundaryHyphens(value: string): string {
    let start = 0;
    let end = value.length;
    while (start < end && value[start] === '-') start++;
    while (end > start && value[end - 1] === '-') end--;
    return value.slice(start, end);
}

/** Convert an app display/package name into the canonical persisted app id. */
export function slugifyAppId(value: string): string {
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-');
    const slug = trimBoundaryHyphens(normalized).slice(0, 80);
    if (!slug) throw new Error('App name must contain at least one letter or number');
    return slug;
}

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

export type AppUIConfig = Wire.AppUIConfig;
export type AppOAuthClientConfig = Wire.AppOAuthClientConfig;

export type AppInstallationProjectsQuery = Wire.AppInstallationProjectsQuery;

export type AppInstallationsQuery = Wire.AppInstallationsQuery;

export type AppListScope = Wire.AppListScope;

export type AppsQuery = Wire.AppsQuery;

export type ToolCollectionAuthType = Wire.ToolCollectionAuthType;

export type MCPOAuthConfig = Wire.MCPOAuthConfig;

/** Install-time provisioning blueprint for an `auth: 'api_key'` MCP collection. Never holds the key. */
export type MCPApiKeyConfig = Wire.MCPApiKeyConfig;

export type MCPToolCollectionObject = Wire.MCPToolCollectionObject;

export type VertesiaSDKToolCollectionObject = Wire.VertesiaSDKToolCollectionObject;

export type ToolCollectionObject = Wire.ToolCollectionObject;

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
export function normalizeToolCollection(
    collection: ToolCollectionObject,
    vars?: Endpoints,
    sharedParameters?: MCPToolCollectionObject['parameters'],
): ToolCollectionObject {
    if (!collection || typeof collection !== 'object') {
        throw new TypeError('Tool collection must be an object');
    }
    const substitutedUrl =
        vars && collection.url
            ? substituteEndpoints(
                  collection.url,
                  vars,
                  collection.type === 'mcp'
                      ? [...Object.keys(sharedParameters ?? {}), ...Object.keys(collection.parameters ?? {})]
                      : [],
              )
            : collection.url;
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
export type MCPToolAnnotations = Wire.MCPToolAnnotations;

/**
 * Approval behavior class for a tool exposed to agents.
 *
 * - `read_only`: reads or inspects state without changing Vertesia, external systems, or user-visible artifacts.
 * - `side_effecting`: can create, update, delete, send, execute, schedule, or otherwise change state.
 * - `control`: affects agent control flow or tool availability, not user data or external systems.
 * - `requires_confirmation`: high-impact action that must ask the user even in interactive full-control mode.
 */
export type AgentToolApprovalClass = Wire.AgentToolApprovalClass;

/**
 * Tool definition with optional activation control for agent exposure.
 */
export type AgentToolDefinition = Wire.AgentToolDefinition;

/**
 * Definition of a remote activity exposed by a tool server for use in DSL workflows.
 * Remote activities are identified in workflow steps using colon-separated names:
 * `app:<app_name>:<collection>:<activity_name>` (e.g. `app:my-nlp-app:examples:word_count`).
 */
export type RemoteActivityDefinition = Wire.RemoteActivityDefinition;

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

export type AppCapabilities = Wire.AppCapabilities;

/**
 * Header carrying the app version a generated-app UI is running, so studio/zeno resolve app-owned
 * capability refs (`app:<app>:...`) against that exact version instead of the promoted version.
 * Resolution-time only; never persisted. Set by the generated app template via client.withAppVersion.
 */
export const APP_VERSION_HEADER = 'x-vertesia-app-version';
export type AppAvailableIn = Wire.AppAvailableIn;

export type AppVersionKind = Wire.AppVersionKind;
export type AppDeploymentAlias = Wire.AppDeploymentAlias;
export type AppDeploymentAliasTarget = Wire.AppDeploymentAliasTarget;
export type AppVersionState = Wire.AppVersionState;
export type AppVersionTarget = Wire.AppVersionTarget;
export type AppVersionGitRefType = Wire.AppVersionGitRefType;
export type AppBuildTrigger = Wire.AppBuildTrigger;

export type AppVersionStorage = Wire.AppVersionStorage;

export type AppVersionGitSource = Wire.AppVersionGitSource;

export type AppVersionUrls = Wire.AppVersionUrls;

/**
 * Stable, user-defined deployment alias (for example `production` or `customer-preview`).
 *
 * Aliases are deliberately DNS-label compatible so the app gateway can expose each alias through
 * both a shared-origin path and a dedicated application hostname without a second naming rule.
 */
export const APP_DEPLOYMENT_ALIAS_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export type AppVersionRecord = Wire.AppVersionRecord;

export interface AppGenTemplateMetadata {
    name: string;
    version: number;
    runtime_features: Record<string, number>;
}

export const ADVANCED_APP_VERSION_LAUNCH_FEATURE = 'advanced_launch';
export const ADVANCED_APP_VERSION_LAUNCH_PROTOCOL_VERSION = 1;

function recordValue(value: unknown): Record<string, unknown> | undefined {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : undefined;
}

/** Read template provenance captured in an immutable AppGen version manifest. */
export function getAppGenTemplateMetadata(manifest: unknown): AppGenTemplateMetadata | undefined {
    const packageArtifacts = recordValue(recordValue(manifest)?.package_artifacts);
    const metadata = recordValue(packageArtifacts?.appgen_template);
    const runtimeFeatures = recordValue(metadata?.runtime_features);
    const name = typeof metadata?.name === 'string' ? metadata.name.trim() : '';
    if (
        !metadata ||
        !name ||
        !Number.isInteger(metadata.version) ||
        (metadata.version as number) < 1 ||
        !runtimeFeatures
    ) {
        return undefined;
    }

    const normalizedFeatures: Record<string, number> = {};
    for (const [feature, protocolVersion] of Object.entries(runtimeFeatures)) {
        if (Number.isInteger(protocolVersion) && (protocolVersion as number) > 0) {
            normalizedFeatures[feature] = protocolVersion as number;
        }
    }
    return {
        name,
        version: metadata.version as number,
        runtime_features: normalizedFeatures,
    };
}

/** Return the protocol version implemented by one generated-app runtime feature. */
export function getAppVersionRuntimeFeatureVersion(manifest: unknown, feature: string): number | undefined {
    return getAppGenTemplateMetadata(manifest)?.runtime_features[feature];
}

export function supportsAdvancedAppVersionLaunch(manifest: unknown): boolean {
    return (
        (getAppVersionRuntimeFeatureVersion(manifest, ADVANCED_APP_VERSION_LAUNCH_FEATURE) ?? 0) >=
        ADVANCED_APP_VERSION_LAUNCH_PROTOCOL_VERSION
    );
}

export type AppVersionLaunchTarget = Wire.AppVersionLaunchTarget;

export type CreateAppVersionLaunchRequest = Wire.CreateAppVersionLaunchRequest;

export type CreateAppVersionLaunchResponse = Wire.CreateAppVersionLaunchResponse;

export type DeleteAppVersionResponse = Wire.DeleteAppVersionResponse;

export type UpsertAppVersionRequest = Wire.UpsertAppVersionRequest;

export interface AppVersionListQuery {
    app_id?: string;
    kind?: AppVersionKind;
    include_expired?: boolean;
    limit?: number;
}

export type PromoteAppVersionResponse = Wire.PromoteAppVersionResponse;

export type StartAppBuildRequest = Wire.StartAppBuildRequest;

export type StartAppBuildResponse = Wire.StartAppBuildResponse;

export type AppBuildProgressStatus = Wire.AppBuildProgressStatus;

export type AppBuildProgress = Wire.AppBuildProgress;

export type AppScaffoldModule = Wire.AppScaffoldModule;

export type AppScaffoldSourceMode = Wire.AppScaffoldSourceMode;

export type StartAppScaffoldRequest = Wire.StartAppScaffoldRequest;

export type StartAppScaffoldResponse = Wire.StartAppScaffoldResponse;

export type AppGithubConfiguration = Wire.AppGithubConfiguration;
export type StartAppGithubAuthorizationResponse = Wire.StartAppGithubAuthorizationResponse;
export type ExchangeAppGithubAuthorizationRequest = Wire.ExchangeAppGithubAuthorizationRequest;
export type AppGithubRepositoriesQuery = Wire.AppGithubRepositoriesQuery;
export type AppGithubInstallation = Wire.AppGithubInstallation;
export type AppGithubAccount = Wire.AppGithubAccount;
export type ExchangeAppGithubAuthorizationResponse = Wire.ExchangeAppGithubAuthorizationResponse;
export type AppGithubRepository = Wire.AppGithubRepository;
export type AppGithubRepositoryCreation = Wire.AppGithubRepositoryCreation;
export type AppGithubRepositoryList = Wire.AppGithubRepositoryList;
export type AppGithubRepositorySetupQuery = Wire.AppGithubRepositorySetupQuery;
export type AppGithubBranchState = Wire.AppGithubBranchState;
export type AppGithubRepositorySetup = Wire.AppGithubRepositorySetup;

export type StartAppDevelopmentTaskRequest = Wire.StartAppDevelopmentTaskRequest;

export type AppScaffoldProgressStatus = Wire.AppScaffoldProgressStatus;

export type AppScaffoldProgress = Wire.AppScaffoldProgress;

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
export type AppAccessControl = Wire.AppAccessControl;

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
export type AppManifestData = Wire.AppManifestData;
export type UpdateAppPayload = Wire.UpdateAppPayload;

export type AppGitSourceConfig = Wire.AppGitSourceConfig;
export type AppGitSourceProvider = Wire.AppGitSourceProvider;

export type AppSourceConfig = Wire.AppSourceConfig;

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
function substituteEndpoints(url: string, endpoints?: Endpoints, parameterNames: string[] = []): string {
    if (!url || !endpoints) return url;
    return url.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
        // Explicit installation parameters take precedence over legacy platform endpoint placeholders.
        if (parameterNames.includes(key)) return match;
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
export type AppRepoTreeEntry = Wire.AppRepoTreeEntry;

/** A non-recursive listing of an app git repo directory at a given ref. */
export type AppRepoTree = Wire.AppRepoTree;

/** Result of committing one or more uploaded documents to an app repository. */
export type AppRepoDocumentCommit = Wire.AppRepoDocumentCommit;

/** One commit that inserted or changed a file in an app git repository. */
export type AppRepoCommit = Wire.AppRepoCommit;

/** Commit history in an app git repository, optionally filtered to a file. */
export type AppRepoCommits = Wire.AppRepoCommits;

/** A branch or tag in an app git repo, resolved to its latest commit. */
export type AppRepoRef = Wire.AppRepoRef;

/** The branches and tags of an app git repo (see {@link AppRepoRef}). */
export type AppRepoRefs = Wire.AppRepoRefs;

/** A mutable app development task represented by an `agent/*` Git branch. */
export type AppDevelopmentTask = Wire.AppDevelopmentTask;

/** Git-backed development tasks and the branch used for new tasks by default. */
export type AppDevelopmentTaskList = Wire.AppDevelopmentTaskList;

/** Development task details, including the latest parent assistant run when one exists. */
export type AppDevelopmentTaskDetails = Wire.AppDevelopmentTaskDetails;

/** Request to create a branch from an existing branch, tag, or commit. */
export interface CreateAppRepoBranchRequest {
    name: string;
    source_ref: string;
}

/** A newly created app repository branch. */
export type AppRepoBranch = Wire.AppRepoBranch;

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
export type AppPackageEventHook = Wire.AppPackageEventHook;
export type AppPackageHooks = Wire.AppPackageHooks;
export type AppEventHookDelivery = Wire.AppEventHookDelivery;
export type AppEventHookPayload = Wire.AppEventHookPayload;
export type AppEventSubscriptionDefinition = Wire.AppEventSubscriptionDefinition;
export type AppPackage = Wire.AppPackage;

/**
 * A single diagnostic produced while inspecting an app's registration state.
 */
export type AppInspectionIssue = Wire.AppInspectionIssue;

/**
 * Per-capability report of what an app's promoted package actually exposes,
 * compared against what its manifest declares.
 */
export type AppInspectionCapabilityReport = Wire.AppInspectionCapabilityReport;

/**
 * Result of inspecting an app's registration: the resolved manifest state, what
 * the promoted package actually exposes per capability, and diagnostics. This
 * is the ground truth used by the `app_inspect_registration` agent tool and the
 * Build › App inspection UI to verify what is registered vs declared, instead of
 * inferring it from failed object/import calls.
 */
export type AppInspectionResult = Wire.AppInspectionResult;

export type AppWidgetInfo = Wire.AppWidgetInfo;

export type RenderingTemplateDefinition = Wire.RenderingTemplateDefinition;

export type RenderingTemplateDefinitionRef = Wire.RenderingTemplateDefinitionRef;

export type AppManifest = Wire.AppManifest;

export type AppManifestSource = Wire.AppManifestSource;

/**
 * Binding between an MCP collection and an OAuth provider created at install time.
 * Stored on AppInstallation so the runtime can look up the correct OAuth provider by ID,
 * independent of manifest oauth_provider references (which may change).
 */
export type AppInstallationOAuthBinding = Wire.AppInstallationOAuthBinding;

/**
 * Binding between a named OAuth provider and the OAuth provider created for it at install time.
 * Stored on AppInstallation so the runtime can resolve the correct OAuth provider for collections
 * that reference a shared provider via MCPToolCollectionObject.oauth_provider.
 */
export type AppInstallationProviderBinding = Wire.AppInstallationProviderBinding;

export type AppInstallation = Wire.AppInstallation;

export type AppInstallationWithManifest = Wire.AppInstallationWithManifest;

/** An installation whose app manifest could not be resolved (the app was deleted or is unpublished). */
export interface OrphanedAppInstallation extends Omit<AppInstallation, 'manifest'> {
    manifest: null;
}

export type AppInstallationListEntry = Wire.AppInstallationListEntry;

export type OAuthClientCredentials = Wire.OAuthClientCredentials;

export type AppOAuthCollectionParams = Wire.AppOAuthCollectionParams;

/** One installer-supplied MCP API key. */
export type McpApiKeyCredential = Wire.McpApiKeyCredential;

/** Installer-supplied MCP API keys, keyed by collection id. */
export type AppApiKeyCollectionParams = Wire.AppApiKeyCollectionParams;
export type AppOAuthProviderParams = Wire.AppOAuthProviderParams;

export type AppInstallationPayload = Wire.AppInstallationPayload;

export type UpdateAppInstallationToolAllowlistPayload = Wire.UpdateAppInstallationToolAllowlistPayload;

export type UpdateAppInstallationToolPermissionsPayload = Wire.UpdateAppInstallationToolPermissionsPayload;

export type AppInstallationKind = Wire.AppInstallationKind;

/**
 * A description of the tools provided by an app
 */
export type AppToolCollection = Wire.AppToolCollection;

/**
 * A tool and the app installation that provides it, inferred from `./api-schemas/project.js` — the
 * module that owns it, because it converted with the Projects batch rather than with Apps.
 */
export type ProjectToolInfo = Wire.ProjectToolInfo;

/**
 * OAuth authentication status for an MCP tool collection
 */
export type OAuthAuthStatus = Wire.OAuthAuthStatus;

/**
 * Response from OAuth authorization endpoint
 */
export type OAuthAuthorizeResponse = Wire.OAuthAuthorizeResponse;

/**
 * Payload for storing the static bearer token of an `auth: 'api_key'` MCP collection.
 * The key is write-only — it is never echoed back by any endpoint.
 */
export type SetMcpApiKeyRequest = Wire.SetMcpApiKeyRequest;

/** Whether an `auth: 'api_key'` MCP collection has a key stored, plus a display-only hint. */
export type McpApiKeyStatus = Wire.McpApiKeyStatus;

export type McpOAuthTokenRequest = Wire.McpOAuthTokenRequest;

export type McpOAuthTokenResponse = Wire.McpOAuthTokenResponse;

export type McpOAuthConnectResponse = Wire.McpOAuthConnectResponse;

export type McpOAuthDisconnectResponse = Wire.McpOAuthDisconnectResponse;

/**
 * Response from OAuth metadata endpoint
 */
export type OAuthMetadataResponse = Wire.OAuthMetadataResponse;

// ============================================================================
// CompositeApp Shell Configuration Types
// These types define the configuration for a CompositeApp shell that combines
// multiple apps into a unified experience with shared navigation and branding.
// ============================================================================

/**
 * Configuration entry for an individual app in the CompositeApp shell.
 * References an app installation by name.
 */
export type CompositeAppEntry = Wire.CompositeAppEntry;

/**
 * Logo overrides for the CompositeApp shell header.
 * When provided, these URLs replace the default Vertesia logo.
 */
export type CompositeAppLogoOverrides = Wire.CompositeAppLogoOverrides;

/**
 * Message banner overrides for the shell header.
 */
export type CompositeAppMessageStyle = Wire.CompositeAppMessageStyle;
export type CompositeAppMessageOverrides = Wire.CompositeAppMessageOverrides;

/**
 * Switcher visibility overrides for the CompositeApp header.
 */
export type CompositeAppSwitchersOverrides = Wire.CompositeAppSwitchersOverrides;

/**
 * Header button visibility overrides for the CompositeApp header.
 *
 * @deprecated Superseded by `CompositeAppConfig.headerMenu` (free-form header items).
 * Retained for backward compatibility and to seed the default header menu when no
 * `headerMenu` has been configured yet.
 */
export type CompositeAppHeaderOverrides = Wire.CompositeAppHeaderOverrides;

/**
 * User menu overrides for the CompositeApp.
 *
 * @deprecated Superseded by the `user_menu` item in `CompositeAppConfig.headerMenu`.
 * Retained for backward compatibility and to seed the default header menu when no
 * `headerMenu` has been configured yet.
 */
export type CompositeAppUserMenuOverrides = Wire.CompositeAppUserMenuOverrides;

/**
 * Theme overrides for the CompositeApp.
 */
export type CompositeAppThemeOverrides = Wire.CompositeAppThemeOverrides;

/**
 * Sidebar display overrides for the CompositeApp.
 */
export type CompositeAppSidebarOverrides = Wire.CompositeAppSidebarOverrides;

/**
 * Card display overrides for the CompositeApp in the App Portal.
 * Similar to AppManifest display properties, but specific to the CompositeApp card.
 * Allows customers to customize the app portal card (not otherwise possible if using a
 * shared, Vertesia-managed manifest across accounts).
 */
export type CompositeAppCardOverrides = Wire.CompositeAppCardOverrides;

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
export type CompositeAppNavItemPermissions = Wire.CompositeAppNavItemPermissions;

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
export type CompositeAppMenuSection = Wire.CompositeAppMenuSection;

export type CompositeAppHomePlugin = Wire.CompositeAppHomePlugin;

// ============================================================================
// Header Menu Types
// ============================================================================

/**
 * Discriminator for a header item.
 * The four built-ins (`app_portal`, `docs`, `help`, `user_menu`) seed the default
 * header and cannot be deleted (only hidden/customized); `custom` items are fully
 * user-defined buttons.
 */
export type CompositeAppHeaderItemKind = Wire.CompositeAppHeaderItemKind;

/** Where a header link opens. */
export type CompositeAppHeaderItemTarget = Wire.CompositeAppHeaderItemTarget;

/**
 * A single button in the CompositeApp header bar.
 *
 * Unlike sidebar nav-items, header items are free-form and not tied to an installed
 * app: each is a labelled, icon-bearing button linking to a route or external URL.
 * The `user_menu` item is special — it renders the account dropdown, so its `icon`,
 * `href`, and `target` are ignored.
 */
export type CompositeAppHeaderItem = Wire.CompositeAppHeaderItem;

/**
 * CompositeApp shell configuration.
 * This is the main configuration interface for storing CompositeApp settings.
 * Used as the MongoDB model for persisting CompositeApp configurations.
 */
export type CompositeAppConfig = Wire.CompositeAppConfig;

export type CompositeAppConfigPayload = Wire.CompositeAppConfigPayload;

export type ValidateUrlRequest = Wire.ValidateUrlRequest;

export type ValidateUrlResponse = Wire.ValidateUrlResponse;

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
export type AppDeleteSummary = Wire.AppDeleteSummary;

export type UpdateAppInstallationOAuthApprovalPayload = Wire.UpdateAppInstallationOAuthApprovalPayload;

/** Check exact installation grants; legacy app-name grants authorize only the default instance. */
export function hasAppInstallationAccess(
    token: AuthTokenPayload,
    installation: { id: string; project: string; instance_key?: string; manifest: { name: string } },
    ui = false,
): boolean {
    if (token.project?.id !== installation.project) return false;
    const grants = token.app_installations;
    if (grants !== undefined) {
        if (grants.version !== 1 || grants.project_id !== installation.project) return false;
        if (grants.ids.includes(installation.id)) {
            return !ui || !grants.ui_restrictions?.includes(installation.id);
        }
    }
    // Default app-name grants survive reinstalling the same app with a new installation ID.
    // Named instances never inherit these grants, including on refreshed running-agent tokens.
    return (
        (!installation.instance_key || installation.instance_key === 'default') &&
        (token.apps ?? []).includes(installation.manifest.name) &&
        (!ui || !token.ui_restrictions?.includes(installation.manifest.name))
    );
}

/** Persist this effective collection in catalogs so discovery and execution use the same namespace. */
export function resolveInstallationCollection(
    collection: ToolCollectionObject,
    installation: Pick<AppInstallation, 'instance_key' | 'namespace_overrides' | 'namespace_conflicts'>,
): ToolCollectionObject {
    if (collection.type === 'mcp' && installation.namespace_conflicts?.includes(collection.id)) {
        throw new Error(`Namespace conflict for MCP collection '${collection.id}'; resolve it in project app settings`);
    }
    if (collection.type !== 'mcp') return collection;
    const overrides = installation.namespace_overrides;
    if (overrides && Object.hasOwn(overrides, collection.id)) {
        const namespace = overrides[collection.id];
        if (typeof namespace === 'string' && namespace.length > 0) return { ...collection, namespace };
    } else if (!installation.instance_key || installation.instance_key === 'default') {
        return collection;
    }
    throw new Error(`Namespace allocation required for MCP collection '${collection.id}'`);
}

export type AppInstanceAvailability = Wire.AppInstanceAvailability;
export type McpPublicParameter = Wire.McpPublicParameter;
export type McpSecretParameter = Wire.McpSecretParameter;
export type McpConnectionParameter = Wire.McpConnectionParameter;

/** Whether a manifest can safely back an additional MCP-only installation. */
export function isMcpOnlyInstanceManifest(
    manifest: Pick<AppManifestData, 'endpoint' | 'ui' | 'capabilities' | 'tool_collections'>,
): boolean {
    return (
        !manifest.endpoint &&
        !manifest.ui &&
        !manifest.capabilities?.some((capability) => capability !== 'tools') &&
        !!manifest.tool_collections?.length &&
        manifest.tool_collections.every((collection) => normalizeToolCollection(collection).type === 'mcp')
    );
}
