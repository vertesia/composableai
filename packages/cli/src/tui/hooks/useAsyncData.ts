import { useCallback, useEffect, useState } from 'react';

export interface AsyncDataState<T> {
    data: T | null;
    loading: boolean;
    error: string | null;
    refetch: () => void;
}

/**
 * Generic hook for async data fetching with loading/error states.
 */
export function useAsyncData<T>(
    fetcher: () => Promise<T>,
    deps: unknown[] = [],
): AsyncDataState<T> {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [trigger, setTrigger] = useState(0);

    const refetch = useCallback(() => {
        setTrigger(t => t + 1);
    }, []);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        fetcher()
            .then(result => {
                if (!cancelled) {
                    setData(result);
                    setLoading(false);
                }
            })
            .catch(err => {
                if (!cancelled) {
                    setError(String(err));
                    setLoading(false);
                }
            });

        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trigger, ...deps]);

    return { data, loading, error, refetch };
}
