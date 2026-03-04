import { useResolvedUrl, parseUrlScheme } from './useResolvedUrl';
import { CodeBlockPlaceholder } from './CodeBlockPlaceholder';

export interface MarkdownFigureProps {
    src?: string;
    alt?: string;
    caption: string;
    className?: string;
    artifactRunId?: string;
}

/**
 * Markdown figure component for images with captions.
 * Wraps the image in a <figure> element with a <figcaption>.
 *
 * Usage in markdown: ![alt text](image-url "Caption text")
 */
export function MarkdownFigure({
    src,
    alt,
    caption,
    className,
    artifactRunId,
}: MarkdownFigureProps) {
    const rawSrc = src || '';
    const { scheme } = parseUrlScheme(rawSrc);

    // For standard URLs, render directly
    if (scheme === 'standard') {
        return (
            <figure className="my-4">
                <img src={src} alt={alt} className={className} />
                <figcaption className="mt-2 text-sm text-muted text-center italic">
                    {caption}
                </figcaption>
            </figure>
        );
    }

    // For artifact: and image: URLs, use the resolver
    return (
        <ResolvedFigure
            rawSrc={rawSrc}
            alt={alt}
            caption={caption}
            artifactRunId={artifactRunId}
            className={className}
        />
    );
}

/**
 * Internal component for figures that need async URL resolution
 */
function ResolvedFigure({
    rawSrc,
    alt,
    caption,
    artifactRunId,
    className,
}: {
    rawSrc: string;
    alt?: string;
    caption: string;
    artifactRunId?: string;
    className?: string;
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

    return (
        <figure className="my-4">
            <img src={url} alt={alt} className={className} />
            <figcaption className="mt-2 text-sm text-muted text-center italic">
                {caption}
            </figcaption>
        </figure>
    );
}
