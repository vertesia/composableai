import { Button } from '@vertesia/ui/core';
import type { Element } from 'hast';
import type React from 'react';
import { parseAgentResourceHref, useAgentResourceResolver } from './AgentResourceResolver';
import { CodeBlockPlaceholder } from './CodeBlockPlaceholder';
import { parseUrlScheme, useResolvedUrl } from './useResolvedUrl';

export interface MarkdownLinkProps {
    node?: Element;
    href?: string;
    children?: React.ReactNode;
    className?: string;
    artifactRunId?: string;
    /** Open a Markdown artifact in the host artifact viewer instead of downloading it. */
    onArtifactOpen?: (path: string) => void;
    /** Existing link component to delegate to for standard URLs */
    ExistingLink?: React.ComponentType<MarkdownLinkProps>;
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
    onArtifactOpen,
    ExistingLink,
    ...rest
}: MarkdownLinkProps) {
    const rawHref = href || '';
    const resource = parseAgentResourceHref(rawHref);
    if (resource) {
        return (
            <AgentResourceMarkdownLink
                resource={resource}
                rawHref={rawHref}
                artifactRunId={artifactRunId}
                className={className}
                ExistingLink={ExistingLink}
                rest={rest}
            >
                {children}
            </AgentResourceMarkdownLink>
        );
    }

    const { scheme, path } = parseUrlScheme(rawHref);

    // For standard URLs, delegate to existing component or render directly
    if (scheme === 'standard') {
        if (typeof ExistingLink === 'function') {
            return (
                <ExistingLink node={node} href={href} className={className} {...rest}>
                    {children}
                </ExistingLink>
            );
        }
        return (
            <a href={href} {...rest} className={className} target="_blank" rel="noopener noreferrer">
                {children}
            </a>
        );
    }

    // For artifact: and image: URLs, use the resolver
    return (
        <ResolvedLink
            rawHref={rawHref}
            artifactRunId={artifactRunId}
            artifactPath={scheme === 'artifact' ? path : undefined}
            onArtifactOpen={onArtifactOpen}
            className={className}
            rest={rest}
        >
            {children}
        </ResolvedLink>
    );
}

function AgentResourceMarkdownLink({
    resource,
    rawHref,
    artifactRunId,
    className,
    children,
    ExistingLink,
    rest,
}: {
    resource: NonNullable<ReturnType<typeof parseAgentResourceHref>>;
    rawHref: string;
    artifactRunId?: string;
    className?: string;
    children?: React.ReactNode;
    ExistingLink?: React.ComponentType<MarkdownLinkProps>;
    rest: Record<string, unknown>;
}) {
    const resolve = useAgentResourceResolver();
    const target = resolve(resource, {
        workflowRunId: artifactRunId,
        source: 'markdown',
        rawHref,
    });

    if (target.kind === 'navigate') {
        if (typeof ExistingLink === 'function') {
            return (
                <ExistingLink href={target.href} className={className} {...rest}>
                    {children}
                </ExistingLink>
            );
        }
        return (
            <a href={target.href} {...rest} className={className} target="_blank" rel="noopener noreferrer">
                {children}
            </a>
        );
    }

    if (target.kind === 'activate') {
        return (
            <Button variant="link" size="none" className={className} onClick={target.onActivate}>
                {children}
            </Button>
        );
    }

    return <span className={className}>{children}</span>;
}

/**
 * Internal component for links that need async URL resolution
 */
function ResolvedLink({
    rawHref,
    artifactRunId,
    artifactPath,
    onArtifactOpen,
    className,
    children,
    rest,
}: {
    rawHref: string;
    artifactRunId?: string;
    artifactPath?: string;
    onArtifactOpen?: (path: string) => void;
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
            onClick={(event) => {
                if (
                    artifactPath &&
                    /\.md$/i.test(artifactPath) &&
                    onArtifactOpen &&
                    !event.metaKey &&
                    !event.ctrlKey &&
                    !event.shiftKey &&
                    event.button === 0
                ) {
                    event.preventDefault();
                    onArtifactOpen(artifactPath);
                }
            }}
        >
            {children}
        </a>
    );
}
