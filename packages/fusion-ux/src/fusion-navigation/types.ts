/**
 * Fusion Navigation Component Types
 *
 * Types for the navigation rendering components.
 */

import type {
    NavigationTemplate,
    NavigationSectionSpec,
    NavigationItemSpec,
    NavigationLinkSpec,
    NavigationGroupSpec,
    DynamicNavigationSpec,
} from '@vertesia/common';
import type { ResolutionContext } from '../data-binding/types.js';

/**
 * Props for the main NavigationRenderer component.
 */
export interface NavigationRendererProps {
    /** Navigation template */
    navigation: NavigationTemplate;
    /** Current active path (for highlighting) */
    activePath?: string;
    /** Resolved data for dynamic navigation */
    data?: Record<string, unknown>;
    /** Resolution context */
    context?: ResolutionContext;
    /** Navigation handler */
    onNavigate?: (href: string, newTab?: boolean) => void;
    /** Action handler */
    onAction?: (action: string, config?: Record<string, unknown>) => void;
    /** Custom class name */
    className?: string;
}

/**
 * Props for the SidebarNavigation component.
 */
export interface SidebarNavigationProps {
    /** Sidebar sections */
    sections: NavigationSectionSpec[];
    /** Dynamic sections */
    dynamic?: DynamicNavigationSpec[];
    /** Current active path */
    activePath?: string;
    /** Whether sidebar is collapsed */
    collapsed?: boolean;
    /** Toggle collapse handler */
    onToggleCollapse?: () => void;
    /** Resolved data */
    data?: Record<string, unknown>;
    /** Resolution context */
    context?: ResolutionContext;
    /** Navigation handler */
    onNavigate?: (href: string, newTab?: boolean) => void;
    /** Action handler */
    onAction?: (action: string, config?: Record<string, unknown>) => void;
    /** Custom class name */
    className?: string;
}

/**
 * Props for the TopbarNavigation component.
 */
export interface TopbarNavigationProps {
    /** Topbar items */
    items: NavigationItemSpec[];
    /** Current active path */
    activePath?: string;
    /** Resolved data */
    data?: Record<string, unknown>;
    /** Navigation handler */
    onNavigate?: (href: string, newTab?: boolean) => void;
    /** Action handler */
    onAction?: (action: string, config?: Record<string, unknown>) => void;
    /** Custom class name */
    className?: string;
}

/**
 * Props for the NavigationSection component.
 */
export interface NavigationSectionProps {
    /** Section spec */
    section: NavigationSectionSpec;
    /** Current active path */
    activePath?: string;
    /** Whether parent sidebar is collapsed */
    sidebarCollapsed?: boolean;
    /** Resolved data */
    data?: Record<string, unknown>;
    /** Navigation handler */
    onNavigate?: (href: string, newTab?: boolean) => void;
    /** Action handler */
    onAction?: (action: string, config?: Record<string, unknown>) => void;
    /** Custom class name */
    className?: string;
}

/**
 * Props for the NavigationItem component.
 */
export interface NavigationItemProps {
    /** Item spec */
    item: NavigationItemSpec;
    /** Current active path */
    activePath?: string;
    /** Indentation level */
    level?: number;
    /** Whether parent sidebar is collapsed */
    sidebarCollapsed?: boolean;
    /** Resolved data */
    data?: Record<string, unknown>;
    /** Navigation handler */
    onNavigate?: (href: string, newTab?: boolean) => void;
    /** Action handler */
    onAction?: (action: string, config?: Record<string, unknown>) => void;
    /** Custom class name */
    className?: string;
}

/**
 * Props for the NavigationLink component.
 */
export interface NavigationLinkProps {
    /** Link spec */
    item: NavigationLinkSpec;
    /** Current active path */
    activePath?: string;
    /** Indentation level */
    level?: number;
    /** Whether parent sidebar is collapsed */
    sidebarCollapsed?: boolean;
    /** Resolved data */
    data?: Record<string, unknown>;
    /** Navigation handler */
    onNavigate?: (href: string, newTab?: boolean) => void;
    /** Custom class name */
    className?: string;
}

/**
 * Props for the NavigationGroup component.
 */
export interface NavigationGroupProps {
    /** Group spec */
    item: NavigationGroupSpec;
    /** Current active path */
    activePath?: string;
    /** Indentation level */
    level?: number;
    /** Whether parent sidebar is collapsed */
    sidebarCollapsed?: boolean;
    /** Resolved data */
    data?: Record<string, unknown>;
    /** Navigation handler */
    onNavigate?: (href: string, newTab?: boolean) => void;
    /** Action handler */
    onAction?: (action: string, config?: Record<string, unknown>) => void;
    /** Custom class name */
    className?: string;
}

/**
 * Props for the DynamicNavigation component.
 */
export interface DynamicNavigationProps {
    /** Dynamic navigation spec */
    spec: DynamicNavigationSpec;
    /** Current active path */
    activePath?: string;
    /** Whether parent sidebar is collapsed */
    sidebarCollapsed?: boolean;
    /** Resolution context */
    context?: ResolutionContext;
    /** Navigation handler */
    onNavigate?: (href: string, newTab?: boolean) => void;
    /** Custom class name */
    className?: string;
}

/**
 * Context value for navigation.
 */
export interface NavigationContextValue {
    /** Current active path */
    activePath: string;
    /** Whether sidebar is collapsed */
    sidebarCollapsed: boolean;
    /** Toggle sidebar collapse */
    toggleSidebar: () => void;
    /** Navigation handler */
    navigate: (href: string, newTab?: boolean) => void;
    /** Resolved data for dynamic navigation */
    data: Record<string, unknown>;
}
