// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type AgentResourceResolver, AgentResourceResolverProvider } from './AgentResourceResolver.js';
import type { MarkdownLinkProps } from './MarkdownLink.js';
import { MarkdownLink } from './MarkdownLink.js';

vi.mock('./useResolvedUrl.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./useResolvedUrl.js')>();
    return {
        ...actual,
        useResolvedUrl: () => ({
            url: 'https://example.test/artifact',
            isLoading: false,
            error: undefined,
            scheme: 'artifact' as const,
            retry: vi.fn(),
        }),
    };
});

afterEach(cleanup);

describe('MarkdownLink artifact navigation', () => {
    it('opens a Markdown artifact in the host viewer', () => {
        const onArtifactOpen = vi.fn();
        render(
            <MarkdownLink href="artifact:files/report.md" artifactRunId="run-1" onArtifactOpen={onArtifactOpen}>
                Report
            </MarkdownLink>,
        );

        fireEvent.click(screen.getByRole('link', { name: 'Report' }));

        expect(onArtifactOpen).toHaveBeenCalledWith('files/report.md');
    });

    it('keeps modified clicks and non-Markdown artifacts as downloads', () => {
        const onArtifactOpen = vi.fn();
        const view = render(
            <MarkdownLink href="artifact:files/report.md" artifactRunId="run-1" onArtifactOpen={onArtifactOpen}>
                Report
            </MarkdownLink>,
        );

        fireEvent.click(screen.getByRole('link', { name: 'Report' }), { metaKey: true });
        expect(onArtifactOpen).not.toHaveBeenCalled();

        view.rerender(
            <MarkdownLink href="artifact:files/report.pdf" artifactRunId="run-1" onArtifactOpen={onArtifactOpen}>
                Report PDF
            </MarkdownLink>,
        );
        fireEvent.click(screen.getByRole('link', { name: 'Report PDF' }));

        expect(onArtifactOpen).not.toHaveBeenCalled();
    });
});

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
