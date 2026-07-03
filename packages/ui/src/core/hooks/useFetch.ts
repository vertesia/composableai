import { useCallback, useEffect, useRef, useState } from 'react';

export interface FetchOpts<T> {
    start?: () => void;
    end?: () => void;
    defaultValue?: T | (() => T);
    deps?: unknown[] | undefined;
    condition?: () => boolean;
    onSuccess?: (data: T) => void;
    onError?: (err: unknown) => void;
}

function toError(error: unknown) {
    return error instanceof Error ? error : new Error(String(error));
}

export function useFetch<T = unknown>(fetcher: () => Promise<T>, opts?: FetchOpts<T> | unknown[] | undefined | null) {
    if (Array.isArray(opts)) {
        opts = { deps: opts };
    }
    const options = (opts || {}) as FetchOpts<T>;
    const [error, setError] = useState<Error | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(false);
    const [data, setData] = useState<T | undefined>(options.defaultValue);
    const fetcherRef = useRef(fetcher);
    fetcherRef.current = fetcher;
    const optionsRef = useRef(options);
    optionsRef.current = options;
    const fetch = useCallback(() => {
        const currentOptions = optionsRef.current;
        currentOptions.start?.();
        setIsLoading(true);
        return fetcherRef
            .current()
            .then((result: T) => {
                setData(result);
                currentOptions.onSuccess?.(result);
            })
            .catch((error) => {
                const err = toError(error);
                setError(err);
                currentOptions.onError?.(err);
            })
            .finally(() => {
                setIsLoading(false);
                currentOptions.end?.();
            });
    }, []);
    useEffect(() => {
        const currentOptions = optionsRef.current;
        if (!currentOptions.condition || currentOptions.condition()) {
            fetch();
        }
    }, [fetch, ...(options.deps ?? [])]);
    return { data, isLoading, error, setData, refetch: fetch };
}

export function useFetchOnce<T>(fetcher: () => Promise<T>, opts?: FetchOpts<T> | unknown[] | undefined | null) {
    if (!opts || Array.isArray(opts)) {
        opts = { deps: [] };
    } else if (opts) {
        opts.deps = [];
    }
    return useFetch<T>(fetcher, opts);
}
