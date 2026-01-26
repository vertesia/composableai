/**
 * Data Binding Resolver Types
 *
 * Types for the data binding resolution system.
 */

import type { DataBindingSpec } from '@vertesia/common';

/**
 * Result of resolving a single data binding.
 */
export interface ResolvedBinding<T = unknown> {
    /** The binding key */
    key: string;
    /** Resolved data (null if error with onError: 'null') */
    data: T | null;
    /** Whether the resolution was successful */
    success: boolean;
    /** Error message if resolution failed */
    error?: string;
    /** Time taken to resolve in milliseconds */
    duration?: number;
    /** Whether the data is stale (from cache) */
    stale?: boolean;
}

/**
 * Context available during data binding resolution.
 * Contains route params, previously resolved bindings, settings, etc.
 */
export interface ResolutionContext {
    /** Route parameters (e.g., { customerId: '123' } from /customers/:customerId) */
    route?: Record<string, string>;
    /** Application settings */
    settings?: Record<string, unknown>;
    /** User information */
    user?: {
        id?: string;
        roles?: string[];
        permissions?: string[];
        [key: string]: unknown;
    };
    /** Previously resolved bindings (for chained resolution) */
    resolved?: Record<string, unknown>;
    /** Custom context values */
    [key: string]: unknown;
}

/**
 * Result of resolving all data bindings for a page.
 */
export interface PageDataResult {
    /** All resolved data keyed by binding key */
    data: Record<string, unknown>;
    /** Resolution results for each binding */
    bindings: Record<string, ResolvedBinding>;
    /** Whether all bindings resolved successfully */
    success: boolean;
    /** Total resolution time in milliseconds */
    duration: number;
    /** Errors from failed bindings */
    errors: Array<{ key: string; error: string }>;
}

/**
 * Options for data binding resolution.
 */
export interface ResolveOptions {
    /** Abort signal for cancellation */
    signal?: AbortSignal;
    /** Whether to resolve bindings in parallel (default: true) */
    parallel?: boolean;
    /** Timeout in milliseconds per binding (default: 30000) */
    timeout?: number;
    /** Whether to use cached data if available */
    useCache?: boolean;
    /** Cache TTL in seconds */
    cacheTtl?: number;
}

/**
 * Data fetcher functions that the resolver uses.
 * This abstraction allows the resolver to work without direct client dependency.
 */
export interface DataFetchers {
    /**
     * Fetch a single content object by ID.
     */
    fetchContentObject: (
        id: string,
        options?: { select?: string[] }
    ) => Promise<Record<string, unknown>>;

    /**
     * Query multiple content objects.
     */
    queryObjects: (query: {
        filter?: Record<string, unknown>;
        search?: string;
        select?: string[];
        sort?: { field: string; direction: 'asc' | 'desc' };
        limit?: number;
        offset?: number;
        type?: string;
        status?: string;
    }) => Promise<Record<string, unknown>[]>;

    /**
     * Execute a SQL query against a data store.
     */
    queryDataStore: (
        storeId: string,
        sql: string,
        options?: { limit?: number; versionId?: string }
    ) => Promise<{ rows: Record<string, unknown>[]; columns: string[] }>;

    /**
     * Fetch an artifact file.
     */
    fetchArtifact: (
        path: string,
        options?: { format?: 'json' | 'text' | 'csv' | 'binary'; runId?: string }
    ) => Promise<unknown>;

    /**
     * Make an API request.
     */
    fetchApi: (
        endpoint: string,
        options?: {
            method?: 'GET' | 'POST';
            body?: Record<string, unknown>;
            headers?: Record<string, string>;
        }
    ) => Promise<unknown>;
}

/**
 * Cache interface for storing resolved data.
 */
export interface DataCache {
    /** Get cached data */
    get: (key: string) => Promise<{ data: unknown; timestamp: number } | null>;
    /** Set cached data */
    set: (key: string, data: unknown, ttl?: number) => Promise<void>;
    /** Invalidate cached data */
    invalidate: (key: string) => Promise<void>;
    /** Invalidate all cached data matching a pattern */
    invalidatePattern: (pattern: string) => Promise<void>;
}

/**
 * Configuration for creating a data binding resolver.
 */
export interface ResolverConfig {
    /** Data fetcher implementations */
    fetchers: DataFetchers;
    /** Optional cache implementation */
    cache?: DataCache;
    /** Default timeout in milliseconds */
    defaultTimeout?: number;
    /** Transform functions by name */
    transforms?: Record<string, (data: unknown, context: ResolutionContext) => unknown>;
}

/**
 * A data binding resolver instance.
 */
export interface DataBindingResolver {
    /**
     * Resolve a single data binding.
     */
    resolveBinding: (
        binding: DataBindingSpec,
        context: ResolutionContext,
        options?: ResolveOptions
    ) => Promise<ResolvedBinding>;

    /**
     * Resolve all data bindings for a page.
     */
    resolveAll: (
        bindings: DataBindingSpec[],
        context: ResolutionContext,
        options?: ResolveOptions
    ) => Promise<PageDataResult>;

    /**
     * Invalidate cached data for a binding.
     */
    invalidate: (key: string) => Promise<void>;

    /**
     * Register a custom transform function.
     */
    registerTransform: (name: string, fn: (data: unknown, context: ResolutionContext) => unknown) => void;
}
