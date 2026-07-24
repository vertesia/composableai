// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type AgentResourceResolver, AgentResourceResolverProvider } from './AgentResourceResolver';
import { MarkdownLink, type MarkdownLinkProps } from './MarkdownLink';

afterEach(() => cleanup());

describe('MarkdownLink agent resources', () => {
    const ExistingLink = ({ href, children, className }: MarkdownLinkProps) => (
        <a href={href} className={className}>
            {children}
        </a>
    );

    it('routes a custom resource scheme through the host resolver', () => {
        const resolver = vi.fn<AgentResourceResolver>(() => ({ kind: 'navigate', href: '/custom/interactions/int-1' }));
        render(
            <AgentResourceResolverProvider value={resolver}>
                <MarkdownLink href="interaction:int-1" artifactRunId="run-1">
                    Interaction
                </MarkdownLink>
            </AgentResourceResolverProvider>,
        );

        expect(screen.getByRole('link', { name: 'Interaction' }).getAttribute('href')).toBe(
            '/custom/interactions/int-1',
        );
        expect(resolver).toHaveBeenCalledWith(
            { type: 'interaction', id: 'int-1' },
            { workflowRunId: 'run-1', source: 'markdown', rawHref: 'interaction:int-1' },
        );
    });

    it('supports a host activation callback', () => {
        const onActivate = vi.fn();
        render(
            <AgentResourceResolverProvider value={() => ({ kind: 'activate', onActivate })}>
                <MarkdownLink href="store:doc-1">Document</MarkdownLink>
            </AgentResourceResolverProvider>,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Document' }));
        expect(onActivate).toHaveBeenCalledOnce();
    });

    it('renders plain text when no host resolver is configured', () => {
        render(<MarkdownLink href="collection:col-1">Collection</MarkdownLink>);

        expect(screen.queryByRole('link')).toBeNull();
        expect(screen.getByText('Collection').tagName).toBe('SPAN');
    });

    it('preserves the class name when delegating standard and resolved resource links', () => {
        const resolver: AgentResourceResolver = () => ({ kind: 'navigate', href: '/custom/interactions/int-1' });
        render(
            <AgentResourceResolverProvider value={resolver}>
                <MarkdownLink href="https://example.com" className="standard-link" ExistingLink={ExistingLink}>
                    Standard
                </MarkdownLink>
                <MarkdownLink href="interaction:int-1" className="resource-link" ExistingLink={ExistingLink}>
                    Resource
                </MarkdownLink>
            </AgentResourceResolverProvider>,
        );

        expect(screen.getByRole('link', { name: 'Standard' }).className).toBe('standard-link');
        expect(screen.getByRole('link', { name: 'Resource' }).className).toBe('resource-link');
    });
});
