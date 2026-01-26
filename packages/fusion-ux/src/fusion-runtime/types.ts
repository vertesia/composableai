/**
 * Fusion Runtime Types
 *
 * Configuration and types for the fusion application runtime.
 */

import type {
    FusionApplication,
    FusionPage,
    DataBindingSpec,
} from '@vertesia/common';
import type { DataBindingResolver, DataFetchers, ResolverConfig } from '../data-binding/types.js';

/**
 * Fetch function signature for server-side data fetching.
 */
export type FetchFunction = typeof fetch;

/**
 * Runtime configuration for fusion applications.
 */
export interface FusionRuntimeConfig {
    /** Base URL for API requests */
    apiBaseUrl?: string;
    /** Authentication token or getter */
    auth?: string | (() => string | Promise<string>);
    /** Custom fetch implementation */
    fetch?: FetchFunction;
    /** Data fetchers for resolving bindings */
    dataFetchers?: DataFetchers;
    /** Resolver configuration */
    resolverConfig?: Partial<ResolverConfig>;
    /** Enable debug mode */
    debug?: boolean;
    /** Custom error handler */
    onError?: (error: Error, context?: string) => void;
    /** Analytics event handler */
    onAnalyticsEvent?: (event: AnalyticsEvent) => void;
    /** Page loader function */
    loadPage?: (pageId: string) => Promise<FusionPage>;
    /** Application loader function */
    loadApplication?: (appId: string) => Promise<FusionApplication>;
}

/**
 * Analytics event types.
 */
export type AnalyticsEventType =
    | 'page_view'
    | 'navigation'
    | 'action'
    | 'error'
    | 'data_load'
    | 'custom';

/**
 * Analytics event data.
 */
export interface AnalyticsEvent {
    /** Event type */
    type: AnalyticsEventType;
    /** Event name */
    name: string;
    /** Event properties */
    properties?: Record<string, unknown>;
    /** Timestamp */
    timestamp: number;
    /** Page path */
    path?: string;
    /** User ID */
    userId?: string;
    /** Session ID */
    sessionId?: string;
}

/**
 * Runtime state.
 */
export interface FusionRuntimeState {
    /** Initialized flag */
    initialized: boolean;
    /** Current application */
    application: FusionApplication | null;
    /** Current page */
    currentPage: FusionPage | null;
    /** Current path */
    currentPath: string;
    /** Global data cache */
    globalData: Record<string, unknown>;
    /** User context */
    user: { id: string; roles?: string[]; permissions?: string[] } | null;
    /** Session ID */
    sessionId: string;
}

/**
 * Server-side render result.
 */
export interface SSRResult {
    /** Rendered HTML content */
    html: string;
    /** Initial data for hydration */
    initialData: Record<string, unknown>;
    /** Head elements (meta, title, etc.) */
    head: SSRHeadElements;
    /** Page status code */
    statusCode: number;
    /** Redirect URL if applicable */
    redirectUrl?: string;
}

/**
 * Head elements for SSR.
 */
export interface SSRHeadElements {
    /** Page title */
    title?: string;
    /** Meta tags */
    meta?: Array<{ name?: string; property?: string; content: string }>;
    /** Link tags */
    links?: Array<{ rel: string; href: string; [key: string]: string }>;
    /** Script tags */
    scripts?: Array<{ src?: string; content?: string; async?: boolean; defer?: boolean }>;
    /** Style tags */
    styles?: Array<{ content: string }>;
}

/**
 * SSR context for server-side rendering.
 */
export interface SSRContext {
    /** Request URL */
    url: string;
    /** Request headers */
    headers?: Record<string, string>;
    /** Cookies */
    cookies?: Record<string, string>;
    /** User agent */
    userAgent?: string;
    /** Is bot/crawler */
    isBot?: boolean;
}

/**
 * Hydration data passed from server to client.
 */
export interface HydrationData {
    /** Application definition */
    application: FusionApplication;
    /** Current page */
    currentPage?: FusionPage;
    /** Preloaded data */
    preloadedData: Record<string, unknown>;
    /** Initial path */
    initialPath: string;
    /** User context */
    user?: { id: string; roles?: string[]; permissions?: string[] };
}

/**
 * Runtime context value.
 */
export interface FusionRuntimeContextValue {
    /** Runtime state */
    state: FusionRuntimeState;
    /** Data binding resolver */
    resolver: DataBindingResolver | null;
    /** Configuration */
    config: FusionRuntimeConfig;
    /** Navigate to path */
    navigate: (path: string, replace?: boolean) => void;
    /** Trigger action */
    triggerAction: (action: string, config?: Record<string, unknown>) => void;
    /** Track analytics event */
    trackEvent: (event: Omit<AnalyticsEvent, 'timestamp' | 'sessionId'>) => void;
    /** Refresh data */
    refreshData: (key?: string) => Promise<void>;
    /** Set user context */
    setUser: (user: FusionRuntimeState['user']) => void;
}

/**
 * Prefetch options for data loading.
 */
export interface PrefetchOptions {
    /** Data bindings to prefetch */
    bindings: DataBindingSpec[];
    /** Context for resolution */
    context: Record<string, unknown>;
    /** Timeout in milliseconds */
    timeout?: number;
}

/**
 * Route prefetch result.
 */
export interface PrefetchResult {
    /** Success flag */
    success: boolean;
    /** Prefetched data */
    data: Record<string, unknown>;
    /** Errors if any */
    errors?: Array<{ key: string; error: string }>;
}
