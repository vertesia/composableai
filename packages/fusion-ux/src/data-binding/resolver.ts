/**
 * Data Binding Resolver
 *
 * Resolves data bindings by fetching data from various sources
 * and making it available to page content components.
 */

import type { DataBindingSpec, DataSourceType } from '@vertesia/common';
import type {
    DataBindingResolver,
    DataFetchers,
    ResolutionContext,
    ResolvedBinding,
    ResolveOptions,
    PageDataResult,
    ResolverConfig,
} from './types.js';
import { interpolateString, interpolateObject } from './interpolate.js';

/**
 * Default timeout for binding resolution (30 seconds).
 */
const DEFAULT_TIMEOUT = 30000;

/**
 * Create a cache key for a binding.
 */
function createCacheKey(binding: DataBindingSpec, context: ResolutionContext): string {
    const parts = [binding.key, binding.source];

    // Include relevant context in cache key
    if (context.route) {
        parts.push(JSON.stringify(context.route));
    }

    // Include query params in cache key
    const queryConfig = getQueryConfig(binding);
    if (queryConfig) {
        parts.push(JSON.stringify(queryConfig));
    }

    return parts.join(':');
}

/**
 * Get the query configuration from a binding (handles both old and new formats).
 */
function getQueryConfig(binding: DataBindingSpec): unknown {
    switch (binding.source) {
        case 'contentObject':
            return binding.contentObject || binding.query;
        case 'objectQuery':
            return binding.objectQuery || binding.query;
        case 'dataStore':
            return binding.dataStore;
        case 'artifact':
            return binding.artifact;
        case 'api':
            return binding.api || binding.query;
        case 'static':
            return binding.data;
        case 'route':
            return null;
        default:
            return binding.query;
    }
}

/**
 * Resolve a contentObject binding.
 */
async function resolveContentObject(
    binding: DataBindingSpec,
    context: ResolutionContext,
    fetchers: DataFetchers
): Promise<unknown> {
    const config = binding.contentObject || binding.query;
    if (!config?.id) {
        throw new Error('contentObject binding requires id');
    }

    const id = interpolateString(config.id, context as Record<string, unknown>);
    const select = binding.contentObject?.select;

    return fetchers.fetchContentObject(id, { select });
}

/**
 * Resolve an objectQuery binding.
 */
async function resolveObjectQuery(
    binding: DataBindingSpec,
    context: ResolutionContext,
    fetchers: DataFetchers
): Promise<unknown> {
    // Prefer new objectQuery field, fall back to legacy query
    if (binding.objectQuery) {
        const interpolatedConfig = interpolateObject(binding.objectQuery, context as Record<string, unknown>);

        return fetchers.queryObjects({
            filter: interpolatedConfig.filter,
            search: interpolatedConfig.search,
            select: interpolatedConfig.select,
            sort: interpolatedConfig.sort,
            limit: interpolatedConfig.limit,
            offset: interpolatedConfig.offset,
            type: interpolatedConfig.type,
            status: interpolatedConfig.status,
        });
    }

    // Legacy query format
    const config = binding.query;
    if (!config) {
        throw new Error('objectQuery binding requires query configuration');
    }

    const interpolatedConfig = interpolateObject(config, context as Record<string, unknown>);

    return fetchers.queryObjects({
        filter: interpolatedConfig.filter,
        sort: interpolatedConfig.sort,
        limit: interpolatedConfig.limit,
    });
}

/**
 * Resolve a dataStore binding.
 */
async function resolveDataStore(
    binding: DataBindingSpec,
    context: ResolutionContext,
    fetchers: DataFetchers
): Promise<unknown> {
    const config = binding.dataStore;
    if (!config?.storeId || !config?.sql) {
        throw new Error('dataStore binding requires storeId and sql');
    }

    const storeId = interpolateString(config.storeId, context as Record<string, unknown>);
    const sql = interpolateString(config.sql, context as Record<string, unknown>);

    const result = await fetchers.queryDataStore(storeId, sql, {
        limit: config.limit,
        versionId: config.versionId,
    });

    // Return rows array for easier consumption
    return result.rows;
}

/**
 * Resolve an artifact binding.
 */
async function resolveArtifact(
    binding: DataBindingSpec,
    context: ResolutionContext,
    fetchers: DataFetchers
): Promise<unknown> {
    const config = binding.artifact;
    if (!config?.path) {
        throw new Error('artifact binding requires path');
    }

    const path = interpolateString(config.path, context as Record<string, unknown>);
    const runId = config.runId
        ? interpolateString(config.runId, context as Record<string, unknown>)
        : undefined;

    return fetchers.fetchArtifact(path, {
        format: config.format,
        runId,
    });
}

/**
 * Resolve an api binding.
 */
async function resolveApi(
    binding: DataBindingSpec,
    context: ResolutionContext,
    fetchers: DataFetchers
): Promise<unknown> {
    // Prefer new api field, fall back to legacy query
    if (binding.api) {
        const endpoint = interpolateString(binding.api.endpoint, context as Record<string, unknown>);
        const body = binding.api.body
            ? interpolateObject(binding.api.body, context as Record<string, unknown>)
            : undefined;

        return fetchers.fetchApi(endpoint, {
            method: binding.api.method,
            body,
            headers: binding.api.headers,
        });
    }

    // Legacy query format
    const config = binding.query;
    if (!config?.endpoint) {
        throw new Error('api binding requires endpoint');
    }

    const endpoint = interpolateString(config.endpoint, context as Record<string, unknown>);

    return fetchers.fetchApi(endpoint, {
        method: config.method,
    });
}

/**
 * Resolve a static binding.
 */
function resolveStatic(binding: DataBindingSpec): unknown {
    return binding.data;
}

/**
 * Resolve a route binding.
 */
function resolveRoute(context: ResolutionContext): unknown {
    return context.route || {};
}

/**
 * Resolve a collection binding (deprecated, maps to objectQuery).
 */
async function resolveCollection(
    binding: DataBindingSpec,
    context: ResolutionContext,
    fetchers: DataFetchers
): Promise<unknown> {
    // Map old collection format to objectQuery
    const config = binding.query;
    if (!config) {
        throw new Error('collection binding requires query configuration');
    }

    const interpolatedConfig = interpolateObject(config, context as Record<string, unknown>);

    return fetchers.queryObjects({
        filter: interpolatedConfig.filter,
        sort: interpolatedConfig.sort,
        limit: interpolatedConfig.limit,
    });
}

/**
 * Apply a transform function to resolved data.
 */
function applyTransform(
    data: unknown,
    transformName: string,
    context: ResolutionContext,
    transforms: Record<string, (data: unknown, context: ResolutionContext) => unknown>
): unknown {
    const transform = transforms[transformName];
    if (!transform) {
        console.warn(`Transform '${transformName}' not found, returning data unchanged`);
        return data;
    }

    try {
        return transform(data, context);
    } catch (error) {
        console.error(`Transform '${transformName}' failed:`, error);
        throw new Error(`Transform '${transformName}' failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Create a data binding resolver.
 *
 * @param config - Resolver configuration with fetchers and optional cache
 * @returns A data binding resolver instance
 *
 * @example
 * ```ts
 * const resolver = createDataBindingResolver({
 *   fetchers: {
 *     fetchContentObject: (id) => client.objects.retrieve(id),
 *     queryObjects: (query) => client.objects.find(query),
 *     queryDataStore: (storeId, sql) => client.data.query(storeId, { sql }),
 *     fetchArtifact: (path) => client.files.download(path),
 *     fetchApi: (endpoint, opts) => fetch(endpoint, opts).then(r => r.json()),
 *   }
 * });
 *
 * const result = await resolver.resolveAll(page.dataBindings, {
 *   route: { customerId: '123' }
 * });
 * ```
 */
export function createDataBindingResolver(config: ResolverConfig): DataBindingResolver {
    const { fetchers, cache, defaultTimeout = DEFAULT_TIMEOUT } = config;
    const transforms: Record<string, (data: unknown, context: ResolutionContext) => unknown> = {
        ...config.transforms,
    };

    /**
     * Resolve a single binding by source type.
     */
    async function resolveBySource(
        binding: DataBindingSpec,
        context: ResolutionContext
    ): Promise<unknown> {
        const source = binding.source as DataSourceType;

        switch (source) {
            case 'contentObject':
                return resolveContentObject(binding, context, fetchers);
            case 'objectQuery':
                return resolveObjectQuery(binding, context, fetchers);
            case 'dataStore':
                return resolveDataStore(binding, context, fetchers);
            case 'artifact':
                return resolveArtifact(binding, context, fetchers);
            case 'api':
                return resolveApi(binding, context, fetchers);
            case 'static':
                return resolveStatic(binding);
            case 'route':
                return resolveRoute(context);
            case 'collection':
                return resolveCollection(binding, context, fetchers);
            default:
                throw new Error(`Unknown data source type: ${source}`);
        }
    }

    /**
     * Resolve a single data binding.
     */
    async function resolveBinding(
        binding: DataBindingSpec,
        context: ResolutionContext,
        options: ResolveOptions = {}
    ): Promise<ResolvedBinding> {
        const startTime = Date.now();
        const { signal, timeout = defaultTimeout, useCache = true } = options;

        // Check cache first
        if (cache && useCache && binding.source !== 'static' && binding.source !== 'route') {
            const cacheKey = createCacheKey(binding, context);
            const cached = await cache.get(cacheKey);
            if (cached) {
                return {
                    key: binding.key,
                    data: cached.data,
                    success: true,
                    duration: Date.now() - startTime,
                    stale: true,
                };
            }
        }

        try {
            // Create timeout promise
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout);
            });

            // Create abort handler
            const abortPromise = signal
                ? new Promise<never>((_, reject) => {
                      signal.addEventListener('abort', () => reject(new Error('Aborted')));
                  })
                : null;

            // Race resolution against timeout and abort
            const promises: Promise<unknown>[] = [
                resolveBySource(binding, context),
                timeoutPromise,
            ];
            if (abortPromise) {
                promises.push(abortPromise);
            }

            let data = await Promise.race(promises);

            // Apply transform if specified
            if (binding.transform && data !== null && data !== undefined) {
                data = applyTransform(data, binding.transform, context, transforms);
            }

            // Cache the result
            if (cache && binding.source !== 'static' && binding.source !== 'route') {
                const cacheKey = createCacheKey(binding, context);
                await cache.set(cacheKey, data, options.cacheTtl);
            }

            return {
                key: binding.key,
                data,
                success: true,
                duration: Date.now() - startTime,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            // Handle error based on onError setting
            const onError = binding.onError || 'throw';

            if (onError === 'null') {
                return {
                    key: binding.key,
                    data: null,
                    success: false,
                    error: errorMessage,
                    duration: Date.now() - startTime,
                };
            }

            if (onError === 'empty') {
                // Return empty value based on expected type
                const emptyValue = binding.source === 'objectQuery' || binding.source === 'dataStore'
                    ? []
                    : null;

                return {
                    key: binding.key,
                    data: emptyValue,
                    success: false,
                    error: errorMessage,
                    duration: Date.now() - startTime,
                };
            }

            // Default: throw
            return {
                key: binding.key,
                data: null,
                success: false,
                error: errorMessage,
                duration: Date.now() - startTime,
            };
        }
    }

    /**
     * Resolve all data bindings for a page.
     */
    async function resolveAll(
        bindings: DataBindingSpec[],
        context: ResolutionContext,
        options: ResolveOptions = {}
    ): Promise<PageDataResult> {
        const startTime = Date.now();
        const { parallel = true } = options;

        // Build context that includes resolved bindings
        const resolvedContext: ResolutionContext = { ...context, resolved: {} };
        const results: Record<string, ResolvedBinding> = {};
        const data: Record<string, unknown> = {};
        const errors: Array<{ key: string; error: string }> = [];

        if (parallel) {
            // Resolve all bindings in parallel
            const promises = bindings.map((binding) =>
                resolveBinding(binding, resolvedContext, options)
            );
            const resolved = await Promise.all(promises);

            for (const result of resolved) {
                results[result.key] = result;
                data[result.key] = result.data;
                if (!result.success && result.error) {
                    errors.push({ key: result.key, error: result.error });
                }
            }
        } else {
            // Resolve bindings sequentially (allows chaining)
            for (const binding of bindings) {
                const result = await resolveBinding(binding, resolvedContext, options);
                results[result.key] = result;
                data[result.key] = result.data;

                // Update context with resolved data for chaining
                if (resolvedContext.resolved) {
                    resolvedContext.resolved[result.key] = result.data;
                }

                if (!result.success && result.error) {
                    errors.push({ key: result.key, error: result.error });
                }
            }
        }

        return {
            data,
            bindings: results,
            success: errors.length === 0,
            duration: Date.now() - startTime,
            errors,
        };
    }

    /**
     * Invalidate cached data for a binding.
     */
    async function invalidate(key: string): Promise<void> {
        if (cache) {
            await cache.invalidatePattern(`${key}:*`);
        }
    }

    /**
     * Register a custom transform function.
     */
    function registerTransform(
        name: string,
        fn: (data: unknown, context: ResolutionContext) => unknown
    ): void {
        transforms[name] = fn;
    }

    return {
        resolveBinding,
        resolveAll,
        invalidate,
        registerTransform,
    };
}

/**
 * Built-in transform functions.
 */
export const builtInTransforms: Record<string, (data: unknown, context: ResolutionContext) => unknown> = {
    /**
     * Extract a single property from an object.
     * Usage: transform: 'pick:propertyName'
     */
    pick: (data, _context) => {
        // Transform name includes the property: 'pick:propertyName'
        // This is a simple version - actual implementation would parse the transform name
        return data;
    },

    /**
     * Flatten nested arrays.
     */
    flatten: (data) => {
        if (Array.isArray(data)) {
            return data.flat();
        }
        return data;
    },

    /**
     * Get first item from array.
     */
    first: (data) => {
        if (Array.isArray(data)) {
            return data[0] ?? null;
        }
        return data;
    },

    /**
     * Get last item from array.
     */
    last: (data) => {
        if (Array.isArray(data)) {
            return data[data.length - 1] ?? null;
        }
        return data;
    },

    /**
     * Count items in array.
     */
    count: (data) => {
        if (Array.isArray(data)) {
            return data.length;
        }
        return 0;
    },

    /**
     * Extract properties from content objects.
     */
    extractProperties: (data) => {
        if (Array.isArray(data)) {
            return data.map((item) => {
                if (item && typeof item === 'object' && 'properties' in item) {
                    return (item as { properties: unknown }).properties;
                }
                return item;
            });
        }
        if (data && typeof data === 'object' && 'properties' in data) {
            return (data as { properties: unknown }).properties;
        }
        return data;
    },
};
