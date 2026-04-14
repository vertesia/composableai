import { JSONSchema, ToolDefinition } from "@llumiverse/common";
import { CatalogInteractionRef } from "./interaction.js";
import { DSLActivityOptions, InCodeTypeDefinition } from "./store/index.js";

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
    preferredSection?: "default" | "footer" | "settings";
}

export interface AppUIConfig {
    /**
     * The source URL of the app. The src can be a template which contain
     * a variable named `buildId` which will be replaced with the current build id.
     * For example: `/plugins/vertesia-review-center-${buildId}`
     */
    src: string;
    /**
     * The isolation strategy. If not specified it defaults to shadow
     * - shadow - use Shadow DOM to fully isolate the plugin from the host.
     * - css - use CSS processing (like prefixing or other isolation techniques). Ligther but plugins may conflict with the host
     */
    isolation?: "shadow" | "css";
    /**
     * Navigation items for the app's sidebar UI.
     * Only applicable for apps with UI capability in shell contexts (ie. CompositeApp shell).
     */
    navigation?: AppUINavItem[];
    /**
     * Where this app's UI can be displayed.
     * - 'app_portal': Available in the main app portal (standalone)
     * - 'composite_app': Available within a CompositeApp shell
     * Defaults to ['app_portal', 'composite_app'] for new apps.
     */
    available_in?: AppAvailableIn[];
}

/**
 * Authentication type for tool collections
 */
export type ToolCollectionAuthType = "oauth" | "other";

/**
 * Tool collection type
 */
export type ToolCollectionType = "mcp" | "vertesia_sdk";

/**
 * Base tool collection configuration
 */
interface BaseToolCollectionObject {
    /**
     * The URL endpoint for the tool collection
     */
    url: string;

    /**
     * Optional authentication type required for this tool collection
     */
    auth?: ToolCollectionAuthType;
}

/**
 * MCP tool collection configuration (requires name, description, and namespace)
 */
export interface MCPToolCollectionObject extends BaseToolCollectionObject {
    type: "mcp";

    /**
     * Name for the tool collection.
     * Used as an identifier for the collection (e.g., for OAuth authentication).
     */
    name: string;

    /**
     * Description for the tool collection.
     * Helps users understand what tools this collection provides.
     */
    description: string;

    /**
     * Prefix to use for tool names from this collection.
     * Provides clean, readable tool names (e.g., "jira" instead of "https://mcp.atlassian.com/v1/mcp")
     */
    namespace: string;

    /**
     * Reference to an OAuth Application name for this collection.
     * When set, uses the OAuth Application's config (endpoints, client_id, client_secret)
     * instead of MCP dynamic client registration or random fallback.
     * The referenced OAuth Application must exist in the same project.
     */
    oauth_app?: string;
}

/**
 * Vertesia SDK tool collection configuration
 */
export interface VertesiaSDKToolCollectionObject extends BaseToolCollectionObject {
    type: "vertesia_sdk";

    /**
     * Optional namespace to use for tool names from this collection.
     * If not provided, the tool server default will be used.
     */
    namespace?: string;

    /**
     * Optional name for the tool collection.
     * If not provided, the tool server default will be used.
     */
    name?: string;

    /**
     * Optional description for the tool collection.
     * If not provided, the tool server default will be used.
     */
    description?: string;
}

/**
 * Tool collection configuration (object format)
 */
export type ToolCollectionObject = MCPToolCollectionObject | VertesiaSDKToolCollectionObject;

/**
 * Tool collection can be either:
 * - A string URL (legacy format, with "mcp:" prefix for MCP servers)
 * - An object with url, type, and optional auth (new format)
 */
export type ToolCollection = string | ToolCollectionObject;

/**
 * Normalizes a tool collection to the object format.
 * Handles backward compatibility with string URLs.
 *
 * @param collection - String URL or ToolCollectionObject
 * @returns Normalized ToolCollectionObject
 */
export function normalizeToolCollection(collection: ToolCollection): ToolCollectionObject {
    if (typeof collection === 'string') {
        // Legacy string format
        if (collection.startsWith('mcp:')) {
            const url = collection.substring('mcp:'.length);
            // For legacy MCP strings, derive name and prefix from URL
            const urlObj = new URL(url);
            const name = urlObj.hostname.replace(/\./g, '-');
            return {
                url,
                type: 'mcp',
                name,
                description: `MCP server at ${url}`,
                namespace: name
            };
        }
        return {
            url: collection,
            type: 'vertesia_sdk'
        };
    }
    // Already in object format
    return collection;
}


/**
 * Metadata hints from MCP tool annotations (per MCP spec).
 */
export interface MCPToolAnnotations {
    /** Human-readable display name for the tool */
    title?: string;
    /** If true, the tool does not modify any state */
    readOnlyHint?: boolean;
    /** If true, the tool may perform irreversible destructive operations */
    destructiveHint?: boolean;
    /** If true, calling the tool multiple times with the same args has no additional effect */
    idempotentHint?: boolean;
    /** If true, the tool interacts with external entities outside the local environment */
    openWorldHint?: boolean;
}

/**
 * Tool definition with optional activation control for agent exposure.
 */
export interface AgentToolDefinition extends ToolDefinition {
    /**
     * The tool execution URL. It can be an absolute URL or a path in which case the URL is obtained 
     * using the base URL of the tool server API. Ex: http://tool-server.com/api/
     * Example of relative URLs: "tools/my-tool-collection" or "/api/tools/my-tool-collection"
     */
    url?: string;
    /**
     * The tool category if any - for UI purposes.
     */
    category?: string;
    /**
     * Whether this tool is available by default.
     * - true/undefined: Tool is always available to agents
     * - false: Tool is only available when activated by a skill's related_tools
     */
    default?: boolean;
    /**
     * For skill tools (learn_*): list of related tool names that become available
     * when this skill is called. Used for dynamic tool discovery.
     */
    related_tools?: string[];
    /**
     * MCP tool annotations providing hints about tool behavior and safety.
     */
    annotations?: MCPToolAnnotations;
}

/**
 * Definition of a remote activity exposed by a tool server for use in DSL workflows.
 * Remote activities are identified in workflow steps using colon-separated names:
 * `app:<app_name>:<collection>:<activity_name>` (e.g. `app:my-nlp-app:examples:word_count`).
 */
export interface RemoteActivityDefinition {
    /** Activity name (snake_case, unique within the collection) */
    name: string;
    /** Collection name this activity belongs to */
    collection?: string;
    /** Display title */
    title?: string;
    /** Description of what the activity does */
    description?: string;
    /** JSON Schema for the activity input parameters */
    input_schema?: Record<string, any>;
    /** JSON Schema for the activity output */
    output_schema?: Record<string, any>;
    /**
     * The activity execution URL. Can be absolute or relative to the tool server base URL.
     * If not provided, the collection-specific activities endpoint is used.
     */
    url?: string;
    /** Suggested timeout and retry configuration */
    options?: DSLActivityOptions;
}

export type AppCapabilities = 'ui' | 'tools' | 'interactions' | 'types' | 'templates';
export type AppAvailableIn = 'app_portal' | 'composite_app';
export interface AppManifestData {
    /**
     * The name of the app, used as the id in the system.
     * Must be in kebab case (e.g. my-app).
     */
    name: string;

    /**
     * Visibility level of the app:
     * - "public": visible to all accounts
     * - "private": visible only to the owning account
     * - "vertesia": visible only to Vertesia team members (any project)
     */
    visibility: "public" | "private" | "vertesia";

    title: string;
    description: string;
    publisher: string;

    /**
     * A svg icon for the app.
     */
    icon?: string;

    /**
     * A color name to be used as the color of the app card (e.g. blue, red, green, etc.)
     * If not specified a random color will be picked.
     */
    color?: string;

    status: "beta" | "stable" | "deprecated"

    /**
     * The UI configuration of the app. If not specified and the app "ui" is in the app capabilities 
     * then the ui configuration will be fetched from the endpoint property.
     */
    ui?: AppUIConfig

    /**
     * A list of tool collections endpoints to be used by this app.
     * Prefer using endpoint over tool_collections.
     */
    tool_collections?: ToolCollection[]

    /**
     * An URL providing interactions definitions in JSON format.
     * The URL must provide 2 endpoints:
     * 1. GET URL - must return a JSON array with the list of interactions (as AppInteractionRef[])
     * 2. GET URL/{interaction_name} - must return the full interaction definition for the specified interaction.
     * This feature is for advanced composition of interactions. Prefer using endpoint. 
     */
    interactions?: string;

    /**
     * A JSON chema for the app installation settings.
     * @deprecated Use endpoint to provide settings_schema instead
     */
    settings_schema?: JSONSchema;

    /** The following API is part of the second version of the manifest and deprectaes similar properties included directly in the manifest */

    /**
     * Describe the capabiltities of this app - which kind of contributions it provides.
     */
    capabilities?: AppCapabilities[];

    /**
     * The app endpoint URL
     * This URL should return a JSON object describing the contributions provided by the app.
     * The object shape must satisfies AppPackage interface.
     * The endpoint must support GET method and a `scope` parameter to filter which resources are included in the returned AppPackage:
     * The supported scope values are:
     * - ui
     * - tools
     * - interactions
     * - types
     * - settings
     * - all (the default if no scope is provided)
     *  You can also use comma-separated values to combine scopes (e.g. "ui,tools").
     * 
     * Example: 
     * - ?scope=ui,tools - returns only the UI configuration
     */
    endpoint?: string;

    /**
     * Optional endpoint overrides keyed by environment name.
     * When resolving the app endpoint, if the current environment name matches a key,
     * the corresponding URL is used instead of the main `endpoint`.
     * Only dev environment names are allowed as keys (starting with "desktop-" or "dev-").
     */
    endpoint_overrides?: Record<string, string>;
}

/**
 * Returns true if the given environment name is allowed as an endpoint override key.
 * Only "desktop-" or "dev-" prefixed names are valid.
 */
export function isValidEndpointOverrideEnv(envName: string): boolean {
    return envName.startsWith('desktop-') || envName.startsWith('dev-');
}

/**
 * Resolves the effective endpoint for an app given an optional environment name.
 * Returns the override endpoint if the env name matches a valid dev environment, otherwise the default endpoint.
 */
export function resolveAppEndpoint(
    manifest: Pick<AppManifestData, 'endpoint' | 'endpoint_overrides'>,
    envName?: string
): string | undefined {
    if (envName && manifest.endpoint_overrides?.[envName] && isValidEndpointOverrideEnv(envName)) {
        return manifest.endpoint_overrides[envName];
    }
    return manifest.endpoint;
}

export type AppPackageScope = 'ui' | 'tools' | 'interactions' | 'types' | 'templates' | 'settings' | 'widgets' | 'activities' | 'all';
export interface AppPackage {
    /**
     * The UI configuration of the app
     */
    ui?: AppUIConfig

    /**
     * A list of tools exposed by the app.
     */
    tools?: AgentToolDefinition[]

    /**
     * A list of interactions exposed by the app
     */
    interactions?: CatalogInteractionRef[];

    /**
     * A list of types.
     */
    types?: InCodeTypeDefinition[];

    /**
     * Templates provided by the app.
     */
    templates?: RenderingTemplateDefinitionRef[];

    /**
     * Widgets provided by the app.
     */
    widgets?: Record<string, AppWidgetInfo>;

    /**
     * Remote activities exposed by the app for use in DSL workflows.
     * Activities are discovered via `?scope=activities` and referenced in workflow steps
     * using colon-separated names: `app:<app_name>:<collection>:<activity_name>`.
     */
    activities?: RemoteActivityDefinition[];

    /**
     * A JSON chema for the app installation settings.
     */
    settings_schema?: JSONSchema;
}

export interface AppWidgetInfo {
    collection: string;
    skill: string;
    url: string;
}

export interface RenderingTemplateDefinition {
    /** Unique template id: "collection:name" */
    id: string;
    /** Unique template name (kebab-case) */
    name: string;
    /** Display title */
    title?: string;
    /** Short description */
    description: string;
    /** Template type */
    type: 'presentation' | 'document';
    /** Tags for categorization */
    tags?: string[];
    /** Absolute paths to asset files */
    assets: string[];
    /** The template instructions (markdown) */
    instructions: string;
}

export type RenderingTemplateDefinitionRef = Omit<RenderingTemplateDefinition, 'instructions'> & {
    /** Absolute API path to fetch the full template definition */
    path: string;
};

export interface AppManifest extends AppManifestData {
    id: string;
    /** The owning account. Undefined for apps imported from a master region. */
    account?: string;
    created_at: string;
    updated_at: string;
}

export interface AppInstallation {
    id: string;
    project: string; // the project where the app is installed
    manifest: string; // the app manifest
    settings?: Record<string, any>; // settings for the app installation
    /**
     * Admin-managed allowlist of tool names permitted for this installation.
     * When undefined, all tools from the app are permitted.
     * When set, only listed tool names are available for agent configuration and execution.
     */
    tool_allowlist?: string[];
    created_at: string;
    updated_at: string;
}

export interface AppInstallationWithManifest extends Omit<AppInstallation, 'manifest'> {
    manifest: AppManifest; // the app manifest data
}

export interface AppInstallationPayload {
    app_id: string,
    settings?: Record<string, any>
}

export type AppInstallationKind = 'ui' | 'tools' | 'all';

/**
 * A description of the tools provided by an app
 */
export interface AppToolCollection {
    /**
     * The collection name
     */
    name: string;

    /**
     * Optional collection description
     */
    description?: string;

    /**
     * the tools provided by this collection
     */
    tools: AgentToolDefinition[]
}

/**
 * Information about a tool and its associated app installation.
 * Used to look up which app provides a specific tool.
 */
export interface ProjectToolInfo {
    /**
     * The tool name
     */
    tool_name: string;

    /**
     * Optional tool description
     */
    tool_description?: string;

    /**
     * The app name that provides this tool
     */
    app_name: string;

    /**
     * The app installation ID
     */
    app_install_id: string;

    /**
     * The app installation settings.
     * Only included for agent tokens, not user tokens (security: may contain API keys).
     */
    settings?: Record<string, any>;
}

/**
 * OAuth authentication status for an MCP tool collection
 */
export interface OAuthAuthStatus {
    collection_name: string;
    authenticated: boolean;
    mcp_server_url: string;
    expires_at?: string;
    scope?: string;
}

/**
 * Response from OAuth authorization endpoint
 */
export interface OAuthAuthorizeResponse {
    authorization_url?: string;
    state?: string;
    connected?: boolean;
}

/**
 * Response from OAuth metadata endpoint
 */
export interface OAuthMetadataResponse {
    collection_name: string;
    mcp_server_url: string;
    metadata: any;
}

// ============================================================================
// CompositeApp Shell Configuration Types
// These types define the configuration for a CompositeApp shell that combines
// multiple apps into a unified experience with shared navigation and branding.
// ============================================================================

/**
 * Configuration entry for an individual app in the CompositeApp shell.
 * References an app installation by name.
 */
export interface CompositeAppEntry {
    /** App installation name (must match an installed app) */
    appName: string;
}

/**
 * Logo overrides for the CompositeApp shell header.
 * When provided, these URLs replace the default Vertesia logo.
 */
export interface CompositeAppLogoOverrides {
    /** URL for light mode logo (overrides default Vertesia logo) */
    lightModeUrl?: string;
    /** URL for dark mode logo (overrides default Vertesia logo) */
    darkModeUrl?: string;
    /** Whether to hide the Vertesia footer logo in the sidebar when header logo is overridden (defaults to false) */
    hideFooterLogo?: boolean;
}


/**
 * Message banner overrides for the shell header.
*/
export type CompositeAppMessageStyle = 'foreground' | 'info' | 'success' | 'attention' | 'destructive';
export interface CompositeAppMessageOverrides {
    /** Message text to display */
    text?: string;
    /** Whether the message is visible (defaults to true) */
    visible?: boolean;
    /** Text color style. Uses semantic colors */
    style?: CompositeAppMessageStyle;
}

/**
 * Switcher visibility overrides for the CompositeApp header.
 */
export interface CompositeAppSwitchersOverrides {
    /** Whether to hide the organization switcher (defaults to false) */
    hideOrganization?: boolean;
    /** Whether to hide the project switcher (defaults to false) */
    hideProject?: boolean;
}

/**
 * Header button visibility overrides for the CompositeApp header.
 */
export interface CompositeAppHeaderOverrides {
    /** Whether to hide the App Portal button (defaults to false) */
    hideAppPortal?: boolean;
    /** Whether to hide the Docs button (defaults to false) */
    hideDocs?: boolean;
    /** Whether to hide the Help button (defaults to false) */
    hideHelp?: boolean;
}

/**
 * User menu overrides for the CompositeApp.
 */
export interface CompositeAppUserMenuOverrides {
    /** Whether to hide the User Menu (defaults to false) */
    hidden?: boolean;
}

/**
 * Theme overrides for the CompositeApp.
 */
export interface CompositeAppThemeOverrides {
    /** When true, forces light mode and disables dark mode (defaults to false) */
    disableDarkMode?: boolean;
}

/**
 * Sidebar display overrides for the CompositeApp.
 */
export interface CompositeAppSidebarOverrides {
    /** Whether to hide section title headers in the sidebar (defaults to false) */
    hideSectionHeaders?: boolean;
    /** Whether menu items auto-collapse when navigating (accordion behavior). When false, all items stay expanded. Defaults to true. */
    autoCollapse?: boolean;
    /** Whether settings section items auto-collapse when navigating. Independent of autoCollapse which handles all other items. Defaults to true. */
    autoCollapseSettings?: boolean;
    /** Whether footer section items auto-collapse when navigating. Independent of autoCollapse which handles all other items. Defaults to true. */
    autoCollapseFooter?: boolean;
}

/**
 * Card display overrides for the CompositeApp in the App Portal.
 * Similar to AppManifest display properties, but specific to the CompositeApp card.
 * Allows customers to customize the app portal card (not otherwise possible if using a
 * shared, Vertesia-managed manifest across accounts).
 */
export interface CompositeAppCardOverrides {
    /** Whether to show the CompositeApp card in App Portal (default: false) */
    visible?: boolean;
    /** Override the card label (default: "Composite App") */
    label?: string;
    /** Override the card description */
    description?: string;
    /** Override the card icon (Lucide icon name or SVG content string) */
    icon?: string;
    /** Override the card color (e.g., "blue", "red", "purple") */
    color?: string;
}

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
export interface CompositeAppNavItemPermissions {
    /** Group IDs whose members can see this item. */
    groupsAllowed?: string[];
    /** User IDs who can see this item. */
    usersAllowed?: string[];
    /** ProjectRoles values (e.g. "developer", "manager") whose holders can see this item. */
    rolesAllowed?: string[];
}

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
export interface CompositeAppMenuSection {
    /** Stable unique identifier */
    id: string;
    /** Section heading label */
    label: string;
    /** When true, this section and its items are hidden from the sidebar */
    hidden?: boolean;
    /** Ordered nav-items within this section */
    items: CompositeAppMenuNavItem[];
}

export interface CompositeAppHomePlugin {
    /** The app name to use as the home page */
    appName: string;
    /** Optional route within the app (e.g. "/dashboard"). Defaults to "/" */
    appRoute?: string;
}

/**
 * CompositeApp shell configuration.
 * This is the main configuration interface for storing CompositeApp settings.
 * Used as the MongoDB model for persisting CompositeApp configurations.
 */
export interface CompositeAppConfig {
    /**
     * The unique identifier for this CompositeApp configuration 
     * Undefined if the configuration doesn't exists yet.
    */
    id?: string;
    /** The project this CompositeApp belongs to */
    project: string;
    /** Card display overrides (includes visibility) */
    card?: CompositeAppCardOverrides;
    /** Optional logo overrides (replaces default Vertesia logo) */
    logo?: CompositeAppLogoOverrides;
    /** Optional message banner overrides */
    message?: CompositeAppMessageOverrides;
    /** Optional switcher visibility overrides */
    switchers?: CompositeAppSwitchersOverrides;
    /** Optional sidebar display overrides */
    sidebar?: CompositeAppSidebarOverrides;
    /** Optional header button visibility overrides */
    header?: CompositeAppHeaderOverrides;
    /** Optional user menu overrides */
    userMenu?: CompositeAppUserMenuOverrides;
    /** Optional theme overrides (e.g. disable dark mode) */
    theme?: CompositeAppThemeOverrides;
    /** Optional home page override. When set, redirects "/" to the specified app route instead of the dashboard. Send null to unset. */
    homePlugin?: CompositeAppHomePlugin | null;
    /** List of apps to include in the CompositeApp (used for installation tracking and fallback sidebar) */
    apps: CompositeAppEntry[];
    /**
     * Optional sidebar menu. When present, the sidebar renders from this
     * instead of the apps-based pipeline. Top-level array is sections;
     * each section contains nav-items.
     */
    menu?: CompositeAppMenuSection[];
}

export type CompositeAppConfigPayload = Partial<Omit<CompositeAppConfig, 'id' | 'project'>>;

export interface ValidateUrlRequest {
    url: string;
}

export interface ValidateUrlResponse {
    valid: true;
}
