import { useState, useEffect, useCallback, useRef } from 'react';
import { useUserSession } from '@vertesia/ui/session';
import {
    useArtifactUrlCache,
    getArtifactCacheKey,
    getFileCacheKey,
} from '../../features/agent/chat/useArtifactUrlCache';
import {
    parseUrlScheme as parseUrlSchemeFromCommon,
    mapSchemeToRoute as mapSchemeToRouteFromCommon,
    type UrlScheme,
} from '@vertesia/common';

// Re-export type and functions from common for backward compatibility
export type { UrlScheme };
export const parseUrlScheme = parseUrlSchemeFromCommon;
export const mapSchemeToRoute = mapSchemeToRouteFromCommon;

export interface ResolvedUrlState {
    /** The resolved URL, or undefined if not yet resolved */
    url: string | undefined;
    /** Whether the URL is currently being resolved */
    isLoading: boolean;
    /** Error message if resolution failed */
    error: string | undefined;
    /** The detected URL scheme */
    scheme: UrlScheme;
    /** Retry the URL resolution */
    retry: () => void;
}

export interface UseResolvedUrlOptions {
    /** The raw URL to resolve */
    rawUrl: string;
    /** Optional workflow run ID for resolving shorthand artifact paths */
    artifactRunId?: string;
    /** Content disposition for artifact URLs: 'inline' for images, 'attachment' for downloads */
    disposition?: 'inline' | 'attachment';
}

/**
 * Hook to resolve custom URL schemes (artifact:, image:, etc.) to actual URLs.
 * Handles caching, loading states, and error handling.
 */
export function useResolvedUrl({
    rawUrl,
    artifactRunId,
    disposition = 'inline',
}: UseResolvedUrlOptions): ResolvedUrlState {
    const { client } = useUserSession();
    const urlCache = useArtifactUrlCache();
    // Use refs to avoid triggering effect/callback re-runs when these stable values are accessed
    const clientRef = useRef(client);
    clientRef.current = client;
    const urlCacheRef = useRef(urlCache);
    urlCacheRef.current = urlCache;
    const { scheme, path } = parseUrlScheme(rawUrl);

    // For schemes that map to routes, resolve immediately
    const mappedRoute = mapSchemeToRoute(scheme, path);

    const [state, setState] = useState<{
        url: string | undefined;
        isLoading: boolean;
        error: string | undefined;
    }>(() => {
        // If it's a mapped route, use that immediately
        if (mappedRoute) {
            return { url: mappedRoute, isLoading: false, error: undefined };
        }

        // If it's a standard URL, use as-is
        if (scheme === 'standard') {
            return { url: rawUrl, isLoading: false, error: undefined };
        }

        // For artifact/image schemes, check cache first
        if (urlCache && (scheme === 'artifact' || scheme === 'image')) {
            let cacheKey: string;
            if (scheme === 'artifact' && artifactRunId && !path.startsWith('agents/')) {
                cacheKey = getArtifactCacheKey(artifactRunId, path, disposition);
            } else {
                cacheKey = getFileCacheKey(path);
            }
            const cached = urlCache.getUrl(cacheKey);
            if (cached) {
                return { url: cached, isLoading: false, error: undefined };
            }
        }

        // Need to fetch
        return { url: undefined, isLoading: true, error: undefined };
    });

    const [retryCount, setRetryCount] = useState(0);

    const fetchUrl = useCallback(async () => {
        // Skip if already resolved or standard URL
        if (mappedRoute || scheme === 'standard') {
            return;
        }

        // Only artifact and image schemes need async resolution
        if (scheme !== 'artifact' && scheme !== 'image') {
            setState({ url: undefined, isLoading: false, error: `Unknown scheme: ${scheme}` });
            return;
        }

        setState(prev => ({ ...prev, isLoading: true, error: undefined }));

        const currentClient = clientRef.current;
        const currentUrlCache = urlCacheRef.current;

        try {
            let url: string;

            if (scheme === 'artifact') {
                if (artifactRunId && !path.startsWith('agents/')) {
                    const cacheKey = getArtifactCacheKey(artifactRunId, path, disposition);
                    if (currentUrlCache) {
                        url = await currentUrlCache.getOrFetch(cacheKey, async () => {
                            const result = await currentClient.files.getArtifactDownloadUrl(
                                artifactRunId,
                                path,
                                disposition
                            );
                            return result.url;
                        });
                    } else {
                        const result = await currentClient.files.getArtifactDownloadUrl(
                            artifactRunId,
                            path,
                            disposition
                        );
                        url = result.url;
                    }
                } else {
                    const cacheKey = getFileCacheKey(path);
                    if (currentUrlCache) {
                        url = await currentUrlCache.getOrFetch(cacheKey, async () => {
                            const result = await currentClient.files.getDownloadUrl(path);
                            return result.url;
                        });
                    } else {
                        const result = await currentClient.files.getDownloadUrl(path);
                        url = result.url;
                    }
                }
            } else {
                // image: scheme
                const cacheKey = getFileCacheKey(path);
                if (currentUrlCache) {
                    url = await currentUrlCache.getOrFetch(cacheKey, async () => {
                        const result = await currentClient.files.getDownloadUrl(path);
                        return result.url;
                    });
                } else {
                    const result = await currentClient.files.getDownloadUrl(path);
                    url = result.url;
                }
            }

            setState({ url, isLoading: false, error: undefined });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to resolve URL';
            console.error('Failed to resolve URL:', path, err);
            setState({ url: undefined, isLoading: false, error: errorMessage });
        }
    }, [scheme, path, artifactRunId, disposition, mappedRoute]);

    useEffect(() => {
        // Skip if already resolved
        if (state.url && !state.error) {
            return;
        }

        let cancelled = false;

        const doFetch = async () => {
            await fetchUrl();
        };

        if (!cancelled) {
            doFetch();
        }

        return () => {
            cancelled = true;
        };
    }, [fetchUrl, retryCount, state.url, state.error]);

    const retry = useCallback(() => {
        setState({ url: undefined, isLoading: true, error: undefined });
        setRetryCount(c => c + 1);
    }, []);

    return {
        url: state.url,
        isLoading: state.isLoading,
        error: state.error,
        scheme,
        retry,
    };
}
