// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
    collectGroupKeys,
    collectObservedDates,
    computeDegrees,
    computeGraphIdentity,
    computeGraphViewBox,
    computeNeighborhood,
    computeNodeRadius,
    computeTimelineMarkers,
    formatEdgeLabel,
    formatQualifiers,
    isEdgeObservedBy,
    isExpiredEdge,
    isInferredEdge,
    layoutTemporalGraph,
    primaryQualifierValue,
    resolveGroupStyles,
    TEMPORAL_GRAPH_PALETTE,
    type TemporalGraphEdge,
    type TemporalGraphNode,
} from './temporalGraphModel.js';

const nodes: TemporalGraphNode[] = [
    { id: 'nvidia', label: 'NVIDIA', group: 'compute' },
    { id: 'coreweave', label: 'CoreWeave', group: 'cloud' },
    { id: 'openai', label: 'OpenAI', group: 'ai_platform' },
    { id: 'vega', label: 'Vega DC', group: 'datacenter' },
];

const edges: TemporalGraphEdge[] = [
    { id: 'e1', source: 'nvidia', target: 'coreweave', label: 'supplies', confidence: 1, observedAt: '2025-04' },
    { id: 'e2', source: 'coreweave', target: 'openai', label: 'cloud_hosts', confidence: 1, observedAt: '2025-03' },
    { id: 'e3', source: 'nvidia', target: 'openai', label: 'supplies', confidence: 0.82, observedAt: '2026-01' },
    { id: 'e4', source: 'coreweave', target: 'vega', label: 'leases' },
];

describe('as-of filtering', () => {
    it('keeps an edge observed at or before the cutoff and every timeless edge', () => {
        expect(edges.filter((edge) => isEdgeObservedBy(edge, '2025-04')).map((edge) => edge.id)).toEqual([
            'e1',
            'e2',
            'e4',
        ]);
    });

    it('disables the filter entirely when no cutoff is given', () => {
        expect(edges.every((edge) => isEdgeObservedBy(edge))).toBe(true);
    });

    it('lists the distinct observation dates in order', () => {
        expect(collectObservedDates(edges)).toEqual(['2025-03', '2025-04', '2026-01']);
    });
});

describe('computeDegrees', () => {
    it('counts incident visible edges per node', () => {
        expect(Object.fromEntries(computeDegrees(edges))).toEqual({
            nvidia: 2,
            coreweave: 3,
            openai: 2,
            vega: 1,
        });
    });

    it('drops edges observed after the cutoff', () => {
        expect(Object.fromEntries(computeDegrees(edges, '2025-04'))).toEqual({
            nvidia: 1,
            coreweave: 3,
            openai: 1,
            vega: 1,
        });
    });

    it('counts a self-loop once', () => {
        const degrees = computeDegrees([{ id: 'loop', source: 'a', target: 'a' }]);
        expect(degrees.get('a')).toBe(1);
    });
});

describe('computeNodeRadius', () => {
    it('grows with degree and clamps at the configured maximum', () => {
        expect(computeNodeRadius(0)).toBe(10);
        expect(computeNodeRadius(2)).toBe(17);
        expect(computeNodeRadius(1000)).toBe(34);
    });

    it('honors overridden radius options', () => {
        expect(computeNodeRadius(3, { nodeRadiusBase: 4, nodeRadiusStep: 2, nodeRadiusMax: 100 })).toBe(10);
    });
});

describe('computeNeighborhood', () => {
    it('returns the focused node plus its one-hop neighbors', () => {
        expect([...(computeNeighborhood(edges, 'coreweave') ?? [])].sort()).toEqual([
            'coreweave',
            'nvidia',
            'openai',
            'vega',
        ]);
    });

    it('ignores neighbors reached only through an edge past the cutoff', () => {
        expect([...(computeNeighborhood(edges, 'nvidia', '2025-04') ?? [])].sort()).toEqual(['coreweave', 'nvidia']);
    });

    it('is undefined when nothing is focused', () => {
        expect(computeNeighborhood(edges, undefined)).toBeUndefined();
    });
});

describe('resolveGroupStyles', () => {
    it('humanizes undeclared group keys and assigns palette colors by sorted key', () => {
        const styles = resolveGroupStyles(nodes);
        expect(styles.ai_platform.label).toBe('ai platform');
        // Sorted keys: ai_platform, cloud, compute, datacenter.
        expect(styles.ai_platform.color).toBe(TEMPORAL_GRAPH_PALETTE[0]);
        expect(styles.datacenter.color).toBe(TEMPORAL_GRAPH_PALETTE[3]);
    });

    it('is stable when the node array is reordered', () => {
        expect(resolveGroupStyles([...nodes].reverse())).toEqual(resolveGroupStyles(nodes));
    });

    it('lets declared groups override the label and the color', () => {
        const styles = resolveGroupStyles(nodes, { cloud: { label: 'Cloud platform', color: '#123456' } });
        expect(styles.cloud).toEqual({ label: 'Cloud platform', color: '#123456' });
    });

    it('keeps a declared group that no node uses, so the legend stays complete', () => {
        expect(resolveGroupStyles([], { power: { label: 'Power' } }).power.label).toBe('Power');
    });

    it('collects group keys in first-appearance order and ignores ungrouped nodes', () => {
        expect(collectGroupKeys([...nodes, { id: 'x', label: 'X' }])).toEqual([
            'compute',
            'cloud',
            'ai_platform',
            'datacenter',
        ]);
    });
});

describe('layoutTemporalGraph', () => {

    it('keeps every node inside the canvas even when no edge holds it', () => {
        // A sparse graph is mostly isolated nodes; unclamped they drift out and stretch the fitted
        // viewBox until the connected core renders as unclickable specks.
        const many = Array.from({ length: 12 }, (_, i) => ({ id: `n${i}`, label: `N${i}` }));
        const sparse = [{ id: 'e1', source: 'n0', target: 'n1' }];
        const positions = layoutTemporalGraph(many, sparse, { width: 1000, height: 640 });
        for (const [, point] of positions) {
            expect(point.x).toBeGreaterThanOrEqual(0);
            expect(point.x).toBeLessThanOrEqual(1000);
            expect(point.y).toBeGreaterThanOrEqual(0);
            expect(point.y).toBeLessThanOrEqual(640);
        }
    });
    it('is deterministic for the same input', () => {
        const first = layoutTemporalGraph(nodes, edges);
        const second = layoutTemporalGraph(nodes, edges);
        expect([...second]).toEqual([...first]);
    });

    it('produces different positions for a different seed', () => {
        const base = layoutTemporalGraph(nodes, edges);
        const reseeded = layoutTemporalGraph(nodes, edges, { seed: 99 });
        expect(reseeded.get('nvidia')).not.toEqual(base.get('nvidia'));
    });

    it('places every node at a finite coordinate, including an isolated one', () => {
        const isolated = [...nodes, { id: 'alone', label: 'Alone' }];
        const positions = layoutTemporalGraph(isolated, edges);
        expect(positions.size).toBe(5);
        for (const point of positions.values()) {
            expect(Number.isFinite(point.x)).toBe(true);
            expect(Number.isFinite(point.y)).toBe(true);
        }
    });

    it('centers a single node and returns nothing for an empty graph', () => {
        expect(layoutTemporalGraph([{ id: 'solo', label: 'Solo' }], [])).toEqual(
            new Map([['solo', { x: 500, y: 320 }]]),
        );
        expect(layoutTemporalGraph([], []).size).toBe(0);
    });

    it('separates connected nodes rather than collapsing them onto one another', () => {
        const positions = layoutTemporalGraph(nodes, edges);
        const a = positions.get('nvidia');
        const b = positions.get('openai');
        expect(Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0))).toBeGreaterThan(20);
    });

    it('ignores edges that reference an unknown node', () => {
        const positions = layoutTemporalGraph(nodes, [...edges, { id: 'dangling', source: 'nvidia', target: 'ghost' }]);
        expect(positions.has('ghost')).toBe(false);
        expect(positions.size).toBe(nodes.length);
    });
});

describe('computeGraphViewBox', () => {
    it('wraps every node with its radius and the padding', () => {
        const positions = new Map([
            ['a', { x: 100, y: 100 }],
            ['b', { x: 300, y: 200 }],
        ]);
        const radii = new Map([
            ['a', 10],
            ['b', 20],
        ]);
        // Node `a` reaches 100 ± (10 + 18 label allowance), `b` reaches 300 ± (20 + 18), then the
        // 10px padding is added on every side.
        expect(computeGraphViewBox(positions, radii, 10)).toEqual({ x: 62, y: 62, width: 286, height: 186 });
    });

    it('falls back when there is nothing to frame', () => {
        expect(computeGraphViewBox(new Map(), new Map())).toEqual({ x: 0, y: 0, width: 1000, height: 640 });
    });
});

describe('computeGraphIdentity', () => {
    it('ignores array order but reacts to a swapped record', () => {
        expect(computeGraphIdentity([...nodes].reverse(), [...edges].reverse())).toBe(
            computeGraphIdentity(nodes, edges),
        );
        const swapped = [...nodes.slice(0, 3), { id: 'other', label: 'Other' }];
        expect(computeGraphIdentity(swapped, edges)).not.toBe(computeGraphIdentity(nodes, edges));
    });

    it('is empty when there is nothing to frame', () => {
        expect(computeGraphIdentity([], edges)).toBe('');
    });
});

describe('edge presentation', () => {
    it('appends the confidence only below a certainty', () => {
        expect(formatEdgeLabel(edges[0])).toBe('supplies');
        expect(formatEdgeLabel(edges[2])).toBe('supplies ·0.82');
        expect(formatEdgeLabel({ id: 'x', source: 'a', target: 'b', confidence: 0.5 })).toBe('·0.50');
        expect(formatEdgeLabel({ id: 'x', source: 'a', target: 'b' })).toBe('');
    });

    it('rides the leading qualifier along with the predicate', () => {
        const qualified: TemporalGraphEdge = {
            id: 'q',
            source: 'nvidia',
            target: 'amazon',
            label: 'supplies',
            confidence: 0.82,
            qualifiers: { commodity: 'GPUs', product: 'GB200' },
        };
        expect(formatEdgeLabel(qualified)).toBe('supplies·GPUs ·0.82');
        expect(primaryQualifierValue(qualified.qualifiers)).toBe('GPUs');
        expect(primaryQualifierValue(undefined)).toBeUndefined();
        expect(primaryQualifierValue({})).toBeUndefined();
    });

    it('renders every qualifier as key=value for the inspector', () => {
        expect(formatQualifiers({ commodity: 'datacenter capacity', size: '~250MW' })).toBe(
            'commodity=datacenter capacity · size=~250MW',
        );
        expect(formatQualifiers({ megawatts: 250 })).toBe('megawatts=250');
        expect(formatQualifiers(undefined)).toBe('');
    });

    it('marks an edge below the inference threshold', () => {
        expect(isInferredEdge(edges[2])).toBe(true);
        expect(isInferredEdge(edges[0])).toBe(false);
        expect(isInferredEdge({ id: 'x', source: 'a', target: 'b', confidence: 0.9 })).toBe(false);
        expect(isInferredEdge(edges[3])).toBe(false);
    });
});

describe('validity expiry', () => {
    const lease: TemporalGraphEdge = {
        id: 'lease',
        source: 'applied_digital',
        target: 'coreweave',
        label: 'leases_capacity_to',
        confidence: 1,
        observedAt: '2025-07',
        validFrom: '2025-07',
        validTo: '2026-06',
        qualifiers: { commodity: 'datacenter capacity', size: '~250MW' },
    };

    it('is not expired while the cutoff is inside the validity window', () => {
        expect(isExpiredEdge(lease, '2026-06')).toBe(false);
        expect(isExpiredEdge(lease, '2025-09')).toBe(false);
    });

    it('is expired once the cutoff moves past validTo', () => {
        expect(isExpiredEdge(lease, '2026-07')).toBe(true);
    });

    it('needs both a cutoff and a validTo to expire', () => {
        expect(isExpiredEdge(lease)).toBe(false);
        expect(isExpiredEdge({ id: 'x', source: 'a', target: 'b', validFrom: '2020-01' }, '2030-01')).toBe(false);
    });

    it('is independent of belief time: an unobserved edge can still be classified', () => {
        // observedAt gates visibility, validTo gates being in force; the two do not interact.
        expect(isEdgeObservedBy(lease, '2025-01')).toBe(false);
        expect(isExpiredEdge(lease, '2026-08')).toBe(true);
    });

    it('suffixes the label with the ended marker', () => {
        expect(formatEdgeLabel(lease, '2026-08')).toBe('leases_capacity_to·datacenter capacity ·ended');
        expect(formatEdgeLabel(lease, '2026-01')).toBe('leases_capacity_to·datacenter capacity');
        expect(formatEdgeLabel({ id: 'x', source: 'a', target: 'b', validTo: '2020-01' }, '2026-01')).toBe('·ended');
    });
});

describe('computeTimelineMarkers', () => {
    const stops = ['2025-01', '2025-04', '2025-07', '2026-01'];
    const episodes = [
        { id: 'ep-1', date: '2025-04', label: 'Hosting agreement signed' },
        { id: 'ep-2', date: '2025-09', label: 'Lease signed' },
        { id: 'ep-3', date: '2026-01', label: 'Consortium announced' },
        { id: 'ep-0', date: '2024-02', label: 'Before the first stop' },
    ];

    it('snaps each episode back to the latest stop at or before its date', () => {
        expect(computeTimelineMarkers(stops, episodes).map((marker) => [marker.id, marker.stopIndex])).toEqual([
            ['ep-1', 1],
            ['ep-2', 2],
            ['ep-3', 3],
            ['ep-0', 0],
        ]);
    });

    it('positions markers as a 0..1 ratio across the track', () => {
        const ratios = Object.fromEntries(
            computeTimelineMarkers(stops, episodes).map((marker) => [marker.id, marker.ratio]),
        );
        expect(ratios).toEqual({ 'ep-1': 1 / 3, 'ep-2': 2 / 3, 'ep-3': 1, 'ep-0': 0 });
    });

    it('collapses onto the single stop rather than dividing by zero', () => {
        expect(computeTimelineMarkers(['2025-01'], episodes.slice(0, 1))).toEqual([
            { id: 'ep-1', date: '2025-04', label: 'Hosting agreement signed', stopIndex: 0, ratio: 0, data: undefined },
        ]);
    });

    it('has nothing to place when the track has no stop', () => {
        expect(computeTimelineMarkers([], episodes)).toEqual([]);
    });

    it('carries the caller payload through', () => {
        const [marker] = computeTimelineMarkers(stops, [
            { id: 'ep', date: '2025-07', label: 'Episode', data: { recordId: 'r1' } },
        ]);
        expect(marker.data).toEqual({ recordId: 'r1' });
    });
});
