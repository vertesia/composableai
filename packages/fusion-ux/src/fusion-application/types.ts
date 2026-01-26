/**
 * Fusion Application Component Types
 *
 * Types for the application runtime components.
 */

import type {
    FusionApplication,
    FusionPage,
    RouteSpec,
    ThemeSpec,
} from '@vertesia/common';
import type { DataBindingResolver, ResolutionContext } from '../data-binding/types.js';

/**
 * Matched route result.
 */
export interface MatchedRoute {
    /** The matched route spec */
    route: RouteSpec;
    /** Extracted route parameters */
    params: Record<string, string>;
    /** The resolved page (if pageId was used) */
    page?: FusionPage;
}

/**
 * Props for the main FusionApplicationRenderer component.
 */
export interface FusionApplicationRendererProps {
    /** Application definition */
    application: FusionApplication;
    /** Current URL path */
    currentPath: string;
    /** Page loader function (for pageId routes) */
    loadPage?: (pageId: string) => Promise<FusionPage>;
    /** Data binding resolver */
    resolver?: DataBindingResolver;
    /** User context (for permissions) */
    user?: {
        id: string;
        roles?: string[];
        permissions?: string[];
    };
    /** Application settings override */
    settings?: Record<string, unknown>;
    /** Navigation handler */
    onNavigate?: (href: string, newTab?: boolean) => void;
    /** Action handler */
    onAction?: (action: string, config?: Record<string, unknown>) => void;
    /** Error handler */
    onError?: (error: Error) => void;
    /** Loading component */
    loadingComponent?: React.ReactNode;
    /** Error component */
    errorComponent?: (error: string) => React.ReactNode;
    /** Not found component */
    notFoundComponent?: React.ReactNode;
    /** Custom class name */
    className?: string;
}

/**
 * Props for the ApplicationShell component.
 */
export interface ApplicationShellProps {
    /** Application definition */
    application: FusionApplication;
    /** Current path for navigation highlighting */
    currentPath: string;
    /** Global data for navigation */
    globalData: Record<string, unknown>;
    /** Resolution context */
    context: ResolutionContext;
    /** Whether sidebar is collapsed */
    sidebarCollapsed?: boolean;
    /** Toggle sidebar collapse */
    onToggleSidebar?: () => void;
    /** Navigation handler */
    onNavigate?: (href: string, newTab?: boolean) => void;
    /** Action handler */
    onAction?: (action: string, config?: Record<string, unknown>) => void;
    /** Content to render in the main area */
    children: React.ReactNode;
    /** Custom class name */
    className?: string;
}

/**
 * Props for the ApplicationRouter component.
 */
export interface ApplicationRouterProps {
    /** Routes to match against */
    routes: RouteSpec[];
    /** Current URL path */
    currentPath: string;
    /** Default route path */
    defaultRoute: string;
    /** Page loader function */
    loadPage?: (pageId: string) => Promise<FusionPage>;
    /** Global data available to all pages */
    globalData: Record<string, unknown>;
    /** Resolution context */
    context: ResolutionContext;
    /** Navigation handler */
    onNavigate?: (href: string, newTab?: boolean) => void;
    /** Action handler */
    onAction?: (action: string, config?: Record<string, unknown>) => void;
    /** Loading component */
    loadingComponent?: React.ReactNode;
    /** Error component */
    errorComponent?: (error: string) => React.ReactNode;
    /** Not found component */
    notFoundComponent?: React.ReactNode;
}

/**
 * Context value for the application.
 */
export interface ApplicationContextValue {
    /** Application definition */
    application: FusionApplication;
    /** Current matched route */
    currentRoute: MatchedRoute | null;
    /** Current page */
    currentPage: FusionPage | null;
    /** Global data from data sources */
    globalData: Record<string, unknown>;
    /** Application settings */
    settings: Record<string, unknown>;
    /** User context */
    user: { id: string; roles?: string[]; permissions?: string[] } | null;
    /** Resolution context */
    context: ResolutionContext;
    /** Whether sidebar is collapsed */
    sidebarCollapsed: boolean;
    /** Toggle sidebar */
    toggleSidebar: () => void;
    /** Navigate to a path */
    navigate: (href: string, newTab?: boolean) => void;
    /** Trigger an action */
    triggerAction: (action: string, config?: Record<string, unknown>) => void;
    /** Refresh global data */
    refreshGlobalData: () => Promise<void>;
}

/**
 * Props for the ThemeProvider component.
 */
export interface ThemeProviderProps {
    /** Theme specification */
    theme?: ThemeSpec;
    /** Children to render */
    children: React.ReactNode;
}

/**
 * Route matching utilities.
 */
export interface RouteUtils {
    /** Match a path against routes */
    matchRoute: (path: string, routes: RouteSpec[]) => MatchedRoute | null;
    /** Build a path from a route pattern and params */
    buildPath: (pattern: string, params: Record<string, string>) => string;
    /** Parse route parameters from a path */
    parseParams: (pattern: string, path: string) => Record<string, string> | null;
}
