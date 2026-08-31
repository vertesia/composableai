import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from '../../__tests__/axe-helper.js';
import { TemporalGraph } from './TemporalGraph.js';
import type { TemporalGraphEdge, TemporalGraphNode } from './temporalGraphModel.js';

const nodes: TemporalGraphNode[] = [
    { id: 'nvidia', label: 'NVIDIA', sublabel: '$NVDA', group: 'compute' },
    { id: 'coreweave', label: 'CoreWeave', group: 'cloud' },
    { id: 'openai', label: 'OpenAI', group: 'ai_platform' },
];

const edges: TemporalGraphEdge[] = [
    { id: 'e1', source: 'nvidia', target: 'coreweave', label: 'supplies', confidence: 1, observedAt: '2025-04' },
    {
        id: 'e2',
        source: 'coreweave',
        target: 'openai',
        label: 'cloud_hosts',
        confidence: 1,
        observedAt: '2025-03',
        validFrom: '2025-03',
        validTo: '2026-01',
        qualifiers: { workload: 'training' },
    },
];

afterEach(cleanup);

describe('TemporalGraph', () => {
    it('renders every node as a focusable, labelled control', () => {
        render(<TemporalGraph nodes={nodes} edges={edges} label="Test graph" />);

        const node = screen.getByRole('button', { name: 'CoreWeave, cloud, 2 links' });
        expect(node.getAttribute('tabindex')).toBe('0');
        expect(screen.getByRole('application', { name: 'Test graph' })).toBeTruthy();
    });

    it('has no axe violations', async () => {
        const { container } = render(<TemporalGraph nodes={nodes} edges={edges} label="Test graph" />);
        expect(await axe(container)).toHaveNoViolations();
    });

    it('selects a node with the keyboard and reports it to the host', async () => {
        const onSelect = vi.fn();
        render(<TemporalGraph nodes={nodes} edges={edges} label="Test graph" onSelect={onSelect} />);

        const node = screen.getByRole('button', { name: /^NVIDIA/ });
        node.focus();
        await userEvent.keyboard('{Enter}');

        expect(onSelect).toHaveBeenCalledWith({ type: 'node', id: 'nvidia' });
        expect(screen.getByRole('button', { name: /^NVIDIA/ }).getAttribute('aria-pressed')).toBe('true');
    });

    it('leaves the controlled selection to the host', async () => {
        const onSelect = vi.fn();
        render(<TemporalGraph nodes={nodes} edges={edges} label="Test graph" selection={null} onSelect={onSelect} />);

        await userEvent.click(screen.getByRole('button', { name: /^OpenAI/ }));

        expect(onSelect).toHaveBeenCalledWith({ type: 'node', id: 'openai' });
        // Controlled: nothing is selected until the host says so.
        expect(screen.getByRole('button', { name: /^OpenAI/ }).getAttribute('aria-pressed')).toBe('false');
    });

    it('labels an edge with its predicate, qualifier and expiry at the cutoff', () => {
        const { rerender } = render(<TemporalGraph nodes={nodes} edges={edges} asOf="2025-12" label="g" />);
        expect(screen.getByRole('button', { name: 'cloud_hosts·training' })).toBeTruthy();

        rerender(<TemporalGraph nodes={nodes} edges={edges} asOf="2026-06" label="g" />);
        expect(screen.getByRole('button', { name: 'cloud_hosts·training ·ended' })).toBeTruthy();
    });

    it('takes an edge observed after the cutoff out of the tab order', () => {
        render(<TemporalGraph nodes={nodes} edges={edges} asOf="2025-03" label="g" />);
        expect(screen.getByRole('button', { name: 'supplies' }).getAttribute('tabindex')).toBe('-1');
        expect(screen.getByRole('button', { name: 'cloud_hosts·training' }).getAttribute('tabindex')).toBe('0');
    });

    it('keeps node positions stable across selection and as-of changes', async () => {
        // One focus ring per node, always rendered — unlike the halo, which only exists while the
        // node is selected.
        const positions = () =>
            [...document.querySelectorAll('circle.temporal-graph-focus-ring')].map(
                (circle) => `${circle.getAttribute('cx')},${circle.getAttribute('cy')}`,
            );

        const { rerender } = render(<TemporalGraph nodes={nodes} edges={edges} label="g" />);
        const before = positions();

        await userEvent.click(screen.getByRole('button', { name: /^NVIDIA/ }));
        rerender(<TemporalGraph nodes={nodes} edges={edges} asOf="2025-03" matchedIds={['openai']} label="g" />);

        expect(positions()).toEqual(before);
    });

    it('gives every edge and node a widened, transparent hit target', () => {
        render(<TemporalGraph nodes={nodes} edges={edges} label="g" />);

        const bands = [...document.querySelectorAll('line.temporal-graph-hit')];
        expect(bands).toHaveLength(edges.length);
        expect(bands.every((band) => Number(band.getAttribute('stroke-width')) >= 12)).toBe(true);
        // One transparent halo per node, wider than the drawn circle.
        expect(document.querySelectorAll('circle[fill="transparent"]')).toHaveLength(nodes.length);
    });

    it('falls back to the host empty state when there is no node', () => {
        render(<TemporalGraph nodes={[]} edges={[]} emptyState={<p>Nothing reconstructed</p>} label="g" />);
        expect(screen.getByText('Nothing reconstructed')).toBeTruthy();
        expect(screen.queryByRole('application')).toBeNull();
    });
});
