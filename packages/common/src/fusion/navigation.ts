/**
 * Fusion Navigation Types
 *
 * Types for application navigation structure - sidebar, topbar, and dynamic menus.
 */

import type { BadgeSpec, ConditionalSpec, IconSpec } from './common.js';
import type { DataBindingSpec, PermissionSpec } from './page.js';

// ============================================================================
// Navigation Item Types
// ============================================================================

/**
 * Base navigation item specification.
 */
export interface BaseNavigationItemSpec {
    /** Unique identifier */
    id: string;
    /** Display label */
    label: string;
    /** Item icon */
    icon?: IconSpec;
    /** Badge indicator */
    badge?: BadgeSpec;
    /** Visibility condition */
    showIf?: ConditionalSpec;
    /** Required permissions */
    permissions?: PermissionSpec;
    /** Whether this item is disabled */
    disabled?: boolean;
    /** Tooltip text */
    tooltip?: string;
}

/**
 * Navigation link item.
 */
export interface NavigationLinkSpec extends BaseNavigationItemSpec {
    type: 'link';
    /** Navigation path (internal) or URL (external) */
    href: string;
    /** Whether this is an external link */
    external?: boolean;
    /** Target for external links */
    target?: '_blank' | '_self';
    /** Route match pattern for active state (defaults to href) */
    activeMatch?: string;
    /** Whether to match exactly or as prefix */
    activeMatchExact?: boolean;
}

/**
 * Navigation group with children.
 */
export interface NavigationGroupSpec extends BaseNavigationItemSpec {
    type: 'group';
    /** Child navigation items */
    children: NavigationItemSpec[];
    /** Whether the group is initially expanded */
    defaultExpanded?: boolean;
    /** Whether to allow multiple expanded groups */
    collapsible?: boolean;
}

/**
 * Navigation divider/separator.
 */
export interface NavigationDividerSpec {
    type: 'divider';
    /** Optional label for the divider */
    label?: string;
}

/**
 * Navigation action (button that triggers an action).
 */
export interface NavigationActionSpec extends BaseNavigationItemSpec {
    type: 'action';
    /** Action type */
    action: 'modal' | 'agent' | 'custom';
    /** Action configuration */
    config?: {
        /** Modal title (for modal action) */
        modalTitle?: string;
        /** Modal content type (for modal action) */
        modalContent?: string;
        /** Agent message (for agent action) */
        message?: string;
        /** Custom handler name (for custom action) */
        handler?: string;
        /** Custom handler params (for custom action) */
        params?: Record<string, unknown>;
    };
}

/**
 * Union of all navigation item types.
 */
export type NavigationItemSpec =
    | NavigationLinkSpec
    | NavigationGroupSpec
    | NavigationDividerSpec
    | NavigationActionSpec;

// ============================================================================
// Navigation Section Types
// ============================================================================

/**
 * Section within a sidebar navigation.
 */
export interface NavigationSectionSpec {
    /** Section identifier */
    id: string;
    /** Section title (optional header) */
    title?: string;
    /** Items in this section */
    items: NavigationItemSpec[];
    /** Visibility condition */
    showIf?: ConditionalSpec;
    /** Required permissions */
    permissions?: PermissionSpec;
    /** Whether section is initially collapsed */
    collapsed?: boolean;
}

// ============================================================================
// Dynamic Navigation Types
// ============================================================================

/**
 * Dynamic navigation - items generated from data.
 */
export interface DynamicNavigationSpec {
    /** Unique identifier */
    id: string;
    /** Section title */
    title?: string;
    /** Data binding for items */
    dataBinding: DataBindingSpec;
    /** Template for generating items from data */
    itemTemplate: {
        /** Key for item ID */
        idKey: string;
        /** Key for item label */
        labelKey: string;
        /** Key for item icon (optional) */
        iconKey?: string;
        /** Href template (supports {{key}} interpolation) */
        hrefTemplate: string;
        /** Key for badge value (optional) */
        badgeKey?: string;
    };
    /** Maximum items to show */
    maxItems?: number;
    /** Empty state message */
    emptyMessage?: string;
    /** "View all" link */
    viewAllHref?: string;
    /** Visibility condition */
    showIf?: ConditionalSpec;
}

// ============================================================================
// Navigation Template
// ============================================================================

/**
 * Complete navigation template for an application.
 */
export interface NavigationTemplate {
    /** Sidebar navigation sections */
    sidebar?: NavigationSectionSpec[];
    /** Top bar navigation items */
    topbar?: NavigationItemSpec[];
    /** Dynamic navigation sections */
    dynamic?: DynamicNavigationSpec[];
    /** Footer navigation items */
    footer?: NavigationItemSpec[];
    /** Navigation settings */
    settings?: {
        /** Sidebar default state */
        sidebarDefaultCollapsed?: boolean;
        /** Sidebar collapse breakpoint */
        sidebarCollapseBreakpoint?: 'sm' | 'md' | 'lg' | 'xl';
        /** Whether to show breadcrumbs from navigation */
        showBreadcrumbs?: boolean;
        /** Whether to highlight active items */
        highlightActive?: boolean;
    };
}
