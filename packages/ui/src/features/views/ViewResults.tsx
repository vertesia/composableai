import type {
    ViewBoardCardConfiguration,
    ViewCardsDisplay,
    ViewDisplayConfiguration,
    ViewGalleryDisplay,
    ViewHit,
    ViewListDisplay,
    ViewResultField,
    ViewResultMedia,
    ViewSortOption,
    ViewTableDisplay,
} from '@vertesia/common';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
    SortableTableHeaderCell,
    Table,
    TableHeaderCell,
    TBody,
    THead,
    VTooltip,
} from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { ChevronDown, ChevronsUpDown, ChevronUp, ExternalLink, FileText, ImageIcon } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import type { ViewMediaResolver, ViewResultsRendererProps } from './types.js';

function nestedValue(root: unknown, path: string): unknown {
    if (!path || path === '.') return root;
    return path.split('.').reduce<unknown>((value, segment) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
        return (value as Record<string, unknown>)[segment];
    }, root);
}

export function getViewFieldValue(hit: ViewHit, field: string): unknown {
    if (field === 'score') return hit.score;
    if (field.startsWith('annotation.')) return nestedValue(hit.annotation, field.slice('annotation.'.length));
    if (field.startsWith('document.')) return nestedValue(hit.document, field.slice('document.'.length));
    return nestedValue(hit.document, field);
}

function primitiveText(value: unknown): string | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    if (Array.isArray(value)) return value.map(primitiveText).filter(Boolean).join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

export function formatViewFieldValue(hit: ViewHit, field: ViewResultField): string {
    const value = getViewFieldValue(hit, field.field);
    const fallback = field.fallback ?? '';
    if (value === undefined || value === null || value === '') return fallback;

    if (field.format === 'date') {
        const date = new Date(String(value));
        return Number.isNaN(date.getTime())
            ? (primitiveText(value) ?? fallback)
            : new Intl.DateTimeFormat().format(date);
    }
    if (field.format === 'number') {
        const number = typeof value === 'number' ? value : Number(value);
        return Number.isFinite(number) ? new Intl.NumberFormat().format(number) : (primitiveText(value) ?? fallback);
    }
    return primitiveText(value) ?? fallback;
}

function ViewField({ hit, field, className }: { hit: ViewHit; field: ViewResultField; className?: string }) {
    const text = formatViewFieldValue(hit, field);
    if (!text) return null;
    if (field.format === 'badge' || field.format === 'content_type') {
        return <Badge className={className}>{text}</Badge>;
    }
    return <span className={className}>{text}</span>;
}

function OpenResultButton({
    hit,
    onOpenHit,
    compact = false,
}: {
    hit: ViewHit;
    onOpenHit?: (hit: ViewHit) => void;
    compact?: boolean;
}) {
    const { t } = useUITranslation();
    if (!onOpenHit) return null;
    if (compact) {
        return (
            <VTooltip description={t('agent.openDocument')} asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('agent.openDocument')}
                    onClick={() => onOpenHit(hit)}
                >
                    <ExternalLink className="size-4" />
                </Button>
            </VTooltip>
        );
    }
    return (
        <Button type="button" variant="outline" size="sm" onClick={() => onOpenHit(hit)}>
            <ExternalLink className="size-4" />
            {t('agent.openDocument')}
        </Button>
    );
}

function safeMediaUrl(hit: ViewHit, media: ViewResultMedia): string | undefined {
    if (media.source !== 'property' || !media.field) return undefined;
    const value = primitiveText(getViewFieldValue(hit, media.field));
    if (!value) return undefined;
    try {
        const url = new URL(value, typeof window === 'undefined' ? 'https://localhost' : window.location.origin);
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
    } catch {
        return undefined;
    }
}

function ViewMedia({
    hit,
    media,
    resolveMedia,
    className,
}: {
    hit: ViewHit;
    media?: ViewResultMedia;
    resolveMedia?: ViewMediaResolver;
    className?: string;
}) {
    const directUrl = media ? safeMediaUrl(hit, media) : undefined;
    const [resolvedUrl, setResolvedUrl] = useState<string>();
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setResolvedUrl(undefined);
        setFailed(false);
        if (directUrl || !media || !resolveMedia) return;

        let active = true;
        Promise.resolve(resolveMedia(hit, media))
            .then((url) => {
                if (active) setResolvedUrl(url);
            })
            .catch(() => {
                if (active) setFailed(true);
            });
        return () => {
            active = false;
        };
    }, [directUrl, hit, media, resolveMedia]);

    const url = failed ? undefined : (directUrl ?? resolvedUrl);
    const fit = media?.fit === 'contain' ? 'object-contain' : 'object-cover';
    if (url) {
        return <img src={url} alt="" className={`${fit} ${className ?? ''}`} onError={() => setFailed(true)} />;
    }
    const fallback = media?.source === 'type_icon' ? 'type_icon' : (media?.fallback ?? 'type_icon');
    if (fallback === 'none') return null;
    return (
        <div className={`flex items-center justify-center bg-muted ${className ?? ''}`} aria-hidden="true">
            {fallback === 'placeholder' ? (
                <ImageIcon className="size-10 text-muted-foreground" />
            ) : (
                <FileText className="size-10 text-muted-foreground" />
            )}
        </div>
    );
}

function Annotation({ hit }: { hit: ViewHit }) {
    const annotation = hit.annotation?.why_match ?? hit.annotation?.answer ?? hit.annotation?.excerpt;
    return annotation ? <p className="text-sm text-info">{annotation}</p> : null;
}

function BadgeFields({ hit, fields }: { hit: ViewHit; fields?: ViewResultField[] }) {
    if (!fields?.length) return null;
    return (
        <div className="flex flex-wrap gap-1">
            {fields.map((field) => (
                <ViewField key={`${field.field}-${field.label ?? ''}`} hit={hit} field={field} />
            ))}
        </div>
    );
}

function LabeledFields({ hit, fields }: { hit: ViewHit; fields?: ViewResultField[] }) {
    if (!fields?.length) return null;
    return (
        <dl className="space-y-1 text-sm">
            {fields.map((field) => {
                const value = formatViewFieldValue(hit, field);
                if (!value) return null;
                return (
                    <div key={`${field.field}-${field.label ?? ''}`} className="flex gap-2">
                        {field.label && <dt className="shrink-0 text-muted">{field.label}</dt>}
                        <dd className="min-w-0 truncate">{value}</dd>
                    </div>
                );
            })}
        </dl>
    );
}

function ListResults({
    display,
    hits,
    onOpenHit,
    resolveMedia,
}: {
    display: ViewListDisplay;
    hits: ViewHit[];
    onOpenHit?: (hit: ViewHit) => void;
    resolveMedia?: ViewMediaResolver;
}) {
    return (
        <div className="divide-y divide-border rounded-md border">
            {hits.map((hit) => (
                <article key={hit.id} className="flex gap-4 p-4">
                    {display.media && (
                        <ViewMedia
                            hit={hit}
                            media={display.media}
                            resolveMedia={resolveMedia}
                            className="size-20 shrink-0 rounded-md"
                        />
                    )}
                    <div className="min-w-0 flex-1 space-y-2">
                        <div>
                            <h3 className="font-semibold">
                                <ViewField hit={hit} field={display.title} />
                            </h3>
                            {display.subtitle && (
                                <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted">
                                    {display.subtitle.map((field) => (
                                        <ViewField key={field.field} hit={hit} field={field} />
                                    ))}
                                </div>
                            )}
                        </div>
                        {display.description && (
                            <p className="line-clamp-3 text-sm text-muted-foreground">
                                <ViewField hit={hit} field={display.description} />
                            </p>
                        )}
                        <BadgeFields hit={hit} fields={display.badges} />
                        <Annotation hit={hit} />
                    </div>
                    <div className="shrink-0 self-center">
                        <OpenResultButton hit={hit} onOpenHit={onOpenHit} compact />
                    </div>
                </article>
            ))}
        </div>
    );
}

function TableResults({
    display,
    hits,
    isLoading,
    onOpenHit,
    sortOptions,
    currentSort,
    onSortChange,
}: {
    display: ViewTableDisplay;
    hits: ViewHit[];
    isLoading: boolean;
    onOpenHit?: (hit: ViewHit) => void;
    sortOptions?: ViewSortOption[];
    currentSort?: string;
    onSortChange?: (sort: string) => void;
}) {
    const { t } = useUITranslation();
    return (
        <div className="overflow-x-auto rounded-md border">
            <Table className="w-full">
                <THead>
                    <tr>
                        {display.columns.map((column) => {
                            const sortOption = column.sort_option
                                ? sortOptions?.find((option) => option.id === column.sort_option)
                                : undefined;
                            if (!column.sortable || !sortOption) {
                                return (
                                    <TableHeaderCell key={`${column.field}-${column.label ?? ''}`}>
                                        {column.label ?? column.field}
                                    </TableHeaderCell>
                                );
                            }
                            const direction =
                                currentSort === sortOption.id
                                    ? sortOption.sort[0]?.order === 'desc'
                                        ? 'descending'
                                        : 'ascending'
                                    : 'none';
                            return (
                                <SortableTableHeaderCell
                                    key={`${column.field}-${column.label ?? ''}`}
                                    sortDirection={direction}
                                    onSort={() => onSortChange?.(sortOption.id)}
                                    disabled={isLoading || !onSortChange}
                                    sortIndicator={(sortDirection) => {
                                        if (sortDirection === 'ascending') {
                                            return <ChevronUp className="size-3" aria-hidden="true" />;
                                        }
                                        if (sortDirection === 'descending') {
                                            return <ChevronDown className="size-3" aria-hidden="true" />;
                                        }
                                        return <ChevronsUpDown className="size-3 text-muted" aria-hidden="true" />;
                                    }}
                                >
                                    {column.label ?? column.field}
                                </SortableTableHeaderCell>
                            );
                        })}
                        {onOpenHit && (
                            <TableHeaderCell className="w-0">
                                <span className="sr-only">{t('agent.openDocument')}</span>
                            </TableHeaderCell>
                        )}
                    </tr>
                </THead>
                <TBody
                    isLoading={isLoading && hits.length === 0}
                    columns={display.columns.length + (onOpenHit ? 1 : 0)}
                >
                    {hits.map((hit) => (
                        <tr key={hit.id}>
                            {display.columns.map((column) => (
                                <td
                                    key={`${hit.id}-${column.field}`}
                                    style={column.width ? { width: column.width } : undefined}
                                >
                                    <ViewField hit={hit} field={column} />
                                </td>
                            ))}
                            {onOpenHit && (
                                <td className="w-0 whitespace-nowrap text-end">
                                    <OpenResultButton hit={hit} onOpenHit={onOpenHit} compact />
                                </td>
                            )}
                        </tr>
                    ))}
                </TBody>
            </Table>
        </div>
    );
}

const GRID_COLUMNS: Record<number, string> = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-2 xl:grid-cols-3',
    4: 'md:grid-cols-2 xl:grid-cols-4',
    5: 'md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5',
    6: 'md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6',
};

function ResultCard({
    hit,
    configuration,
    onOpenHit,
    resolveMedia,
}: {
    hit: ViewHit;
    configuration: ViewCardsDisplay | ViewBoardCardConfiguration;
    onOpenHit?: (hit: ViewHit) => void;
    resolveMedia?: ViewMediaResolver;
}) {
    return (
        <Card className="flex h-full min-w-0 flex-col overflow-hidden">
            {configuration.media && (
                <ViewMedia
                    hit={hit}
                    media={configuration.media}
                    resolveMedia={resolveMedia}
                    className="h-40 w-full border-b"
                />
            )}
            <CardHeader className="gap-2 p-4">
                <BadgeFields hit={hit} fields={configuration.badges} />
                <CardTitle className="truncate text-base">
                    <ViewField hit={hit} field={configuration.title} />
                </CardTitle>
                {configuration.description && (
                    <CardDescription className="line-clamp-3">
                        <ViewField hit={hit} field={configuration.description} />
                    </CardDescription>
                )}
            </CardHeader>
            <CardContent className="flex-1 p-4 pt-0">
                <LabeledFields hit={hit} fields={configuration.fields} />
                <Annotation hit={hit} />
            </CardContent>
            {onOpenHit && (
                <CardFooter className="justify-end p-4 pt-0">
                    <OpenResultButton hit={hit} onOpenHit={onOpenHit} />
                </CardFooter>
            )}
        </Card>
    );
}

function CardsResults({
    display,
    hits,
    onOpenHit,
    resolveMedia,
}: {
    display: ViewCardsDisplay;
    hits: ViewHit[];
    onOpenHit?: (hit: ViewHit) => void;
    resolveMedia?: ViewMediaResolver;
}) {
    return (
        <div className={`grid grid-cols-1 gap-4 ${GRID_COLUMNS[display.columns ?? 3]}`}>
            {hits.map((hit) => (
                <ResultCard
                    key={hit.id}
                    hit={hit}
                    configuration={display}
                    onOpenHit={onOpenHit}
                    resolveMedia={resolveMedia}
                />
            ))}
        </div>
    );
}

function GalleryResults({
    display,
    hits,
    onOpenHit,
    resolveMedia,
}: {
    display: ViewGalleryDisplay;
    hits: ViewHit[];
    onOpenHit?: (hit: ViewHit) => void;
    resolveMedia?: ViewMediaResolver;
}) {
    return (
        <div className={`grid grid-cols-1 gap-4 ${GRID_COLUMNS[display.columns ?? 4]}`}>
            {hits.map((hit) => (
                <Card key={hit.id} className="overflow-hidden">
                    <ViewMedia
                        hit={hit}
                        media={display.media}
                        resolveMedia={resolveMedia}
                        className="aspect-square w-full border-b"
                    />
                    <CardContent className="space-y-2 p-3">
                        <h3 className="truncate font-semibold">
                            <ViewField hit={hit} field={display.title} />
                        </h3>
                        {display.caption && (
                            <div className="space-y-1 text-sm text-muted">
                                {display.caption.map((field) => (
                                    <div key={field.field} className="truncate">
                                        <ViewField hit={hit} field={field} />
                                    </div>
                                ))}
                            </div>
                        )}
                        <OpenResultButton hit={hit} onOpenHit={onOpenHit} />
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

function BoardResults({
    display,
    hits,
    onOpenHit,
    resolveMedia,
}: {
    display: Extract<ViewDisplayConfiguration, { type: 'board' }>;
    hits: ViewHit[];
    onOpenHit?: (hit: ViewHit) => void;
    resolveMedia?: ViewMediaResolver;
}) {
    const grouped = new Map<string, ViewHit[]>();
    for (const hit of hits) {
        const key = primitiveText(getViewFieldValue(hit, display.group_by)) ?? '';
        grouped.set(key, [...(grouped.get(key) ?? []), hit]);
    }
    const columns = display.columns?.length
        ? [...display.columns].sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
        : [...grouped.keys()].sort().map((value) => ({ value, label: value || '—' }));

    return (
        <div className="flex min-w-max gap-4 overflow-x-auto pb-2">
            {columns.map((column) => {
                const columnHits = grouped.get(column.value) ?? [];
                return (
                    <section key={column.value} className="w-80 shrink-0 space-y-3 rounded-lg bg-muted/40 p-3">
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="font-semibold">{column.label}</h3>
                            <Badge>{columnHits.length}</Badge>
                        </div>
                        <div className="space-y-3">
                            {columnHits.map((hit) => (
                                <ResultCard
                                    key={hit.id}
                                    hit={hit}
                                    configuration={display.card}
                                    onOpenHit={onOpenHit}
                                    resolveMedia={resolveMedia}
                                />
                            ))}
                        </div>
                    </section>
                );
            })}
        </div>
    );
}

function renderResults(
    configuration: ViewDisplayConfiguration,
    hits: ViewHit[],
    isLoading: boolean,
    onOpenHit?: (hit: ViewHit) => void,
    resolveMedia?: ViewMediaResolver,
    sortOptions?: ViewSortOption[],
    currentSort?: string,
    onSortChange?: (sort: string) => void,
): ReactNode {
    if (configuration.type === 'table') {
        return (
            <TableResults
                display={configuration}
                hits={hits}
                isLoading={isLoading}
                onOpenHit={onOpenHit}
                sortOptions={sortOptions}
                currentSort={currentSort}
                onSortChange={onSortChange}
            />
        );
    }
    if (configuration.type === 'cards') {
        return <CardsResults display={configuration} hits={hits} onOpenHit={onOpenHit} resolveMedia={resolveMedia} />;
    }
    if (configuration.type === 'gallery') {
        return <GalleryResults display={configuration} hits={hits} onOpenHit={onOpenHit} resolveMedia={resolveMedia} />;
    }
    if (configuration.type === 'board') {
        return <BoardResults display={configuration} hits={hits} onOpenHit={onOpenHit} resolveMedia={resolveMedia} />;
    }
    return <ListResults display={configuration} hits={hits} onOpenHit={onOpenHit} resolveMedia={resolveMedia} />;
}

export function DefaultViewResults({
    configuration,
    definition,
    request,
    result,
    isLoading,
    onSortChange,
    onOpenHit,
    resolveMedia,
}: ViewResultsRendererProps) {
    const { t } = useUITranslation();
    if (!isLoading && result.hits.length === 0) {
        return <p className="py-12 text-center text-sm text-muted">{t('filter.noResultsFound')}</p>;
    }
    return (
        <>
            {renderResults(
                configuration,
                result.hits,
                isLoading,
                onOpenHit,
                resolveMedia,
                definition.results?.sort_options,
                result.sort ?? request.sort ?? definition.results?.default_sort,
                onSortChange,
            )}
        </>
    );
}
