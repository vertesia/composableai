import { Badge, Button, cn } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { NavLink } from '@vertesia/ui/router';
import { formatQualifiers, isExpiredEdge, type TemporalGraphEdge } from '@vertesia/ui/widgets';
import { ArrowLeft, ArrowRight, BrainCircuit, ExternalLink, Network, Sparkles } from 'lucide-react';
import type { MemoryEntity, MemoryEntry, MemoryEvidence, MemoryRelationship } from './memoryGraphModel.js';

export type MemorySelection =
    | { kind: 'entity'; id: string }
    | { kind: 'statement'; id: string }
    | { kind: 'memory'; id: string };

export interface MemoryGraphInspectorProps {
    selection?: MemorySelection;
    entities: MemoryEntity[];
    relationships: MemoryRelationship[];
    memories: MemoryEntry[];
    /** Belief-time cutoff currently on the scrubber; drives "known" and "expired" rendering. */
    asOf?: string;
    search: string;
    onSelect: (selection: MemorySelection | undefined) => void;
    onOpenRecord?: (recordId: string) => void;
}

function RecordLink({
    recordId,
    label,
    onOpenRecord,
}: {
    recordId: string;
    label: string;
    onOpenRecord?: (recordId: string) => void;
}) {
    if (onOpenRecord) {
        return (
            <Button variant="ghost" size="xs" className="px-0 text-info" onClick={() => onOpenRecord(recordId)}>
                <ExternalLink className="size-3" aria-hidden={true} />
                {label}
            </Button>
        );
    }
    return (
        <NavLink
            className="inline-flex items-center gap-1 text-xs text-info hover:underline"
            href={`/store/objects/${recordId}`}
            topLevelNav
        >
            <ExternalLink className="size-3" aria-hidden={true} />
            {label}
        </NavLink>
    );
}

function InspectorSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section>
            <h3 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">{title}</h3>
            <div className="mt-2">{children}</div>
        </section>
    );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="rounded-md border bg-background px-2.5 py-2">
            <div className="font-mono text-[9px] uppercase tracking-widest text-muted">{label}</div>
            <div className="mt-0.5 tabular-nums text-foreground">{value}</div>
        </div>
    );
}

function EvidenceCards({ evidence, emptyText }: { evidence: MemoryEvidence[]; emptyText: string }) {
    if (evidence.length === 0) {
        return <p className="rounded-md border border-dashed p-2 text-xs text-muted">{emptyText}</p>;
    }
    return (
        <div className="flex flex-col gap-2">
            {evidence.map((item) => (
                <div
                    key={`${item.sourceId}:${item.locator ?? ''}`}
                    className="rounded-md border border-s-[3px] border-s-attention bg-background p-2.5"
                >
                    <div className="font-mono text-[10.5px] text-attention">{item.sourceId}</div>
                    {item.locator ? <div className="mt-0.5 text-xs text-muted">{item.locator}</div> : null}
                    {item.summary ? (
                        <p className="mt-1.5 border-s-2 ps-2 text-xs italic leading-relaxed text-foreground">
                            {item.summary}
                        </p>
                    ) : null}
                </div>
            ))}
        </div>
    );
}

/** One row of the entity inspector's connection list. */
function ConnectionRow({
    relationship,
    otherLabel,
    isOutgoing,
    isExpired,
    onSelect,
}: {
    relationship: MemoryRelationship;
    otherLabel: string;
    isOutgoing: boolean;
    isExpired: boolean;
    onSelect: () => void;
}) {
    const { t } = useUITranslation();
    const qualifiers = formatQualifiers(relationship.qualifiers);
    const hasValidity = Boolean(relationship.validFrom || relationship.validTo);
    return (
        <Button
            variant="outline"
            className={cn(
                'h-auto w-full justify-start rounded-md p-2 font-mono text-[11px]',
                isExpired && 'opacity-60',
            )}
            onClick={onSelect}
        >
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                    {isOutgoing ? (
                        <ArrowRight className="size-3 shrink-0 text-muted" aria-hidden={true} />
                    ) : (
                        <ArrowLeft className="size-3 shrink-0 text-muted" aria-hidden={true} />
                    )}
                    <span className="text-info">{relationship.predicate}</span>
                    <span className="truncate text-foreground">{otherLabel}</span>
                    <span className="ms-auto shrink-0 text-[10px] text-muted">
                        {relationship.confidenceScore?.toFixed(2) ?? relationship.confidence}
                    </span>
                </div>
                {qualifiers ? <div className="mt-1 text-[10px] text-muted">{qualifiers}</div> : null}
                {hasValidity ? (
                    <div className={cn('mt-1 text-[10px] text-muted', isExpired && 'line-through')}>
                        {t('memoryGraph.validity', {
                            from: relationship.validFrom ?? '…',
                            to: relationship.validTo ?? t('memoryGraph.validityOpenEnd'),
                        })}
                        {isExpired ? ` · ${t('memoryGraph.noLongerInForce')}` : ''}
                    </div>
                ) : null}
            </div>
        </Button>
    );
}

function EntityInspector({
    entity,
    relationships,
    entityLabels,
    asOf,
    onSelect,
    onOpenRecord,
}: {
    entity: MemoryEntity;
    relationships: MemoryRelationship[];
    entityLabels: Map<string, string>;
    asOf?: string;
    onSelect: (selection: MemorySelection) => void;
    onOpenRecord?: (recordId: string) => void;
}) {
    const { t } = useUITranslation();
    const known = relationships.filter(
        (relationship) => !relationship.observedAt || !asOf || relationship.observedAt <= asOf,
    );
    const outbound = known.filter((relationship) => relationship.subjectId === entity.entityId);
    const inbound = known.filter((relationship) => relationship.objectId === entity.entityId);
    const connections = [...outbound, ...inbound];
    const firstSeen = connections
        .map((relationship) => relationship.observedAt)
        .filter((value): value is string => Boolean(value))
        .sort()[0];

    return (
        <div className="flex flex-col gap-5">
            <div>
                <div className="flex items-center gap-2">
                    <Network className="size-4 text-info" aria-hidden={true} />
                    <h2 className="font-semibold text-foreground">{entity.displayName}</h2>
                    {entity.ticker ? <span className="font-mono text-xs text-muted">${entity.ticker}</span> : null}
                </div>
                <div className="mt-1 font-mono text-[10.5px] text-muted">entity:{entity.entityId}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
                <Fact label={t('memoryGraph.kind')} value={entity.kind.replaceAll('_', ' ')} />
                <Fact label={t('memoryGraph.group')} value={(entity.layer ?? entity.kind).replaceAll('_', ' ')} />
                <Fact label={t('memoryGraph.outgoing')} value={outbound.length} />
                <Fact label={t('memoryGraph.incoming')} value={inbound.length} />
                <Fact label={t('memoryGraph.firstSeen')} value={firstSeen ?? '—'} />
                <Fact label={t('memoryGraph.degree')} value={connections.length} />
            </div>
            <InspectorSection title={t('memoryGraph.connections')}>
                {connections.length === 0 ? (
                    <p className="text-xs text-muted">{t('memoryGraph.noConnections')}</p>
                ) : (
                    <div className="flex flex-col gap-1.5">
                        {connections.map((relationship) => {
                            const isOutgoing = relationship.subjectId === entity.entityId;
                            const otherId = isOutgoing ? relationship.objectId : relationship.subjectId;
                            return (
                                <ConnectionRow
                                    key={relationship.relationshipId}
                                    relationship={relationship}
                                    isOutgoing={isOutgoing}
                                    otherLabel={entityLabels.get(otherId) ?? otherId}
                                    isExpired={Boolean(asOf && relationship.validTo && relationship.validTo < asOf)}
                                    onSelect={() => onSelect({ kind: 'statement', id: relationship.relationshipId })}
                                />
                            );
                        })}
                    </div>
                )}
            </InspectorSection>
            <RecordLink
                recordId={entity.recordId}
                label={t('memoryGraph.openEntityRecord')}
                onOpenRecord={onOpenRecord}
            />
        </div>
    );
}

function StatementInspector({
    relationship,
    entityLabels,
    asOf,
    onSelect,
    onOpenRecord,
}: {
    relationship: MemoryRelationship;
    entityLabels: Map<string, string>;
    asOf?: string;
    onSelect: (selection: MemorySelection) => void;
    onOpenRecord?: (recordId: string) => void;
}) {
    const { t } = useUITranslation();
    // Reuse the widget's classifier so the inspector and the canvas can never disagree.
    const edge: TemporalGraphEdge = {
        id: relationship.relationshipId,
        source: relationship.subjectId,
        target: relationship.objectId,
        validTo: relationship.validTo,
    };
    const isExpired = isExpiredEdge(edge, asOf);
    const qualifiers = formatQualifiers(relationship.qualifiers);
    const hasValidity = Boolean(relationship.validFrom || relationship.validTo);

    return (
        <div className="flex flex-col gap-5">
            <div>
                <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-info" aria-hidden={true} />
                    <h2 className="font-semibold text-foreground">{t('memoryGraph.statement')}</h2>
                </div>
                <div className="mt-1 font-mono text-[10.5px] text-muted">{relationship.relationshipId}</div>
            </div>
            <div className="rounded-lg border bg-background p-3">
                <Button
                    variant="ghost"
                    size="xs"
                    className="h-auto p-0 text-sm font-medium"
                    onClick={() => onSelect({ kind: 'entity', id: relationship.subjectId })}
                >
                    {entityLabels.get(relationship.subjectId) ?? relationship.subjectId}
                </Button>
                <div className="my-2 flex items-center gap-2 font-mono text-xs text-info">
                    <ArrowRight className="size-3" aria-hidden={true} />
                    {relationship.predicate}
                </div>
                <Button
                    variant="ghost"
                    size="xs"
                    className="h-auto p-0 text-sm font-medium"
                    onClick={() => onSelect({ kind: 'entity', id: relationship.objectId })}
                >
                    {entityLabels.get(relationship.objectId) ?? relationship.objectId}
                </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
                <Fact
                    label={t('memoryGraph.confidence')}
                    value={relationship.confidenceScore?.toFixed(2) ?? relationship.confidence.replaceAll('_', ' ')}
                />
                <Fact label={t('memoryGraph.observed')} value={relationship.observedAt ?? '—'} />
            </div>
            {qualifiers ? (
                <InspectorSection title={t('memoryGraph.qualifiers')}>
                    <p className="font-mono text-xs text-muted">{qualifiers}</p>
                </InspectorSection>
            ) : null}
            {hasValidity ? (
                <InspectorSection title={t('memoryGraph.validityTitle')}>
                    <p className={cn('font-mono text-xs text-muted', isExpired && 'line-through')}>
                        {t('memoryGraph.validity', {
                            from: relationship.validFrom ?? '…',
                            to: relationship.validTo ?? t('memoryGraph.validityOpenEnd'),
                        })}
                    </p>
                    {isExpired ? (
                        <Badge variant="outline" className="mt-2">
                            {t('memoryGraph.noLongerInForce')}
                        </Badge>
                    ) : null}
                </InspectorSection>
            ) : null}
            <InspectorSection title={t('memoryGraph.evidence')}>
                <EvidenceCards evidence={relationship.evidence} emptyText={t('memoryGraph.noEvidence')} />
            </InspectorSection>
            {relationship.notes ? (
                <InspectorSection title={t('memoryGraph.notes')}>
                    <p className="text-xs leading-relaxed text-muted">{relationship.notes}</p>
                </InspectorSection>
            ) : null}
            <RecordLink
                recordId={relationship.recordId}
                label={t('memoryGraph.openStatementRecord')}
                onOpenRecord={onOpenRecord}
            />
        </div>
    );
}

function MemoryEntryInspector({
    memory,
    onOpenRecord,
}: {
    memory: MemoryEntry;
    onOpenRecord?: (recordId: string) => void;
}) {
    const { t } = useUITranslation();
    return (
        <div className="flex flex-col gap-5">
            <div>
                <div className="flex items-center gap-2">
                    <BrainCircuit className="size-4 text-info" aria-hidden={true} />
                    <h2 className="font-semibold text-foreground">{memory.title}</h2>
                </div>
                <div className="mt-1 font-mono text-[10.5px] text-muted">{memory.memoryId}</div>
            </div>
            <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{memory.kind.replaceAll('_', ' ')}</Badge>
                <Badge variant={memory.confidence === 'explicit' ? 'success' : 'attention'}>
                    {memory.confidence.replaceAll('_', ' ')}
                </Badge>
            </div>
            <p className="text-sm leading-relaxed text-foreground">{memory.summary}</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
                <Fact label={t('memoryGraph.observed')} value={memory.observedAt} />
                <Fact label={t('memoryGraph.validFrom')} value={memory.validFrom ?? '—'} />
                {memory.validTo ? <Fact label={t('memoryGraph.validTo')} value={memory.validTo} /> : null}
            </div>
            {memory.entityIds.length > 0 ? (
                <InspectorSection title={t('memoryGraph.entities')}>
                    <div className="flex flex-wrap gap-1.5">
                        {memory.entityIds.map((entityId) => (
                            <Badge key={entityId} variant="outline">
                                {entityId}
                            </Badge>
                        ))}
                    </div>
                </InspectorSection>
            ) : null}
            <InspectorSection title={t('memoryGraph.evidence')}>
                <EvidenceCards evidence={memory.evidence} emptyText={t('memoryGraph.noEvidence')} />
            </InspectorSection>
            {memory.notes ? (
                <InspectorSection title={t('memoryGraph.notes')}>
                    <p className="text-xs leading-relaxed text-muted">{memory.notes}</p>
                </InspectorSection>
            ) : null}
            <RecordLink
                recordId={memory.recordId}
                label={t('memoryGraph.openMemoryRecord')}
                onOpenRecord={onOpenRecord}
            />
        </div>
    );
}

function ContentMemoryList({
    memories,
    search,
    asOf,
    onSelect,
}: {
    memories: MemoryEntry[];
    search: string;
    asOf?: string;
    onSelect: (memoryId: string) => void;
}) {
    const { t } = useUITranslation();
    const normalized = search.trim().toLowerCase();
    const visible = memories
        .filter((memory) => !asOf || memory.observedAt <= asOf)
        .filter(
            (memory) =>
                !normalized ||
                [memory.title, memory.summary, memory.kind, ...memory.entityIds].some((value) =>
                    value.toLowerCase().includes(normalized),
                ),
        )
        .sort((left, right) => right.observedAt.localeCompare(left.observedAt));

    return (
        <div>
            <div className="flex items-center gap-2">
                <BrainCircuit className="size-4 text-info" aria-hidden={true} />
                <h2 className="font-semibold text-foreground">{t('memoryGraph.contentMemory')}</h2>
                <Badge variant="outline" className="ms-auto">
                    {visible.length}
                </Badge>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted">{t('memoryGraph.contentMemoryHint')}</p>
            <div className="mt-4 flex flex-col gap-2">
                {visible.length === 0 ? (
                    <p className="rounded-md border border-dashed p-3 text-xs text-muted">
                        {t('memoryGraph.noMemories')}
                    </p>
                ) : (
                    visible.map((memory) => (
                        <Button
                            key={memory.memoryId}
                            variant="outline"
                            className="h-auto w-full justify-start rounded-md p-3 text-start"
                            onClick={() => onSelect(memory.memoryId)}
                        >
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-muted">
                                    <span>{memory.kind.replaceAll('_', ' ')}</span>
                                    <span aria-hidden={true}>·</span>
                                    <span>{memory.observedAt}</span>
                                </div>
                                <div className="mt-1 text-xs font-semibold text-foreground">{memory.title}</div>
                                <p className="mt-1 line-clamp-3 text-xs font-normal leading-relaxed text-muted">
                                    {memory.summary}
                                </p>
                            </div>
                        </Button>
                    ))
                )}
            </div>
        </div>
    );
}

export function MemoryGraphInspector({
    selection,
    entities,
    relationships,
    memories,
    asOf,
    search,
    onSelect,
    onOpenRecord,
}: MemoryGraphInspectorProps) {
    const entityLabels = new Map(entities.map((entity) => [entity.entityId, entity.displayName]));
    const entity =
        selection?.kind === 'entity' ? entities.find((candidate) => candidate.entityId === selection.id) : undefined;
    const relationship =
        selection?.kind === 'statement'
            ? relationships.find((candidate) => candidate.relationshipId === selection.id)
            : undefined;
    const memory =
        selection?.kind === 'memory' ? memories.find((candidate) => candidate.memoryId === selection.id) : undefined;

    return (
        <aside className="overflow-y-auto rounded-lg border bg-card p-4">
            {entity ? (
                <EntityInspector
                    entity={entity}
                    relationships={relationships}
                    entityLabels={entityLabels}
                    asOf={asOf}
                    onSelect={onSelect}
                    onOpenRecord={onOpenRecord}
                />
            ) : relationship ? (
                <StatementInspector
                    relationship={relationship}
                    entityLabels={entityLabels}
                    asOf={asOf}
                    onSelect={onSelect}
                    onOpenRecord={onOpenRecord}
                />
            ) : memory ? (
                <MemoryEntryInspector memory={memory} onOpenRecord={onOpenRecord} />
            ) : (
                <ContentMemoryList
                    memories={memories}
                    search={search}
                    asOf={asOf}
                    onSelect={(memoryId) => onSelect({ kind: 'memory', id: memoryId })}
                />
            )}
        </aside>
    );
}
