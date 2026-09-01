import type { ContentObjectItemApiResponse } from '@vertesia/common';
import type { TemporalGraphEdge, TemporalGraphGroup, TemporalGraphNode } from '@vertesia/ui/widgets';
import { asRecord, readQualifiers, readString, readStringArray } from './memoryRecordReaders.js';

/**
 * Every property the content record stores, verbatim.
 *
 * The curated fields on each model drive the layout; this bag is what the inspector's "all
 * attributes" section renders, so a field the ontology gains tomorrow shows up without a code
 * change and nothing stored is invisible in the UI.
 */
export type MemoryRawProperties = Record<string, unknown>;

export interface MemoryEntity {
    recordId: string;
    entityId: string;
    displayName: string;
    kind: string;
    layer?: string;
    ticker?: string;
    publicStatus?: string;
    raw: MemoryRawProperties;
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
    raw: MemoryRawProperties;
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
    raw: MemoryRawProperties;
}

export interface MemoryGraphData {
    entities: MemoryEntity[];
    relationships: MemoryRelationship[];
    memories: MemoryEntry[];
    sourceCount: number;
    /** Business source id → content-store record id, for the snapshot's evidence. */
    sourceRecordIds: MemorySourceIndex;
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
                raw: properties,
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
                // Belief time and business validity are separate axes and must never stand in for
                // one another: a statement with no `observed_at` simply has no place on the belief
                // timeline. See {@link MemoryTimeAxis}.
                observedAt: readString(properties, 'observed_at'),
                validFrom: readString(properties, 'valid_from'),
                validTo: readString(properties, 'valid_to'),
                qualifiers: readQualifiers(properties.qualifiers),
                evidence: parseEvidence(properties.evidence),
                raw: properties,
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
                raw: properties,
            },
        ];
    });
}

/**
 * The two time axes the corpus carries, and which one the explorer is scrubbing.
 *
 * - `valid` — **business time**: when the statement is actually true, from `valid_from` to
 *   `valid_to`. This is what a reader means by moving through time, so it is the default.
 * - `observed` — **belief time**: when Memory learned the statement, `observed_at`, in practice the
 *   publication date of the source.
 *
 * They are genuinely different dates on the same record — an IREN monthly update is *published* on
 * 2025-06-05 and *true* for 2025-05-01 → 2025-05-31 — so neither may ever stand in for the other.
 */
export type MemoryTimeAxis = 'valid' | 'observed';

/** Business time: what "moving through time" means to a reader. */
export const DEFAULT_MEMORY_TIME_AXIS: MemoryTimeAxis = 'valid';

/** The dated fields shared by statements and content memory entries. */
export interface MemoryTemporalRecord {
    observedAt?: string;
    validFrom?: string;
    validTo?: string;
}

/** The date a record enters the timeline on, or `undefined` when it carries none for this axis. */
export function memoryAxisStart(record: MemoryTemporalRecord, axis: MemoryTimeAxis): string | undefined {
    return axis === 'valid' ? record.validFrom : record.observedAt;
}

/**
 * Whether the record has entered the timeline by the cutoff.
 *
 * A record with no date on the active axis is always in: dropping it would hide it at every cutoff,
 * which reads as data loss rather than as an as-of filter.
 */
export function hasMemoryAxisStarted(record: MemoryTemporalRecord, axis: MemoryTimeAxis, asOf?: string): boolean {
    if (!asOf) return true;
    const start = memoryAxisStart(record, axis);
    return !start || start <= asOf;
}

/**
 * Whether the record is in scope at the cutoff on the active axis.
 *
 * On the business axis that means the validity interval contains the cutoff — a statement is out of
 * scope both before it takes effect and after `valid_to`. On the belief axis it means the brain
 * knew it by then; an expired statement is still something it knows, so it stays in scope there.
 */
export function isMemoryInScope(record: MemoryTemporalRecord, axis: MemoryTimeAxis, asOf?: string): boolean {
    if (!asOf) return true;
    if (!hasMemoryAxisStarted(record, axis, asOf)) return false;
    if (axis === 'observed') return true;
    return !record.validTo || record.validTo >= asOf;
}

/**
 * Business source id → content-store record id.
 *
 * Evidence quotes a source by the id the corpus authored (`sec2y-iren-…-ex-99-1-2`), which is not a
 * content-object id. This index is what turns those into links.
 */
export type MemorySourceIndex = Map<string, string>;

/** Distinct evidence source ids referenced by a snapshot, sorted so the query key is stable. */
export function collectMemorySourceIds(data: {
    relationships: MemoryRelationship[];
    memories: MemoryEntry[];
}): string[] {
    const ids = new Set<string>();
    for (const relationship of data.relationships) {
        for (const evidence of relationship.evidence) ids.add(evidence.sourceId);
    }
    for (const memory of data.memories) {
        for (const evidence of memory.evidence) ids.add(evidence.sourceId);
    }
    return [...ids].sort();
}

/**
 * Elasticsearch clause matching source records by the ids evidence quotes.
 *
 * The reconstruction resolves a source's business id as `properties.source_id`, falling back to the
 * record's `external_id`, so both are matched — in one clause, so the whole set of sources a
 * snapshot references is fetched by a single request rather than one per evidence item.
 */
export function buildMemorySourceIdFilter(sourceIds: string[]): Record<string, unknown> {
    return {
        bool: {
            should: [{ terms: { 'properties.source_id': sourceIds } }, { terms: { external_id: sourceIds } }],
            minimum_should_match: 1,
        },
    };
}

/** Index source records by every id evidence could quote them under. */
export function indexMemorySourceRecords(records: ContentObjectItemApiResponse[]): MemorySourceIndex {
    const index: MemorySourceIndex = new Map();
    for (const record of records) {
        const sourceId = readString(asRecord(record.properties), 'source_id');
        if (sourceId) index.set(sourceId, record.id);
        if (record.external_id) index.set(record.external_id, record.id);
    }
    return index;
}

/** What the inspector is pinned to. Ids are graph ids — the same ones the canvas emits. */
export type MemorySelection =
    | { kind: 'entity'; id: string }
    | { kind: 'statement'; id: string }
    | { kind: 'memory'; id: string };

/**
 * Outcome of looking a selection up in the loaded snapshot.
 *
 * `missing` exists so a click can never be a silent no-op: when the selected record is not in the
 * arrays the inspector was handed, it says so instead of falling back to the default panel.
 */
export type ResolvedMemorySelection =
    | { status: 'none' }
    | { status: 'entity'; entity: MemoryEntity }
    | { status: 'statement'; relationship: MemoryRelationship }
    | { status: 'memory'; memory: MemoryEntry }
    | { status: 'missing'; selection: MemorySelection };

export interface MemorySnapshot {
    entities: MemoryEntity[];
    relationships: MemoryRelationship[];
    memories: MemoryEntry[];
}

/** An entity by its graph id, falling back to its content-store record id. */
export function findMemoryEntity(entities: MemoryEntity[], id: string): MemoryEntity | undefined {
    return entities.find((entity) => entity.entityId === id) ?? entities.find((entity) => entity.recordId === id);
}

/**
 * A statement by its graph id, falling back to its content-store record id.
 *
 * {@link parseMemoryRelationships} derives `relationshipId` from `relationship_id`, then
 * `external_id`, then the record id, so a statement whose `relationship_id` property is absent is
 * addressed by one of the fallbacks. Matching the record id as well keeps such a statement
 * inspectable whichever of the three a caller — a deep link, a stale selection — happens to carry.
 */
export function findMemoryRelationship(
    relationships: MemoryRelationship[],
    id: string,
): MemoryRelationship | undefined {
    return (
        relationships.find((relationship) => relationship.relationshipId === id) ??
        relationships.find((relationship) => relationship.recordId === id)
    );
}

/** A content memory by its graph id, falling back to its content-store record id. */
export function findMemoryEntry(memories: MemoryEntry[], id: string): MemoryEntry | undefined {
    return memories.find((memory) => memory.memoryId === id) ?? memories.find((memory) => memory.recordId === id);
}

/** Classify a selection against the loaded snapshot. See {@link ResolvedMemorySelection}. */
export function resolveMemorySelection(
    selection: MemorySelection | undefined,
    snapshot: MemorySnapshot,
): ResolvedMemorySelection {
    if (!selection) return { status: 'none' };
    if (selection.kind === 'entity') {
        const entity = findMemoryEntity(snapshot.entities, selection.id);
        return entity ? { status: 'entity', entity } : { status: 'missing', selection };
    }
    if (selection.kind === 'statement') {
        const relationship = findMemoryRelationship(snapshot.relationships, selection.id);
        return relationship ? { status: 'statement', relationship } : { status: 'missing', selection };
    }
    const memory = findMemoryEntry(snapshot.memories, selection.id);
    return memory ? { status: 'memory', memory } : { status: 'missing', selection };
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
 *
 * The edge's `observedAt` is the *active axis*' start date, which is the field the canvas cuts on:
 * on the business axis a statement therefore appears when it takes effect and — through the
 * `validTo` the edge also carries — ghosts once it is out of force. Which nodes and edges exist
 * does not depend on the axis, only the dates on them do, so switching axis cannot move a node.
 */
export function buildMemoryGraphView(
    data: {
        entities: MemoryEntity[];
        relationships: MemoryRelationship[];
    },
    axis: MemoryTimeAxis = DEFAULT_MEMORY_TIME_AXIS,
): MemoryGraphView {
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
            observedAt: memoryAxisStart(relationship, axis),
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
 * Stops of the as-of scrubber, on the active axis.
 *
 * On the belief axis these are the dates at which the brain learned something — `observed_at` only,
 * so a lease running to 2028 cannot drag the timeline into the future. On the business axis they
 * are the dates at which something starts or stops being true, `valid_to` included: the end of a
 * validity window is a real event on that axis, and the scrubber has to be able to land on it.
 *
 * A record carrying no date for the active axis contributes no stop, which is the honest answer —
 * it is not placed anywhere on that axis rather than borrowed from the other one.
 */
export function collectMemoryTimeline(
    data: {
        relationships: MemoryRelationship[];
        memories: MemoryEntry[];
    },
    axis: MemoryTimeAxis = DEFAULT_MEMORY_TIME_AXIS,
): string[] {
    const stops = new Set<string>();
    const add = (value: string | undefined) => {
        if (value) stops.add(value);
    };
    for (const record of [...data.relationships, ...data.memories]) {
        add(memoryAxisStart(record, axis));
        if (axis === 'valid') add(record.validTo);
    }
    return [...stops].sort();
}

/** Share of relationships that carry at least one piece of structured evidence, as a percentage. */
export function computeEvidenceCoverage(relationships: MemoryRelationship[]): number | undefined {
    if (relationships.length === 0) return undefined;
    const grounded = relationships.filter((relationship) => relationship.evidence.length > 0).length;
    return Math.round((grounded / relationships.length) * 100);
}
