/**
 * Fusion Application Types
 *
 * Types for AI-generated business applications stored in the database.
 * Applications combine navigation, pages, routing, and global data sources.
 */

import type { IconSpec, ThemeSpec } from './common.js';
import type { NavigationTemplate } from './navigation.js';
import type { DataBindingSpec, PermissionSpec } from './page.js';

// ============================================================================
// Status Types
// ============================================================================

export type FusionApplicationStatus = 'draft' | 'published' | 'archived';
export type FusionPageStatus = 'draft' | 'published' | 'archived';

// ============================================================================
// Route Types
// ============================================================================

/**
 * Route parameter definition for dynamic routes.
 */
export interface RouteParamSpec {
    /** Parameter name (e.g., 'id', 'slug') */
    name: string;
    /** Parameter type for validation */
    type?: 'string' | 'number' | 'uuid';
    /** Whether the parameter is required */
    required?: boolean;
    /** Default value if not provided */
    default?: string;
}

/**
 * Route specification mapping URL patterns to pages.
 */
export interface RouteSpec {
    /** URL path pattern (e.g., '/products', '/products/:id') */
    path: string;
    /** Reference to a FusionPage document ID */
    pageId?: string;
    /** Inline page template (for simple apps without separate page documents) */
    inlinePage?: InlinePageTemplate;
    /** Route parameters */
    params?: RouteParamSpec[];
    /** Whether this route requires authentication */
    requiresAuth?: boolean;
    /** Permissions required to access this route */
    permissions?: PermissionSpec;
}

/**
 * Inline page template for routes that don't need separate page documents.
 * Used for simple apps where pages are defined directly in the application.
 */
export interface InlinePageTemplate {
    /** Page title */
    title: string;
    /** Page layout configuration */
    layout: import('./page.js').PageLayoutSpec;
    /** Page regions with content */
    regions: import('./page.js').PageRegionSpec[];
    /** Page-level data bindings */
    dataBindings?: DataBindingSpec[];
    /** Page actions (header buttons) */
    actions?: import('./page.js').ActionSpec[];
    /** Breadcrumb configuration */
    breadcrumbs?: import('./page.js').BreadcrumbSpec[];
}

// ============================================================================
// Global Data Source Types
// ============================================================================

/**
 * Global data source available across the entire application.
 */
export interface GlobalDataSourceSpec {
    /** Unique key to reference this data source */
    key: string;
    /** Data binding specification */
    binding: DataBindingSpec;
    /** Whether to prefetch on application load */
    prefetch?: boolean;
    /** Cache duration in seconds (0 = no cache) */
    cacheDuration?: number;
    /** Whether this data source requires authentication */
    requiresAuth?: boolean;
}

// ============================================================================
// Application Settings Types
// ============================================================================

/**
 * JSON Schema-like definition for application settings.
 * Allows users to configure the application without editing templates.
 */
export interface SettingsSchemaProperty {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    title?: string;
    description?: string;
    default?: unknown;
    enum?: unknown[];
    items?: SettingsSchemaProperty;
    properties?: Record<string, SettingsSchemaProperty>;
    required?: string[];
}

export interface SettingsSchema {
    type: 'object';
    properties: Record<string, SettingsSchemaProperty>;
    required?: string[];
}

// ============================================================================
// Main Application Interface
// ============================================================================

/**
 * FusionApplication - A complete AI-generated business application.
 *
 * Applications combine:
 * - Navigation structure (sidebar, topbar)
 * - Routing (URL patterns to pages)
 * - Theme (colors, logo)
 * - Global data sources (shared across pages)
 * - Settings schema (user-configurable options)
 */
export interface FusionApplication {
    /** Unique identifier */
    id: string;
    /** URL-safe slug for the application */
    name: string;
    /** Display title */
    title: string;
    /** Application description */
    description?: string;
    /** Semantic version (e.g., '1.0.0') */
    version?: string;
    /** Application icon */
    icon?: IconSpec;
    /** Publication status */
    status: FusionApplicationStatus;
    /** Navigation structure */
    navigation: NavigationTemplate;
    /** Route definitions */
    routes: RouteSpec[];
    /** Default route path when accessing the app root */
    defaultRoute: string;
    /** Application theme */
    theme?: ThemeSpec;
    /** Global data sources */
    globalDataSources?: GlobalDataSourceSpec[];
    /** Application-level permissions */
    permissions?: PermissionSpec;
    /** User-configurable settings schema */
    settingsSchema?: SettingsSchema;
    /** Current settings values */
    settings?: Record<string, unknown>;
    /** Organization tags */
    tags?: string[];
    /** Project this application belongs to */
    project: string;
    /** Account that owns this application */
    account: string;
    /** Creation timestamp */
    created_at: string;
    /** Last update timestamp */
    updated_at: string;
    /** User who created the application */
    created_by?: string;
    /** User who last updated the application */
    updated_by?: string;
}

// ============================================================================
// Page Interface
// ============================================================================

/**
 * FusionPage - A page within a fusion application.
 *
 * Pages can be:
 * - Linked to an application (part of a multi-page app)
 * - Standalone (rendered independently)
 */
export interface FusionPage {
    /** Unique identifier */
    id: string;
    /** URL-safe slug for the page */
    name: string;
    /** Display title */
    title: string;
    /** Page description */
    description?: string;
    /** Page icon */
    icon?: IconSpec;
    /** Publication status */
    status: FusionPageStatus;
    /** URL path (relative to app root or standalone) */
    path: string;
    /** Layout configuration */
    layout: import('./page.js').PageLayoutSpec;
    /** Page regions with content */
    regions: import('./page.js').PageRegionSpec[];
    /** Page-level data bindings */
    dataBindings?: DataBindingSpec[];
    /** Page actions (header buttons) */
    actions?: import('./page.js').ActionSpec[];
    /** Breadcrumb configuration */
    breadcrumbs?: import('./page.js').BreadcrumbSpec[];
    /** Page-level permissions */
    permissions?: PermissionSpec;
    /** SEO metadata */
    meta?: {
        keywords?: string[];
        image?: string;
    };
    /** Custom CSS class */
    className?: string;
    /** Parent application ID (optional) */
    application?: string;
    /** Organization tags */
    tags?: string[];
    /** Project this page belongs to */
    project: string;
    /** Account that owns this page */
    account: string;
    /** Creation timestamp */
    created_at: string;
    /** Last update timestamp */
    updated_at: string;
    /** User who created the page */
    created_by?: string;
    /** User who last updated the page */
    updated_by?: string;
}

// ============================================================================
// API Payload Types
// ============================================================================

/**
 * Payload for creating a new fusion application.
 */
export interface CreateFusionApplicationPayload {
    name: string;
    title: string;
    description?: string;
    version?: string;
    icon?: IconSpec;
    navigation: NavigationTemplate;
    routes: RouteSpec[];
    defaultRoute: string;
    theme?: ThemeSpec;
    globalDataSources?: GlobalDataSourceSpec[];
    permissions?: PermissionSpec;
    settingsSchema?: SettingsSchema;
    settings?: Record<string, unknown>;
    tags?: string[];
}

/**
 * Payload for updating a fusion application.
 */
export interface UpdateFusionApplicationPayload {
    name?: string;
    title?: string;
    description?: string;
    version?: string;
    icon?: IconSpec;
    status?: FusionApplicationStatus;
    navigation?: NavigationTemplate;
    routes?: RouteSpec[];
    defaultRoute?: string;
    theme?: ThemeSpec;
    globalDataSources?: GlobalDataSourceSpec[];
    permissions?: PermissionSpec;
    settingsSchema?: SettingsSchema;
    settings?: Record<string, unknown>;
    tags?: string[];
}

/**
 * Payload for creating a new fusion page.
 */
export interface CreateFusionPagePayload {
    name: string;
    title: string;
    description?: string;
    icon?: IconSpec;
    path: string;
    layout: import('./page.js').PageLayoutSpec;
    regions: import('./page.js').PageRegionSpec[];
    dataBindings?: DataBindingSpec[];
    actions?: import('./page.js').ActionSpec[];
    breadcrumbs?: import('./page.js').BreadcrumbSpec[];
    permissions?: PermissionSpec;
    meta?: { keywords?: string[]; image?: string };
    className?: string;
    application?: string;
    tags?: string[];
}

/**
 * Payload for updating a fusion page.
 */
export interface UpdateFusionPagePayload {
    name?: string;
    title?: string;
    description?: string;
    icon?: IconSpec;
    status?: FusionPageStatus;
    path?: string;
    layout?: import('./page.js').PageLayoutSpec;
    regions?: import('./page.js').PageRegionSpec[];
    dataBindings?: DataBindingSpec[];
    actions?: import('./page.js').ActionSpec[];
    breadcrumbs?: import('./page.js').BreadcrumbSpec[];
    permissions?: PermissionSpec;
    meta?: { keywords?: string[]; image?: string };
    className?: string;
    application?: string;
    tags?: string[];
}

/**
 * List item for fusion applications (summary view).
 */
export interface FusionApplicationItem {
    id: string;
    name: string;
    title: string;
    description?: string;
    status: FusionApplicationStatus;
    version?: string;
    icon?: IconSpec;
    routeCount: number;
    pageCount: number;
    tags?: string[];
    created_at: string;
    updated_at: string;
}

/**
 * List item for fusion pages (summary view).
 */
export interface FusionPageItem {
    id: string;
    name: string;
    title: string;
    description?: string;
    status: FusionPageStatus;
    path: string;
    icon?: IconSpec;
    application?: string;
    tags?: string[];
    created_at: string;
    updated_at: string;
}
