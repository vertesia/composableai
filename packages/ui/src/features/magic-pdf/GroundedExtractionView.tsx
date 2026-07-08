import {
    Badge,
    Button,
    cn,
    ErrorBox,
    errorMessage,
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
    Spinner,
    useFetch,
} from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { CheckCircle2, ChevronLeft, ChevronRight, Eye, FileDown, FileJson2, FileText, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const ADVANCED_PROCESSING_PREFIX = 'magic-pdf';

interface GroundedBox {
    x: number;
    y: number;
    w: number;
    h: number;
}

interface GroundedCitation {
    path: string;
    page: number;
    block_ids: number[];
    verified: boolean;
    source_text?: string;
    value?: string;
    boxes: GroundedBox[];
    misaligned?: boolean;
    snapped?: boolean;
    confidence?: number;
}

interface GroundedExtractionFile {
    version: number;
    object_id: string;
    run_id: string;
    model?: string;
    generated_at: string;
    pages: Record<string, { width: number; height: number }>;
    data: Record<string, unknown>;
    citations: GroundedCitation[];
    /** Mean provenance confidence in [0,1]; 1.0 = verified against a digital text layer */
    confidence?: number;
    conflicts?: { path: string; kept: unknown; dropped: unknown }[];
}

interface GroundedExtractionViewProps {
    objectId: string;
    onClose?: () => void;
}

/** True when a grounded extraction result exists for the object */
export function useGroundedExtractionAvailable(objectId: string): boolean {
    const { client } = useUserSession();
    const [available, setAvailable] = useState(false);
    useEffect(() => {
        let cancelled = false;
        setAvailable(false);
        client.files
            .getDownloadUrl(`${ADVANCED_PROCESSING_PREFIX}/${objectId}/grounded-extraction.json`)
            .then((r) => fetch(r.url, { method: 'HEAD' }))
            .then((res) => {
                if (!cancelled) setAvailable(res.ok);
            })
            .catch(() => {
                // no grounded extraction for this object
            });
        return () => {
            cancelled = true;
        };
    }, [client, objectId]);
    return available;
}

export interface GroundedSummary {
    confidence?: number;
    verified: number;
    total: number;
}

/** Lightweight summary of the object's grounded extraction, or null when none exists */
export function useGroundedSummary(objectId: string): GroundedSummary | null {
    const { client } = useUserSession();
    const [summary, setSummary] = useState<GroundedSummary | null>(null);
    useEffect(() => {
        let cancelled = false;
        setSummary(null);
        client.files
            .getDownloadUrl(`${ADVANCED_PROCESSING_PREFIX}/${objectId}/grounded-extraction.json`)
            .then((r) => fetch(r.url))
            .then((res) => (res.ok ? res.json() : null))
            .then((file: GroundedExtractionFile | null) => {
                if (cancelled || !file?.citations) return;
                setSummary({
                    confidence: file.confidence,
                    verified: file.citations.filter((c) => c.verified).length,
                    total: file.citations.length,
                });
            })
            .catch(() => {
                // no grounded extraction for this object
            });
        return () => {
            cancelled = true;
        };
    }, [client, objectId]);
    return summary;
}

/**
 * Embeddable grounded-extraction review panel (fills its container): extracted
 * properties on one side, source pages with citation boxes on the other.
 * Clicking a property highlights where in the document it was read.
 */
export function GroundedExtractionPanel({ objectId, onClose }: GroundedExtractionViewProps) {
    const { t } = useUITranslation();
    const { client } = useUserSession();

    const {
        data: extraction,
        error,
        isLoading,
    } = useFetch<GroundedExtractionFile>(async () => {
        const response = await client.files.getDownloadUrl(
            `${ADVANCED_PROCESSING_PREFIX}/${objectId}/grounded-extraction.json`,
        );
        const result = await fetch(response.url);
        if (!result.ok) {
            throw new Error(t('grounded.notFound'));
        }
        return result.json();
    }, [objectId]);

    if (error) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-4 p-8 max-w-md">
                    <ErrorBox title={t('grounded.failedToLoad')}>{errorMessage(error)}</ErrorBox>
                    {onClose && (
                        <Button variant="outline" onClick={onClose}>
                            {t('pdf.close')}
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    if (isLoading || !extraction) {
        return (
            <div className="flex h-full items-center justify-center">
                <Spinner size="lg" />
            </div>
        );
    }

    return (
        <div className="relative h-full">
            <GroundedExtractionViewImpl extraction={extraction} objectId={objectId} onClose={onClose} />
        </div>
    );
}

/**
 * Full-screen route wrapper around GroundedExtractionPanel.
 */
export function GroundedExtractionView({ objectId, onClose }: GroundedExtractionViewProps) {
    return (
        <div className="fixed inset-0 bg-background z-50">
            <GroundedExtractionPanel objectId={objectId} onClose={onClose} />
        </div>
    );
}

function GroundedExtractionViewImpl({
    extraction,
    objectId,
    onClose,
}: {
    extraction: GroundedExtractionFile;
    objectId: string;
    onClose?: () => void;
}) {
    const { t } = useUITranslation();
    const { client } = useUserSession();
    const pageNumbers = useMemo(
        () =>
            Object.keys(extraction.pages)
                .map((p) => parseInt(p, 10))
                .sort((a, b) => a - b),
        [extraction.pages],
    );

    const downloadArtifact = (path: string) => {
        client.files
            .getDownloadUrl(`${ADVANCED_PROCESSING_PREFIX}/${objectId}/${path}`)
            .then((r) => window.open(r.url, '_blank'))
            .catch(() => {
                // artifact absent for this document
            });
    };
    const [page, setPage] = useState(pageNumbers[0] ?? 1);
    const [selectedPath, setSelectedPath] = useState<string | undefined>(undefined);

    const citationsByPath = useMemo(() => {
        const map = new Map<string, GroundedCitation[]>();
        for (const citation of extraction.citations) {
            const list = map.get(citation.path) ?? [];
            list.push(citation);
            map.set(citation.path, list);
        }
        return map;
    }, [extraction.citations]);

    const verifiedCount = extraction.citations.filter((c) => c.verified).length;

    const selectPath = (path: string) => {
        setSelectedPath(path);
        const citation = citationsByPath.get(path)?.[0];
        if (citation) {
            setPage(citation.page);
        }
    };

    const pageIndex = pageNumbers.indexOf(page);

    return (
        <ResizablePanelGroup direction="horizontal" className="absolute inset-0">
            <ResizablePanel defaultSize={55} minSize={25} className="flex flex-col bg-muted">
                {/* Page navigation */}
                <div className="flex h-9 items-center justify-center gap-2 shrink-0 bg-sidebar px-2 border-b border-sidebar-border">
                    <Button
                        variant="ghost"
                        size="xs"
                        aria-label={t('grounded.previousPage')}
                        disabled={pageIndex <= 0}
                        onClick={() => setPage(pageNumbers[pageIndex - 1])}
                    >
                        <ChevronLeft className="size-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground">
                        {t('pdf.pageOf', { pageNumber: page, totalPages: pageNumbers.length })}
                    </span>
                    <Button
                        variant="ghost"
                        size="xs"
                        aria-label={t('grounded.nextPage')}
                        disabled={pageIndex >= pageNumbers.length - 1}
                        onClick={() => setPage(pageNumbers[pageIndex + 1])}
                    >
                        <ChevronRight className="size-4" />
                    </Button>
                </div>
                <div className="flex-1 overflow-auto p-2">
                    <PageWithOverlay
                        objectId={objectId}
                        page={page}
                        dims={extraction.pages[String(page)]}
                        citations={extraction.citations.filter((c) => c.page === page)}
                        selectedPath={selectedPath}
                        onSelectPath={setSelectedPath}
                    />
                </div>
            </ResizablePanel>
            <ResizableHandle className="w-[4px] bg-border cursor-ew-resize" />
            <ResizablePanel defaultSize={45} minSize={20} className="flex flex-col">
                {/* Header */}
                <div className="flex h-9 items-center justify-between shrink-0 bg-sidebar px-2 border-b border-sidebar-border">
                    <span className="text-sm font-medium">{t('grounded.title')}</span>
                    <div className="flex items-center gap-2">
                        {typeof extraction.confidence === 'number' && (
                            <Badge
                                variant={extraction.confidence >= 0.95 ? 'success' : 'attention'}
                                title={t('grounded.confidenceHint')}
                            >
                                {t('grounded.confidence', {
                                    percent: Math.round(extraction.confidence * 100),
                                })}
                            </Badge>
                        )}
                        <Badge variant={verifiedCount === extraction.citations.length ? 'success' : 'attention'}>
                            {t('grounded.verifiedOf', {
                                verified: verifiedCount,
                                total: extraction.citations.length,
                            })}
                        </Badge>
                        <Button
                            variant="ghost"
                            size="xs"
                            aria-label={t('grounded.downloadCitations')}
                            title={t('grounded.downloadCitations')}
                            onClick={() => downloadArtifact('grounded-extraction.json')}
                        >
                            <FileJson2 className="size-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="xs"
                            aria-label={t('grounded.downloadBlocks')}
                            title={t('grounded.downloadBlocks')}
                            onClick={() => downloadArtifact(`pages/page-${page}.json`)}
                        >
                            <FileText className="size-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="xs"
                            aria-label={t('grounded.downloadAnnotated')}
                            title={t('grounded.downloadAnnotated')}
                            onClick={() => downloadArtifact('grounded-annotated.pdf')}
                        >
                            <FileDown className="size-4" />
                        </Button>
                        {!!onClose && (
                            <Button variant="ghost" size="xs" onClick={onClose} aria-label={t('pdf.close')}>
                                <X className="size-4" />
                            </Button>
                        )}
                    </div>
                </div>
                {/* Extracted data */}
                <div className="flex-1 overflow-auto p-3">
                    <DataNode
                        value={extraction.data}
                        path=""
                        citationsByPath={citationsByPath}
                        selectedPath={selectedPath}
                        onSelect={selectPath}
                    />
                    {extraction.conflicts && extraction.conflicts.length > 0 && (
                        <div className="mt-4 text-xs text-attention">
                            {t('grounded.conflicts', { count: extraction.conflicts.length })}
                        </div>
                    )}
                </div>
            </ResizablePanel>
        </ResizablePanelGroup>
    );
}

function PageWithOverlay({
    objectId,
    page,
    dims,
    citations,
    selectedPath,
    onSelectPath,
}: {
    objectId: string;
    page: number;
    dims?: { width: number; height: number };
    citations: GroundedCitation[];
    selectedPath?: string;
    onSelectPath: (path: string) => void;
}) {
    const { t } = useUITranslation();
    const { client } = useUserSession();
    const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;
        setImageUrl(undefined);
        client.files
            .getDownloadUrl(`${ADVANCED_PROCESSING_PREFIX}/${objectId}/pages/page-${page}.original.jpg`)
            .then((r) => {
                if (!cancelled) setImageUrl(r.url);
            })
            .catch((err: unknown) => console.warn('Failed to load page image', err));
        return () => {
            cancelled = true;
        };
    }, [client, objectId, page]);

    if (!imageUrl || !dims) {
        return (
            <div className="flex items-center justify-center h-64">
                <Spinner />
            </div>
        );
    }

    return (
        <div className="relative w-full">
            <img src={imageUrl} alt={t('grounded.pageAlt', { page })} className="w-full select-none" />
            {citations.flatMap((citation) =>
                citation.boxes.map((box, i) => {
                    const isSelected = selectedPath === citation.path;
                    return (
                        <button
                            key={`${citation.path}-${i}`}
                            type="button"
                            aria-label={citation.path}
                            title={`${citation.path}${citation.source_text ? `\n${citation.source_text}` : ''}`}
                            onClick={() => onSelectPath(citation.path)}
                            className={cn(
                                'absolute cursor-pointer border rounded-[1px] transition-colors',
                                citation.misaligned && 'border-dashed',
                                isSelected
                                    ? 'border-2 border-destructive bg-destructive/20 z-10'
                                    : selectedPath
                                      ? 'border-info/30 hover:border-info'
                                      : citation.verified
                                        ? 'border-success/70 hover:bg-success/20'
                                        : 'border-attention/80 hover:bg-attention/20',
                            )}
                            style={{
                                // inline position: the app's button base styles override the
                                // `absolute` utility class with position: relative
                                position: 'absolute',
                                left: `${(box.x / dims.width) * 100}%`,
                                top: `${(box.y / dims.height) * 100}%`,
                                width: `${(box.w / dims.width) * 100}%`,
                                height: `${(box.h / dims.height) * 100}%`,
                            }}
                        />
                    );
                }),
            )}
        </div>
    );
}

function DataNode({
    value,
    path,
    citationsByPath,
    selectedPath,
    onSelect,
}: {
    value: unknown;
    path: string;
    citationsByPath: Map<string, GroundedCitation[]>;
    selectedPath?: string;
    onSelect: (path: string) => void;
}) {
    if (Array.isArray(value)) {
        if (value.length > 0 && value.every((item) => item !== null && typeof item === 'object')) {
            return (
                <ArrayTable
                    items={value as Record<string, unknown>[]}
                    path={path}
                    citationsByPath={citationsByPath}
                    selectedPath={selectedPath}
                    onSelect={onSelect}
                />
            );
        }
        return (
            <div className="space-y-1">
                {value.map((item, i) => (
                    <DataNode
                        key={`${path}[${i}]`}
                        value={item}
                        path={`${path}[${i}]`}
                        citationsByPath={citationsByPath}
                        selectedPath={selectedPath}
                        onSelect={onSelect}
                    />
                ))}
            </div>
        );
    }
    if (value !== null && typeof value === 'object') {
        return (
            <div className={path ? 'ps-3 border-s border-border space-y-0.5' : 'space-y-0.5'}>
                {Object.entries(value as Record<string, unknown>).map(([key, child]) => {
                    const childPath = path ? `${path}.${key}` : key;
                    const isLeaf = child === null || typeof child !== 'object';
                    if (isLeaf) {
                        return (
                            <LeafRow
                                key={childPath}
                                label={key}
                                value={child}
                                path={childPath}
                                citationsByPath={citationsByPath}
                                selectedPath={selectedPath}
                                onSelect={onSelect}
                            />
                        );
                    }
                    // Arrays of objects render as a table with its own labeled header
                    const rendersOwnLabel =
                        Array.isArray(child) &&
                        child.length > 0 &&
                        child.every((item) => item !== null && typeof item === 'object');
                    return (
                        <div key={childPath} className="pt-1">
                            {!rendersOwnLabel && (
                                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    {key}
                                </div>
                            )}
                            <DataNode
                                value={child}
                                path={childPath}
                                citationsByPath={citationsByPath}
                                selectedPath={selectedPath}
                                onSelect={onSelect}
                            />
                        </div>
                    );
                })}
            </div>
        );
    }
    return null;
}

function ArrayTable({
    items,
    path,
    citationsByPath,
    selectedPath,
    onSelect,
}: {
    items: Record<string, unknown>[];
    path: string;
    citationsByPath: Map<string, GroundedCitation[]>;
    selectedPath?: string;
    onSelect: (path: string) => void;
}) {
    const { t } = useUITranslation();
    const columns = useMemo(() => {
        const keys = new Set<string>();
        for (const item of items) {
            for (const key of Object.keys(item)) keys.add(key);
        }
        return Array.from(keys);
    }, [items]);

    return (
        <div className="pt-1">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {path.split('.').pop()} ({items.length})
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="text-start text-muted-foreground">
                            {columns.map((col) => (
                                <th key={col} scope="col" className="py-1 pe-2 font-medium">
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, i) => (
                            <tr key={`${path}[${i}]`} className="border-t border-border/50">
                                {columns.map((col) => {
                                    const cellPath = `${path}[${i}].${col}`;
                                    const citation = citationsByPath.get(cellPath)?.[0];
                                    const isSelected = selectedPath === cellPath;
                                    return (
                                        <td key={col} className="py-0.5 pe-2">
                                            <button
                                                type="button"
                                                onClick={() => onSelect(cellPath)}
                                                className={cn(
                                                    'text-start rounded px-1 w-full',
                                                    isSelected
                                                        ? 'bg-destructive/15 ring-1 ring-destructive'
                                                        : citation
                                                          ? 'hover:bg-muted cursor-pointer'
                                                          : 'text-muted-foreground cursor-default',
                                                )}
                                            >
                                                {formatValue(item[col])}
                                                {citation && typeof citation.confidence === 'number' && (
                                                    <span
                                                        className={cn(
                                                            'ms-1 text-[10px]',
                                                            scoreColor(citation.confidence),
                                                        )}
                                                        title={t('grounded.confidenceHint')}
                                                    >
                                                        {Math.round(citation.confidence * 100)}%
                                                    </span>
                                                )}
                                            </button>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function LeafRow({
    label,
    value,
    path,
    citationsByPath,
    selectedPath,
    onSelect,
}: {
    label: string;
    value: unknown;
    path: string;
    citationsByPath: Map<string, GroundedCitation[]>;
    selectedPath?: string;
    onSelect: (path: string) => void;
}) {
    const { t } = useUITranslation();
    const citation = citationsByPath.get(path)?.[0];
    const isSelected = selectedPath === path;

    return (
        <button
            type="button"
            onClick={() => citation && onSelect(path)}
            className={cn(
                'flex items-center gap-2 w-full text-start text-sm rounded px-1.5 py-0.5',
                isSelected ? 'bg-destructive/15 ring-1 ring-destructive' : citation ? 'hover:bg-muted' : '',
                !citation && 'cursor-default',
            )}
        >
            <span className="text-muted-foreground min-w-28 shrink-0">{label}</span>
            <span className="flex-1 wrap-break-word">{formatValue(value)}</span>
            {citation && typeof citation.confidence === 'number' && (
                <span
                    className={cn('text-xs shrink-0', scoreColor(citation.confidence))}
                    title={t('grounded.confidenceHint')}
                >
                    {Math.round(citation.confidence * 100)}%
                </span>
            )}
            {citation &&
                (citation.verified ? (
                    <CheckCircle2 aria-label={t('grounded.verified')} className="size-3.5 shrink-0 text-success" />
                ) : (
                    <Eye aria-label={t('grounded.readFromImage')} className="size-3.5 shrink-0 text-attention" />
                ))}
        </button>
    );
}

function scoreColor(confidence: number): string {
    if (confidence >= 0.95) return 'text-success';
    if (confidence >= 0.7) return 'text-attention';
    return 'text-destructive';
}

function formatValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}
