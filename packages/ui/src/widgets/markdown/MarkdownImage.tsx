import React from 'react';
import { useResolvedUrl, parseUrlScheme } from './useResolvedUrl';
import { CodeBlockPlaceholder } from './CodeBlockPlaceholder';

export interface MarkdownImageProps {
    node?: any;
    src?: string;
    alt?: string;
    className?: string;
    artifactRunId?: string;
    /** Existing image component to delegate to for standard URLs */
    ExistingImg?: React.ComponentType<any>;
}

/**
 * Markdown image component with support for custom URL schemes.
 * Handles artifact: and image: URLs with loading states and error handling.
 */
export function MarkdownImage({
    node,
    src,
    alt,
    className,
    artifactRunId,
    ExistingImg,
    ...rest
}: MarkdownImageProps) {
    const rawSrc = src || '';
    const { scheme } = parseUrlScheme(rawSrc);

    // For standard URLs, delegate to existing component or render directly
    if (scheme === 'standard') {
        if (typeof ExistingImg === 'function') {
            return <ExistingImg node={node} src={src} alt={alt} {...rest} />;
        }
        return <img src={src} alt={alt} className={className} {...rest} />;
    }

    // For artifact: and image: URLs, use the resolver
    return (
        <ResolvedImage
            rawSrc={rawSrc}
            alt={alt}
            artifactRunId={artifactRunId}
            className={className}
            rest={rest}
        />
    );
}

/**
 * Internal component for images that need async URL resolution
 */
function ResolvedImage({
    rawSrc,
    alt,
    artifactRunId,
    className,
    rest,
}: {
    rawSrc: string;
    alt?: string;
    artifactRunId?: string;
    className?: string;
    rest: Record<string, unknown>;
}) {
    const { url, isLoading, error, retry } = useResolvedUrl({
        rawUrl: rawSrc,
        artifactRunId,
        disposition: 'inline',
    });

    if (isLoading) {
        return <CodeBlockPlaceholder type="image" message={alt ? `Loading ${alt}...` : undefined} />;
    }

    if (error) {
        return (
            <CodeBlockPlaceholder
                type="image"
                error={error}
                onRetry={retry}
            />
        );
    }

    if (!url) {
        return null;
    }

    return <img src={url} alt={alt} className={className} {...rest} />;
}
