import { useUserSession } from '@vertesia/ui/session';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { TypeRegistry } from './TypeRegistry.js';

/** Delay before the first automatic retry after a failed load. It doubles after each further failure. */
const RETRY_BASE_MS = 2_000;
/** Upper bound for the backoff. A server Retry-After hint can still lengthen the wait beyond it. */
const RETRY_MAX_MS = 60_000;

/**
 * Milliseconds to wait before the next automatic retry, after `failures` consecutive failed loads.
 * A `retryAfterMs` hint from the request error (the server's Retry-After) is a floor, never shortened.
 */
export function typeCatalogRetryDelayMs(failures: number, retryAfterMs?: number): number {
    const backoff = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.max(0, failures - 1));
    return Math.max(backoff, retryAfterMs ?? 0);
}

/** Reads the `retryAfterMs` hint that the API client attaches to its request errors. */
function retryAfterHintMs(err: unknown): number | undefined {
    const hint = (err as { retryAfterMs?: unknown } | null)?.retryAfterMs;
    return typeof hint === 'number' && Number.isFinite(hint) && hint >= 0 ? hint : undefined;
}

interface TypeRegistryContextValue {
    registry: TypeRegistry | undefined;
    isLoading: boolean;
    load: () => Promise<void>;
    reload: () => Promise<void>;
}

const TypeRegistryContext = createContext<TypeRegistryContextValue>({
    registry: undefined,
    isLoading: false,
    load: () => Promise.resolve(),
    reload: () => Promise.resolve(),
});

interface TypeRegistryProviderProps {
    children: ReactNode;
}

export function TypeRegistryProvider({ children }: TypeRegistryProviderProps) {
    const { store, project } = useUserSession();
    const [registry, setRegistry] = useState<TypeRegistry | undefined>();
    const [isLoading, setIsLoading] = useState(false);
    const fetchRef = useRef(false);
    const failuresRef = useRef(0);
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    // Bumped whenever in-flight work must be discarded: reload, project change, unmount.
    const generationRef = useRef(0);
    const loadRef = useRef<() => Promise<void>>(() => Promise.resolve());
    const projectIdRef = useRef(project?.id);

    const clearRetryTimer = useCallback(() => {
        if (retryTimerRef.current !== undefined) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = undefined;
    }, []);

    /** Discards in-flight and scheduled work so that its results cannot land in the new state. */
    const invalidate = useCallback(() => {
        generationRef.current += 1;
        clearRetryTimer();
        failuresRef.current = 0;
        fetchRef.current = false;
        setIsLoading(false);
    }, [clearRetryTimer]);

    const load = useCallback(async () => {
        // While a retry is scheduled, the timer owns the next request. Consumers that mount or re-render
        // in the meantime must not start one, or every failure would turn into an immediate request.
        if (!project || fetchRef.current || retryTimerRef.current) return;
        const generation = generationRef.current;
        fetchRef.current = true;
        setIsLoading(true);
        try {
            const types = await store.types.catalog.list({ layout: true });
            if (generation !== generationRef.current) return;
            failuresRef.current = 0;
            clearRetryTimer();
            setRegistry(new TypeRegistry(types));
        } catch (err) {
            if (generation !== generationRef.current) return;
            failuresRef.current += 1;
            console.error('Failed to fetch types', err);
            const delay = typeCatalogRetryDelayMs(failuresRef.current, retryAfterHintMs(err));
            retryTimerRef.current = setTimeout(() => {
                retryTimerRef.current = undefined;
                void loadRef.current();
            }, delay);
        } finally {
            if (generation === generationRef.current) {
                fetchRef.current = false;
                setIsLoading(false);
            }
        }
    }, [store, project, clearRetryTimer]);

    useEffect(() => {
        loadRef.current = load;
    }, [load]);

    const reload = useCallback(async () => {
        invalidate();
        return load();
    }, [invalidate, load]);

    // Discard pending work on unmount.
    useEffect(() => invalidate, [invalidate]);

    // Reset when project changes
    useEffect(() => {
        if (projectIdRef.current !== project?.id) {
            projectIdRef.current = project?.id;
            invalidate();
            setRegistry(undefined);
        }
    });

    return (
        <TypeRegistryContext.Provider value={{ registry, isLoading, load, reload }}>
            {children}
        </TypeRegistryContext.Provider>
    );
}

export function useTypeRegistry() {
    const ctx = useContext(TypeRegistryContext);

    useEffect(() => {
        if (!ctx.registry && !ctx.isLoading) {
            ctx.load();
        }
    }, [ctx.registry, ctx.isLoading, ctx.load]);

    return ctx;
}
