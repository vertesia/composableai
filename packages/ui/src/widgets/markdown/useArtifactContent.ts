/**
 * useArtifactContent - Hook to fetch artifact content from GCS
 *
 * Used by expand:* code blocks to fetch and render artifact content inline.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUserSession } from '@vertesia/ui/session';
import {
    useArtifactUrlCache,
    getArtifactCacheKey,
} from '../../features/agent/chat/useArtifactUrlCache';

export interface ArtifactContentState<T = unknown> {
    /** The fetched content, parsed if JSON */
    data: T | undefined;
    /** Raw string content */
    rawContent: string | undefined;
    /** Whether the content is currently being fetched */
    isLoading: boolean;
    /** Error message if fetch failed */
    error: string | undefined;
    /** Detected content type */
    contentType: 'json' | 'text' | 'binary' | undefined;
    /** Retry the fetch */
    retry: () => void;
}

export interface UseArtifactContentOptions {
    /** Workflow run ID for artifact path resolution */
    runId: string | undefined;
    /** Artifact path (e.g., "direct/chart_123.json") */
    path: string;
    /** Whether to auto-parse JSON content (default: true) */
    parseJson?: boolean;
}

/**
 * Detect content type from path extension
 */
function detectContentType(path: string): 'json' | 'text' | 'binary' {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'json':
            return 'json';
        case 'md':
        case 'txt':
        case 'csv':
        case 'yaml':
        case 'yml':
            return 'text';
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'webp':
        case 'pdf':
            return 'binary';
        default:
            return 'text';
    }
}

/**
 * Hook to fetch artifact content from GCS.
 * Handles caching, loading states, and error handling.
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useArtifactContent({
 *   runId: artifactRunId,
 *   path: 'direct/chart_123.json'
 * });
 * ```
 */
export function useArtifactContent<T = unknown>({
    runId,
    path,
    parseJson = true,
}: UseArtifactContentOptions): ArtifactContentState<T> {
    const { client } = useUserSession();
    const urlCache = useArtifactUrlCache();

    // Use refs to avoid triggering effect re-runs
    const clientRef = useRef(client);
    clientRef.current = client;
    const urlCacheRef = useRef(urlCache);
    urlCacheRef.current = urlCache;

    const [state, setState] = useState<{
        data: T | undefined;
        rawContent: string | undefined;
        isLoading: boolean;
        error: string | undefined;
        contentType: 'json' | 'text' | 'binary' | undefined;
    }>({
        data: undefined,
        rawContent: undefined,
        isLoading: true,
        error: undefined,
        contentType: undefined,
    });

    const [retryCount, setRetryCount] = useState(0);

    const fetchContent = useCallback(async () => {
        if (!runId) {
            setState({
                data: undefined,
                rawContent: undefined,
                isLoading: false,
                error: 'No run ID provided',
                contentType: undefined,
            });
            return;
        }

        if (!path) {
            setState({
                data: undefined,
                rawContent: undefined,
                isLoading: false,
                error: 'No artifact path provided',
                contentType: undefined,
            });
            return;
        }

        setState(prev => ({ ...prev, isLoading: true, error: undefined }));

        const currentClient = clientRef.current;
        const currentUrlCache = urlCacheRef.current;
        const contentType = detectContentType(path);

        try {
            // Get signed URL for the artifact
            const cacheKey = getArtifactCacheKey(runId, path, 'inline');
            let signedUrl: string;

            if (currentUrlCache) {
                signedUrl = await currentUrlCache.getOrFetch(cacheKey, async () => {
                    const result = await currentClient.files.getArtifactDownloadUrl(
                        runId,
                        path,
                        'inline'
                    );
                    return result.url;
                });
            } else {
                const result = await currentClient.files.getArtifactDownloadUrl(
                    runId,
                    path,
                    'inline'
                );
                signedUrl = result.url;
            }

            // Fetch the actual content
            const response = await fetch(signedUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch artifact: ${response.status} ${response.statusText}`);
            }

            // For binary content, return the URL instead
            if (contentType === 'binary') {
                setState({
                    data: signedUrl as unknown as T,
                    rawContent: undefined,
                    isLoading: false,
                    error: undefined,
                    contentType,
                });
                return;
            }

            const rawContent = await response.text();

            // Parse JSON if requested and content is JSON
            let data: T | undefined;
            if (parseJson && contentType === 'json') {
                try {
                    data = JSON.parse(rawContent) as T;
                } catch {
                    // If JSON parse fails, treat as text
                    data = rawContent as unknown as T;
                }
            } else {
                data = rawContent as unknown as T;
            }

            setState({
                data,
                rawContent,
                isLoading: false,
                error: undefined,
                contentType,
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch artifact';
            console.error('Failed to fetch artifact content:', path, err);
            setState({
                data: undefined,
                rawContent: undefined,
                isLoading: false,
                error: errorMessage,
                contentType,
            });
        }
    }, [runId, path, parseJson]);

    useEffect(() => {
        fetchContent();
    }, [fetchContent, retryCount]);

    const retry = useCallback(() => {
        setState({
            data: undefined,
            rawContent: undefined,
            isLoading: true,
            error: undefined,
            contentType: undefined,
        });
        setRetryCount(c => c + 1);
    }, []);

    return {
        data: state.data,
        rawContent: state.rawContent,
        isLoading: state.isLoading,
        error: state.error,
        contentType: state.contentType,
        retry,
    };
}
