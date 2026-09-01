import type { VertesiaClient } from '@vertesia/client';
import type { ContentObjectItemApiResponse } from '@vertesia/common';
import { Button, cn, ErrorBox, Input, MessageBox, SelectBox, Spinner, useDebounce } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import {
    computeTimelineMarkers,
    resolveGroupStyles,
    TemporalGraph,
    type TemporalGraphSelection,
} from '@vertesia/ui/widgets';
import { BrainCircuit, Network, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MemoryGraphInspector } from './MemoryGraphInspector.js';
import { MemoryGraphRail } from './MemoryGraphRail.js';
import { MemoryGraphStatusBar } from './MemoryGraphStatusBar.js';
import {
    buildMemoryBrainFilter,
    formatModelName,
    type MemoryBrain,
    type MemoryBrainStatusTone,
    memoryBrainStatusTone,
    parseMemoryBrains,
    selectMemoryBrain,
    sortMemoryBrains,
} from './memoryBrainModel.js';
import {
    buildMemoryGraphView,
    buildMemorySourceIdFilter,
    collectMemoryPredicates,
    collectMemorySourceIds,
    collectMemoryTimeline,
    computeEvidenceCoverage,
    computeMemoryMatchIds,
    DEFAULT_MEMORY_TIME_AXIS,
    indexMemorySourceRecords,
    isMemoryInScope,
    type MemoryEntity,
    type MemoryEntry,
    type MemoryGraphData,
    type MemoryRelationship,
    type MemorySelection,
    type MemorySourceIndex,
    type MemoryTimeAxis,
    memoryAxisStart,
    parseMemoryEntities,
    parseMemoryEntries,
    parseMemoryRelationships,
} from './memoryGraphModel.js';
import { asRecord, mapMemoryQueryHits } from './memoryRecordReaders.js';

/** Content-store type names the corpus is stored under. Every one is overridable per deployment. */
export interface MemoryGraphTypeNames {
    brain: string;
    entity: string;
    relationship: string;
    source: string;
    memoryEntry: string;
}

export const DEFAULT_MEMORY_TYPE_NAMES: MemoryGraphTypeNames = {
    brain: 'AI Market Brain',
    entity: 'AI Market Entity',
    relationship: 'AI Market Relationship',
    source: 'AI Market Source',
    memoryEntry: 'AI Market Memory Entry',
};

export const DEFAULT_MEMORY_POLL_INTERVAL_MS = 15_000;

const BRAIN_PAGE_SIZE = 100;

/** Text color per brain-status tone, so the selector reads like the catalog cards. */
const BRAIN_STATUS_TEXT: Record<MemoryBrainStatusTone, string> = {
    success: 'text-success',
    info: 'text-info',
    attention: 'text-attention',
    destructive: 'text-destructive',
    done: 'text-done',
    secondary: 'text-muted',
};

/**
 * The explorer holds a whole brain in memory rather than paging, so this is a safety ceiling, not a
 * page size: {@link mapMemoryQueryHits} throws rather than silently drawing a truncated graph.
 */
const GRAPH_RECORD_LIMIT = 10_000;

/**
 * Ceiling on the source ids resolved to content objects in one batch.
 *
 * Evidence links are a convenience, not the view: past this many distinct sources the lookup is
 * skipped and the ids stay plain text, rather than sending Elasticsearch an unbounded terms clause.
 */
const SOURCE_RESOLVE_LIMIT = 2_000;

/**
 * Read the current heads of one content type straight from the index.
 *
 * `revision.head` is filtered in the query rather than after the fact, so superseded revisions
 * never leave Elasticsearch and never count against the record limit.
 */
async function queryHeadRecords(
    client: VertesiaClient,
    typeId: string,
    filters: Record<string, unknown>[] = [],
): Promise<ContentObjectItemApiResponse[]> {
    const result = await client.store.query.dsl({
        query: {
            bool: {
                filter: [{ term: { 'type.id': typeId } }, { term: { 'revision.head': true } }, ...filters],
            },
        },
        size: GRAPH_RECORD_LIMIT,
    });
    return mapMemoryQueryHits(result.hits, result.total, GRAPH_RECORD_LIMIT);
}

/** Head count for one content type, without transferring a single document. */
async function countHeadRecords(client: VertesiaClient, typeId: string): Promise<number> {
    const result = await client.store.query.dsl({
        query: {
            bool: {
                filter: [{ term: { 'type.id': typeId } }, { term: { 'revision.head': true } }],
            },
        },
        size: 0,
    });
    return result.total ?? 0;
}

/**
 * Resolve the source ids a snapshot's evidence quotes to content-store records, in one request.
 *
 * Evidence carries a business id (`sec2y-iren-…-ex-99-1-2`), not an object id, so a link needs a
 * lookup. Doing it per evidence item would mean a request storm on every selection; instead the
 * whole snapshot's sources are resolved once per load, and the result is reused for every
 * selection. A failure here degrades to plain-text source ids — it must never take the graph down.
 */
async function resolveMemorySourceIndex(
    client: VertesiaClient,
    sourceTypeId: string,
    data: { relationships: MemoryRelationship[]; memories: MemoryEntry[] },
): Promise<MemorySourceIndex> {
    const sourceIds = collectMemorySourceIds(data);
    if (sourceIds.length === 0 || sourceIds.length > SOURCE_RESOLVE_LIMIT) return new Map();
    try {
        const result = await client.store.query.dsl({
            query: {
                bool: {
                    filter: [
                        { term: { 'type.id': sourceTypeId } },
                        { term: { 'revision.head': true } },
                        buildMemorySourceIdFilter(sourceIds),
                    ],
                },
            },
            size: sourceIds.length,
        });
        return indexMemorySourceRecords(
            (result.hits ?? []).map((hit) => ({ id: hit.id, ...asRecord(hit.source) }) as ContentObjectItemApiResponse),
        );
    } catch (err: unknown) {
        console.warn('Memory graph could not resolve evidence sources to content objects', err);
        return new Map();
    }
}

export interface MemoryGraphExplorerProps {
    /** Brain to open with. The explorer owns the selection from then on. */
    initialBrainId?: string;
    onBrainChange?: (brain: MemoryBrain) => void;
    typeNames?: Partial<MemoryGraphTypeNames>;
    /** Milliseconds between background refreshes. `0` disables polling. */
    pollIntervalMs?: number;
    /** Explicit height. Without it the explorer fills its parent. */
    height?: string | number;
    className?: string;
    showInspector?: boolean;
    showRail?: boolean;
    /** Called instead of navigating to `/store/objects/:id` when the host owns routing. */
    onOpenRecord?: (recordId: string) => void;
}

interface MemoryCatalog {
    brains: MemoryBrain[];
    entities: MemoryEntity[];
    relationshipTypeId: string;
    memoryEntryTypeId: string;
    sourceTypeId: string;
    sourceCount: number;
}

function toError(value: unknown): Error {
    return value instanceof Error ? value : new Error(String(value));
}

/**
 * Batteries-included Memory graph explorer.
 *
 * Like {@link ModernAgentConversation}, it takes its client from the surrounding
 * `UserSessionProvider` and fetches everything it needs, so a host embeds it in one line:
 * `<MemoryGraphExplorer />`. Entitlement gating stays in the host — this component never reads the
 * account.
 */
export function MemoryGraphExplorer({
    initialBrainId,
    onBrainChange,
    typeNames,
    pollIntervalMs = DEFAULT_MEMORY_POLL_INTERVAL_MS,
    height,
    className,
    showInspector = true,
    showRail = true,
    onOpenRecord,
}: MemoryGraphExplorerProps) {
    const { client } = useUserSession();
    const { t } = useUITranslation();

    const brainTypeName = typeNames?.brain ?? DEFAULT_MEMORY_TYPE_NAMES.brain;
    const entityTypeName = typeNames?.entity ?? DEFAULT_MEMORY_TYPE_NAMES.entity;
    const relationshipTypeName = typeNames?.relationship ?? DEFAULT_MEMORY_TYPE_NAMES.relationship;
    const sourceTypeName = typeNames?.source ?? DEFAULT_MEMORY_TYPE_NAMES.source;
    const memoryEntryTypeName = typeNames?.memoryEntry ?? DEFAULT_MEMORY_TYPE_NAMES.memoryEntry;

    const [catalog, setCatalog] = useState<MemoryCatalog>();
    const [catalogError, setCatalogError] = useState<Error>();
    const [isCatalogLoading, setIsCatalogLoading] = useState(true);
    const [graph, setGraph] = useState<MemoryGraphData>();
    const [graphError, setGraphError] = useState<Error>();
    const [isGraphLoading, setIsGraphLoading] = useState(false);
    const [selectedBrainId, setSelectedBrainId] = useState(initialBrainId);
    const [searchInput, setSearchInput] = useState('');
    const [activePredicates, setActivePredicates] = useState<string[]>([]);
    const [asOfIndex, setAsOfIndex] = useState<number>();
    const [timeAxis, setTimeAxis] = useState<MemoryTimeAxis>(DEFAULT_MEMORY_TIME_AXIS);
    const [selection, setSelection] = useState<MemorySelection>();

    // Latest-wins guards: a response from a superseded brain or a superseded catalog request must
    // never be written to state.
    const catalogGenRef = useRef(0);
    const graphGenRef = useRef(0);
    const notifiedBrainRef = useRef<string | undefined>(undefined);
    // Last resolved evidence-source index, keyed by the source ids it was built from.
    const sourceIndexRef = useRef<{ key: string; index: MemorySourceIndex }>(undefined);

    const search = useDebounce(searchInput, 250);

    const loadCatalog = useCallback(async () => {
        const generation = ++catalogGenRef.current;
        setIsCatalogLoading(true);
        try {
            const [brainType, entityType, relationshipType, sourceType, memoryEntryType] = await Promise.all([
                client.store.types.getTypeByName(brainTypeName),
                client.store.types.getTypeByName(entityTypeName),
                client.store.types.getTypeByName(relationshipTypeName),
                client.store.types.getTypeByName(sourceTypeName),
                client.store.types.getTypeByName(memoryEntryTypeName),
            ]);
            const [brainResult, entityRecords, sourceCount] = await Promise.all([
                client.store.objects.search({
                    limit: BRAIN_PAGE_SIZE,
                    all_revisions: false,
                    query: { type: brainType.id },
                }),
                queryHeadRecords(client, entityType.id),
                countHeadRecords(client, sourceType.id),
            ]);
            if (generation !== catalogGenRef.current) return;
            setCatalog({
                // Same order as the catalog cards, so the two lists never disagree.
                brains: sortMemoryBrains(parseMemoryBrains(brainResult.results)),
                entities: parseMemoryEntities(entityRecords),
                relationshipTypeId: relationshipType.id,
                memoryEntryTypeId: memoryEntryType.id,
                sourceTypeId: sourceType.id,
                sourceCount,
            });
            // A success clears the previous failure: one bad poll must not brick the view.
            setCatalogError(undefined);
        } catch (err: unknown) {
            if (generation !== catalogGenRef.current) return;
            setCatalogError(toError(err));
        } finally {
            if (generation === catalogGenRef.current) setIsCatalogLoading(false);
        }
    }, [client, brainTypeName, entityTypeName, relationshipTypeName, sourceTypeName, memoryEntryTypeName]);

    useEffect(() => {
        void loadCatalog();
    }, [loadCatalog]);

    const selectedBrain = useMemo(
        () => selectMemoryBrain(catalog?.brains ?? [], selectedBrainId),
        [catalog?.brains, selectedBrainId],
    );

    const relationshipTypeId = catalog?.relationshipTypeId;
    const memoryEntryTypeId = catalog?.memoryEntryTypeId;
    const sourceTypeId = catalog?.sourceTypeId;
    const entities = catalog?.entities;
    const sourceCount = catalog?.sourceCount ?? 0;
    const brainId = selectedBrain?.brainId;

    const loadGraph = useCallback(async () => {
        if (!relationshipTypeId || !memoryEntryTypeId || !sourceTypeId || !brainId || !entities) return;
        const generation = ++graphGenRef.current;
        setIsGraphLoading(true);
        try {
            const brainFilter = [buildMemoryBrainFilter({ brainId })];
            const [relationshipRecords, memoryRecords] = await Promise.all([
                queryHeadRecords(client, relationshipTypeId, brainFilter),
                queryHeadRecords(client, memoryEntryTypeId, brainFilter),
            ]);
            if (generation !== graphGenRef.current) return;
            const relationships = parseMemoryRelationships(relationshipRecords);
            const memories = parseMemoryEntries(memoryRecords);
            // A poll that brings back the same evidence reuses the resolved index instead of
            // re-querying the source type every interval.
            const sourceKey = collectMemorySourceIds({ relationships, memories }).join(' ');
            const cached = sourceIndexRef.current;
            const sourceRecordIds =
                cached?.key === sourceKey
                    ? cached.index
                    : await resolveMemorySourceIndex(client, sourceTypeId, { relationships, memories });
            if (generation !== graphGenRef.current) return;
            sourceIndexRef.current = { key: sourceKey, index: sourceRecordIds };
            setGraph({
                entities,
                relationships,
                memories,
                sourceCount,
                sourceRecordIds,
                loadedAt: new Date().toISOString(),
            });
            setGraphError(undefined);
        } catch (err: unknown) {
            if (generation !== graphGenRef.current) return;
            setGraphError(toError(err));
        } finally {
            if (generation === graphGenRef.current) setIsGraphLoading(false);
        }
    }, [client, relationshipTypeId, memoryEntryTypeId, sourceTypeId, entities, sourceCount, brainId]);

    useEffect(() => {
        void loadGraph();
    }, [loadGraph]);

    useEffect(() => {
        if (pollIntervalMs <= 0 || !brainId) return;
        const timer = window.setInterval(() => void loadGraph(), pollIntervalMs);
        return () => window.clearInterval(timer);
    }, [loadGraph, pollIntervalMs, brainId]);

    useEffect(() => {
        if (!selectedBrain || notifiedBrainRef.current === selectedBrain.brainId) return;
        notifiedBrainRef.current = selectedBrain.brainId;
        setSelectedBrainId(selectedBrain.brainId);
        onBrainChange?.(selectedBrain);
    }, [selectedBrain, onBrainChange]);

    const handleBrainChange = useCallback((brain: MemoryBrain) => {
        // Drop the previous brain's snapshot and every filter derived from it; the generation
        // counter takes care of any response still in flight.
        setGraph(undefined);
        setGraphError(undefined);
        setSelectedBrainId(brain.brainId);
        setSelection(undefined);
        setActivePredicates([]);
        setAsOfIndex(undefined);
    }, []);

    const handleTimeAxisChange = useCallback((axis: MemoryTimeAxis) => {
        setTimeAxis(axis);
        // Stops are per-axis, so the current index would point at an unrelated date. Unpinning
        // returns the scrubber to the latest stop of the axis just chosen.
        setAsOfIndex(undefined);
    }, []);

    const handleRefresh = useCallback(() => {
        void Promise.all([loadCatalog(), loadGraph()]);
    }, [loadCatalog, loadGraph]);

    const view = useMemo(
        () => buildMemoryGraphView(graph ?? { entities: [], relationships: [] }, timeAxis),
        [graph, timeAxis],
    );
    const groupStyles = useMemo(() => resolveGroupStyles(view.nodes, view.groups), [view]);
    const predicates = useMemo(() => collectMemoryPredicates(graph?.relationships ?? []), [graph]);
    const stops = useMemo(
        () =>
            collectMemoryTimeline(
                { relationships: graph?.relationships ?? [], memories: graph?.memories ?? [] },
                timeAxis,
            ),
        [graph, timeAxis],
    );
    const lastStopIndex = Math.max(stops.length - 1, 0);
    // `undefined` pins the scrubber to the latest stop, so a newly reconstructed statement widens
    // the timeline instead of silently landing outside the cutoff.
    const effectiveAsOfIndex = Math.min(asOfIndex ?? lastStopIndex, lastStopIndex);
    const asOf = stops[effectiveAsOfIndex];

    // Episodes are placed on the same axis as the scrubber; one that carries no date for the active
    // axis has no position on it and is left off the track rather than borrowed from the other one.
    const episodes = useMemo(
        () =>
            computeTimelineMarkers(
                stops,
                (graph?.memories ?? []).flatMap((memory) => {
                    const date = memoryAxisStart(memory, timeAxis);
                    return date ? [{ id: memory.memoryId, date, label: memory.title, data: memory }] : [];
                }),
            ),
        [stops, graph, timeAxis],
    );

    const matchedIds = useMemo(
        () => computeMemoryMatchIds(view, { search, predicates: activePredicates }),
        [view, search, activePredicates],
    );

    const graphSelection: TemporalGraphSelection | null = useMemo(() => {
        if (selection?.kind === 'entity') return { type: 'node', id: selection.id };
        if (selection?.kind === 'statement') return { type: 'edge', id: selection.id };
        return null;
    }, [selection]);

    const handleGraphSelect = useCallback((next: TemporalGraphSelection | undefined) => {
        if (!next) {
            setSelection(undefined);
            return;
        }
        setSelection({ kind: next.type === 'node' ? 'entity' : 'statement', id: next.id });
    }, []);

    const togglePredicate = useCallback((predicate: string) => {
        setActivePredicates((current) =>
            current.includes(predicate) ? current.filter((value) => value !== predicate) : [...current, predicate],
        );
    }, []);

    // Counted over the drawn edges, so the readout always matches what is on the canvas.
    const knownEdgeCount = useMemo(
        () => view.edges.filter((edge) => !edge.data || isMemoryInScope(edge.data, timeAxis, asOf)).length,
        [view.edges, timeAxis, asOf],
    );

    const isFirstLoad = (isCatalogLoading || isGraphLoading) && !graph;
    const blockingError = catalogError && !catalog ? catalogError : undefined;
    // Once a snapshot is on screen a failed poll is a notice, not a replacement for the view.
    const inlineError = !blockingError ? (graphError ?? catalogError) : undefined;
    const columns = cn(
        'grid min-h-0 flex-1 gap-2',
        showRail && showInspector && 'xl:grid-cols-[236px_minmax(0,1fr)_320px]',
        showRail && !showInspector && 'xl:grid-cols-[236px_minmax(0,1fr)]',
        !showRail && showInspector && 'xl:grid-cols-[minmax(0,1fr)_320px]',
    );

    const body = () => {
        if (blockingError) {
            return (
                <div className="flex flex-1 items-center justify-center p-4">
                    <ErrorBox
                        title={t('memoryGraph.notReadyTitle')}
                        action={handleRefresh}
                        actionLabel={t('memoryGraph.refresh')}
                    >
                        {`${blockingError.message}\n\n${t('memoryGraph.notReadyDescription')}`}
                    </ErrorBox>
                </div>
            );
        }
        if (catalog && catalog.brains.length === 0) {
            // Not an error: a project simply has no brain yet. It must not look like a failure.
            return (
                <div className="flex flex-1 items-center justify-center p-4">
                    <div className="max-w-md rounded-lg border border-dashed bg-card p-8 text-center">
                        <div className="mx-auto w-fit rounded-full bg-muted-background p-3 text-muted">
                            <BrainCircuit className="size-6" aria-hidden={true} />
                        </div>
                        <p className="mt-3 font-medium text-foreground">{t('memoryGraph.noBrainsTitle')}</p>
                        <p className="mt-1 text-sm leading-relaxed text-muted">
                            {t('memoryGraph.noBrainsDescription')}
                        </p>
                    </div>
                </div>
            );
        }
        if (isFirstLoad) {
            return (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted">
                    <Spinner />
                    <p className="text-sm">{t('memoryGraph.loading')}</p>
                </div>
            );
        }
        return (
            <div className={columns}>
                {showRail ? (
                    <MemoryGraphRail
                        stops={stops}
                        timeAxis={timeAxis}
                        onTimeAxisChange={handleTimeAxisChange}
                        asOfIndex={effectiveAsOfIndex}
                        onAsOfIndexChange={setAsOfIndex}
                        episodes={episodes}
                        knownEdgeCount={knownEdgeCount}
                        totalEdgeCount={view.edges.length}
                        predicates={predicates}
                        activePredicates={activePredicates}
                        onTogglePredicate={togglePredicate}
                        onClearPredicates={() => setActivePredicates([])}
                        groups={groupStyles}
                    />
                ) : null}

                <main className="relative min-h-[420px] overflow-hidden rounded-lg border bg-background">
                    <div className="pointer-events-none absolute top-2.5 z-10 px-3 font-mono text-[10.5px] text-muted">
                        {t('memoryGraph.hudCounts', {
                            nodes: view.nodes.length,
                            known: knownEdgeCount,
                            edges: view.edges.length,
                        })}
                    </div>
                    <TemporalGraph
                        nodes={view.nodes}
                        edges={view.edges}
                        groups={view.groups}
                        selection={graphSelection}
                        onSelect={handleGraphSelect}
                        asOf={asOf}
                        matchedIds={matchedIds}
                        label={t('memoryGraph.graphLabel')}
                        emptyState={
                            <div className="flex flex-col items-center gap-3">
                                <div className="rounded-full bg-muted-background p-3 text-muted">
                                    <Network className="size-6" aria-hidden={true} />
                                </div>
                                <div>
                                    <p className="font-medium text-foreground">{t('memoryGraph.emptyTitle')}</p>
                                    <p className="mt-1 text-sm text-muted">{t('memoryGraph.emptyDescription')}</p>
                                </div>
                            </div>
                        }
                    />
                </main>

                {showInspector ? (
                    <MemoryGraphInspector
                        selection={selection}
                        entities={graph?.entities ?? []}
                        relationships={graph?.relationships ?? []}
                        memories={graph?.memories ?? []}
                        sourceRecordIds={graph?.sourceRecordIds}
                        timeAxis={timeAxis}
                        asOf={asOf}
                        search={search}
                        onSelect={setSelection}
                        onOpenRecord={onOpenRecord}
                    />
                ) : null}
            </div>
        );
    };

    return (
        <div
            className={cn('flex min-h-0 flex-col gap-2', !height && 'h-full', className)}
            style={height ? { height } : undefined}
        >
            <div className="flex shrink-0 flex-wrap items-center gap-2 px-2 pt-2">
                <div className="w-72">
                    <SelectBox
                        aria-label={t('memoryGraph.selectBrain')}
                        by="brainId"
                        value={selectedBrain}
                        options={catalog?.brains ?? []}
                        optionLabel={(brain: MemoryBrain) => (
                            <div className="min-w-0">
                                <div className="flex items-baseline gap-2">
                                    <span className="min-w-0 flex-1 truncate font-medium">{brain.displayName}</span>
                                    <span
                                        className={cn(
                                            'shrink-0 font-mono text-[10px] uppercase tracking-wide',
                                            BRAIN_STATUS_TEXT[memoryBrainStatusTone(brain.status)],
                                        )}
                                    >
                                        {brain.status}
                                    </span>
                                </div>
                                <div className="truncate text-xs text-muted">
                                    {formatModelName(brain.model)}
                                    {brain.reasoningEffort ? ` · ${brain.reasoningEffort}` : ''}
                                </div>
                            </div>
                        )}
                        filterBy={(brain: MemoryBrain) =>
                            `${brain.displayName} ${brain.brainId} ${brain.model} ${brain.status}`
                        }
                        onChange={handleBrainChange}
                        placeholder={t('memoryGraph.brainPlaceholder')}
                        isLoading={isCatalogLoading}
                    />
                </div>
                <div className="min-w-48 flex-1">
                    <Input
                        aria-label={t('memoryGraph.searchLabel')}
                        value={searchInput}
                        onChange={setSearchInput}
                        placeholder={t('memoryGraph.searchPlaceholder')}
                    />
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    isDisabled={isCatalogLoading || isGraphLoading}
                >
                    <RefreshCw
                        className={cn('size-4', (isCatalogLoading || isGraphLoading) && 'motion-safe:animate-spin')}
                        aria-hidden={true}
                    />
                    {t('memoryGraph.refresh')}
                </Button>
            </div>

            {inlineError ? (
                <MessageBox status="warning" className="mx-2 shrink-0">
                    {t('memoryGraph.refreshFailed', { message: inlineError.message })}
                </MessageBox>
            ) : null}

            {/* Below xl the three panes stack, so the page scrolls instead of clipping them. */}
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 xl:overflow-hidden">{body()}</div>

            <MemoryGraphStatusBar
                brain={selectedBrain}
                loadedAt={graph?.loadedAt}
                isLoading={isCatalogLoading || isGraphLoading}
                pollIntervalMs={pollIntervalMs}
                entityCount={view.nodes.length}
                statementCount={view.edges.length}
                memoryCount={graph?.memories.length ?? 0}
                sourceCount={graph?.sourceCount ?? 0}
                evidenceCoverage={computeEvidenceCoverage(graph?.relationships ?? [])}
            />
        </div>
    );
}
