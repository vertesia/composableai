import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from '../../__tests__/axe-helper.js';
import { MemoryGraphInspector } from './MemoryGraphInspector.js';
import type { MemoryEntry } from './memoryGraphModel.js';

const memories: MemoryEntry[] = [
    {
        recordId: 'memory-record-1',
        memoryId: 'mem-1',
        kind: 'event',
        title: 'Deal signed',
        summary: 'CoreWeave signed a multi-year capacity deal.',
        entityIds: ['coreweave'],
        confidence: 'explicit',
        observedAt: '2025-06',
        evidence: [],
    },
];

afterEach(cleanup);

describe('MemoryGraphInspector', () => {
    it('lists content memory when nothing is selected', () => {
        render(
            <MemoryGraphInspector
                selection={undefined}
                entities={[]}
                relationships={[]}
                memories={memories}
                search=""
                onSelect={vi.fn()}
            />,
        );

        expect(screen.getByText('Deal signed')).toBeTruthy();
    });

    it('names a selection the snapshot does not hold instead of silently falling back', async () => {
        const onSelect = vi.fn();
        render(
            <MemoryGraphInspector
                selection={{ kind: 'statement', id: 'ghost-statement' }}
                entities={[]}
                relationships={[]}
                memories={memories}
                search=""
                onSelect={onSelect}
            />,
        );

        expect(screen.getByText('Not in this snapshot')).toBeTruthy();
        expect(screen.getByText('Statement')).toBeTruthy();
        expect(screen.getByText('ghost-statement')).toBeTruthy();
        // The default panel must not be what a dead click lands on.
        expect(screen.queryByText('Deal signed')).toBeNull();

        await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
        expect(onSelect).toHaveBeenCalledWith(undefined);
    });

    it('has no axe violations while reporting a missing selection', async () => {
        const { container } = render(
            <MemoryGraphInspector
                selection={{ kind: 'entity', id: 'ghost-entity' }}
                entities={[]}
                relationships={[]}
                memories={[]}
                search=""
                onSelect={vi.fn()}
            />,
        );

        expect(await axe(container)).toHaveNoViolations();
    });
});
