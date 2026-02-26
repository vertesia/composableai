/**
 * Data fetching hooks for the admin panel.
 * Self-contained — no dependency on @vertesia/ui.
 */

import { useEffect, useState } from 'react';
import type { AppPackage } from '@vertesia/common';
import type { ServerInfo } from './types.js';

interface FetchState<T> {
    data: T | undefined;
    isLoading: boolean;
    error: Error | undefined;
}

/**
 * Minimal data-fetching hook (replaces @vertesia/ui's useFetch).
 */
function useFetch<T>(fetcher: () => Promise<T>, deps: unknown[]): FetchState<T> {
    const [state, setState] = useState<FetchState<T>>({
        data: undefined,
        isLoading: true,
        error: undefined,
    });

    useEffect(() => {
        let cancelled = false;
        setState(prev => ({ ...prev, isLoading: true, error: undefined }));

        fetcher()
            .then(data => {
                if (!cancelled) setState({ data, isLoading: false, error: undefined });
            })
            .catch((err: unknown) => {
                if (!cancelled) setState({ data: undefined, isLoading: false, error: err as Error });
            });

        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return state;
}

/**
 * Fetches the tool server info (message, version, endpoints).
 */
export function useServerInfo(baseUrl: string) {
    return useFetch<ServerInfo>(() =>
        fetch(baseUrl).then(r => r.json()),
        [baseUrl]
    );
}

/**
 * Fetches the full app package with all resources.
 */
export function useAppPackage(baseUrl: string) {
    return useFetch<AppPackage>(() =>
        fetch(`${baseUrl}/package`).then(r => r.json()),
        [baseUrl]
    );
}
