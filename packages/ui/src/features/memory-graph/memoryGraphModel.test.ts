// @vitest-environment node
import { type ContentObjectItemApiResponse, ContentObjectStatus, type JSONObject } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import {
    buildMemoryGraphView,
    collectMemoryPredicates,
    collectMemoryTimeline,
    computeEvidenceCoverage,
    computeMemoryMatchIds,
    type MemoryEntity,
    type MemoryEntry,
    type MemoryRelationship,
    memoryConfidenceScore,
    memoryEntityGroup,
    parseMemoryEntities,
    parseMemoryEntries,
    parseMemoryRelationships,
} from './memoryGraphModel.js';

function contentRecord(
    id: string,
    name: string,
    properties: JSONObject,
    externalId?: string,
): ContentObjectItemApiResponse {
    return {
        id,
        name,
        created_by: 'user-1',
        updated_by: 'user-1',
        created_at: '2026-08-29T00:00:00.000Z',
        updated_at: '2026-08-29T00:00:00.000Z',
        location: '/',
        status: ContentObjectStatus.completed,
        revision: { root: id, head: true },
        properties,
        ...(externalId ? { external_id: externalId } : {}),
    };
}

describe('parseMemoryEntities', () => {
    it('reads every declared entity field', () => {
        const records = [
            contentRecord('entity-record-msft', 'Microsoft record', {
                entity_id: 'microsoft',
                display_name: 'Microsoft',
                kind: 'public_company',
                layer: 'cloud_platform',
                ticker: 'MSFT',
                public_status: 'public',
            }),
        ];

        expect(parseMemoryEntities(records)).toEqual([
            {
                recordId: 'entity-record-msft',
                entityId: 'microsoft',
                displayName: 'Microsoft',
                kind: 'public_company',
                layer: 'cloud_platform',
                ticker: 'MSFT',
                publicStatus: 'public',
            } satisfies MemoryEntity,
        ]);
    });

    it('skips records without a usable entity_id', () => {
        const records = [
            contentRecord('entity-record-empty', 'No identifier', {}),
            contentRecord('entity-record-blank', 'Blank identifier', { entity_id: '   ' }),
            contentRecord('entity-record-typed', 'Wrong type', { entity_id: 42 }),
        ];

        expect(parseMemoryEntities(records)).toEqual([]);
    });

    it('falls back to the record name and the organization kind', () => {
        const records = [contentRecord('entity-record-openai', 'OpenAI', { entity_id: 'openai' })];

        expect(parseMemoryEntities(records)).toEqual([
            {
                recordId: 'entity-record-openai',
                entityId: 'openai',
                displayName: 'OpenAI',
                kind: 'organization',
                layer: undefined,
                ticker: undefined,
                publicStatus: undefined,
            } satisfies MemoryEntity,
        ]);
    });
});

describe('memoryConfidenceScore', () => {
    it('projects the reconstruction enums onto 0..1', () => {
        expect(memoryConfidenceScore('explicit')).toBe(1);
        expect(memoryConfidenceScore('strong_inference')).toBe(0.8);
        expect(memoryConfidenceScore('weak_inference')).toBe(0.55);
    });

    it('parses and clamps a numeric confidence', () => {
        expect(memoryConfidenceScore('0.82')).toBe(0.82);
        expect(memoryConfidenceScore('4')).toBe(1);
        expect(memoryConfidenceScore('-1')).toBe(0);
    });

    it('has no opinion about an uninterpretable value', () => {
        expect(memoryConfidenceScore('unspecified')).toBeUndefined();
        expect(memoryConfidenceScore(undefined)).toBeUndefined();
    });
});

describe('parseMemoryRelationships', () => {
    it('reads the tuple, confidence, temporal fields, qualifiers and structured evidence', () => {
        const records = [
            contentRecord('relationship-record-1', 'Applied Digital leases to CoreWeave', {
                relationship_id: 'rel-apld-crwv',
                subject_id: 'applied_digital',
                predicate: 'leases_capacity_to',
                object_id: 'coreweave',
                confidence: 'explicit',
                origin: 'reconstruction',
                notes: 'Ellendale campus',
                observed_at: '2025-07',
                valid_from: '2025-07',
                valid_to: '2026-06',
                qualifiers: {
                    commodity: 'datacenter capacity',
                    megawatts: 250,
                    nested: { ignored: true },
                    blank: '  ',
                },
                evidence: [
                    { source_id: 'sec-8k-apld-2025-07', locator: 'Ex. 99.1', summary: '~250MW lease' },
                    { locator: 'no source id, dropped' },
                    'not-an-object',
                ],
            }),
        ];

        expect(parseMemoryRelationships(records)).toEqual([
            {
                recordId: 'relationship-record-1',
                relationshipId: 'rel-apld-crwv',
                subjectId: 'applied_digital',
                predicate: 'leases_capacity_to',
                objectId: 'coreweave',
                confidence: 'explicit',
                confidenceScore: 1,
                origin: 'reconstruction',
                notes: 'Ellendale campus',
                observedAt: '2025-07',
                validFrom: '2025-07',
                validTo: '2026-06',
                qualifiers: { commodity: 'datacenter capacity', megawatts: 250 },
                evidence: [{ sourceId: 'sec-8k-apld-2025-07', locator: 'Ex. 99.1', summary: '~250MW lease' }],
            } satisfies MemoryRelationship,
        ]);
    });

    it('tolerates a corpus that carries none of the temporal or qualifier fields', () => {
        const records = [
            contentRecord('relationship-record-bare', 'Bare tuple', {
                subject_id: 'nvidia',
                predicate: 'supplies',
                object_id: 'coreweave',
            }),
        ];

        expect(parseMemoryRelationships(records)[0]).toMatchObject({
            observedAt: undefined,
            validFrom: undefined,
            validTo: undefined,
            qualifiers: undefined,
            confidence: 'unspecified',
            confidenceScore: undefined,
        });
    });

    it('preserves numeric reconstruction confidence and scores it', () => {
        const records = [
            contentRecord('relationship-record-numeric-confidence', 'Hut 8 develops Vega', {
                subject_id: 'hut8',
                predicate: 'develops_datacenter',
                object_id: 'vega_datacenter',
                confidence: 0.99,
            }),
        ];

        const [parsed] = parseMemoryRelationships(records);
        expect(parsed.confidence).toBe('0.99');
        expect(parsed.confidenceScore).toBe(0.99);
    });

    it('skips records missing any part of the tuple', () => {
        const records = [
            contentRecord('relationship-no-subject', 'No subject', { predicate: 'supplies', object_id: 'coreweave' }),
            contentRecord('relationship-no-predicate', 'No predicate', {
                subject_id: 'nvidia',
                object_id: 'coreweave',
            }),
            contentRecord('relationship-no-object', 'No object', { subject_id: 'nvidia', predicate: 'supplies' }),
        ];

        expect(parseMemoryRelationships(records)).toEqual([]);
    });

    it('falls back through external_id to the record id', () => {
        const withExternalId = contentRecord(
            'relationship-record-2',
            'Amazon invested in Anthropic',
            { subject_id: 'amazon', predicate: 'invested_in', object_id: 'anthropic' },
            'ai-market-network-v0:relationship:amazon-invested_in-anthropic',
        );
        const withoutAnyId = contentRecord('relationship-record-3', 'Cerebras partners with G42', {
            subject_id: 'cerebras',
            predicate: 'strategic_partner',
            object_id: 'g42',
            evidence: 'not-a-list',
        });

        const parsed = parseMemoryRelationships([withExternalId, withoutAnyId]);

        expect(parsed[0].relationshipId).toBe('ai-market-network-v0:relationship:amazon-invested_in-anthropic');
        expect(parsed[1].relationshipId).toBe('relationship-record-3');
        expect(parsed[1].evidence).toEqual([]);
    });
});

describe('parseMemoryEntries', () => {
    it('reads temporal content memory and structured evidence', () => {
        const records = [
            contentRecord('memory-record-1', 'Cerebras and G42 sign MOU', {
                memory_id: 'memory-cerebras-g42-mou',
                kind: 'commitment',
                title: 'Cerebras and G42 sign an AI infrastructure MOU',
                summary: 'G42 plans to deploy Cerebras systems in its cloud and research operations.',
                entity_ids: ['cerebras', 'g42', '', 42],
                confidence: 'explicit',
                observed_at: '2021-11-22',
                valid_from: '2021-11-22',
                notes: 'The MOU describes planned deployment rather than completed installation.',
                evidence: [
                    {
                        source_id: 'cerebras-g42-mou-2021-11-22',
                        locator: 'paragraph 4',
                        summary: 'G42 will equip its cloud and research institute with Cerebras systems.',
                    },
                ],
            }),
        ];

        expect(parseMemoryEntries(records)).toEqual([
            {
                recordId: 'memory-record-1',
                memoryId: 'memory-cerebras-g42-mou',
                kind: 'commitment',
                title: 'Cerebras and G42 sign an AI infrastructure MOU',
                summary: 'G42 plans to deploy Cerebras systems in its cloud and research operations.',
                entityIds: ['cerebras', 'g42'],
                confidence: 'explicit',
                observedAt: '2021-11-22',
                validFrom: '2021-11-22',
                validTo: undefined,
                notes: 'The MOU describes planned deployment rather than completed installation.',
                evidence: [
                    {
                        sourceId: 'cerebras-g42-mou-2021-11-22',
                        locator: 'paragraph 4',
                        summary: 'G42 will equip its cloud and research institute with Cerebras systems.',
                    },
                ],
            } satisfies MemoryEntry,
        ]);
    });

    it('skips records without the required identity, title, summary, or observation time', () => {
        const records = [
            contentRecord('memory-no-id', 'No ID', { title: 'Event', summary: 'S', observed_at: '2026-01-01' }),
            contentRecord('memory-no-title', 'No title', { memory_id: 'm2', summary: 'S', observed_at: '2026-01-01' }),
            contentRecord('memory-no-summary', 'No summary', {
                memory_id: 'm3',
                title: 'Event',
                observed_at: '2026-01-01',
            }),
            contentRecord('memory-no-observed-at', 'No date', { memory_id: 'm4', title: 'Event', summary: 'S' }),
        ];

        expect(parseMemoryEntries(records)).toEqual([]);
    });
});

describe('buildMemoryGraphView', () => {
    const entities: MemoryEntity[] = [
        {
            recordId: 'entity-record-msft',
            entityId: 'microsoft',
            displayName: 'Microsoft',
            kind: 'public_company',
            layer: 'cloud_platform',
            ticker: 'MSFT',
        },
        {
            recordId: 'entity-record-openai',
            entityId: 'openai',
            displayName: 'OpenAI',
            kind: 'private_company',
            layer: 'model_lab',
        },
        {
            recordId: 'entity-record-crwv',
            entityId: 'coreweave',
            displayName: 'CoreWeave',
            kind: 'public_company',
            layer: 'compute',
            ticker: 'CRWV',
        },
        {
            recordId: 'entity-record-vega',
            entityId: 'vega-datacenter',
            displayName: 'Vega data center',
            kind: 'facility',
            layer: 'datacenter',
        },
    ];

    const relationships: MemoryRelationship[] = [
        {
            recordId: 'relationship-record-1',
            relationshipId: 'rel-1',
            subjectId: 'microsoft',
            predicate: 'invested_in',
            objectId: 'openai',
            confidence: 'explicit',
            confidenceScore: 1,
            observedAt: '2025-01',
            evidence: [{ sourceId: 'sec-msft-2025q4', locator: 'Item 1A', summary: 'Investment disclosed' }],
        },
        {
            recordId: 'relationship-record-2',
            relationshipId: 'rel-2',
            subjectId: 'coreweave',
            predicate: 'cloud_hosts',
            objectId: 'openai',
            confidence: 'strong_inference',
            confidenceScore: 0.8,
            observedAt: '2025-03',
            validFrom: '2025-03',
            validTo: '2028-03',
            qualifiers: { workload: 'training' },
            evidence: [],
        },
        {
            // `nvidia` has no entity record, so this tuple can never be drawn.
            recordId: 'relationship-record-3',
            relationshipId: 'rel-3',
            subjectId: 'nvidia',
            predicate: 'supplies',
            objectId: 'coreweave',
            confidence: 'explicit',
            confidenceScore: 1,
            evidence: [],
        },
    ];

    it('keeps only entities that take part in a drawable statement', () => {
        const view = buildMemoryGraphView({ entities, relationships });

        expect(view.nodes.map((node) => node.id).sort()).toEqual(['coreweave', 'microsoft', 'openai']);
        expect(view.edges.map((edge) => edge.id).sort()).toEqual(['rel-1', 'rel-2']);
    });

    it('drops a statement whose subject or object has no entity record', () => {
        const view = buildMemoryGraphView({ entities, relationships });
        expect(view.edges.some((edge) => edge.id === 'rel-3')).toBe(false);
    });

    it('carries confidence, temporal fields, qualifiers and evidence onto the edge', () => {
        const view = buildMemoryGraphView({ entities, relationships });
        const edge = view.edges.find((candidate) => candidate.id === 'rel-2');

        expect(edge).toMatchObject({
            source: 'coreweave',
            target: 'openai',
            label: 'cloud_hosts',
            confidence: 0.8,
            observedAt: '2025-03',
            validFrom: '2025-03',
            validTo: '2028-03',
            qualifiers: { workload: 'training' },
        });
        expect(view.edges.find((candidate) => candidate.id === 'rel-1')?.evidence).toEqual([
            { source: 'sec-msft-2025q4', locator: 'Item 1A', excerpt: 'Investment disclosed' },
        ]);
    });

    it('labels a node with its display name, ticker and layer group', () => {
        const view = buildMemoryGraphView({ entities, relationships });
        const node = view.nodes.find((candidate) => candidate.id === 'coreweave');

        expect(node).toMatchObject({ label: 'CoreWeave', sublabel: '$CRWV', group: 'compute' });
        expect(view.nodes.find((candidate) => candidate.id === 'openai')?.sublabel).toBeUndefined();
        expect(Object.keys(view.groups).sort()).toEqual(['cloud_platform', 'compute', 'model_lab']);
    });

    it('groups by layer, falling back to kind', () => {
        expect(memoryEntityGroup(entities[0])).toBe('cloud_platform');
        expect(memoryEntityGroup({ ...entities[0], layer: undefined })).toBe('public_company');
    });

    it('is empty when nothing has been reconstructed', () => {
        expect(buildMemoryGraphView({ entities, relationships: [] })).toEqual({ nodes: [], edges: [], groups: {} });
    });
});

describe('computeMemoryMatchIds', () => {
    const entities: MemoryEntity[] = [
        { recordId: 'r1', entityId: 'microsoft', displayName: 'Microsoft', kind: 'public_company', layer: 'cloud' },
        { recordId: 'r2', entityId: 'openai', displayName: 'OpenAI', kind: 'private_company', layer: 'lab' },
        { recordId: 'r3', entityId: 'coreweave', displayName: 'CoreWeave', kind: 'public_company', layer: 'cloud' },
    ];
    const relationships: MemoryRelationship[] = [
        {
            recordId: 'r4',
            relationshipId: 'rel-1',
            subjectId: 'microsoft',
            predicate: 'invested_in',
            objectId: 'openai',
            confidence: 'explicit',
            evidence: [{ sourceId: 'sec-msft-2025q4' }],
        },
        {
            recordId: 'r5',
            relationshipId: 'rel-2',
            subjectId: 'coreweave',
            predicate: 'cloud_hosts',
            objectId: 'openai',
            confidence: 'explicit',
            qualifiers: { workload: 'training' },
            evidence: [],
        },
    ];
    const view = buildMemoryGraphView({ entities, relationships });

    it('is undefined when no filter is active, so nothing gets dimmed', () => {
        expect(computeMemoryMatchIds(view, { search: '   ', predicates: [] })).toBeUndefined();
    });

    it('matches a predicate and keeps both endpoints of the statement', () => {
        const matched = computeMemoryMatchIds(view, { search: '', predicates: ['invested_in'] });
        expect(matched?.sort()).toEqual(['microsoft', 'openai', 'rel-1']);
    });

    it('matches free text against evidence, qualifiers and entity labels', () => {
        expect(computeMemoryMatchIds(view, { search: ' SEC-MSFT ', predicates: [] })?.sort()).toEqual([
            'microsoft',
            'openai',
            'rel-1',
        ]);
        expect(computeMemoryMatchIds(view, { search: 'training', predicates: [] })?.sort()).toEqual([
            'coreweave',
            'openai',
            'rel-2',
        ]);
        // An entity matches on its own even when the predicate chips exclude every one of its
        // statements — the node stays lit while its edges dim.
        expect(computeMemoryMatchIds(view, { search: 'coreweave', predicates: ['invested_in'] })).toEqual([
            'coreweave',
        ]);
    });

    it('intersects the predicate chips with the search', () => {
        expect(computeMemoryMatchIds(view, { search: 'sec-msft', predicates: ['cloud_hosts'] })).toEqual([]);
    });
});

describe('rail inputs', () => {
    const relationships: MemoryRelationship[] = [
        {
            recordId: 'r1',
            relationshipId: 'rel-1',
            subjectId: 'a',
            predicate: 'supplies',
            objectId: 'b',
            confidence: 'explicit',
            observedAt: '2025-04',
            validTo: '2028-01',
            evidence: [{ sourceId: 's1' }],
        },
        {
            recordId: 'r2',
            relationshipId: 'rel-2',
            subjectId: 'b',
            predicate: 'invested_in',
            objectId: 'c',
            confidence: 'explicit',
            observedAt: '2025-01',
            evidence: [],
        },
        {
            recordId: 'r3',
            relationshipId: 'rel-3',
            subjectId: 'c',
            predicate: 'supplies',
            objectId: 'a',
            confidence: 'explicit',
            evidence: [],
        },
    ];
    const memories: MemoryEntry[] = [
        {
            recordId: 'r4',
            memoryId: 'mem-1',
            kind: 'event',
            title: 'Deal signed',
            summary: 'Summary',
            entityIds: [],
            confidence: 'explicit',
            observedAt: '2025-06',
            evidence: [],
        },
    ];

    it('lists distinct predicates in sorted order', () => {
        expect(collectMemoryPredicates(relationships)).toEqual(['invested_in', 'supplies']);
    });

    it('builds the scrubber from belief time only, ignoring validity dates', () => {
        expect(collectMemoryTimeline({ relationships, memories })).toEqual(['2025-01', '2025-04', '2025-06']);
    });

    it('reports evidence coverage as a percentage, or nothing at all when there is no statement', () => {
        expect(computeEvidenceCoverage(relationships)).toBe(33);
        expect(computeEvidenceCoverage([])).toBeUndefined();
    });
});
