import { Button, cn, ErrorBox, Input, MessageBox, SelectBox, Spinner, useDebounce } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import {
    computeTimelineMarkers,
    isEdgeObservedBy,
    resolveGroupStyles,
    TemporalGraph,
    type TemporalGraphSelection,
} from '@vertesia/ui/widgets';
import { Network, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MemoryGraphInspector, type MemorySelection } from './MemoryGraphInspector.js';
import { MemoryGraphRail } from './MemoryGraphRail.js';
import { MemoryGraphStatusBar } from './MemoryGraphStatusBar.js';
import {
    buildMemoryRelationshipMatch,
    formatModelName,
    type MemoryBrain,
    parseMemoryBrains,
    selectMemoryBrain,
} from './memoryBrainModel.js';
import {
    buildMemoryGraphView,
    collectMemoryPredicates,
    collectMemoryTimeline,
    computeEvidenceCoverage,
    computeMemoryMatchIds,
    type MemoryEntity,
    type MemoryGraphData,
    parseMemoryEntities,
    parseMemoryEntries,
    parseMemoryRelationships,
} from './memoryGraphModel.js';

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

const ENTITY_PAGE_SIZE = 500;
const RECORD_PAGE_SIZE = 500;
const BRAIN_PAGE_SIZE = 100;

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
    const [selection, setSelection] = useState<MemorySelection>();

    // Latest-wins guards: a response from a superseded brain or a superseded catalog request must
    // never be written to state.
    const catalogGenRef = useRef(0);
    const graphGenRef = useRef(0);
    const notifiedBrainRef = useRef<string | undefined>(undefined);

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
            const [brainResult, entityResult, sourceResult] = await Promise.all([
                client.store.objects.search({
                    limit: BRAIN_PAGE_SIZE,
                    all_revisions: false,
                    query: { type: brainType.id },
                }),
                client.store.objects.search({
                    limit: ENTITY_PAGE_SIZE,
                    all_revisions: false,
                    query: { type: entityType.id },
                }),
                client.store.objects.search({
                    limit: 1,
                    all_revisions: false,
                    query: { type: sourceType.id },
                }),
            ]);
            if (generation !== catalogGenRef.current) return;
            setCatalog({
                brains: parseMemoryBrains(brainResult.results),
                entities: parseMemoryEntities(entityResult.results),
                relationshipTypeId: relationshipType.id,
                memoryEntryTypeId: memoryEntryType.id,
                sourceCount: sourceResult.facets?.total ?? sourceResult.results.length,
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
    const entities = catalog?.entities;
    const sourceCount = catalog?.sourceCount ?? 0;
    const brainId = selectedBrain?.brainId;

    const loadGraph = useCallback(async () => {
        if (!relationshipTypeId || !memoryEntryTypeId || !brainId || !entities) return;
        const generation = ++graphGenRef.current;
        setIsGraphLoading(true);
        try {
            const match = buildMemoryRelationshipMatch({ brainId });
            const [relationshipResult, memoryResult] = await Promise.all([
                client.store.objects.search({
                    limit: RECORD_PAGE_SIZE,
                    all_revisions: false,
                    query: { type: relationshipTypeId, match },
                }),
                client.store.objects.search({
                    limit: RECORD_PAGE_SIZE,
                    all_revisions: false,
                    query: { type: memoryEntryTypeId, match },
                }),
            ]);
            if (generation !== graphGenRef.current) return;
            setGraph({
                entities,
                relationships: parseMemoryRelationships(relationshipResult.results),
                memories: parseMemoryEntries(memoryResult.results),
                sourceCount,
                loadedAt: new Date().toISOString(),
            });
            setGraphError(undefined);
        } catch (err: unknown) {
            if (generation !== graphGenRef.current) return;
            setGraphError(toError(err));
        } finally {
            if (generation === graphGenRef.current) setIsGraphLoading(false);
        }
    }, [client, relationshipTypeId, memoryEntryTypeId, entities, sourceCount, brainId]);

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

    const handleRefresh = useCallback(() => {
        void Promise.all([loadCatalog(), loadGraph()]);
    }, [loadCatalog, loadGraph]);

    const view = useMemo(() => buildMemoryGraphView(graph ?? { entities: [], relationships: [] }), [graph]);
    const groupStyles = useMemo(() => resolveGroupStyles(view.nodes, view.groups), [view]);
    const predicates = useMemo(() => collectMemoryPredicates(graph?.relationships ?? []), [graph]);
    const stops = useMemo(
        () => collectMemoryTimeline({ relationships: graph?.relationships ?? [], memories: graph?.memories ?? [] }),
        [graph],
    );
    const lastStopIndex = Math.max(stops.length - 1, 0);
    // `undefined` pins the scrubber to the latest stop, so a newly reconstructed statement widens
    // the timeline instead of silently landing outside the cutoff.
    const effectiveAsOfIndex = Math.min(asOfIndex ?? lastStopIndex, lastStopIndex);
    const asOf = stops[effectiveAsOfIndex];

    const episodes = useMemo(
        () =>
            computeTimelineMarkers(
                stops,
                (graph?.memories ?? []).map((memory) => ({
                    id: memory.memoryId,
                    date: memory.observedAt,
                    label: memory.title,
                    data: memory,
                })),
            ),
        [stops, graph],
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

    const knownEdgeCount = useMemo(
        () => view.edges.filter((edge) => isEdgeObservedBy(edge, asOf)).length,
        [view.edges, asOf],
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
            return (
                <div className="flex flex-1 items-center justify-center p-4">
                    <ErrorBox title={t('memoryGraph.noBrainsTitle')}>{t('memoryGraph.noBrainsDescription')}</ErrorBox>
                </div>
            );
        }
        if (isFirstLoad) {
            return (
                <div className="flex flex-1 items-center justify-center gap-3 text-muted">
                    <Spinner /> {t('memoryGraph.loading')}
                </div>
            );
        }
        return (
            <div className={columns}>
                {showRail ? (
                    <MemoryGraphRail
                        stops={stops}
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
                                <div className="truncate font-medium">{brain.displayName}</div>
                                <div className="truncate text-xs text-muted">
                                    {formatModelName(brain.model)}
                                    {brain.reasoningEffort ? ` · ${brain.reasoningEffort}` : ''}
                                </div>
                            </div>
                        )}
                        filterBy={(brain: MemoryBrain) => `${brain.displayName} ${brain.brainId} ${brain.model}`}
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

            <div className="flex min-h-0 flex-1 flex-col px-2">{body()}</div>

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
