/**
 * Fusion Page Component Types
 *
 * Types for the page rendering components.
 */

import type { ReactNode } from 'react';
import type {
    FusionPage,
    PageLayoutSpec,
    PageRegionSpec,
    PageContentSpec,
    ActionSpec,
    BreadcrumbSpec,
    IconSpec,
} from '@vertesia/common';
import type { ResolutionContext } from '../data-binding/types.js';

/**
 * Props for the main FusionPageRenderer component.
 */
export interface FusionPageRendererProps {
    /** Page definition */
    page: FusionPage;
    /** Pre-resolved data (if not using usePageData internally) */
    data?: Record<string, unknown>;
    /** Resolution context (route params, settings, user) */
    context?: ResolutionContext;
    /** Whether to load data internally (default: true if data not provided) */
    autoLoadData?: boolean;
    /** Loading component to show while data loads */
    loadingComponent?: ReactNode;
    /** Error component to show on data load failure */
    errorComponent?: (error: string) => ReactNode;
    /** Custom class name for the page wrapper */
    className?: string;
    /** Callback when an action is triggered */
    onAction?: (action: ActionSpec, data?: Record<string, unknown>) => void;
    /** Callback when a field value is updated */
    onUpdate?: (key: string, value: unknown) => void;
    /** Callback when navigation is requested */
    onNavigate?: (href: string, newTab?: boolean) => void;
}

/**
 * Props for the PageLayoutRenderer component.
 */
export interface PageLayoutRendererProps {
    /** Layout specification */
    layout: PageLayoutSpec;
    /** Regions to render within the layout */
    regions: PageRegionSpec[];
    /** Resolved data for content */
    data: Record<string, unknown>;
    /** Resolution context */
    context: ResolutionContext;
    /** Custom class name */
    className?: string;
    /** Action handler */
    onAction?: (action: ActionSpec, data?: Record<string, unknown>) => void;
    /** Update handler */
    onUpdate?: (key: string, value: unknown) => void;
    /** Navigation handler */
    onNavigate?: (href: string, newTab?: boolean) => void;
}

/**
 * Props for the RegionRenderer component.
 */
export interface RegionRendererProps {
    /** Region specification */
    region: PageRegionSpec;
    /** Resolved data for content */
    data: Record<string, unknown>;
    /** Resolution context */
    context: ResolutionContext;
    /** Custom class name */
    className?: string;
    /** Action handler */
    onAction?: (action: ActionSpec, data?: Record<string, unknown>) => void;
    /** Update handler */
    onUpdate?: (key: string, value: unknown) => void;
    /** Navigation handler */
    onNavigate?: (href: string, newTab?: boolean) => void;
}

/**
 * Props for the ContentRenderer component.
 */
export interface ContentRendererProps {
    /** Content specification */
    content: PageContentSpec;
    /** Resolved data for content */
    data: Record<string, unknown>;
    /** Resolution context */
    context: ResolutionContext;
    /** Custom class name */
    className?: string;
    /** Action handler */
    onAction?: (action: ActionSpec, data?: Record<string, unknown>) => void;
    /** Update handler */
    onUpdate?: (key: string, value: unknown) => void;
    /** Navigation handler */
    onNavigate?: (href: string, newTab?: boolean) => void;
}

/**
 * Props for the ActionButton component.
 */
export interface ActionButtonProps {
    /** Action specification */
    action: ActionSpec;
    /** Current data context */
    data?: Record<string, unknown>;
    /** Resolution context */
    context: ResolutionContext;
    /** Whether the action is currently executing */
    loading?: boolean;
    /** Custom class name */
    className?: string;
    /** Click handler */
    onClick?: (action: ActionSpec, data?: Record<string, unknown>) => void;
}

/**
 * Props for the BreadcrumbsRenderer component.
 */
export interface BreadcrumbsRendererProps {
    /** Breadcrumb items */
    breadcrumbs: BreadcrumbSpec[];
    /** Resolved data for dynamic labels */
    data: Record<string, unknown>;
    /** Navigation handler */
    onNavigate?: (href: string) => void;
    /** Custom class name */
    className?: string;
}

/**
 * Props for the PageHeader component.
 */
export interface PageHeaderProps {
    /** Page title */
    title: string;
    /** Page description */
    description?: string;
    /** Page icon */
    icon?: IconSpec;
    /** Header actions */
    actions?: ActionSpec[];
    /** Breadcrumbs */
    breadcrumbs?: BreadcrumbSpec[];
    /** Resolved data */
    data: Record<string, unknown>;
    /** Resolution context */
    context: ResolutionContext;
    /** Action handler */
    onAction?: (action: ActionSpec, data?: Record<string, unknown>) => void;
    /** Navigation handler */
    onNavigate?: (href: string, newTab?: boolean) => void;
    /** Custom class name */
    className?: string;
}

/**
 * Registry for custom content renderers.
 * Allows extending the built-in content types with custom components.
 */
export interface ContentRendererRegistry {
    /** Get a renderer for a content type */
    get: (type: string) => React.ComponentType<ContentRendererProps> | undefined;
    /** Register a custom renderer */
    register: (type: string, renderer: React.ComponentType<ContentRendererProps>) => void;
}

/**
 * Context value for fusion page rendering.
 */
export interface FusionPageContextValue {
    /** Resolved data */
    data: Record<string, unknown>;
    /** Resolution context */
    context: ResolutionContext;
    /** Action handler */
    onAction?: (action: ActionSpec, data?: Record<string, unknown>) => void;
    /** Update handler */
    onUpdate?: (key: string, value: unknown) => void;
    /** Navigation handler */
    onNavigate?: (href: string, newTab?: boolean) => void;
    /** Content renderer registry */
    renderers?: ContentRendererRegistry;
}
