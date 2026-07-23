// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { AgentResourceReference } from '@vertesia/common';
import {
    Boxes,
    BrainCircuit,
    Database,
    FileType,
    MessagesSquare,
    PanelsTopLeft,
    PlayCircle,
    SquareTerminal,
    Workflow,
} from 'lucide-react';
import type React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../../i18n/index.js';
import { ReactRouterContext, type RouterContext } from '../../../../router/index.js';
import { AgentResourceResolverProvider } from '../../../../widgets/markdown/AgentResourceResolver';
import { ResourceChangeSummary } from './ResourceChangeSummary';
import { ResourceChip } from './ResourceChip';
import { getResourceIcon } from './resourceLinks';

function makeRouterContext(): RouterContext {
    return {
        location: window.location,
        route: { path: '/', Component: () => null },
        params: {},
        state: null,
        matchedRoutePath: '/',
        navigate: vi.fn(),
        router: {
            navigate: vi.fn(),
            getTopRouter: () => ({ navigator: { addStickyParams: (href: string) => href } }),
        },
    } as unknown as RouterContext;
}

function renderWithProviders(ui: React.ReactNode) {
    return render(
        <I18nProvider lng="en">
            <ReactRouterContext.Provider value={makeRouterContext()}>{ui}</ReactRouterContext.Provider>
        </I18nProvider>,
    );
}

const ref = (over: Partial<AgentResourceReference> = {}): AgentResourceReference => ({
    type: 'document',
    id: 'd1',
    label: 'My Document',
    action: 'created',
    ...over,
});

afterEach(() => cleanup());

describe('ResourceChip', () => {
    it('uses the same icons as the Studio navigation', () => {
        expect(getResourceIcon('document')).toBe(Database);
        expect(getResourceIcon('collection')).toBe(Boxes);
        expect(getResourceIcon('content_type')).toBe(FileType);
        expect(getResourceIcon('interaction')).toBe(MessagesSquare);
        expect(getResourceIcon('prompt')).toBe(SquareTerminal);
        expect(getResourceIcon('agent')).toBe(BrainCircuit);
        expect(getResourceIcon('workflow')).toBe(Workflow);
        expect(getResourceIcon('process')).toBe(Workflow);
        expect(getResourceIcon('process_run')).toBe(PlayCircle);
        expect(getResourceIcon('interaction_run')).toBe(PlayCircle);
        expect(getResourceIcon('view')).toBe(PanelsTopLeft);
    });

    it('renders a navigable link supplied by the host resolver', () => {
        renderWithProviders(
            <AgentResourceResolverProvider value={() => ({ kind: 'navigate', href: '/documents/d1' })}>
                <ResourceChip resource={ref()} />
            </AgentResourceResolverProvider>,
        );
        const link = screen.getByRole('link', { name: /My Document/ });
        expect(link.getAttribute('href')).toContain('/documents/d1');
        expect(screen.getByText('Created')).not.toBeNull();
    });

    it('renders a non-interactive chip when the host does not configure a resolver', () => {
        renderWithProviders(<ResourceChip resource={ref({ type: 'interaction', id: 'int-1', label: 'Chat' })} />);
        expect(screen.queryByRole('link')).toBeNull();
        expect(screen.getByText('Chat')).not.toBeNull();
    });

    it('renders a deleted resource as a non-interactive chip (no link)', () => {
        renderWithProviders(<ResourceChip resource={ref({ action: 'deleted', label: 'Gone' })} />);
        expect(screen.queryByRole('link')).toBeNull();
        expect(screen.getByText('Gone')).not.toBeNull();
        expect(screen.getByText('Deleted')).not.toBeNull();
    });

    it('honors a resolver override from context', () => {
        renderWithProviders(
            <AgentResourceResolverProvider value={() => ({ kind: 'navigate', href: '/custom/path' })}>
                <ResourceChip resource={ref()} />
            </AgentResourceResolverProvider>,
        );
        expect(screen.getByRole('link').getAttribute('href')).toContain('/custom/path');
    });

    it('supports a host activation callback instead of navigation', () => {
        const onActivate = vi.fn();
        renderWithProviders(
            <AgentResourceResolverProvider value={() => ({ kind: 'activate', onActivate })}>
                <ResourceChip resource={ref()} />
            </AgentResourceResolverProvider>,
        );

        fireEvent.click(screen.getByRole('button', { name: /My Document/ }));
        expect(onActivate).toHaveBeenCalledOnce();
        expect(screen.queryByRole('link')).toBeNull();
    });
});

describe('ResourceChangeSummary', () => {
    it('renders nothing when there are no resources', () => {
        const { container } = renderWithProviders(<ResourceChangeSummary resources={[]} />);
        expect(container.querySelector('[data-agent-resource-summary]')).toBeNull();
    });

    it('renders a header and a chip per resource', () => {
        const { container } = renderWithProviders(
            <ResourceChangeSummary
                resources={[ref({ id: 'd1', label: 'Doc One' }), ref({ type: 'collection', id: 'c1', label: 'Col' })]}
            />,
        );
        expect(container.querySelector('[data-agent-resource-summary]')?.className).not.toContain('bg-muted');
        expect(screen.getByText('Resources changed')).not.toBeNull();
        expect(screen.getByText('Doc One')).not.toBeNull();
        expect(screen.getByText('Col')).not.toBeNull();
    });

    it('collapses beyond five resources and expands on click', () => {
        const many = Array.from({ length: 7 }, (_, i) => ref({ id: `d${i}`, label: `Doc ${i}` }));
        renderWithProviders(<ResourceChangeSummary resources={many} />);
        // Only 5 shown initially
        expect(screen.queryByText('Doc 5')).toBeNull();
        const toggle = screen.getByRole('button', { name: /View all 7 changes/ });
        fireEvent.click(toggle);
        expect(screen.getByText('Doc 5')).not.toBeNull();
        expect(screen.getByText('Doc 6')).not.toBeNull();
    });
});
