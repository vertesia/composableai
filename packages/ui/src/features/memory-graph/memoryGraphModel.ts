import type { ContentObjectItemApiResponse } from '@vertesia/common';
import type { TemporalGraphEdge, TemporalGraphGroup, TemporalGraphNode } from '@vertesia/ui/widgets';
import { asRecord, readQualifiers, readString, readStringArray } from './memoryRecordReaders.js';

export interface MemoryEntity {
    recordId: string;
    entityId: string;
    displayName: string;
    kind: string;
    layer?: string;
    ticker?: string;
    publicStatus?: string;
}

export interface MemoryEvidence {
    sourceId: string;
    locator?: string;
    summary?: string;
}

export interface MemoryRelationship {
    recordId: string;
    relationshipId: string;
    subjectId: string;
    predicate: string;
    objectId: string;
    /** Raw confidence as authored: an enum label or a stringified number. */
    confidence: string;
    /** Confidence projected onto 0..1 for rendering. Undefined when it cannot be interpreted. */
    confidenceScore?: number;
    origin?: string;
    notes?: string;
    /** Belief time — when the statement entered the brain. */
    observedAt?: string;
    /** Business validity — when the statement was, and stopped being, in force. */
    validFrom?: string;
    validTo?: string;
    qualifiers?: Record<string, string | number>;
    evidence: MemoryEvidence[];
}

export interface MemoryEntry {
    recordId: string;
    memoryId: string;
    kind: string;
    title: string;
    summary: string;
    entityIds: string[];
    confidence: string;
    observedAt: string;
    validFrom?: string;
    validTo?: string;
    notes?: string;
    evidence: MemoryEvidence[];
}

export interface MemoryGraphData {
    entities: MemoryEntity[];
    relationships: MemoryRelationship[];
    memories: MemoryEntry[];
    sourceCount: number;
    loadedAt: string;
}

/**
 * Confidence enums used by the reconstruction, projected onto the 0..1 scale the graph draws with.
 * Anything below 0.9 renders as an inference (dashed).
 */
const CONFIDENCE_SCORES: Record<string, number> = {
    explicit: 1,
    confirmed: 1,
    strong_inference: 0.8,
    inference: 0.7,
    weak_inference: 0.55,
    speculative: 0.35,
};

/** Numeric confidence for a raw value, or `undefined` when it carries no usable signal. */
export function memoryConfidenceScore(confidence: string | undefined): number | undefined {
    if (!confidence) return undefined;
    const known = CONFIDENCE_SCORES[confidence];
    if (known !== undefined) return known;
    const parsed = Number.parseFloat(confidence);
    if (!Number.isFinite(parsed)) return undefined;
    return Math.min(Math.max(parsed, 0), 1);
}

function readConfidence(record: Record<string, unknown>): string {
    const value = record.confidence;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return readString(record, 'confidence') ?? 'unspecified';
}

function parseEvidence(value: unknown): MemoryEvidence[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
        const record = asRecord(item);
        const sourceId = readString(record, 'source_id');
        if (!sourceId) return [];
        return [
            {
                sourceId,
                locator: readString(record, 'locator'),
                summary: readString(record, 'summary'),
            },
        ];
    });
}

export function parseMemoryEntities(records: ContentObjectItemApiResponse[]): MemoryEntity[] {
    return records.flatMap((record) => {
        const properties = asRecord(record.properties);
        const entityId = readString(properties, 'entity_id');
        if (!entityId) return [];
        return [
            {
                recordId: record.id,
                entityId,
                displayName: readString(properties, 'display_name') ?? record.name ?? entityId,
                kind: readString(properties, 'kind') ?? 'organization',
                layer: readString(properties, 'layer'),
                ticker: readString(properties, 'ticker'),
                publicStatus: readString(properties, 'public_status'),
            },
        ];
    });
}

export function parseMemoryRelationships(records: ContentObjectItemApiResponse[]): MemoryRelationship[] {
    return records.flatMap((record) => {
        const properties = asRecord(record.properties);
        const subjectId = readString(properties, 'subject_id');
        const predicate = readString(properties, 'predicate');
        const objectId = readString(properties, 'object_id');
        if (!subjectId || !predicate || !objectId) return [];
        const confidence = readConfidence(properties);
        return [
            {
                recordId: record.id,
                relationshipId: readString(properties, 'relationship_id') ?? record.external_id ?? record.id,
                subjectId,
                predicate,
                objectId,
                confidence,
                confidenceScore: memoryConfidenceScore(confidence),
                origin: readString(properties, 'origin'),
                notes: readString(properties, 'notes'),
                observedAt: readString(properties, 'observed_at'),
                validFrom: readString(properties, 'valid_from'),
                validTo: readString(properties, 'valid_to'),
                qualifiers: readQualifiers(properties.qualifiers),
                evidence: parseEvidence(properties.evidence),
            },
        ];
    });
}

export function parseMemoryEntries(records: ContentObjectItemApiResponse[]): MemoryEntry[] {
    return records.flatMap((record) => {
        const properties = asRecord(record.properties);
        const memoryId = readString(properties, 'memory_id');
        const title = readString(properties, 'title');
        const summary = readString(properties, 'summary');
        const observedAt = readString(properties, 'observed_at');
        if (!memoryId || !title || !summary || !observedAt) return [];
        return [
            {
                recordId: record.id,
                memoryId,
                kind: readString(properties, 'kind') ?? 'event',
                title,
                summary,
                entityIds: readStringArray(properties, 'entity_ids'),
                confidence: readConfidence(properties),
                observedAt,
                validFrom: readString(properties, 'valid_from'),
                validTo: readString(properties, 'valid_to'),
                notes: readString(properties, 'notes'),
                evidence: parseEvidence(properties.evidence),
            },
        ];
    });
}

export type MemoryGraphNode = TemporalGraphNode<MemoryEntity>;
export type MemoryGraphEdge = TemporalGraphEdge<MemoryRelationship>;

export interface MemoryGraphView {
    nodes: MemoryGraphNode[];
    edges: MemoryGraphEdge[];
    groups: Record<string, TemporalGraphGroup>;
}

/** Layer, else kind: the coarsest grouping the corpus reliably carries. */
export function memoryEntityGroup(entity: MemoryEntity): string {
    return entity.layer ?? entity.kind;
}

/**
 * Project the parsed corpus onto the graph widget's shape.
 *
 * Only entities that take part in a relationship become nodes: the entity index is shared across
 * brains and project-wide, so drawing all of it would fill the canvas with records this brain has
 * never reasoned about.
 */
export function buildMemoryGraphView(data: {
    entities: MemoryEntity[];
    relationships: MemoryRelationship[];
}): MemoryGraphView {
    const entitiesById = new Map(data.entities.map((entity) => [entity.entityId, entity]));
    const referenced = new Set<string>();
    const edges: MemoryGraphEdge[] = [];

    for (const relationship of data.relationships) {
        if (!entitiesById.has(relationship.subjectId) || !entitiesById.has(relationship.objectId)) continue;
        referenced.add(relationship.subjectId);
        referenced.add(relationship.objectId);
        edges.push({
            id: relationship.relationshipId,
            source: relationship.subjectId,
            target: relationship.objectId,
            label: relationship.predicate,
            confidence: relationship.confidenceScore,
            observedAt: relationship.observedAt,
            validFrom: relationship.validFrom,
            validTo: relationship.validTo,
            qualifiers: relationship.qualifiers,
            evidence: relationship.evidence.map((evidence) => ({
                source: evidence.sourceId,
                locator: evidence.locator,
                excerpt: evidence.summary,
            })),
            data: relationship,
        });
    }

    const nodes: MemoryGraphNode[] = data.entities
        .filter((entity) => referenced.has(entity.entityId))
        .map((entity) => ({
            id: entity.entityId,
            label: entity.displayName,
            sublabel: entity.ticker ? `$${entity.ticker}` : undefined,
            group: memoryEntityGroup(entity),
            data: entity,
        }));

    const groups: Record<string, TemporalGraphGroup> = {};
    for (const node of nodes) {
        if (node.group && !groups[node.group]) groups[node.group] = { label: node.group.replaceAll('_', ' ') };
    }

    return { nodes, edges, groups };
}

export interface MemoryGraphFilter {
    /** Already-debounced free-text query. */
    search: string;
    /** Empty means "every predicate". */
    predicates: string[];
}

/**
 * Ids the current filter matches, or `undefined` when no filter is active.
 *
 * The result is handed to the graph as decoration: nothing is removed, so filtering can never
 * re-run the layout or move a node under the pointer.
 */
export function computeMemoryMatchIds(view: MemoryGraphView, filter: MemoryGraphFilter): string[] | undefined {
    const search = filter.search.trim().toLowerCase();
    const predicates = new Set(filter.predicates);
    if (!search && predicates.size === 0) return undefined;

    const matchedEdges = view.edges.filter((edge) => {
        const relationship = edge.data;
        if (predicates.size > 0 && relationship && !predicates.has(relationship.predicate)) return false;
        if (!search) return true;
        const haystack = relationship
            ? [
                  relationship.relationshipId,
                  relationship.subjectId,
                  relationship.predicate,
                  relationship.objectId,
                  relationship.confidence,
                  ...Object.entries(relationship.qualifiers ?? {}).map(([key, value]) => `${key} ${value}`),
                  ...relationship.evidence.flatMap((evidence) => [evidence.sourceId, evidence.summary ?? '']),
              ]
            : [edge.id];
        return haystack.some((value) => value.toLowerCase().includes(search));
    });

    const matched = new Set<string>(matchedEdges.map((edge) => edge.id));
    for (const edge of matchedEdges) {
        matched.add(edge.source);
        matched.add(edge.target);
    }
    if (search) {
        for (const node of view.nodes) {
            const entity = node.data;
            const haystack = [node.id, node.label, entity?.kind ?? '', entity?.layer ?? '', entity?.ticker ?? ''];
            if (haystack.some((value) => value.toLowerCase().includes(search))) matched.add(node.id);
        }
    }
    return [...matched];
}

/** Distinct predicates present in the corpus, sorted, for the rail's filter chips. */
export function collectMemoryPredicates(relationships: MemoryRelationship[]): string[] {
    return [...new Set(relationships.map((relationship) => relationship.predicate))].sort();
}

/**
 * Stops of the as-of scrubber.
 *
 * The scrubber walks *belief* time: every distinct date at which this brain learned something,
 * relationships and episodic memory entries alike. Validity dates are deliberately excluded — a
 * lease that runs to 2028 must not drag the timeline into the future and mark today's statements
 * as expired.
 */
export function collectMemoryTimeline(data: {
    relationships: MemoryRelationship[];
    memories: MemoryEntry[];
}): string[] {
    const stops = new Set<string>();
    for (const relationship of data.relationships) {
        if (relationship.observedAt) stops.add(relationship.observedAt);
    }
    for (const memory of data.memories) stops.add(memory.observedAt);
    return [...stops].sort();
}

/** Share of relationships that carry at least one piece of structured evidence, as a percentage. */
export function computeEvidenceCoverage(relationships: MemoryRelationship[]): number | undefined {
    if (relationships.length === 0) return undefined;
    const grounded = relationships.filter((relationship) => relationship.evidence.length > 0).length;
    return Math.round((grounded / relationships.length) * 100);
}
