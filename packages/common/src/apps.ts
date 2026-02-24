import { JSONSchema, ToolDefinition } from "@llumiverse/common";
import { CatalogInteractionRef } from "./interaction.js";
import { InCodeTypeDefinition } from "./store/index.js";

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
}

export type AppCapabilities = 'ui' | 'tools' | 'interactions' | 'types';
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
     * A tools collection endpoint is an URL which may end with a `?import` query string.
     * If the `?import` query string is used the tool will be imported as a javascript module and not executed through a POST on the collections endpoint.
     * This feature is for advanced composition of tools. Prefer using endpoint. 
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
}
export type AppPackageScope = 'ui' | 'tools' | 'interactions' | 'types' | 'templates' | 'settings' | 'widgets' | 'all';
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
    templates?: TemplateDefinitionRef[];

    /**
     * Widgets provided by the app.
     */
    widgets?: Record<string, AppWidgetInfo>;

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

export interface TemplateDefinitionRef {
    id: string;  // "collection:name"
    name: string;
    title?: string;
    description: string;
    type: 'presentation' | 'document';
    tags?: string[];
    assets: string[];
    instructions: string;
}

export interface AppManifest extends AppManifestData {
    id: string;
    account: string;
    created_at: string;
    updated_at: string;
}

export interface AppInstallation {
    id: string;
    project: string; // the project where the app is installed
    manifest: string; // the app manifest
    settings?: Record<string, any>; // settings for the app installation
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
    tools: { name: string, description?: string }[]
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
    authorization_url: string;
    state: string;
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
 * App navigation item display overrides.
 * Allows customizing individual nav items for an app installation within the CompositeApp shell.
 */
export interface CompositeAppNavItemOverride {
    /** Used as identifier to match the nav item to override -- does not change route path */
    route: string;
    /** Hide this nav item from the sidebar */
    hidden?: boolean;
    /** Override the displayed nav item label */
    label?: string;
    /** Override the displayed nav item icon (Lucide icon name or SVG content string) */
    icon?: string;
    //TODO: Set permissions for routes
}

/**
 * Configuration entry for an individual app in the CompositeApp shell.
 * References an app installation by name and allows customizing its appearance.
 */
export interface CompositeAppEntry {
    /** App installation name (must match an installed app) */
    appName: string;
    /** Override the label displayed for the app */
    labelOverride?: string;
    /** Override the icon displayed for the app (Lucide icon name or SVG content string) */
    iconOverride?: string;
    /** Overrides for navigation items provided by the app */
    navigationOverrides?: CompositeAppNavItemOverride[];
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
    /** Whether to show the organization switcher (defaults to true) */
    showOrganization?: boolean;
    /** Whether to show the project switcher (defaults to true) */
    showProject?: boolean;
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
    /** List of apps to include in the CompositeApp */
    apps: CompositeAppEntry[];
}

export type CompositeAppConfigPayload = Partial<Omit<CompositeAppConfig, 'id' | 'project'>>;
