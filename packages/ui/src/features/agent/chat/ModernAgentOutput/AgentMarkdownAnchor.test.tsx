// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAgentMarkdownAnchor } from './AgentMarkdownAnchor';

afterEach(() => cleanup());

describe('createAgentMarkdownAnchor', () => {
    it.each([
        'https://example.com/store/objects/doc-1?view=full#section',
        '//example.com/store/collections/col-1?view=full#section',
    ])('keeps external resource-shaped URLs external: %s', (href) => {
        const StoreLinkComponent = vi.fn(() => null);
        const CollectionLinkComponent = vi.fn(() => null);
        const Anchor = createAgentMarkdownAnchor({ StoreLinkComponent, CollectionLinkComponent });

        render(<Anchor href={href}>External</Anchor>);

        expect(screen.getByRole('link', { name: 'External' }).getAttribute('href')).toBe(href);
        expect(screen.getByRole('link', { name: 'External' }).getAttribute('target')).toBe('_blank');
        expect(StoreLinkComponent).not.toHaveBeenCalled();
        expect(CollectionLinkComponent).not.toHaveBeenCalled();
    });

    it('passes a clean document id and styling to the host document link', () => {
        const StoreLinkComponent = ({
            href,
            documentId,
            className,
            children,
        }: {
            href: string;
            documentId: string;
            className?: string;
            children: React.ReactNode;
        }) => (
            <a href={href} className={className} data-document-id={documentId}>
                {children}
            </a>
        );
        const Anchor = createAgentMarkdownAnchor({
            StoreLinkComponent,
            addStickyParams: (href) => `${href}&a=account-1`,
        });

        render(
            <Anchor href="/store/objects/doc-1?revision=rev-1#properties" className="resource-link">
                Document
            </Anchor>,
        );

        const link = screen.getByRole('link', { name: 'Document' });
        expect(link.getAttribute('data-document-id')).toBe('doc-1');
        expect(link.getAttribute('href')).toBe('/store/objects/doc-1?revision=rev-1#properties&a=account-1');
        expect(link.className).toBe('resource-link');
    });

    it('passes a clean collection id to the host collection link', () => {
        const CollectionLinkComponent = ({
            href,
            collectionId,
            children,
        }: {
            href: string;
            collectionId: string;
            children: React.ReactNode;
        }) => (
            <a href={href} data-collection-id={collectionId}>
                {children}
            </a>
        );
        const Anchor = createAgentMarkdownAnchor({ CollectionLinkComponent });

        render(<Anchor href="/store/collections/col-1?tab=objects#top">Collection</Anchor>);

        expect(screen.getByRole('link', { name: 'Collection' }).getAttribute('data-collection-id')).toBe('col-1');
    });
});
