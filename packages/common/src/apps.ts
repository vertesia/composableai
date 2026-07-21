import type { JSONObject, JSONSchema, ToolDefinition } from '@llumiverse/common';
import type { AppDashboardDefinition } from './data-platform.js';
import type { CatalogInteractionRef } from './interaction.js';
import type { DSLActivityOptions, InCodeProcessDefinition, InCodeTypeDefinition } from './store/index.js';
import type { InCodeViewDefinition } from './views.js';

/** Allowed values for AppUINavItem.preferredSection */
export const PREFERRED_SECTIONS = ['default', 'footer', 'settings'] as const;

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

export interface AppUIConfig {
    /**
     * The source URL of the app. The src can be a template which contain
     * a variable named `buildId` which will be replaced with the current build id.
     * For example: `/plugins/vertesia-review-center-${buildId}`
     */
    src: string;
    /**
     * The isolation strategy. If not specified it defaults to shadow.
     * - shadow - use Shadow DOM to fully isolate the plugin from the host.
     * - css - inject the plugin's styles (minus the preflight) into the host document;
     *   lighter but styles may conflict with the host.
     */
    isolation?: 'shadow' | 'css';
    /**
     * When true the host modifies the app's css at load time to attempt to fix broken
     * or missing styles. Only takes effect in css isolation mode. Defaults to false.
     */
    css_rebuild?: boolean;
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

export interface AppInstallationProjectsQuery {
    name?: string;
    id?: string;
}

export interface AppInstallationsQuery {
    kind?: AppInstallationKind;
    available_in?: AppAvailableIn;
}

/**
 * Authentication type for tool collections
 */
export type ToolCollectionAuthType = 'oauth' | 'other';

/**
 * Tool collection type
 */
export type ToolCollectionType = 'mcp' | 'vertesia_sdk';

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
 * Install-time OAuth provisioning blueprint for an MCP collection.
 * Defines how to auto-create an OAuth provider when the app is installed.
 * Does NOT affect runtime behaviour — the runtime uses oauth_bindings on AppInstallation.
 */
export interface MCPOAuthConfig {
    /**
     * Name for the OAuth provider to create at install time.
     * Defaults to the collection id converted to kebab-case if not specified.
     */
    name?: string;
    /** Human-readable display name for the created OAuth provider. */
    display_name?: string;
    grant_type?: 'authorization_code' | 'client_credentials';
    authorization_endpoint?: string;
    token_endpoint?: string;
    revocation_endpoint?: string;
    /**
     * Pre-configured client_id.
     * Omit if the installer must supply it (include 'client_id' in required_at_install).
     */
    client_id?: string;
    use_pkce?: boolean;
    default_scopes?: string[];
    /**
     * Parameters the installer must provide at install time.
     * These are shown as form fields in composable-ui before the install completes.
     * - 'client_id': user supplies the OAuth client ID
     * - 'client_secret': user supplies the OAuth client secret
     */
    required_at_install?: Array<'client_id' | 'client_secret' | 'scopes'>;
}

/**
 * MCP tool collection configuration (requires name, description, and namespace)
 */
export interface MCPToolCollectionObject extends BaseToolCollectionObject {
    type: 'mcp';

    /**
     * Stable identifier for this collection.
     * Used to key oauth_bindings on AppInstallation — protects against collection renames.
     * Required for new manifests.
     */
    id: string;

    /**
     * Name for the tool collection.
     * Human-readable label for the collection.
     * Used in UI.
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
     * Reference to an OAuth provider name for this collection (legacy / manual path).
     * When set, uses the OAuth provider's config (endpoints, client_id, client_secret)
     * instead of MCP dynamic client registration or random fallback.
     * The referenced OAuth provider must exist in the same project.
     */
    oauth_app?: string;

    /**
     * Install-time OAuth provisioning blueprint.
     * When present, the platform auto-creates an OAuth provider at install time
     * using these values merged with any user-supplied required_at_install params.
     * The created app is recorded in AppInstallation.oauth_bindings.
     * Mutually exclusive with oauth_provider.
     */
    oauth_config?: MCPOAuthConfig;

    /**
     * Reference to a key in AppManifestData.oauth_providers.
     * When set, this collection shares the named provider's OAuth provider configuration.
     * Mutually exclusive with oauth_config and oauth_app.
     * Requires auth: "oauth" to be set.
     */
    oauth_provider?: string;

    /**
     * Additional OAuth scopes for this collection when using a shared oauth_provider.
     * These are merged (union) with the provider's default_scopes at install time.
     * Only valid when oauth_provider is set.
     */
    oauth_scopes?: string[];
}

/**
 * Vertesia SDK tool collection configuration
 */
export interface VertesiaSDKToolCollectionObject extends BaseToolCollectionObject {
    type: 'vertesia_sdk';

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
/**
 * @discriminator type
 */
export type ToolCollectionObject = MCPToolCollectionObject | VertesiaSDKToolCollectionObject;

/**
 * Backward-compatible TypeScript alias. Public API payloads should reference
 * ToolCollectionObject directly so generated clients do not create a wrapper
 * model around the discriminated union.
 */
export type ToolCollection = ToolCollectionObject;

export const MCP_COLLECTION_ID_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
export const MCP_COLLECTION_NAMESPACE_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

export function isValidMCPCollectionId(id: string): boolean {
    return MCP_COLLECTION_ID_PATTERN.test(id);
}

export function isValidMCPCollectionNamespace(namespace: string): boolean {
    return MCP_COLLECTION_NAMESPACE_PATTERN.test(namespace);
}

export function deriveMCPCollectionId(input: string): string {
    return input
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_+/g, '_');
}

export function getDefaultOAuthAppNameForCollectionId(collectionId: string): string {
    return collectionId.replace(/_/g, '-');
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
 * Approval behavior class for a tool exposed to agents.
 *
 * - `read_only`: reads or inspects state without changing Vertesia, external systems, or user-visible artifacts.
 * - `side_effecting`: can create, update, delete, send, execute, schedule, or otherwise change state.
 * - `control`: affects agent control flow or tool availability, not user data or external systems.
 * - `requires_confirmation`: high-impact action that must ask the user even in interactive full-control mode.
 */
export type AgentToolApprovalClass = 'read_only' | 'side_effecting' | 'control' | 'requires_confirmation';

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
     * - false: Tool is only available when enabled by a skill via `tools`
     */
    default?: boolean;
    /**
     * For skill tools (`learn_*`): the tool names this skill enables when called.
     * Matches the `tools:` key used in SKILL.md frontmatter and built-in skill
     * definitions — one name across the whole stack.
     */
    tools?: string[];
    /**
     * MCP tool annotations providing hints about tool behavior and safety.
     */
    annotations?: MCPToolAnnotations;
    /**
     * Approval classification used by interactive agent approval modes.
     * Use `requires_confirmation` for actions that must prompt even in full-control mode.
     */
    approval_class?: AgentToolApprovalClass;
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
    input_schema?: Record<string, unknown>;
    /** JSON Schema for the activity output */
    output_schema?: Record<string, unknown>;
    /**
     * The activity execution URL. Can be absolute or relative to the tool server base URL.
     * If not provided, the collection-specific activities endpoint is used.
     */
    url?: string;
    /** Suggested timeout and retry configuration */
    options?: DSLActivityOptions;
}

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

export type AppCapabilities = (typeof APP_CAPABILITIES)[number];

/**
 * Header carrying the app version a generated-app UI is running, so studio/zeno resolve app-owned
 * capability refs (`app:<app>:...`) against that version (candidate testing) instead of current.
 * Resolution-time only; never persisted. Set by the generated app template via client.withAppVersion.
 */
export const APP_VERSION_HEADER = 'x-vertesia-app-version';
/**
 * The platform-artifact types an app build can be required to create. A finer-grained
 * counterpart to {@link AppCapabilities}: a single `interactions` capability may comprise
 * several `interaction` artifacts plus `agent`, `activity`, and `tool` artifacts that
 * {@link AppCapabilities} folds together. Used by the App Solution Architect manifest and
 * the publish-time capability gate.
 */
export const APP_ARTIFACT_TYPES = [
    'interaction',
    'agent',
    'type',
    'process',
    'view',
    'template',
    'dashboard',
    'activity',
    'tool',
] as const;

export type AppArtifactType = (typeof APP_ARTIFACT_TYPES)[number];

/**
 * A single platform artifact the App Solution Architect requires the build to create.
 * `id` is the app-owned in-code id the implementation must register and reference
 * (e.g. `app:<name>:main:extract-item` for interactions/agents, `app:<name>:<type>` for
 * types, `app:<name>:<process>` for processes).
 */
/**
 * Build progress for one artifact, maintained by the developer agent as a living checklist:
 *  - `pending` — defined by the architect, not yet built.
 *  - `built`   — registered in the package, not yet successfully exercised.
 *  - `done`    — built AND successfully exercised against real data.
 * This is the agent's self-reported claim for tracking/handoff; the capability gate verifies
 * the truth independently via package registration + run/data telemetry and does not trust it.
 */
export type AppArtifactStatus = 'pending' | 'built' | 'done';

export const APP_ARTIFACT_STATUSES: readonly AppArtifactStatus[] = ['pending', 'built', 'done'];

export interface AppPlannedArtifact {
    /** App-owned in-code id the build must register and reference. */
    id: string;
    type: AppArtifactType;
    /** Short human label. */
    name?: string;
    /** Why this artifact exists / what it does — carried into the build checklist. */
    purpose?: string;
    /**
     * When false, the artifact is planned but optional: the capability gate warns rather
     * than blocks if it is missing or never exercised. Defaults to required (true).
     */
    required?: boolean;
    /** Build progress, updated by the developer agent. Defaults to `pending`. */
    status?: AppArtifactStatus;
}

/**
 * Structured result the App Solution Architect emits alongside its prose artifacts — the
 * machine-readable contract for the build. The implementation MUST create and successfully
 * exercise every required artifact before preview/publish. Persisted into the app repo as
 * {@link APP_CAPABILITY_MANIFEST_PATH} so it survives across runs and the publish-time
 * capability gate can verify against it deterministically. If the builder finds the plan
 * wrong or insufficient, the orchestrator relaunches the architect to revise the manifest;
 * the gate always checks against the latest committed copy.
 */
export interface AppCapabilityManifest {
    /** Artifact-storage ref to the prose architecture spec (e.g. the architecture `.md`). */
    spec_artifact: string;
    /** Platform artifacts the build must create. */
    artifacts: AppPlannedArtifact[];
    /**
     * Monotonic revision, starting at 1, bumped each time the architect evolves the manifest for
     * the SAME app on a later iteration (read the committed manifest, preserve untouched artifacts,
     * add/modify/remove, then bump). Lets downstream agents tell which contract they are building to.
     */
    revision?: number;
    /**
     * Newest-first change notes, one entry per revision (what was added/modified/removed and why).
     * How manifest changes are communicated to downstream agents across iterations.
     */
    changelog?: string[];
    /** Optional free-form notes the architect wants the builder to honor. */
    notes?: string;
}

/** Repo-relative path the capability manifest is committed to, read by the publish gate. */
export const APP_CAPABILITY_MANIFEST_PATH = 'docs/app-capability-manifest.json';
export type AppAvailableIn = 'app_portal' | 'composite_app';

export type AppVersionKind = 'design' | 'preview' | 'published';
export type AppVersionState = 'ready' | 'failed' | 'expired';
export type AppVersionTarget = 'static' | 'service';
export type AppVersionGitRefType = 'branch' | 'tag' | 'commit' | 'detached';
export type AppBuildIntent = 'preview' | 'publish';
export type AppBuildTrigger = 'ui' | 'git_push' | 'agent' | 'api';

export interface AppVersionStorage {
    tenant_id?: string;
    app_prefix?: string;
    artifacts_prefix?: string;
    source_archive?: string;
    source_git?: AppVersionGitSource;
    build_prefix?: string;
    manifest_path?: string;
    service_archive?: string;
    live_metadata_path?: string;
}

export interface AppVersionGitSource {
    url?: string;
    remote?: string;
    /**
     * The source ref that should be used to reproduce this version. For immutable
     * app versions this is normally the tag created during preview/publish.
     */
    ref?: string;
    ref_type?: AppVersionGitRefType;
    branch?: string;
    tag?: string;
    commit?: string;
    dirty?: boolean;
    pushed?: boolean;
    push_warning?: string;
}

export interface AppVersionUrls {
    live_url?: string;
    app_url?: string;
    plugin_url?: string;
    package_url?: string;
    internal_preview_url?: string;
}

export interface AppVersionRecord {
    id: string;
    account: string;
    project: string;
    app?: string;
    app_id: string;
    app_name: string;
    version_id: string;
    kind: AppVersionKind;
    state: AppVersionState;
    active?: boolean;
    target?: AppVersionTarget;
    agent_run_id?: string;
    sandbox_id?: string;
    title?: string;
    description?: string;
    storage?: AppVersionStorage;
    urls?: AppVersionUrls;
    manifest?: Record<string, unknown>;
    files?: string[];
    file_count?: number;
    source_file_count?: number;
    screenshot_artifact?: string;
    checks?: string[];
    created_by?: string;
    created_at: string;
    updated_at: string;
    published_at?: string;
    checked_at?: string;
    expires_at?: string;
}

export interface UpsertAppVersionRequest {
    app?: string;
    app_id: string;
    app_name?: string;
    version_id: string;
    kind: AppVersionKind;
    state?: AppVersionState;
    active?: boolean;
    target?: AppVersionTarget;
    agent_run_id?: string;
    sandbox_id?: string;
    title?: string;
    description?: string;
    storage?: AppVersionStorage;
    urls?: AppVersionUrls;
    manifest?: Record<string, unknown>;
    files?: string[];
    file_count?: number;
    source_file_count?: number;
    screenshot_artifact?: string;
    checks?: string[];
    published_at?: string;
    checked_at?: string;
    expires_at?: string;
}

export interface AppVersionListQuery {
    app_id?: string;
    kind?: AppVersionKind;
    include_expired?: boolean;
    limit?: number;
}

export interface ActivateAppVersionResponse {
    version: AppVersionRecord;
    app?: AppManifest;
}

export interface StartAppBuildRequest {
    /**
     * Source branch, tag, or commit to build. When omitted, the app source
     * configuration chooses the dev branch for previews and production branch
     * for publishes.
     */
    source_ref?: string;
    source_ref_type?: Extract<AppVersionGitRefType, 'branch' | 'tag' | 'commit'>;
    intent?: AppBuildIntent;
    trigger?: AppBuildTrigger;
    target?: AppVersionTarget;
    activate?: boolean;
    title?: string;
    description?: string;
}

export interface StartAppBuildResponse {
    workflow_id: string;
    run_id: string;
    app_id: string;
    intent: AppBuildIntent;
    source_ref?: string;
    source_ref_type?: Extract<AppVersionGitRefType, 'branch' | 'tag' | 'commit'>;
}

export interface AppBuildWorkflowInput extends StartAppBuildRequest {
    app_id: string;
    app_record_id?: string;
    app_title?: string;
    app_description?: string;
    source_git_url?: string;
}

export interface AppBuildWorkflowResult {
    app_id: string;
    version_id: string;
    kind: Extract<AppVersionKind, 'preview' | 'published'>;
    state: AppVersionState;
    source_git?: AppVersionGitSource;
    urls?: AppVersionUrls;
    file_count?: number;
}

export type AppBuildProgressStatus = 'queued' | 'resolving' | 'building' | 'completed' | 'failed';

export interface AppBuildProgress {
    status: AppBuildProgressStatus;
    step: string;
    app_id?: string;
    version_id?: string;
    intent?: AppBuildIntent;
    source_ref?: string;
    source_ref_type?: Extract<AppVersionGitRefType, 'branch' | 'tag' | 'commit'>;
    source_commit?: string;
    file_count?: number;
    app_url?: string;
    error?: string;
    updated_at: string;
}

export type AppScaffoldModule = 'service' | 'assistant' | 'content-app' | 'examples';

export interface StartAppScaffoldRequest {
    /**
     * App id / package name to create. It is normalized to the same slug rules
     * used by @vertesia/create-plugin.
     */
    app_id: string;
    title?: string;
    description?: string;
    modules?: AppScaffoldModule[];
    /**
     * Start an initial preview build after the source has been pushed.
     * Defaults to true.
     */
    create_version?: boolean;
}

export interface StartAppScaffoldResponse {
    workflow_id: string;
    run_id: string;
    app_id: string;
    app_record_id?: string;
    git_url?: string;
    create_version: boolean;
}

export interface AppScaffoldWorkflowInput extends StartAppScaffoldRequest {}

export interface AppScaffoldWorkflowResult {
    app_id: string;
    app_record_id?: string;
    git_url?: string;
    source_git?: AppVersionGitSource;
    files?: number;
    initial_build?: StartAppBuildResponse;
}

export type AppScaffoldProgressStatus =
    | 'queued'
    | 'reserving'
    | 'scaffolding'
    | 'pushing'
    | 'building'
    | 'completed'
    | 'failed';

export interface AppScaffoldProgress {
    status: AppScaffoldProgressStatus;
    step: string;
    app_id?: string;
    app_record_id?: string;
    git_url?: string;
    files?: number;
    initial_build?: StartAppBuildResponse;
    error?: string;
    error_details?: string[];
    updated_at: string;
}

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
export type AppAccessControl = 'all' | 'ui' | 'none';

/**
 * Resolve the effective access_control policy for an installed app:
 * installation override wins, then manifest default, then `'all'`.
 *
 * Shared by the STS (JWT generation), the studio-server (validation), and the UI (badge display)
 * so the resolution rule lives in exactly one place. Named `effectiveAppAccessControl` (not just
 * `effectiveAccessControl`) because exports from `@vertesia/common` are flattened — the broader
 * name would risk colliding with other access-control families added later.
 */
export function effectiveAppAccessControl(
    installation: { access_control?: AppAccessControl } | null | undefined,
    manifest: { access_control?: AppAccessControl } | null | undefined,
): AppAccessControl {
    return installation?.access_control ?? manifest?.access_control ?? 'all';
}

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
    visibility: 'public' | 'private' | 'vertesia';

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

    /**
     * Optional preview screenshot for the app-management UI, captured by the builder during a
     * build/QA run. Resolved client-side from the owning agent run's artifact storage, so it
     * carries both the run id and the artifact path.
     */
    preview_screenshot?: {
        /** Agent run id whose artifact storage holds the screenshot. */
        agent_run_id: string;
        /** Artifact path within that storage, e.g. "preview-checks/app-preview-<ts>.png". */
        artifact: string;
    };

    status: 'beta' | 'stable' | 'deprecated';

    /**
     * The UI configuration of the app. If not specified and the app "ui" is in the app capabilities
     * then the ui configuration will be fetched from the endpoint property.
     */
    ui?: AppUIConfig;

    /**
     * A list of tool collections endpoints to be used by this app.
     * Prefer using endpoint over tool_collections.
     */
    tool_collections?: ToolCollectionObject[];

    /**
     * Named OAuth providers shared across multiple MCP tool collections.
     * Keys must be kebab-case identifiers. Each value is an MCPOAuthConfig blueprint.
     * Collections reference a provider via MCPToolCollectionObject.oauth_provider.
     * One OAuth provider is created per provider at install time; all referencing
     * collections share that app via AppInstallation.provider_bindings.
     */
    oauth_providers?: Record<string, MCPOAuthConfig>;

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
     * - processes
     * - templates
     * - dashboards
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

    /**
     * Optional app version string (e.g. "1.0.0") — informational.
     */
    version?: string;

    /**
     * Source repository configuration for apps generated and maintained through
     * AppGen. Branches are mutable deployment lanes; immutable app versions
     * record their exact source tag/commit in AppVersionRecord.storage.source_git.
     */
    source?: AppSourceConfig;

    /**
     * Free-form tags used for classification and filtering. Platform apps
     * carry `"system"` so UIs can skip install/uninstall/manage-permission
     * controls that don't apply to synthetic installations.
     */
    tags?: string[];

    /**
     * Access control policy for the app. Defaults to 'all' (ACE-gated everywhere)
     * when undefined. See {@link AppAccessControl} for semantics. May be overridden
     * on the AppInstallation.
     */
    access_control?: AppAccessControl;
}

export interface AppGitSourceConfig {
    url?: string;
    default_branch?: string;
    production_branch?: string;
    development_branch?: string;
}

export interface AppSourceConfig {
    kind: 'git';
    git?: AppGitSourceConfig;
}

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
    /** The appgen app-gateway base URL (serves published app bundles + their `/api` runtime). */
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
export interface AppRepoTreeEntry {
    /** File or directory name (last path segment). */
    name: string;
    /** Path relative to the repo root. */
    path: string;
    /** Whether the entry is a file (`blob`) or a directory (`tree`). */
    type: 'blob' | 'tree';
}

/** A non-recursive listing of an app git repo directory at a given ref. */
export interface AppRepoTree {
    /** The ref the listing was read at (empty/undefined = default branch / HEAD). */
    ref?: string;
    /** The directory prefix that was listed (empty = repo root). */
    prefix?: string;
    entries: AppRepoTreeEntry[];
}

/** Browser-side limits mirrored by the app Git service document endpoint. */
export const APP_REPO_DOCUMENT_UPLOAD_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const APP_REPO_DOCUMENT_UPLOAD_MAX_TOTAL_BYTES = 80 * 1024 * 1024;
export const APP_REPO_DOCUMENT_UPLOAD_MAX_FILES = 20;
export const APP_REPO_DOCUMENT_UPLOAD_PREFIX = 'docs/';

/** Result of committing one or more uploaded documents to an app repository. */
export interface AppRepoDocumentCommit {
    /** Updated branch name. */
    ref: string;
    /** Branch HEAD before the commit. */
    previous_commit: string;
    /** Newly created commit SHA. */
    commit: string;
    /** Repository paths changed by the commit. */
    paths: string[];
}

/** One commit that inserted or changed a file in an app git repository. */
export interface AppRepoCommit {
    /** Full commit SHA. */
    commit: string;
    /** Complete commit message. */
    message: string;
    /** Commit author name, when available. */
    author?: string;
    /** Commit author date as an ISO-8601 string, when available. */
    date?: string;
}

/** File-specific commit history in an app git repository. */
export interface AppRepoCommits {
    /** Ref from which history traversal started (empty/undefined = default branch / HEAD). */
    ref?: string;
    /** File path relative to the repository root. */
    path: string;
    /** Commits ordered newest first. */
    commits: AppRepoCommit[];
}

/** A branch or tag in an app git repo, resolved to its latest commit. */
export interface AppRepoRef {
    /** Short ref name (e.g. `main`, `v1.0.0`). */
    name: string;
    /** Commit hash the ref points at (annotated tags are peeled to their commit). */
    commit: string;
    /** First line of the commit message, when available. */
    commit_subject?: string;
    /** Commit date as an ISO-8601 string, when available. */
    commit_date?: string;
    /** Commit author name, when available. */
    commit_author?: string;
}

/** The branches and tags of an app git repo (see {@link AppRepoRef}). */
export interface AppRepoRefs {
    /** The repository's default branch (HEAD target), when resolvable. */
    default_branch?: string;
    branches: AppRepoRef[];
    tags: AppRepoRef[];
}

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
    'all',
] as const;

export type AppPackageScope = (typeof APP_PACKAGE_SCOPES)[number];
export interface AppPackage {
    /**
     * The UI configuration of the app
     */
    ui?: AppUIConfig;

    /**
     * A list of tools exposed by the app.
     */
    tools?: AgentToolDefinition[];

    /**
     * A list of skills (`learn_*` tools) exposed by the app. Kept separate from
     * `tools` so clients can render them distinctly — consumers that don't care
     * (e.g. the worker building a combined tool registry) should concatenate
     * the two lists.
     */
    skills?: AgentToolDefinition[];

    /**
     * A list of interactions exposed by the app
     */
    interactions?: CatalogInteractionRef[];

    /**
     * A list of types.
     */
    types?: InCodeTypeDefinition[];

    /**
     * A list of process definitions exposed by the app.
     */
    processes?: InCodeProcessDefinition[];

    /**
     * View Experiences exposed by the app as in-code definitions.
     */
    views?: InCodeViewDefinition[];

    /**
     * Templates provided by the app.
     */
    templates?: RenderingTemplateDefinitionRef[];

    /**
     * Dashboards provided by the app.
     */
    dashboards?: AppDashboardDefinition[];

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

/**
 * A single diagnostic produced while inspecting an app's registration state.
 */
export interface AppInspectionIssue {
    severity: 'error' | 'warning';
    /** The capability this issue relates to, when applicable (e.g. 'types'). */
    capability?: AppPackageScope;
    /** Stable machine code, e.g. 'capability_declared_but_empty', 'endpoint_unreachable', 'not_installed'. */
    code: string;
    /** Human-readable explanation, safe to surface to the model and the UI. */
    message: string;
}

/**
 * Per-capability report of what an app's published package actually exposes,
 * compared against what its manifest declares.
 */
export interface AppInspectionCapabilityReport {
    capability: AppPackageScope;
    /** True when the manifest's `capabilities` array declares this capability. */
    declared: boolean;
    /** The local ids the published package actually serves for this capability. */
    exposed_ids: string[];
    /** Convenience count of `exposed_ids`. */
    exposed_count: number;
}

/**
 * Result of inspecting an app's registration: the resolved manifest state, what
 * the published package actually exposes per capability, and diagnostics. This
 * is the ground truth used by the `app_inspect_registration` agent tool and the
 * Build › App inspection UI to verify what is registered vs declared, instead of
 * inferring it from failed object/import calls.
 */
export interface AppInspectionResult {
    app_id: string;
    name: string;
    version?: string;
    /** The resolved package endpoint for the current environment, if any. */
    endpoint?: string;
    /** True when the package endpoint responded to the capability probe. */
    endpoint_reachable: boolean;
    /** True when the app is installed in the current project. */
    installed: boolean;
    access_control?: string;
    /** The capabilities declared on the manifest. */
    capabilities: AppPackageScope[];
    /** What the published package exposes, per capability. */
    package: AppInspectionCapabilityReport[];
    /** Diagnostics — errors and warnings about the registration state. */
    issues: AppInspectionIssue[];
    /** Populated when the package probe itself failed (endpoint error/unreachable). */
    probe_error?: string;
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
    /** Source metadata for generated or synced app manifests. */
    source?: AppManifestSource;
    created_at: string;
    updated_at: string;
}

export interface AppManifestSource {
    kind: 'git';
    git: {
        url: string;
        default_branch?: string;
        production_branch?: string;
        development_branch?: string;
    };
}

/**
 * Binding between an MCP collection and an OAuth provider created at install time.
 * Stored on AppInstallation so the runtime can look up the correct OAuth provider by ID,
 * independent of manifest oauth_provider references (which may change).
 */
export interface AppInstallationOAuthBinding {
    /**
     * Stable collection identifier: MCPToolCollectionObject.id for new manifests.
     * Legacy installations may still contain a name-based fallback value.
     */
    collection_id: string;
    /**
     * MongoDB ObjectId of the OAuth provider in this project.
     * Used for ID-based lookups (rename-proof).
     */
    oauth_provider_id: string;
    /**
     * Name of the OAuth provider at creation time.
     * Used by the workflow token path (getMCPClient → remoteMcpConnections.getToken) which looks up by name.
     */
    oauth_provider_name: string;
}

/**
 * Binding between a named OAuth provider and the OAuth provider created for it at install time.
 * Stored on AppInstallation so the runtime can resolve the correct OAuth provider for collections
 * that reference a shared provider via MCPToolCollectionObject.oauth_provider.
 */
export interface AppInstallationProviderBinding {
    /** Key from AppManifestData.oauth_providers */
    provider_key: string;
    /** MongoDB ObjectId of the created OAuth provider */
    oauth_provider_id: string;
    /** Name of the OAuth provider at creation time (for audit/display only) */
    oauth_provider_name: string;
}

export interface AppInstallation {
    id: string;
    project: string; // the project where the app is installed
    manifest: string; // the app manifest
    settings?: Record<string, unknown>; // settings for the app installation
    /**
     * Admin-managed allowlist of tool names permitted for this installation.
     * When undefined, all tools from the app are permitted.
     * When set, only listed tool names are available for agent configuration and execution.
     */
    tool_allowlist?: string[];
    /**
     * OAuth bindings created at install time via oauth_config provisioning.
     * Maps collection identity (id or name) → OAuth provider ObjectId.
     * Used by the runtime to resolve the correct OAuth provider without relying on manifest names.
     */
    oauth_bindings?: AppInstallationOAuthBinding[];
    /**
     * OAuth bindings created at install time via oauth_providers provisioning.
     * Maps provider key → OAuth provider ObjectId.
     * Multiple collections sharing the same provider all resolve to the same OAuth provider.
     */
    provider_bindings?: AppInstallationProviderBinding[];
    /**
     * Per-installation override of the manifest's access_control policy.
     * When set, takes precedence over the manifest value. When undefined, the
     * manifest value (or 'all' default) applies.
     */
    access_control?: AppAccessControl;
    created_at: string;
    updated_at: string;
}

export interface AppInstallationWithManifest extends Omit<AppInstallation, 'manifest'> {
    manifest: AppManifest; // the app manifest data
    /**
     * Computed by the server: ids of MCP tool collections for this installation that require OAuth.
     * Accounts for all three signals: manifest auth:'oauth', manifest oauth_app, and oauth_bindings.
     * Populated by the GET /installations/all endpoint.
     */
    oauth_collection_ids?: string[];
}

export interface AppInstallationListEntry extends Omit<AppInstallation, 'manifest'> {
    manifest: AppManifest | null;
    oauth_collection_ids?: string[];
}

export interface OrphanedAppInstallation extends Omit<AppInstallation, 'manifest'> {
    manifest: null;
}

export interface OAuthClientCredentials {
    client_id?: string;
    client_secret?: string;
    scopes?: string[];
}

export type AppOAuthCollectionParams = Record<string, OAuthClientCredentials>;
export type AppOAuthProviderParams = Record<string, OAuthClientCredentials>;

export interface AppInstallationPayload {
    app_id: string;
    settings?: Record<string, unknown>;
    /**
     * Per-installation override of the manifest's `access_control` policy. When provided, takes precedence
     * over the manifest default for every access check. Sibling of `settings` — admin-controlled, not
     * part of the app's own settings JSON.
     *
     * Three send-time semantics on update:
     *  - Field omitted entirely from the payload → leave the existing override unchanged.
     *  - Explicit `null` → clear the override, fall back to the manifest default.
     *  - String enum → set the override to that value.
     *
     * (On install, the same shape applies; omit or pass `null` to use the manifest default.)
     */
    access_control?: AppAccessControl | null;
    /**
     * OAuth credentials for each collection, keyed by collection.id.
     * Legacy callers may still use collection.name for older manifests.
     * Collected from the user at install time for collections with oauth_config.required_at_install.
     */
    oauth_params?: AppOAuthCollectionParams;
    /**
     * OAuth credentials for named providers, keyed by the provider key from oauth_providers.
     * Collected from the user at install time for providers with required_at_install.
     * Separate from oauth_params to avoid key collisions between provider keys and collection ids.
     */
    oauth_provider_params?: AppOAuthProviderParams;
}

export interface UpdateAppInstallationToolAllowlistPayload {
    tool_allowlist: string[] | null;
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
    tools: AgentToolDefinition[];
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
    settings?: Record<string, unknown>;
}

/**
 * OAuth authentication status for an MCP tool collection
 */
export interface OAuthAuthStatus {
    collection_id: string;
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

export interface McpOAuthCollectionRef {
    app_install_id: string;
    collection_id: string;
}

export interface McpOAuthTokenRequest {
    app_install_id?: string;
    collection_id?: string;
    mcp_server_url?: string;
}

export interface McpOAuthTokenResponse {
    access_token: string;
}

export interface McpOAuthConnectResponse {
    success: boolean;
}

export interface McpOAuthDisconnectResponse {
    success: boolean;
    message: string;
}

/**
 * Response from OAuth metadata endpoint
 */
export interface OAuthMetadataResponse {
    collection_id: string;
    collection_name: string;
    mcp_server_url: string;
    metadata: JSONObject;
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
 *
 * @deprecated Superseded by `CompositeAppConfig.headerMenu` (free-form header items).
 * Retained for backward compatibility and to seed the default header menu when no
 * `headerMenu` has been configured yet.
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
 *
 * @deprecated Superseded by the `user_menu` item in `CompositeAppConfig.headerMenu`.
 * Retained for backward compatibility and to seed the default header menu when no
 * `headerMenu` has been configured yet.
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
    /** SystemRoles values (e.g. "developer", "manager") whose holders can see this item. */
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

// ============================================================================
// Header Menu Types
// ============================================================================

/**
 * Discriminator for a header item.
 * The four built-ins (`app_portal`, `docs`, `help`, `user_menu`) seed the default
 * header and cannot be deleted (only hidden/customized); `custom` items are fully
 * user-defined buttons.
 */
export type CompositeAppHeaderItemKind = 'app_portal' | 'docs' | 'help' | 'user_menu' | 'custom';

/** Where a header link opens. */
export type CompositeAppHeaderItemTarget = '_self' | '_blank';

/** Stable identifiers for the built-in header items. */
export const COMPOSITE_APP_HEADER_BUILTIN_IDS = ['app_portal', 'docs', 'help', 'user_menu'] as const;

/**
 * A single button in the CompositeApp header bar.
 *
 * Unlike sidebar nav-items, header items are free-form and not tied to an installed
 * app: each is a labelled, icon-bearing button linking to a route or external URL.
 * The `user_menu` item is special — it renders the account dropdown, so its `icon`,
 * `href`, and `target` are ignored.
 */
export interface CompositeAppHeaderItem {
    /** Stable unique identifier. Built-ins use their kind as id (e.g. "app_portal"). */
    id: string;
    /** Item kind. `custom` for user-added buttons; otherwise one of the four built-ins. */
    kind: CompositeAppHeaderItemKind;
    /** Display label, used as the button tooltip / accessible name. */
    label: string;
    /** Lucide icon name or SVG content string. Ignored for `user_menu`. */
    icon?: string;
    /** Destination route ("/...") or external URL. Ignored for `user_menu`. */
    href?: string;
    /** Where to open the link (defaults to "_self"). Ignored for `user_menu`. */
    target?: CompositeAppHeaderItemTarget;
    /** When true, this item is hidden from the header. */
    hidden?: boolean;
    /** Optional access control settings for this header item. */
    permissions?: CompositeAppNavItemPermissions;
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
    /**
     * @deprecated Use `headerMenu` instead. Optional header button visibility overrides.
     * Still read to seed `headerMenu` defaults for configs saved before the header menu existed.
     */
    header?: CompositeAppHeaderOverrides;
    /**
     * @deprecated Use the `user_menu` item in `headerMenu` instead. Optional user menu overrides.
     * Still read to seed `headerMenu` defaults for configs saved before the header menu existed.
     */
    userMenu?: CompositeAppUserMenuOverrides;
    /**
     * Optional free-form header menu. When present, the header renders from this ordered
     * list instead of the legacy `header`/`userMenu` flags. Built-in items (App Portal,
     * Docs, Help, User Menu) can be hidden/relabeled/re-icon'd/redirected; custom items
     * are arbitrary buttons.
     */
    headerMenu?: CompositeAppHeaderItem[];
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

/**
 * Result of DELETE /api/v1/apps/:id. With `?confirm=true` the cascade runs and
 * `deleted: true` is set; without it the endpoint returns a dry-run summary so
 * the UI can show what would be removed.
 */
export interface AppDeleteSummary {
    confirmed: boolean;
    app_id: string;
    app_name: string;
    versions: number;
    installations: number;
    storage_prefix: string;
    git_repo_url?: string;
    deleted: boolean;
    warnings: string[];
}
