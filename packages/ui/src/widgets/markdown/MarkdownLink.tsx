import React from 'react';
import type { Element } from 'hast';
import { useResolvedUrl, parseUrlScheme, mapSchemeToRoute } from './useResolvedUrl';
import { useSchemeRouteOverrides } from './SchemeRouteContext';
import { CodeBlockPlaceholder } from './CodeBlockPlaceholder';

export interface MarkdownLinkProps {
    node?: Element;
    href?: string;
    children?: React.ReactNode;
    className?: string;
    artifactRunId?: string;
    /** Existing link component to delegate to for standard URLs */
    ExistingLink?: React.ComponentType<any>;
}

/**
 * Markdown link component with support for custom URL schemes.
 * Handles artifact:, image:, store:, document://, and collection: URLs.
 */
export function MarkdownLink({
    node,
    href,
    children,
    className,
    artifactRunId,
    ExistingLink,
    ...rest
}: MarkdownLinkProps) {
    const rawHref = href || '';
    const { scheme, path } = parseUrlScheme(rawHref);
    const schemeOverrides = useSchemeRouteOverrides();

    // For schemes that map directly to routes (store:, document://, collection:)
    const mappedRoute = mapSchemeToRoute(scheme, path, schemeOverrides);
    if (mappedRoute) {
        if (typeof ExistingLink === 'function') {
            return (
                <ExistingLink node={node} href={mappedRoute} data-scheme={scheme} {...rest}>
                    {children}
                </ExistingLink>
            );
        }
        return (
            <a
                href={mappedRoute}
                {...rest}
                className={className}
                target="_blank"
                rel="noopener noreferrer"
            >
                {children}
            </a>
        );
    }

    // For standard URLs, delegate to existing component or render directly
    if (scheme === 'standard') {
        if (typeof ExistingLink === 'function') {
            return (
                <ExistingLink node={node} href={href} {...rest}>
                    {children}
                </ExistingLink>
            );
        }
        return (
            <a
                href={href}
                {...rest}
                className={className}
                target="_blank"
                rel="noopener noreferrer"
            >
                {children}
            </a>
        );
    }

    // For artifact: and image: URLs, use the resolver
    return (
        <ResolvedLink
            rawHref={rawHref}
            artifactRunId={artifactRunId}
            className={className}
            rest={rest}
        >
            {children}
        </ResolvedLink>
    );
}

/**
 * Internal component for links that need async URL resolution
 */
function ResolvedLink({
    rawHref,
    artifactRunId,
    className,
    children,
    rest,
}: {
    rawHref: string;
    artifactRunId?: string;
    className?: string;
    children?: React.ReactNode;
    rest: Record<string, unknown>;
}) {
    const { url, isLoading, error, retry } = useResolvedUrl({
        rawUrl: rawHref,
        artifactRunId,
        disposition: 'attachment',
    });

    if (isLoading) {
        return (
            <span className="inline-flex items-center gap-1 text-muted">
                <CodeBlockPlaceholder type="link" />
            </span>
        );
    }

    if (error) {
        return (
            <span className="inline-flex items-center gap-1">
                <CodeBlockPlaceholder type="link" error={error} onRetry={retry} />
            </span>
        );
    }

    return (
        <a
            href={url || '#'}
            {...rest}
            className={className}
            target="_blank"
            rel="noopener noreferrer"
        >
            {children}
        </a>
    );
}
