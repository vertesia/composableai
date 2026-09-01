import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from '../../__tests__/axe-helper.js';
import { MemoryGraphInspector } from './MemoryGraphInspector.js';
import type { MemoryEntity, MemoryEntry, MemoryRelationship } from './memoryGraphModel.js';

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
        raw: {},
    },
];

const entities: MemoryEntity[] = [
    {
        recordId: 'entity-record-1',
        entityId: 'coreweave',
        displayName: 'CoreWeave',
        kind: 'public_company',
        ticker: 'CRWV',
        raw: {
            entity_id: 'coreweave',
            display_name: 'CoreWeave',
            ticker: 'CRWV',
            // None of the following is part of the curated layout.
            sector_exposure: ['frontier_models', 'enterprise'],
            headcount: 1200,
            is_public: true,
            parent: null,
        },
    },
];

const relationships: MemoryRelationship[] = [
    {
        recordId: 'relationship-record-1',
        relationshipId: 'rel-1',
        subjectId: 'coreweave',
        predicate: 'cloud_hosts',
        objectId: 'openai',
        confidence: 'explicit',
        confidenceScore: 1,
        evidence: [
            { sourceId: 'sec2y-iren-operating-update-2025-06-05', locator: 'Ex. 99.1' },
            { sourceId: 'unresolved-source-2' },
        ],
        raw: {
            relationship_id: 'rel-1',
            subject_id: 'coreweave',
            predicate: 'cloud_hosts',
            object_id: 'openai',
            qualifiers: { workload: 'training', megawatts: 250 },
        },
    },
];

const sourceRecordIds = new Map([['sec2y-iren-operating-update-2025-06-05', 'source-record-1']]);

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

    describe('all attributes', () => {
        function renderEntity() {
            return render(
                <MemoryGraphInspector
                    selection={{ kind: 'entity', id: 'coreweave' }}
                    entities={entities}
                    relationships={[]}
                    memories={[]}
                    search=""
                    onSelect={vi.fn()}
                    onOpenRecord={vi.fn()}
                />,
            );
        }

        it('stays collapsed until asked for', () => {
            renderEntity();

            expect(screen.getByRole('button', { name: /All attributes/ })).toBeTruthy();
            expect(screen.queryByText('sector_exposure')).toBeNull();
        });

        it('renders every stored key, humanised and verbatim, including ones the layout ignores', async () => {
            renderEntity();
            await userEvent.click(screen.getByRole('button', { name: /All attributes/ }));

            for (const key of ['entity_id', 'display_name', 'ticker', 'sector_exposure', 'headcount', 'is_public']) {
                // A single-word key humanises to itself, so it legitimately appears twice.
                expect(screen.getAllByText(key).length).toBeGreaterThan(0);
            }
            // Humanised labels sit next to the exact stored key, which operators debug against.
            expect(screen.getByText('sector exposure')).toBeTruthy();
            expect(screen.getByText('display name')).toBeTruthy();
            // Scalars render inline; a null value is not silently dropped.
            expect(screen.getByText('1200')).toBeTruthy();
            expect(screen.getByText('true')).toBeTruthy();
            expect(screen.getAllByText('parent').length).toBeGreaterThan(0);
        });

        it('renders a nested value as scrollable JSON rather than widening the panel', async () => {
            const { container } = renderEntity();
            await userEvent.click(screen.getByRole('button', { name: /All attributes/ }));

            const block = container.querySelector('pre');
            expect(block).not.toBeNull();
            expect(block?.textContent).toContain('frontier_models');
            expect(block?.className).toContain('overflow-auto');
        });

        it('has no axe violations with the attributes expanded', async () => {
            const { container } = renderEntity();
            await userEvent.click(screen.getByRole('button', { name: /All attributes/ }));

            expect(await axe(container)).toHaveNoViolations();
        });

        it('shows the statement and memory records their own stored properties', async () => {
            render(
                <MemoryGraphInspector
                    selection={{ kind: 'statement', id: 'rel-1' }}
                    entities={entities}
                    relationships={relationships}
                    memories={[]}
                    search=""
                    onSelect={vi.fn()}
                    onOpenRecord={vi.fn()}
                />,
            );
            await userEvent.click(screen.getByRole('button', { name: /All attributes/ }));

            expect(screen.getAllByText('qualifiers').length).toBeGreaterThan(0);
            expect(screen.getByText('object_id')).toBeTruthy();
        });
    });

    describe('content-object links', () => {
        it('opens the selected entity record', async () => {
            const onOpenRecord = vi.fn();
            render(
                <MemoryGraphInspector
                    selection={{ kind: 'entity', id: 'coreweave' }}
                    entities={entities}
                    relationships={[]}
                    memories={[]}
                    search=""
                    onSelect={vi.fn()}
                    onOpenRecord={onOpenRecord}
                />,
            );

            await userEvent.click(screen.getByRole('button', { name: /Open entity record/ }));
            expect(onOpenRecord).toHaveBeenCalledWith('entity-record-1');
        });

        it('opens the selected memory record', async () => {
            const onOpenRecord = vi.fn();
            render(
                <MemoryGraphInspector
                    selection={{ kind: 'memory', id: 'mem-1' }}
                    entities={[]}
                    relationships={[]}
                    memories={memories}
                    search=""
                    onSelect={vi.fn()}
                    onOpenRecord={onOpenRecord}
                />,
            );

            await userEvent.click(screen.getByRole('button', { name: /Open memory record/ }));
            expect(onOpenRecord).toHaveBeenCalledWith('memory-record-1');
        });

        it('links an evidence source that resolved, and leaves an unresolved one as text', async () => {
            const onOpenRecord = vi.fn();
            render(
                <MemoryGraphInspector
                    selection={{ kind: 'statement', id: 'rel-1' }}
                    entities={entities}
                    relationships={relationships}
                    memories={[]}
                    sourceRecordIds={sourceRecordIds}
                    search=""
                    onSelect={vi.fn()}
                    onOpenRecord={onOpenRecord}
                />,
            );

            await userEvent.click(
                screen.getByRole('button', { name: 'Open source record sec2y-iren-operating-update-2025-06-05' }),
            );
            expect(onOpenRecord).toHaveBeenCalledWith('source-record-1');
            // An id the snapshot could not resolve must not pretend to be a link.
            expect(screen.getByText('unresolved-source-2')).toBeTruthy();
            expect(screen.queryByRole('button', { name: /Open source record unresolved-source-2/ })).toBeNull();
        });

        it('opens the statement record from the selected statement', async () => {
            const onOpenRecord = vi.fn();
            render(
                <MemoryGraphInspector
                    selection={{ kind: 'statement', id: 'rel-1' }}
                    entities={entities}
                    relationships={relationships}
                    memories={[]}
                    search=""
                    onSelect={vi.fn()}
                    onOpenRecord={onOpenRecord}
                />,
            );

            await userEvent.click(screen.getByRole('button', { name: /Open statement record/ }));
            expect(onOpenRecord).toHaveBeenCalledWith('relationship-record-1');
        });
    });

    describe('time axes', () => {
        // Published 2025-06-05, true only for May — the record that made the two axes worth telling
        // apart in the first place.
        const monthly: MemoryEntry[] = [
            {
                recordId: 'memory-record-2',
                memoryId: 'mem-iren-may',
                kind: 'event',
                title: 'IREN May operating update',
                summary: 'Monthly capacity figures for May.',
                entityIds: [],
                confidence: 'explicit',
                observedAt: '2025-06-05',
                validFrom: '2025-05-01',
                validTo: '2025-05-31',
                evidence: [],
                raw: {},
            },
        ];

        function renderList(timeAxis: 'valid' | 'observed', asOf: string) {
            return render(
                <MemoryGraphInspector
                    selection={undefined}
                    entities={[]}
                    relationships={[]}
                    memories={monthly}
                    timeAxis={timeAxis}
                    asOf={asOf}
                    search=""
                    onSelect={vi.fn()}
                />,
            );
        }

        it('holds a record in scope only inside its validity window on business time', () => {
            renderList('valid', '2025-04-30');
            expect(screen.queryByText('IREN May operating update')).toBeNull();
            cleanup();

            renderList('valid', '2025-05-15');
            expect(screen.getByText('IREN May operating update')).toBeTruthy();
            cleanup();

            renderList('valid', '2025-06-15');
            expect(screen.queryByText('IREN May operating update')).toBeNull();
        });

        it('switching the axis changes which records are in scope at the same cutoff', () => {
            // 2025-06-15 is after publication but after the validity window closed too, so the two
            // axes disagree about the very same record at the very same date.
            renderList('observed', '2025-06-15');
            expect(screen.getByText('IREN May operating update')).toBeTruthy();
            cleanup();

            renderList('observed', '2025-05-15');
            expect(screen.queryByText('IREN May operating update')).toBeNull();
        });

        it('states both dates on the selected record, with the stored field names', () => {
            render(
                <MemoryGraphInspector
                    selection={{ kind: 'memory', id: 'mem-iren-may' }}
                    entities={[]}
                    relationships={[]}
                    memories={monthly}
                    search=""
                    onSelect={vi.fn()}
                    onOpenRecord={vi.fn()}
                />,
            );

            expect(screen.getByText('When it was true')).toBeTruthy();
            expect(screen.getByText('When we learned it')).toBeTruthy();
            expect(screen.getByText('valid_from → valid_to')).toBeTruthy();
            expect(screen.getByText('observed_at')).toBeTruthy();
            expect(screen.getByText('valid 2025-05-01 → 2025-05-31')).toBeTruthy();
            expect(screen.getByText('2025-06-05')).toBeTruthy();
        });
    });
});
