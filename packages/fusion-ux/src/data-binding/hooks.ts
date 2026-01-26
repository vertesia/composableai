/**
 * React Hooks for Data Binding
 *
 * Hooks for using data bindings in React components.
 */

import { useState, useEffect, useCallback, useRef, useMemo, createContext, useContext } from 'react';
import type { DataBindingSpec } from '@vertesia/common';
import type {
    DataBindingResolver,
    ResolutionContext,
    PageDataResult,
    ResolveOptions,
} from './types.js';

/**
 * Context for providing a data binding resolver to components.
 */
export const DataBindingResolverContext = createContext<DataBindingResolver | null>(null);

/**
 * Hook to get the data binding resolver from context.
 */
export function useDataBindingResolver(): DataBindingResolver {
    const resolver = useContext(DataBindingResolverContext);
    if (!resolver) {
        throw new Error('useDataBindingResolver must be used within a DataBindingResolverProvider');
    }
    return resolver;
}

/**
 * State for page data loading.
 */
export interface PageDataState {
    /** Resolved data keyed by binding key */
    data: Record<string, unknown>;
    /** Whether data is currently loading */
    loading: boolean;
    /** Error message if loading failed */
    error: string | null;
    /** Full resolution result */
    result: PageDataResult | null;
    /** Refetch all data */
    refetch: () => Promise<void>;
    /** Invalidate a specific binding */
    invalidate: (key: string) => Promise<void>;
}

/**
 * Options for usePageData hook.
 */
export interface UsePageDataOptions extends ResolveOptions {
    /** Whether to fetch data immediately (default: true) */
    immediate?: boolean;
    /** Whether data fetching is enabled (default: true) */
    enabled?: boolean;
    /** Dependencies that trigger refetch when changed */
    deps?: unknown[];
}

/**
 * Hook for loading page data from bindings.
 *
 * @param bindings - Data binding specifications
 * @param context - Resolution context (route params, settings, etc.)
 * @param options - Loading options
 * @returns Page data state with data, loading, error, and refetch
 *
 * @example
 * ```tsx
 * function CustomerPage({ customerId }: { customerId: string }) {
 *   const { data, loading, error } = usePageData(
 *     page.dataBindings,
 *     { route: { customerId } }
 *   );
 *
 *   if (loading) return <Spinner />;
 *   if (error) return <Error message={error} />;
 *
 *   return (
 *     <div>
 *       <CustomerHeader customer={data.customer} />
 *       <OrdersTable orders={data.orders} />
 *     </div>
 *   );
 * }
 * ```
 */
export function usePageData(
    bindings: DataBindingSpec[] | undefined,
    context: ResolutionContext,
    options: UsePageDataOptions = {}
): PageDataState {
    const resolver = useDataBindingResolver();
    const { immediate = true, enabled = true, deps = [], ...resolveOptions } = options;

    const [data, setData] = useState<Record<string, unknown>>({});
    const [loading, setLoading] = useState(immediate && enabled && !!bindings?.length);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<PageDataResult | null>(null);

    // Track abort controller for cleanup
    const abortControllerRef = useRef<AbortController | null>(null);

    // Use ref for resolveOptions to prevent unnecessary refetches
    const resolveOptionsRef = useRef(resolveOptions);
    resolveOptionsRef.current = resolveOptions;

    // Memoize context to prevent unnecessary refetches
    const contextKey = useMemo(() => JSON.stringify(context), [context]);

    // Memoize bindings key to detect actual changes
    const bindingsKey = useMemo(() => JSON.stringify(bindings), [bindings]);

    const refetch = useCallback(async () => {
        if (!bindings?.length) {
            setData({});
            setLoading(false);
            setError(null);
            setResult(null);
            return;
        }

        // Abort previous request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        setLoading(true);
        setError(null);

        try {
            const pageResult = await resolver.resolveAll(bindings, context, {
                ...resolveOptionsRef.current,
                signal: abortController.signal,
            });

            // Check if request was aborted
            if (abortController.signal.aborted) {
                return;
            }

            setData(pageResult.data);
            setResult(pageResult);

            if (!pageResult.success && pageResult.errors.length > 0) {
                // Set error but still provide partial data
                setError(pageResult.errors.map((e) => `${e.key}: ${e.error}`).join('; '));
            }
        } catch (err) {
            if (err instanceof Error && err.message === 'Aborted') {
                return;
            }
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            if (!abortController.signal.aborted) {
                setLoading(false);
            }
        }
    }, [bindingsKey, contextKey, resolver, bindings, context]);

    const invalidate = useCallback(
        async (key: string) => {
            await resolver.invalidate(key);
            await refetch();
        },
        [resolver, refetch]
    );

    // Initial fetch and refetch on dependency changes
    useEffect(() => {
        if (immediate && enabled) {
            refetch();
        }

        return () => {
            // Cleanup: abort pending request
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [immediate, enabled, refetch, ...deps]);

    return {
        data,
        loading,
        error,
        result,
        refetch,
        invalidate,
    };
}

/**
 * Hook for loading a single data binding.
 *
 * @param binding - Data binding specification
 * @param context - Resolution context
 * @param options - Loading options
 * @returns Single binding state
 *
 * @example
 * ```tsx
 * function CustomerCard({ customerId }: { customerId: string }) {
 *   const { data: customer, loading } = useBinding(
 *     { key: 'customer', source: 'contentObject', contentObject: { id: customerId } },
 *     {}
 *   );
 *
 *   if (loading) return <Spinner />;
 *   return <Card title={customer?.name} />;
 * }
 * ```
 */
export function useBinding<T = unknown>(
    binding: DataBindingSpec | undefined,
    context: ResolutionContext,
    options: UsePageDataOptions = {}
): {
    data: T | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
} {
    const bindings = useMemo(() => (binding ? [binding] : []), [binding]);
    const { data, loading, error, refetch } = usePageData(bindings, context, options);

    return {
        data: binding ? (data[binding.key] as T | null) ?? null : null,
        loading,
        error,
        refetch,
    };
}

/**
 * Hook for polling data at an interval.
 *
 * @param bindings - Data binding specifications (only bindings with pollingInterval are polled)
 * @param context - Resolution context
 * @param options - Loading options
 * @returns Page data state with automatic polling
 */
export function usePollingData(
    bindings: DataBindingSpec[] | undefined,
    context: ResolutionContext,
    options: UsePageDataOptions = {}
): PageDataState {
    const state = usePageData(bindings, context, options);

    // Set up polling for bindings that have pollingInterval
    useEffect(() => {
        if (!bindings?.length) return;

        const intervals: NodeJS.Timeout[] = [];

        for (const binding of bindings) {
            if (binding.pollingInterval && binding.pollingInterval > 0) {
                const interval = setInterval(() => {
                    state.invalidate(binding.key);
                }, binding.pollingInterval * 1000);
                intervals.push(interval);
            }
        }

        return () => {
            for (const interval of intervals) {
                clearInterval(interval);
            }
        };
    }, [bindings, state.invalidate]);

    return state;
}
