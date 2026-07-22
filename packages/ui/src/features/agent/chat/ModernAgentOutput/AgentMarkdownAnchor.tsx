import { NavLink } from '@vertesia/ui/router';
import type React from 'react';

/** Host-provided renderer for store/document links (e.g. to open a side panel instead of navigating). */
export type StoreLinkComponentType = React.ComponentType<{
    href: string;
    documentId: string;
    children: React.ReactNode;
}>;

/** Host-provided renderer for store/collection links. */
export type CollectionLinkComponentType = React.ComponentType<{
    href: string;
    collectionId: string;
    children: React.ReactNode;
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
        const isInternal = href.startsWith('/');
        const withParams = isInternal && addStickyParams ? addStickyParams(href) : href;

        if (href.includes('/store/objects')) {
            if (StoreLinkComponent) {
                const documentId = href.split('/store/objects/')[1] || '';
                return (
                    <StoreLinkComponent href={withParams} documentId={documentId}>
                        {props.children}
                    </StoreLinkComponent>
                );
            }
            return (
                <NavLink href={withParams} topLevelNav>
                    {props.children}
                </NavLink>
            );
        }

        if (href.includes('/store/collections')) {
            if (CollectionLinkComponent) {
                const collectionId = href.split('/store/collections/')[1] || '';
                return (
                    <CollectionLinkComponent href={withParams} collectionId={collectionId}>
                        {props.children}
                    </CollectionLinkComponent>
                );
            }
            return (
                <NavLink href={withParams} topLevelNav>
                    {props.children}
                </NavLink>
            );
        }

        // Any other relative in-app path (e.g. /studio/interactions/:id, /store/workflows/:id)
        // navigates internally so tenant params are preserved and the SPA is not reloaded.
        if (isInternal) {
            return (
                <NavLink href={withParams} topLevelNav>
                    {props.children}
                </NavLink>
            );
        }

        return <a {...props} target="_blank" rel="noopener noreferrer" />;
    };
}
