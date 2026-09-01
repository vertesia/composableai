import { Badge, Button, Collapsible, CollapsibleContent, CollapsibleTrigger, cn } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { NavLink } from '@vertesia/ui/router';
import { formatQualifiers, isExpiredEdge, JSONCode, type TemporalGraphEdge } from '@vertesia/ui/widgets';
import {
    ArrowLeft,
    ArrowRight,
    BrainCircuit,
    ChevronDown,
    ExternalLink,
    Network,
    Quote,
    SearchX,
    Sparkles,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
    DEFAULT_MEMORY_TIME_AXIS,
    hasMemoryAxisStarted,
    isMemoryInScope,
    type MemoryEntity,
    type MemoryEntry,
    type MemoryEvidence,
    type MemoryRawProperties,
    type MemoryRelationship,
    type MemorySelection,
    type MemorySourceIndex,
    type MemoryTemporalRecord,
    type MemoryTimeAxis,
    memoryAxisStart,
    resolveMemorySelection,
} from './memoryGraphModel.js';

export interface MemoryGraphInspectorProps {
    selection?: MemorySelection;
    entities: MemoryEntity[];
    relationships: MemoryRelationship[];
    memories: MemoryEntry[];
    /** Evidence source id → content-store record id. Absent ids stay plain text. */
    sourceRecordIds?: MemorySourceIndex;
    /** Which time axis the scrubber walks; decides what `asOf` is compared against. */
    timeAxis?: MemoryTimeAxis;
    /** Cutoff currently on the scrubber; drives "in scope" and "expired" rendering. */
    asOf?: string;
    search: string;
    onSelect: (selection: MemorySelection | undefined) => void;
    onOpenRecord?: (recordId: string) => void;
}

/**
 * The way out of the graph and into the content store.
 *
 * Deliberately a full-width row rather than a footnote link: reaching the underlying record is a
 * primary action of the inspector, and the record id is part of what an operator came for.
 */
function RecordLink({
    recordId,
    label,
    onOpenRecord,
}: {
    recordId: string;
    label: string;
    onOpenRecord?: (recordId: string) => void;
}) {
    const body = (
        <>
            <ExternalLink className="size-3.5 shrink-0" aria-hidden={true} />
            <span className="min-w-0 flex-1 truncate">{label}</span>
            <span className="shrink-0 font-mono text-[10px] font-normal text-muted">{recordId}</span>
        </>
    );
    const shared = 'flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-start text-xs font-medium';
    if (onOpenRecord) {
        return (
            <Button variant="outline" className={cn(shared, 'h-auto text-info')} onClick={() => onOpenRecord(recordId)}>
                {body}
            </Button>
        );
    }
    return (
        <NavLink
            className={cn(shared, 'bg-background text-info hover:underline')}
            href={`/store/objects/${recordId}`}
            topLevelNav
        >
            {body}
        </NavLink>
    );
}

/** `public_status` → `public status`. The exact key is rendered next to it, never replaced by this. */
function humanizeAttributeKey(key: string): string {
    return key.replaceAll('_', ' ').trim() || key;
}

/**
 * One stored value.
 *
 * Scalars render inline — numbers with `tabular-nums` so a column of them lines up. Anything
 * structured goes to {@link JSONCode}, which is the smallest thing that does the job: a `<pre>` with
 * token colouring and its own `overflow-auto`, so a wide array scrolls inside its own box instead of
 * widening the panel. `JSONDisplay`/`JSONView` were the alternative and are the wrong tool here —
 * they default to an interactive expand/collapse tree with its own state, inside a `h-full` flex
 * wrapper meant to fill a pane, which is more chrome than a dense attribute list can carry.
 */
function AttributeValue({ value }: { value: unknown }) {
    if (value === null || value === undefined) return <span className="text-muted">—</span>;
    if (typeof value === 'string') {
        return <span className="wrap-break-word">{value}</span>;
    }
    if (typeof value === 'number') return <span className="tabular-nums">{String(value)}</span>;
    if (typeof value === 'boolean') return <span className="font-mono">{String(value)}</span>;
    // Only the height is capped here: JSONCode already brings the padding, type scale and
    // horizontal scroll, and overriding those by appending classes would depend on Tailwind's
    // emission order rather than on anything readable.
    return <JSONCode data={value} className="max-h-56" />;
}

/**
 * Every property the record actually stores, collapsed by default.
 *
 * Nothing is filtered: fields the curated layout above already shows appear here too, because this
 * section answers "what is stored", not "what did we decide to show". A field the ontology gains
 * tomorrow therefore needs no code change to become visible.
 */
function AllAttributesSection({ raw }: { raw: MemoryRawProperties }) {
    const { t } = useUITranslation();
    const [isOpen, setIsOpen] = useState(false);
    const entries = useMemo(() => Object.entries(raw).sort(([left], [right]) => left.localeCompare(right)), [raw]);

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <div className="flex items-baseline justify-between gap-2 border-b pb-1">
                <CollapsibleTrigger asChild>
                    <Button
                        variant="ghost"
                        size="xs"
                        className="h-auto gap-1.5 px-0 font-mono text-[10px] font-semibold uppercase tracking-widest text-muted"
                    >
                        <ChevronDown
                            className={cn('size-3 shrink-0 transition-transform', !isOpen && '-rotate-90')}
                            aria-hidden={true}
                        />
                        {t('memoryGraph.allAttributes')}
                    </Button>
                </CollapsibleTrigger>
                <span className="font-mono text-[10px] tabular-nums text-muted">{entries.length}</span>
            </div>
            <CollapsibleContent>
                <p className="mt-2 text-[11px] leading-relaxed text-muted">{t('memoryGraph.allAttributesHint')}</p>
                {entries.length === 0 ? (
                    <p className="mt-2 rounded-md border border-dashed px-2.5 py-2 text-xs text-muted">
                        {t('memoryGraph.noAttributes')}
                    </p>
                ) : (
                    <dl className="mt-2 flex flex-col gap-1.5">
                        {entries.map(([key, value]) => (
                            <div key={key} className="min-w-0 rounded-md border bg-background px-2.5 py-1.5">
                                <dt className="flex items-baseline justify-between gap-2">
                                    <span className="min-w-0 truncate text-[10px] uppercase tracking-widest text-muted">
                                        {humanizeAttributeKey(key)}
                                    </span>
                                    <span className="shrink-0 font-mono text-[10px] text-muted">{key}</span>
                                </dt>
                                <dd className="mt-1 min-w-0 text-xs leading-relaxed text-foreground">
                                    <AttributeValue value={value} />
                                </dd>
                            </div>
                        ))}
                    </dl>
                )}
            </CollapsibleContent>
        </Collapsible>
    );
}

/** Panel header: icon, title, and the record id the panel is pinned to. */
function InspectorHeader({
    icon,
    title,
    subtitle,
    identity,
}: {
    icon: React.ReactNode;
    title: string;
    subtitle?: React.ReactNode;
    identity: string;
}) {
    return (
        <header>
            <div className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-info">{icon}</span>
                <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold leading-snug text-foreground">{title}</h2>
                    {subtitle ? <div className="mt-0.5 text-xs text-muted">{subtitle}</div> : null}
                </div>
            </div>
            <div className="mt-2 wrap-break-word font-mono text-[10px] leading-relaxed text-muted">{identity}</div>
        </header>
    );
}

function InspectorSection({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
    return (
        <section>
            <div className="flex items-baseline justify-between gap-2 border-b pb-1">
                <h3 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">{title}</h3>
                {count !== undefined ? (
                    <span className="font-mono text-[10px] tabular-nums text-muted">{count}</span>
                ) : null}
            </div>
            <div className="mt-2.5">{children}</div>
        </section>
    );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="rounded-md border bg-background px-2.5 py-1.5">
            <div className="font-mono text-[9px] uppercase tracking-widest text-muted">{label}</div>
            <div className="mt-1 truncate text-[13px] font-medium tabular-nums text-foreground">{value}</div>
        </div>
    );
}

/** Semantic band for a 0..1 confidence: certain, inferred, or speculative. */
function confidenceTone(score: number | undefined): 'success' | 'info' | 'attention' {
    if (score === undefined || score >= 0.9) return 'success';
    return score >= 0.7 ? 'info' : 'attention';
}

/** Confidence as a number, a humanized label, and a proportional bar. */
function ConfidenceMeter({ relationship, label }: { relationship: MemoryRelationship; label: string }) {
    const score = relationship.confidenceScore;
    const tone = confidenceTone(score);
    return (
        <div className="rounded-md border bg-background px-2.5 py-1.5">
            <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[9px] uppercase tracking-widest text-muted">{label}</span>
                <span className="font-mono text-[10px] text-muted">{relationship.confidence.replaceAll('_', ' ')}</span>
            </div>
            <div className="mt-1 text-[13px] font-medium tabular-nums text-foreground">
                {score !== undefined ? score.toFixed(2) : '—'}
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted-background">
                <div
                    className={cn(
                        'h-full rounded-full',
                        tone === 'success' && 'bg-success',
                        tone === 'info' && 'bg-info',
                        tone === 'attention' && 'bg-attention',
                    )}
                    style={{ width: `${Math.round((score ?? 0) * 100)}%` }}
                />
            </div>
        </div>
    );
}

/** Compact confidence read-out for a dense list row. */
function ConfidenceTag({ relationship }: { relationship: MemoryRelationship }) {
    const score = relationship.confidenceScore;
    const tone = confidenceTone(score);
    return (
        <span
            className={cn(
                'shrink-0 rounded-sm px-1 py-px font-mono text-[10px] tabular-nums',
                tone === 'success' && 'text-success',
                tone === 'info' && 'text-info',
                tone === 'attention' && 'text-attention',
            )}
        >
            {score !== undefined ? score.toFixed(2) : relationship.confidence.replaceAll('_', ' ')}
        </span>
    );
}

/**
 * The source id of one evidence item, as a link when it resolves to a content object.
 *
 * The id is a business id the corpus authored, so it only becomes a link once the snapshot's
 * batched source lookup has mapped it. An unmapped id stays exactly what it was: plain text.
 */
function EvidenceSourceId({
    sourceId,
    recordId,
    onOpenRecord,
}: {
    sourceId: string;
    recordId?: string;
    onOpenRecord?: (recordId: string) => void;
}) {
    const { t } = useUITranslation();
    const className = 'min-w-0 flex-1 truncate font-mono text-[10.5px] font-medium text-attention';
    if (!recordId) {
        return <span className={className}>{sourceId}</span>;
    }
    if (onOpenRecord) {
        return (
            <Button
                variant="ghost"
                size="xs"
                className={cn(className, 'h-auto justify-start px-0 hover:underline')}
                aria-label={t('memoryGraph.openSourceRecord', { sourceId })}
                onClick={() => onOpenRecord(recordId)}
            >
                {sourceId}
            </Button>
        );
    }
    // No aria-label here: NavLink does not forward one, and the link text is the source id itself,
    // which is the name an operator is looking for anyway.
    return (
        <NavLink className={cn(className, 'hover:underline')} href={`/store/objects/${recordId}`} topLevelNav>
            {sourceId}
        </NavLink>
    );
}

function EvidenceCards({
    evidence,
    emptyText,
    sourceRecordIds,
    onOpenRecord,
}: {
    evidence: MemoryEvidence[];
    emptyText: string;
    sourceRecordIds?: MemorySourceIndex;
    onOpenRecord?: (recordId: string) => void;
}) {
    if (evidence.length === 0) {
        return <p className="rounded-md border border-dashed px-2.5 py-2 text-xs text-muted">{emptyText}</p>;
    }
    return (
        <ul className="flex flex-col gap-2">
            {evidence.map((item) => (
                <li
                    key={`${item.sourceId}:${item.locator ?? ''}`}
                    className="rounded-md border border-s-[3px] border-s-attention bg-background px-2.5 py-2"
                >
                    <div className="flex items-baseline gap-2">
                        <EvidenceSourceId
                            sourceId={item.sourceId}
                            recordId={sourceRecordIds?.get(item.sourceId)}
                            onOpenRecord={onOpenRecord}
                        />
                        {item.locator ? (
                            <span className="shrink-0 font-mono text-[10px] text-muted">{item.locator}</span>
                        ) : null}
                    </div>
                    {item.summary ? (
                        <p className="mt-2 flex gap-1.5 text-xs italic leading-relaxed text-foreground">
                            <Quote className="mt-0.5 size-3 shrink-0 text-muted" aria-hidden={true} />
                            <span className="min-w-0">{item.summary}</span>
                        </p>
                    ) : null}
                </li>
            ))}
        </ul>
    );
}

/** Validity line, struck through once the statement is out of force at the cutoff. */
function ValidityLine({
    relationship,
    isExpired,
    className,
}: {
    relationship: MemoryRelationship;
    isExpired: boolean;
    className?: string;
}) {
    const { t } = useUITranslation();
    return (
        <span className={cn('font-mono tabular-nums', isExpired && 'line-through', className)}>
            {t('memoryGraph.validity', {
                from: relationship.validFrom ?? '…',
                to: relationship.validTo ?? t('memoryGraph.validityOpenEnd'),
            })}
        </span>
    );
}

/**
 * The record's two dates, side by side and labelled.
 *
 * A record is dated twice and the two answers differ — an IREN monthly update was *published* on
 * 2025-06-05 and was *true* for May. Showing only one of them is what made the scrubber ambiguous,
 * so the inspector states both, with the stored field names next to them for operators.
 */
function BitemporalSection({ record, isExpired }: { record: MemoryTemporalRecord; isExpired: boolean }) {
    const { t } = useUITranslation();
    const validity =
        record.validFrom || record.validTo
            ? t('memoryGraph.validity', {
                  from: record.validFrom ?? '…',
                  to: record.validTo ?? t('memoryGraph.validityOpenEnd'),
              })
            : '—';
    const rows = [
        { field: 'valid_from → valid_to', label: t('memoryGraph.axisValid'), value: validity, struck: isExpired },
        { field: 'observed_at', label: t('memoryGraph.axisObserved'), value: record.observedAt ?? '—', struck: false },
    ];
    return (
        <InspectorSection title={t('memoryGraph.timeTitle')}>
            <dl className="flex flex-col gap-1.5">
                {rows.map((row) => (
                    <div key={row.field} className="rounded-md border bg-background px-2.5 py-1.5">
                        <dt className="flex items-baseline justify-between gap-2">
                            <span className="min-w-0 truncate text-[10px] uppercase tracking-widest text-muted">
                                {row.label}
                            </span>
                            <span className="shrink-0 font-mono text-[10px] text-muted">{row.field}</span>
                        </dt>
                        <dd
                            className={cn(
                                'mt-1 font-mono text-xs tabular-nums text-foreground',
                                row.struck && 'line-through',
                            )}
                        >
                            {row.value}
                        </dd>
                    </div>
                ))}
            </dl>
            {isExpired ? (
                <Badge variant="outline" className="mt-2">
                    {t('memoryGraph.noLongerInForce')}
                </Badge>
            ) : null}
        </InspectorSection>
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
            className={cn('h-auto w-full justify-start rounded-md px-2.5 py-2 text-start', isExpired && 'opacity-70')}
            onClick={onSelect}
        >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-1.5">
                    {isOutgoing ? (
                        <ArrowRight className="size-3 shrink-0 text-muted" aria-hidden={true} />
                    ) : (
                        <ArrowLeft className="size-3 shrink-0 text-muted" aria-hidden={true} />
                    )}
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{otherLabel}</span>
                    <ConfidenceTag relationship={relationship} />
                </div>
                <div className="ps-[18px] font-mono text-[10.5px] text-info">{relationship.predicate}</div>
                {qualifiers ? <div className="ps-[18px] font-mono text-[10px] text-muted">{qualifiers}</div> : null}
                {hasValidity ? (
                    <div className="flex flex-wrap items-center gap-1.5 ps-[18px] text-[10px] text-muted">
                        <ValidityLine relationship={relationship} isExpired={isExpired} />
                        {isExpired ? <span className="text-attention">{t('memoryGraph.noLongerInForce')}</span> : null}
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
    timeAxis,
    asOf,
    onSelect,
    onOpenRecord,
}: {
    entity: MemoryEntity;
    relationships: MemoryRelationship[];
    entityLabels: Map<string, string>;
    timeAxis: MemoryTimeAxis;
    asOf?: string;
    onSelect: (selection: MemorySelection) => void;
    onOpenRecord?: (recordId: string) => void;
}) {
    const { t } = useUITranslation();
    // Statements that have started on the active axis, expired ones included: those still belong on
    // the list, marked "no longer in force", rather than vanishing from the entity's history.
    const known = relationships.filter((relationship) => hasMemoryAxisStarted(relationship, timeAxis, asOf));
    const outbound = known.filter((relationship) => relationship.subjectId === entity.entityId);
    const inbound = known.filter((relationship) => relationship.objectId === entity.entityId);
    const connections = [...outbound, ...inbound];
    const firstSeen = connections
        .map((relationship) => (timeAxis === 'valid' ? relationship.validFrom : relationship.observedAt))
        .filter((value): value is string => Boolean(value))
        .sort()[0];

    return (
        <div className="flex flex-col gap-5">
            <InspectorHeader
                icon={<Network className="size-4" aria-hidden={true} />}
                title={entity.displayName}
                subtitle={entity.ticker ? <span className="font-mono tabular-nums">${entity.ticker}</span> : undefined}
                identity={`entity:${entity.entityId}`}
            />
            <RecordLink
                recordId={entity.recordId}
                label={t('memoryGraph.openEntityRecord')}
                onOpenRecord={onOpenRecord}
            />
            <div className="grid grid-cols-2 gap-2">
                <Fact label={t('memoryGraph.kind')} value={entity.kind.replaceAll('_', ' ')} />
                <Fact label={t('memoryGraph.group')} value={(entity.layer ?? entity.kind).replaceAll('_', ' ')} />
                <Fact label={t('memoryGraph.outgoing')} value={outbound.length} />
                <Fact label={t('memoryGraph.incoming')} value={inbound.length} />
                <Fact label={t('memoryGraph.firstSeen')} value={firstSeen ?? '—'} />
                <Fact label={t('memoryGraph.degree')} value={connections.length} />
            </div>
            <InspectorSection title={t('memoryGraph.connections')} count={connections.length}>
                {connections.length === 0 ? (
                    <p className="rounded-md border border-dashed px-2.5 py-2 text-xs text-muted">
                        {t('memoryGraph.noConnections')}
                    </p>
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
            <AllAttributesSection raw={entity.raw} />
        </div>
    );
}

function StatementInspector({
    relationship,
    entityLabels,
    sourceRecordIds,
    asOf,
    onSelect,
    onOpenRecord,
}: {
    relationship: MemoryRelationship;
    entityLabels: Map<string, string>;
    sourceRecordIds?: MemorySourceIndex;
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

    return (
        <div className="flex flex-col gap-5">
            <InspectorHeader
                icon={<Sparkles className="size-4" aria-hidden={true} />}
                title={t('memoryGraph.statement')}
                subtitle={<span className="font-mono">{relationship.predicate}</span>}
                identity={relationship.relationshipId}
            />
            <RecordLink
                recordId={relationship.recordId}
                label={t('memoryGraph.openStatementRecord')}
                onOpenRecord={onOpenRecord}
            />
            <div className="rounded-lg border bg-background p-2.5">
                <Button
                    variant="ghost"
                    size="xs"
                    className="h-auto w-full justify-start p-0 text-start text-[13px] font-medium hover:underline"
                    onClick={() => onSelect({ kind: 'entity', id: relationship.subjectId })}
                >
                    <span className="min-w-0 truncate">
                        {entityLabels.get(relationship.subjectId) ?? relationship.subjectId}
                    </span>
                </Button>
                <div className="my-1.5 flex items-center gap-1.5 font-mono text-[11px] text-info">
                    <ArrowRight className="size-3 shrink-0" aria-hidden={true} />
                    <span className="min-w-0 truncate">{relationship.predicate}</span>
                </div>
                <Button
                    variant="ghost"
                    size="xs"
                    className="h-auto w-full justify-start p-0 text-start text-[13px] font-medium hover:underline"
                    onClick={() => onSelect({ kind: 'entity', id: relationship.objectId })}
                >
                    <span className="min-w-0 truncate">
                        {entityLabels.get(relationship.objectId) ?? relationship.objectId}
                    </span>
                </Button>
            </div>
            <ConfidenceMeter relationship={relationship} label={t('memoryGraph.confidence')} />
            <BitemporalSection record={relationship} isExpired={isExpired} />
            {qualifiers ? (
                <InspectorSection title={t('memoryGraph.qualifiers')}>
                    <p className="font-mono text-xs leading-relaxed text-muted">{qualifiers}</p>
                </InspectorSection>
            ) : null}
            <InspectorSection title={t('memoryGraph.evidence')} count={relationship.evidence.length}>
                <EvidenceCards
                    evidence={relationship.evidence}
                    emptyText={t('memoryGraph.noEvidence')}
                    sourceRecordIds={sourceRecordIds}
                    onOpenRecord={onOpenRecord}
                />
            </InspectorSection>
            {relationship.notes ? (
                <InspectorSection title={t('memoryGraph.notes')}>
                    <p className="text-xs leading-relaxed text-muted">{relationship.notes}</p>
                </InspectorSection>
            ) : null}
            <AllAttributesSection raw={relationship.raw} />
        </div>
    );
}

function MemoryEntryInspector({
    memory,
    sourceRecordIds,
    asOf,
    onOpenRecord,
}: {
    memory: MemoryEntry;
    sourceRecordIds?: MemorySourceIndex;
    asOf?: string;
    onOpenRecord?: (recordId: string) => void;
}) {
    const { t } = useUITranslation();
    const isExpired = Boolean(asOf && memory.validTo && memory.validTo < asOf);
    return (
        <div className="flex flex-col gap-5">
            <InspectorHeader
                icon={<BrainCircuit className="size-4" aria-hidden={true} />}
                title={memory.title}
                identity={memory.memoryId}
            />
            <RecordLink
                recordId={memory.recordId}
                label={t('memoryGraph.openMemoryRecord')}
                onOpenRecord={onOpenRecord}
            />
            <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline">{memory.kind.replaceAll('_', ' ')}</Badge>
                <Badge variant={memory.confidence === 'explicit' ? 'success' : 'attention'}>
                    {memory.confidence.replaceAll('_', ' ')}
                </Badge>
            </div>
            <p className="text-[13px] leading-relaxed text-foreground">{memory.summary}</p>
            <BitemporalSection record={memory} isExpired={isExpired} />
            {memory.entityIds.length > 0 ? (
                <InspectorSection title={t('memoryGraph.entities')} count={memory.entityIds.length}>
                    <div className="flex flex-wrap gap-1.5">
                        {memory.entityIds.map((entityId) => (
                            <Badge key={entityId} variant="outline">
                                {entityId}
                            </Badge>
                        ))}
                    </div>
                </InspectorSection>
            ) : null}
            <InspectorSection title={t('memoryGraph.evidence')} count={memory.evidence.length}>
                <EvidenceCards
                    evidence={memory.evidence}
                    emptyText={t('memoryGraph.noEvidence')}
                    sourceRecordIds={sourceRecordIds}
                    onOpenRecord={onOpenRecord}
                />
            </InspectorSection>
            {memory.notes ? (
                <InspectorSection title={t('memoryGraph.notes')}>
                    <p className="text-xs leading-relaxed text-muted">{memory.notes}</p>
                </InspectorSection>
            ) : null}
            <AllAttributesSection raw={memory.raw} />
        </div>
    );
}

/**
 * Shown when a selection points at a record the loaded snapshot does not hold.
 *
 * Without it the inspector fell through to the default panel and the click looked like a no-op.
 */
function MissingSelectionInspector({ selection, onClear }: { selection: MemorySelection; onClear: () => void }) {
    const { t } = useUITranslation();
    const kindLabel =
        selection.kind === 'entity'
            ? t('memoryGraph.selectionKindEntity')
            : selection.kind === 'statement'
              ? t('memoryGraph.selectionKindStatement')
              : t('memoryGraph.selectionKindMemory');

    return (
        <div className="flex flex-col gap-4">
            <InspectorHeader
                icon={<SearchX className="size-4 text-attention" aria-hidden={true} />}
                title={t('memoryGraph.selectionMissingTitle')}
                subtitle={kindLabel}
                identity={selection.id}
            />
            <p className="text-xs leading-relaxed text-muted">{t('memoryGraph.selectionMissingDescription')}</p>
            <Button variant="outline" size="sm" className="self-start" onClick={onClear}>
                {t('memoryGraph.clearSelection')}
            </Button>
        </div>
    );
}

/** Intentional empty block: an icon, a title, and a line saying what would fill it. */
function EmptyPanel({ title, description }: { title: string; description: string }) {
    return (
        <div className="rounded-md border border-dashed px-3 py-6 text-center">
            <BrainCircuit className="mx-auto size-5 text-muted" aria-hidden={true} />
            <p className="mt-2 text-xs font-medium text-foreground">{title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">{description}</p>
        </div>
    );
}

function ContentMemoryList({
    memories,
    search,
    timeAxis,
    asOf,
    onSelect,
}: {
    memories: MemoryEntry[];
    search: string;
    timeAxis: MemoryTimeAxis;
    asOf?: string;
    onSelect: (memoryId: string) => void;
}) {
    const { t } = useUITranslation();
    const normalized = search.trim().toLowerCase();
    // The date the row is stamped and sorted by follows the active axis, falling back to belief
    // time only for display when the entry carries no business date.
    const axisDate = (memory: MemoryEntry) => memoryAxisStart(memory, timeAxis) ?? memory.observedAt;
    const visible = memories
        .filter((memory) => isMemoryInScope(memory, timeAxis, asOf))
        .filter(
            (memory) =>
                !normalized ||
                [memory.title, memory.summary, memory.kind, ...memory.entityIds].some((value) =>
                    value.toLowerCase().includes(normalized),
                ),
        )
        .sort((left, right) => axisDate(right).localeCompare(axisDate(left)));

    return (
        <div>
            <div className="flex items-center gap-2">
                <BrainCircuit className="size-4 shrink-0 text-info" aria-hidden={true} />
                <h2 className="text-sm font-semibold text-foreground">{t('memoryGraph.contentMemory')}</h2>
                <Badge variant="outline" className="ms-auto tabular-nums">
                    {visible.length}
                </Badge>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">{t('memoryGraph.contentMemoryHint')}</p>
            <div className="mt-4 flex flex-col gap-1.5">
                {visible.length === 0 ? (
                    memories.length === 0 ? (
                        <EmptyPanel
                            title={t('memoryGraph.noMemoriesTitle')}
                            description={t('memoryGraph.noMemoriesDescription')}
                        />
                    ) : (
                        <EmptyPanel
                            title={t('memoryGraph.noMatchingMemoriesTitle')}
                            description={t('memoryGraph.noMatchingMemoriesDescription')}
                        />
                    )
                ) : (
                    visible.map((memory) => (
                        <Button
                            key={memory.memoryId}
                            variant="outline"
                            className="h-auto w-full justify-start rounded-md px-2.5 py-2 text-start"
                            onClick={() => onSelect(memory.memoryId)}
                        >
                            <div className="flex min-w-0 flex-col gap-1">
                                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-muted">
                                    <span className="truncate">{memory.kind.replaceAll('_', ' ')}</span>
                                    <span aria-hidden={true}>·</span>
                                    <span className="shrink-0 tabular-nums">{axisDate(memory)}</span>
                                </div>
                                <div className="text-xs font-semibold leading-snug text-foreground">{memory.title}</div>
                                <p className="line-clamp-3 text-xs font-normal leading-relaxed text-muted">
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
    sourceRecordIds,
    timeAxis = DEFAULT_MEMORY_TIME_AXIS,
    asOf,
    search,
    onSelect,
    onOpenRecord,
}: MemoryGraphInspectorProps) {
    const entityLabels = useMemo(
        () => new Map(entities.map((entity) => [entity.entityId, entity.displayName])),
        [entities],
    );
    const resolved = useMemo(
        () => resolveMemorySelection(selection, { entities, relationships, memories }),
        [selection, entities, relationships, memories],
    );

    return (
        <aside className="min-h-0 overflow-y-auto rounded-lg border bg-card p-4">
            {resolved.status === 'entity' ? (
                <EntityInspector
                    entity={resolved.entity}
                    relationships={relationships}
                    entityLabels={entityLabels}
                    timeAxis={timeAxis}
                    asOf={asOf}
                    onSelect={onSelect}
                    onOpenRecord={onOpenRecord}
                />
            ) : resolved.status === 'statement' ? (
                <StatementInspector
                    relationship={resolved.relationship}
                    entityLabels={entityLabels}
                    sourceRecordIds={sourceRecordIds}
                    asOf={asOf}
                    onSelect={onSelect}
                    onOpenRecord={onOpenRecord}
                />
            ) : resolved.status === 'memory' ? (
                <MemoryEntryInspector
                    memory={resolved.memory}
                    sourceRecordIds={sourceRecordIds}
                    asOf={asOf}
                    onOpenRecord={onOpenRecord}
                />
            ) : resolved.status === 'missing' ? (
                <MissingSelectionInspector selection={resolved.selection} onClear={() => onSelect(undefined)} />
            ) : (
                <ContentMemoryList
                    memories={memories}
                    search={search}
                    timeAxis={timeAxis}
                    asOf={asOf}
                    onSelect={(memoryId) => onSelect({ kind: 'memory', id: memoryId })}
                />
            )}
        </aside>
    );
}
