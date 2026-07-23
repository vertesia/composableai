import { useUserSession } from '@vertesia/ui/session';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    getArtifactCacheKey,
    getFileCacheKey,
    isProjectFilePath,
    useArtifactUrlCache,
} from '../../features/agent/chat/useArtifactUrlCache';

export type UrlScheme =
    | 'artifact'
    | 'image'
    | 'store'
    | 'document'
    | 'collection'
    | 'interaction'
    | 'prompt'
    | 'agent'
    | 'workflow'
    | 'process'
    | 'run'
    | 'standard';

const AGENT_RESOURCE_SCHEMES = new Set<UrlScheme>([
    'store',
    'document',
    'collection',
    'interaction',
    'prompt',
    'agent',
    'workflow',
    'process',
    'run',
]);

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
 * Strip an optional `//` authority (and stray leading slashes) after a scheme colon so
 * `scheme://path` and `scheme:path` parse identically.
 */
function stripSchemePath(raw: string): string {
    return raw.trim().replace(/^\/+/, '');
}

/**
 * Parses a URL and returns its scheme and path
 */
export function parseUrlScheme(rawUrl: string): { scheme: UrlScheme; path: string } {
    if (rawUrl.startsWith('artifact:')) {
        return { scheme: 'artifact', path: rawUrl.slice(9).trim() };
    }
    if (rawUrl.startsWith('image:')) {
        return { scheme: 'image', path: rawUrl.slice(6).trim() };
    }
    const colonIndex = rawUrl.indexOf(':');
    if (colonIndex > 0) {
        const scheme = rawUrl.slice(0, colonIndex);
        if (AGENT_RESOURCE_SCHEMES.has(scheme as UrlScheme)) {
            return { scheme: scheme as UrlScheme, path: stripSchemePath(rawUrl.slice(colonIndex + 1)) };
        }
    }
    return { scheme: 'standard', path: rawUrl };
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

    const [state, setState] = useState<{
        url: string | undefined;
        isLoading: boolean;
        error: string | undefined;
    }>(() => {
        // If it's a standard URL, use as-is
        if (scheme === 'standard') {
            return { url: rawUrl, isLoading: false, error: undefined };
        }

        // For artifact/image schemes, check cache first
        if (urlCache && (scheme === 'artifact' || scheme === 'image')) {
            let cacheKey: string;
            if (scheme === 'artifact' && artifactRunId && !isProjectFilePath(path)) {
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

    const fetchUrl = useCallback(async () => {
        // Skip if already resolved or standard URL
        if (scheme === 'standard') {
            return;
        }

        // Only artifact and image schemes need async resolution
        if (scheme !== 'artifact' && scheme !== 'image') {
            setState({ url: undefined, isLoading: false, error: `Unknown scheme: ${scheme}` });
            return;
        }

        setState((prev) => ({ ...prev, isLoading: true, error: undefined }));

        const currentClient = clientRef.current;
        const currentUrlCache = urlCacheRef.current;

        try {
            let url: string;

            if (scheme === 'artifact') {
                if (artifactRunId && !isProjectFilePath(path)) {
                    const cacheKey = getArtifactCacheKey(artifactRunId, path, disposition);
                    if (currentUrlCache) {
                        url = await currentUrlCache.getOrFetch(cacheKey, async () => {
                            const result = await currentClient.files.getArtifactDownloadUrl(
                                artifactRunId,
                                path,
                                disposition,
                            );
                            return result.url;
                        });
                    } else {
                        const result = await currentClient.files.getArtifactDownloadUrl(
                            artifactRunId,
                            path,
                            disposition,
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
    }, [scheme, path, artifactRunId, disposition]);

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
            void doFetch();
        }

        return () => {
            cancelled = true;
        };
    }, [fetchUrl, state.url, state.error]);

    const retry = useCallback(() => {
        setState({ url: undefined, isLoading: true, error: undefined });
        void fetchUrl();
    }, [fetchUrl]);

    return {
        url: state.url,
        isLoading: state.isLoading,
        error: state.error,
        scheme,
        retry,
    };
}
