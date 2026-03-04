import React, { createContext, useContext, useCallback, useRef } from "react";

interface ArtifactUrlCacheContextValue {
    getUrl: (key: string) => string | undefined;
    setUrl: (key: string, url: string) => void;
    getOrFetch: (
        key: string,
        fetcher: () => Promise<string>
    ) => Promise<string>;
}

const ArtifactUrlCacheContext = createContext<ArtifactUrlCacheContextValue | null>(null);

/**
 * Provider component that maintains a cache of resolved artifact URLs.
 * This prevents re-fetching the same artifact URL multiple times during re-renders.
 */
export function ArtifactUrlCacheProvider({ children }: { children: React.ReactNode }) {
    const cacheRef = useRef<Map<string, string>>(new Map());
    const pendingRef = useRef<Map<string, Promise<string>>>(new Map());

    const getUrl = useCallback((key: string): string | undefined => {
        return cacheRef.current.get(key);
    }, []);

    const setUrl = useCallback((key: string, url: string): void => {
        cacheRef.current.set(key, url);
    }, []);

    const getOrFetch = useCallback(async (
        key: string,
        fetcher: () => Promise<string>
    ): Promise<string> => {
        // Return cached URL if available
        const cached = cacheRef.current.get(key);
        if (cached) {
            return cached;
        }

        // Return pending promise if a fetch is already in progress
        const pending = pendingRef.current.get(key);
        if (pending) {
            return pending;
        }

        // Start new fetch and cache the promise
        const promise = fetcher().then((url) => {
            cacheRef.current.set(key, url);
            pendingRef.current.delete(key);
            return url;
        }).catch((err) => {
            pendingRef.current.delete(key);
            throw err;
        });

        pendingRef.current.set(key, promise);
        return promise;
    }, []);

    const value = React.useMemo(
        () => ({ getUrl, setUrl, getOrFetch }),
        [getUrl, setUrl, getOrFetch]
    );

    return (
        <ArtifactUrlCacheContext.Provider value={value}>
            {children}
        </ArtifactUrlCacheContext.Provider>
    );
}

/**
 * Hook to access the artifact URL cache.
 * Returns null if used outside of ArtifactUrlCacheProvider.
 */
export function useArtifactUrlCache(): ArtifactUrlCacheContextValue | null {
    return useContext(ArtifactUrlCacheContext);
}

/**
 * Generate a cache key for an artifact URL.
 */
export function getArtifactCacheKey(runId: string, path: string, disposition: string = "inline"): string {
    return `artifact:${runId}:${path}:${disposition}`;
}

/**
 * Generate a cache key for a file URL.
 */
export function getFileCacheKey(path: string): string {
    return `file:${path}`;
}
