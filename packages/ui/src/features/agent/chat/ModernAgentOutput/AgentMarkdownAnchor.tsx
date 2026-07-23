import { NavLink } from '@vertesia/ui/router';
import type React from 'react';

/** Host-provided renderer for store/document links (e.g. to open a side panel instead of navigating). */
export type StoreLinkComponentType = React.ComponentType<{
    href: string;
    documentId: string;
    children: React.ReactNode;
    className?: string;
}>;

/** Host-provided renderer for store/collection links. */
export type CollectionLinkComponentType = React.ComponentType<{
    href: string;
    collectionId: string;
    children: React.ReactNode;
    className?: string;
}>;

export interface AgentMarkdownAnchorOptions {
    /** Custom component to render store/document links instead of default NavLink navigation. */
    StoreLinkComponent?: StoreLinkComponentType;
    /** Custom component to render store/collection links instead of default NavLink navigation. */
    CollectionLinkComponent?: CollectionLinkComponentType;
    /**
     * Applies tenant sticky params (account `a` / project `p`) to internal routes so copy-link and
     * open-in-new-tab preserve the current tenant. Left undefined when no router is in scope.
     */
    addStickyParams?: (href: string) => string;
}

interface AnchorProps {
    node?: unknown;
    ref?: unknown;
    href?: string;
    children?: React.ReactNode;
    className?: string;
}

function getInternalRouteId(href: string, routePrefix: string): string | undefined {
    if (!href.startsWith(routePrefix)) {
        return undefined;
    }
    return href.slice(routePrefix.length).split(/[/?#]/, 1)[0] || undefined;
}

/**
 * Builds the markdown `a` renderer used across agent chat.
 *
 * Custom-scheme links (`store:`, `collection:`, `interaction:`, `prompt:`, ...) are resolved by the
 * host's AgentResourceResolver upstream in MarkdownLink, so navigable targets reach this renderer as
 * concrete paths. We route relative paths through NavLink (preserving tenant params); only document
 * and collection paths get the optional host-provided link components. External URLs open in a new
 * tab, matching prior behavior.
 */
export function createAgentMarkdownAnchor(options: AgentMarkdownAnchorOptions = {}) {
    const { StoreLinkComponent, CollectionLinkComponent, addStickyParams } = options;

    return function AgentMarkdownAnchor({ node: _node, ref: _ref, ...props }: AnchorProps) {
        const href = props.href || '';
        const isInternal = href.startsWith('/') && !href.startsWith('//');
        const withParams = isInternal && addStickyParams ? addStickyParams(href) : href;
        const documentId = isInternal ? getInternalRouteId(href, '/store/objects/') : undefined;

        if (documentId && StoreLinkComponent) {
            return (
                <StoreLinkComponent href={withParams} documentId={documentId} className={props.className}>
                    {props.children}
                </StoreLinkComponent>
            );
        }

        const collectionId = isInternal ? getInternalRouteId(href, '/store/collections/') : undefined;
        if (collectionId && CollectionLinkComponent) {
            return (
                <CollectionLinkComponent href={withParams} collectionId={collectionId} className={props.className}>
                    {props.children}
                </CollectionLinkComponent>
            );
        }

        // Any other relative in-app path (e.g. /studio/interactions/:id, /store/workflows/:id)
        // navigates internally so tenant params are preserved and the SPA is not reloaded.
        if (isInternal) {
            return (
                <NavLink href={withParams} className={props.className} topLevelNav>
                    {props.children}
                </NavLink>
            );
        }

        return <a {...props} target="_blank" rel="noopener noreferrer" />;
    };
}
