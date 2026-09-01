// @vitest-environment node
import { type ContentObjectItemApiResponse, ContentObjectStatus, type JSONObject } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import {
    buildMemoryGraphView,
    buildMemorySourceIdFilter,
    collectMemoryPredicates,
    collectMemorySourceIds,
    collectMemoryTimeline,
    computeEvidenceCoverage,
    computeMemoryMatchIds,
    hasMemoryAxisStarted,
    indexMemorySourceRecords,
    isMemoryInScope,
    type MemoryEntity,
    type MemoryEntry,
    type MemoryRelationship,
    memoryAxisStart,
    memoryConfidenceScore,
    memoryEntityGroup,
    parseMemoryEntities,
    parseMemoryEntries,
    parseMemoryRelationships,
    resolveMemorySelection,
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
        const properties: JSONObject = {
            entity_id: 'microsoft',
            display_name: 'Microsoft',
            kind: 'public_company',
            layer: 'cloud_platform',
            ticker: 'MSFT',
            public_status: 'public',
        };
        const records = [contentRecord('entity-record-msft', 'Microsoft record', properties)];

        expect(parseMemoryEntities(records)).toEqual([
            {
                recordId: 'entity-record-msft',
                entityId: 'microsoft',
                displayName: 'Microsoft',
                kind: 'public_company',
                layer: 'cloud_platform',
                ticker: 'MSFT',
                publicStatus: 'public',
                raw: properties,
            } satisfies MemoryEntity,
        ]);
    });

    it('carries every stored property, including ones no curated field reads', () => {
        const records = [
            contentRecord('entity-record-anthropic', 'Anthropic', {
                entity_id: 'anthropic',
                display_name: 'Anthropic',
                // Not part of the curated shape: it must still survive parsing.
                sector_exposure: ['frontier_models', 'enterprise'],
                headcount: 1200,
            }),
        ];

        expect(parseMemoryEntities(records)[0].raw).toEqual({
            entity_id: 'anthropic',
            display_name: 'Anthropic',
            sector_exposure: ['frontier_models', 'enterprise'],
            headcount: 1200,
        });
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
                raw: { entity_id: 'openai' },
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
        const properties: JSONObject = {
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
        };
        const records = [contentRecord('relationship-record-1', 'Applied Digital leases to CoreWeave', properties)];

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
                // The curated fields drop a nested qualifier and two malformed evidence items; the
                // raw bag keeps the record exactly as stored so the inspector can show all of it.
                raw: properties,
            } satisfies MemoryRelationship,
        ]);
    });

    it('never lets business validity stand in for belief time', () => {
        // The two axes answer different questions. A statement with no `observed_at` has no place
        // on the belief timeline, and borrowing `valid_from` would silently claim it does.
        const records = [
            contentRecord('relationship-valid-only', 'Validity only', {
                relationship_id: 'r-valid-only',
                subject_id: 'nvidia',
                predicate: 'supplies',
                object_id: 'iren',
                valid_from: '2025-05-31',
            }),
        ];

        expect(parseMemoryRelationships(records)[0]).toMatchObject({
            observedAt: undefined,
            validFrom: '2025-05-31',
        });
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
        const properties: JSONObject = {
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
        };
        const records = [contentRecord('memory-record-1', 'Cerebras and G42 sign MOU', properties)];

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
                raw: properties,
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
            raw: {},
        },
        {
            recordId: 'entity-record-openai',
            entityId: 'openai',
            displayName: 'OpenAI',
            kind: 'private_company',
            layer: 'model_lab',
            raw: {},
        },
        {
            recordId: 'entity-record-crwv',
            entityId: 'coreweave',
            displayName: 'CoreWeave',
            kind: 'public_company',
            layer: 'compute',
            ticker: 'CRWV',
            raw: {},
        },
        {
            recordId: 'entity-record-vega',
            entityId: 'vega-datacenter',
            displayName: 'Vega data center',
            kind: 'facility',
            layer: 'datacenter',
            raw: {},
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
            raw: {},
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
            raw: {},
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
            raw: {},
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
        {
            recordId: 'r1',
            entityId: 'microsoft',
            displayName: 'Microsoft',
            kind: 'public_company',
            layer: 'cloud',
            raw: {},
        },
        { recordId: 'r2', entityId: 'openai', displayName: 'OpenAI', kind: 'private_company', layer: 'lab', raw: {} },
        {
            recordId: 'r3',
            entityId: 'coreweave',
            displayName: 'CoreWeave',
            kind: 'public_company',
            layer: 'cloud',
            raw: {},
        },
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
            raw: {},
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
            raw: {},
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
            raw: {},
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
            raw: {},
        },
        {
            recordId: 'r3',
            relationshipId: 'rel-3',
            subjectId: 'c',
            predicate: 'supplies',
            objectId: 'a',
            confidence: 'explicit',
            evidence: [],
            raw: {},
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
            validFrom: '2025-05',
            evidence: [],
            raw: {},
        },
    ];

    it('lists distinct predicates in sorted order', () => {
        expect(collectMemoryPredicates(relationships)).toEqual(['invested_in', 'supplies']);
    });

    it('builds the belief-time scrubber from observation dates only, ignoring validity', () => {
        expect(collectMemoryTimeline({ relationships, memories }, 'observed')).toEqual([
            '2025-01',
            '2025-04',
            '2025-06',
        ]);
    });

    it('builds the business-time scrubber from the validity window, both ends of it', () => {
        // rel-1 has only a valid_to, mem-1 a valid_from: each contributes the stop it carries, and
        // a record with no business date at all contributes none.
        expect(collectMemoryTimeline({ relationships, memories }, 'valid')).toEqual(['2025-05', '2028-01']);
        expect(collectMemoryTimeline({ relationships: [], memories: [] }, 'valid')).toEqual([]);
    });

    it('defaults to business time, which is what a reader means by moving through time', () => {
        expect(collectMemoryTimeline({ relationships, memories })).toEqual(
            collectMemoryTimeline({ relationships, memories }, 'valid'),
        );
    });

    it('reports evidence coverage as a percentage, or nothing at all when there is no statement', () => {
        expect(computeEvidenceCoverage(relationships)).toBe(33);
        expect(computeEvidenceCoverage([])).toBeUndefined();
    });
});

describe('resolveMemorySelection', () => {
    const entities: MemoryEntity[] = [
        {
            recordId: 'entity-record-a',
            entityId: 'alpha',
            displayName: 'Alpha',
            kind: 'organization',
            raw: {},
        },
    ];
    const relationships: MemoryRelationship[] = [
        {
            recordId: 'relationship-record-1',
            relationshipId: 'rel-1',
            subjectId: 'alpha',
            predicate: 'supplies',
            objectId: 'beta',
            confidence: 'explicit',
            evidence: [],
            raw: {},
        },
    ];
    const memories: MemoryEntry[] = [
        {
            recordId: 'memory-record-1',
            memoryId: 'mem-1',
            kind: 'event',
            title: 'Deal signed',
            summary: 'Summary',
            entityIds: [],
            confidence: 'explicit',
            observedAt: '2025-06',
            evidence: [],
            raw: {},
        },
    ];
    const snapshot = { entities, relationships, memories };

    it('reports no selection at all', () => {
        expect(resolveMemorySelection(undefined, snapshot)).toEqual({ status: 'none' });
    });

    it('resolves each kind by its graph id', () => {
        expect(resolveMemorySelection({ kind: 'entity', id: 'alpha' }, snapshot)).toEqual({
            status: 'entity',
            entity: entities[0],
        });
        expect(resolveMemorySelection({ kind: 'statement', id: 'rel-1' }, snapshot)).toEqual({
            status: 'statement',
            relationship: relationships[0],
        });
        expect(resolveMemorySelection({ kind: 'memory', id: 'mem-1' }, snapshot)).toEqual({
            status: 'memory',
            memory: memories[0],
        });
    });

    it('resolves each kind by its content-store record id as well', () => {
        expect(resolveMemorySelection({ kind: 'entity', id: 'entity-record-a' }, snapshot)).toMatchObject({
            status: 'entity',
        });
        expect(resolveMemorySelection({ kind: 'statement', id: 'relationship-record-1' }, snapshot)).toMatchObject({
            status: 'statement',
        });
        expect(resolveMemorySelection({ kind: 'memory', id: 'memory-record-1' }, snapshot)).toMatchObject({
            status: 'memory',
        });
    });

    it('classifies a selection the snapshot does not hold as missing rather than as nothing', () => {
        for (const selection of [
            { kind: 'entity', id: 'ghost' },
            { kind: 'statement', id: 'ghost' },
            { kind: 'memory', id: 'ghost' },
        ] as const) {
            expect(resolveMemorySelection(selection, snapshot)).toEqual({ status: 'missing', selection });
        }
    });

    it('never resolves a kind against another kind index', () => {
        expect(resolveMemorySelection({ kind: 'entity', id: 'rel-1' }, snapshot)).toMatchObject({ status: 'missing' });
        expect(resolveMemorySelection({ kind: 'statement', id: 'alpha' }, snapshot)).toMatchObject({
            status: 'missing',
        });
    });

    it('keeps a statement inspectable when its relationship_id property is absent', () => {
        // The parser falls back to external_id, then to the record id, and the graph edge carries
        // that fallback: whichever of the three a selection quotes must resolve to the record.
        const parsed = parseMemoryRelationships([
            contentRecord(
                'relationship-record-2',
                'External id only',
                { subject_id: 'alpha', predicate: 'supplies', object_id: 'beta' },
                'external-rel-2',
            ),
            contentRecord('relationship-record-3', 'Record id only', {
                subject_id: 'beta',
                predicate: 'supplies',
                object_id: 'alpha',
            }),
        ]);
        const [external, bare] = parsed;
        expect(external.relationshipId).toBe('external-rel-2');
        expect(bare.relationshipId).toBe('relationship-record-3');

        const view = buildMemoryGraphView({
            entities: [
                ...entities,
                { recordId: 'entity-record-b', entityId: 'beta', displayName: 'Beta', kind: 'organization', raw: {} },
            ],
            relationships: parsed,
        });
        const local = { entities, relationships: parsed, memories };
        for (const edge of view.edges) {
            expect(resolveMemorySelection({ kind: 'statement', id: edge.id }, local)).toMatchObject({
                status: 'statement',
            });
        }
    });
});

describe('evidence source resolution', () => {
    const relationships: MemoryRelationship[] = [
        {
            recordId: 'r1',
            relationshipId: 'rel-1',
            subjectId: 'a',
            predicate: 'supplies',
            objectId: 'b',
            confidence: 'explicit',
            evidence: [{ sourceId: 'sec2y-iren-2025-06-05' }, { sourceId: 'apld-coreweave-lease-2025-06-02' }],
            raw: {},
        },
        {
            recordId: 'r2',
            relationshipId: 'rel-2',
            subjectId: 'b',
            predicate: 'supplies',
            objectId: 'c',
            // The same source backing two statements must be asked for once.
            evidence: [{ sourceId: 'sec2y-iren-2025-06-05', locator: 'Ex. 99.1' }],
            confidence: 'explicit',
            raw: {},
        },
    ];
    const memories: MemoryEntry[] = [
        {
            recordId: 'r3',
            memoryId: 'mem-1',
            kind: 'event',
            title: 'Deal signed',
            summary: 'Summary',
            entityIds: [],
            confidence: 'explicit',
            observedAt: '2025-06',
            evidence: [{ sourceId: 'cerebras-g42-mou-2021-11-22' }],
            raw: {},
        },
    ];

    it('collects the distinct source ids of a whole snapshot, sorted', () => {
        expect(collectMemorySourceIds({ relationships, memories })).toEqual([
            'apld-coreweave-lease-2025-06-02',
            'cerebras-g42-mou-2021-11-22',
            'sec2y-iren-2025-06-05',
        ]);
        expect(collectMemorySourceIds({ relationships: [], memories: [] })).toEqual([]);
    });

    it('matches sources on either id the reconstruction may have used', () => {
        expect(buildMemorySourceIdFilter(['s1', 's2'])).toEqual({
            bool: {
                should: [{ terms: { 'properties.source_id': ['s1', 's2'] } }, { terms: { external_id: ['s1', 's2'] } }],
                minimum_should_match: 1,
            },
        });
    });

    it('indexes source records by their business id and by their external id', () => {
        const index = indexMemorySourceRecords([
            contentRecord('source-record-1', 'IREN update', { source_id: 'sec2y-iren-2025-06-05' }),
            contentRecord('source-record-2', 'Cerebras MOU', {}, 'cerebras-g42-mou-2021-11-22'),
            contentRecord('source-record-3', 'Unidentifiable', {}),
        ]);

        expect(index.get('sec2y-iren-2025-06-05')).toBe('source-record-1');
        expect(index.get('cerebras-g42-mou-2021-11-22')).toBe('source-record-2');
        expect(index.get('source-record-3')).toBeUndefined();
    });
});

describe('time axes', () => {
    // Published 2025-06-05, true only for May: the two axes place this record in different months.
    const monthlyUpdate: MemoryRelationship = {
        recordId: 'r1',
        relationshipId: 'rel-iren-may',
        subjectId: 'iren',
        predicate: 'reports_capacity',
        objectId: 'nvidia',
        confidence: 'explicit',
        observedAt: '2025-06-05',
        validFrom: '2025-05-01',
        validTo: '2025-05-31',
        evidence: [],
        raw: {},
    };
    const undated: MemoryRelationship = {
        recordId: 'r2',
        relationshipId: 'rel-undated',
        subjectId: 'a',
        predicate: 'supplies',
        objectId: 'b',
        confidence: 'explicit',
        evidence: [],
        raw: {},
    };

    it('reads the start date of the active axis', () => {
        expect(memoryAxisStart(monthlyUpdate, 'valid')).toBe('2025-05-01');
        expect(memoryAxisStart(monthlyUpdate, 'observed')).toBe('2025-06-05');
        expect(memoryAxisStart(undated, 'valid')).toBeUndefined();
    });

    it('scopes a business-time window to the dates it actually covers', () => {
        expect(isMemoryInScope(monthlyUpdate, 'valid', '2025-04-30')).toBe(false);
        expect(isMemoryInScope(monthlyUpdate, 'valid', '2025-05-15')).toBe(true);
        expect(isMemoryInScope(monthlyUpdate, 'valid', '2025-06-15')).toBe(false);
    });

    it('scopes belief time by what the brain knew, expired or not', () => {
        expect(isMemoryInScope(monthlyUpdate, 'observed', '2025-05-15')).toBe(false);
        // Out of force since 2025-05-31, but the brain still knows it — belief time keeps it.
        expect(isMemoryInScope(monthlyUpdate, 'observed', '2025-06-15')).toBe(true);
    });

    it('keeps a record with no date on the active axis in scope rather than hiding it', () => {
        expect(isMemoryInScope(undated, 'valid', '2025-01-01')).toBe(true);
        expect(isMemoryInScope(undated, 'observed', '2025-01-01')).toBe(true);
        expect(hasMemoryAxisStarted(undated, 'valid', '2025-01-01')).toBe(true);
    });

    it('lists a statement that has started but expired, so the inspector can mark it', () => {
        expect(hasMemoryAxisStarted(monthlyUpdate, 'valid', '2025-06-15')).toBe(true);
        expect(isMemoryInScope(monthlyUpdate, 'valid', '2025-06-15')).toBe(false);
    });

    it('cuts the canvas on the active axis without changing which nodes and edges exist', () => {
        const entities: MemoryEntity[] = [
            { recordId: 'e1', entityId: 'iren', displayName: 'IREN', kind: 'public_company', raw: {} },
            { recordId: 'e2', entityId: 'nvidia', displayName: 'Nvidia', kind: 'public_company', raw: {} },
        ];
        const valid = buildMemoryGraphView({ entities, relationships: [monthlyUpdate] }, 'valid');
        const observed = buildMemoryGraphView({ entities, relationships: [monthlyUpdate] }, 'observed');

        expect(valid.nodes.map((node) => node.id)).toEqual(observed.nodes.map((node) => node.id));
        expect(valid.edges.map((edge) => edge.id)).toEqual(observed.edges.map((edge) => edge.id));
        // Only the cutoff date the canvas compares against differs between the two axes.
        expect(valid.edges[0].observedAt).toBe('2025-05-01');
        expect(observed.edges[0].observedAt).toBe('2025-06-05');
        expect(valid.edges[0].validTo).toBe('2025-05-31');
    });
});
