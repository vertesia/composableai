import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Filter as FilterIcon } from 'lucide-react';
import {
    Badge,
    Button,
    type Filter,
    type FilterGroup,
    type FilterOption,
    FilterBar,
    FilterBtn,
    FilterClear,
    FilterProvider,
    Input,
    Spinner,
    TBody,
    THead,
    Table,
    useDebounce,
    useFetch,
    useIntersectionObserver,
    useToast,
    VTooltip,
} from '@vertesia/ui/core';
import { GenericPageNavHeader } from '@vertesia/ui/features';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import {
    type ContentObjectItem,
    type ContentObjectTypeItem,
    ContentObjectStatus,
} from '@vertesia/common';

const PAGE_SIZE = 50;

const STATUS_VALUES = Object.values(ContentObjectStatus);

type SortField = 'name' | 'type' | 'status' | 'updated';
type SortDir = 'asc' | 'desc';

// Elasticsearch text fields can't be sorted directly; use the .keyword sub-field.
// See ElasticsearchIndexManager BASE_INDEX_MAPPING_PROPERTIES.
const SORT_FIELD_MAP: Record<SortField, string> = {
    name: 'name.keyword',
    type: 'type.name',
    status: 'status',
    updated: 'updated_at',
};

type BadgeVariant =
    | 'default'
    | 'secondary'
    | 'destructive'
    | 'attention'
    | 'success'
    | 'info'
    | 'done';

function statusVariant(status?: ContentObjectStatus): BadgeVariant {
    switch (status) {
        case ContentObjectStatus.ready:
        case ContentObjectStatus.completed:
            return 'success';
        case ContentObjectStatus.failed:
            return 'destructive';
        case ContentObjectStatus.processing:
        case ContentObjectStatus.created:
            return 'attention';
        case ContentObjectStatus.archived:
            return 'done';
        default:
            return 'default';
    }
}

function getSelectValues(filters: Filter[], name: string): string[] {
    const filter = filters.find((f) => f.name === name);
    if (!filter || !Array.isArray(filter.value) || filter.value.length === 0) return [];
    return filter.value
        .map((v) => (typeof v === 'string' ? v : v.value ?? ''))
        .filter((v): v is string => Boolean(v));
}

export function ContentObjectsPage() {
    const { t } = useUITranslation();
    const { client } = useUserSession();
    const toast = useToast();

    const [query, setQuery] = useState('');
    const [filters, setFilters] = useState<Filter[]>([]);
    const [sortField, setSortField] = useState<SortField>('updated');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [types, setTypes] = useState<ContentObjectTypeItem[]>([]);
    const [moreItems, setMoreItems] = useState<ContentObjectItem[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const debouncedQuery = useDebounce(query, 300);

    const loadMoreRef = useRef<HTMLDivElement>(null);

    const buildQuery = useCallback(() => {
        const typeIds = getSelectValues(filters, 'type');
        const statusValues = getSelectValues(filters, 'status');
        const trimmed = debouncedQuery.trim();
        return {
            ...(trimmed ? { full_text: trimmed } : {}),
            ...(typeIds.length ? { types: typeIds } : {}),
            ...(statusValues.length ? { status: statusValues } : {}),
        };
    }, [debouncedQuery, filters]);

    const sortPayload = useMemo(
        () => [{ field: SORT_FIELD_MAP[sortField], order: sortDir }],
        [sortField, sortDir],
    );

    const { data: firstPage, isLoading } = useFetch<ContentObjectItem[]>(
        async () => {
            const result = await client.objects.search({
                query: buildQuery(),
                limit: PAGE_SIZE,
                offset: 0,
                sort: sortPayload,
            });
            return result.results ?? [];
        },
        {
            deps: [debouncedQuery, filters, sortField, sortDir],
            onSuccess: (results) => {
                setMoreItems([]);
                setHasMore(results.length >= PAGE_SIZE);
            },
            onError: (err) => {
                console.error('Content object search failed:', err);
                toast({ status: 'error', title: t('objects.searchError') });
            },
        },
    );

    useEffect(() => {
        client.store.types
            .list({ limit: 200 })
            .then(setTypes)
            .catch((err) => console.error('Failed to load content types:', err));
    }, [client]);

    const items = useMemo(() => [...(firstPage ?? []), ...moreItems], [firstPage, moreItems]);

    const loadMore = useCallback(() => {
        if (isLoadingMore || !hasMore || isLoading) return;
        setIsLoadingMore(true);
        const offset = items.length;
        client.objects
            .search({
                query: buildQuery(),
                limit: PAGE_SIZE,
                offset,
                sort: sortPayload,
            })
            .then((result) => {
                const results = result.results ?? [];
                setMoreItems((prev) => [...prev, ...results]);
                setHasMore(results.length >= PAGE_SIZE);
            })
            .catch((err) => {
                console.error('Load more failed:', err);
                toast({ status: 'error', title: t('objects.searchError') });
            })
            .finally(() => setIsLoadingMore(false));
    }, [
        client,
        buildQuery,
        sortPayload,
        items.length,
        isLoadingMore,
        isLoading,
        hasMore,
        toast,
        t,
    ]);

    useIntersectionObserver(loadMoreRef, loadMore, {
        threshold: 0.1,
        deps: [loadMore],
    });

    const handleSort = useCallback(
        (field: SortField) => {
            if (sortField === field) {
                setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
                return;
            }
            setSortField(field);
            setSortDir('asc');
        },
        [sortField],
    );

    const addFilterValue = useCallback(
        (name: 'type' | 'status', value: string, label: string) => {
            const placeholder =
                name === 'type' ? t('objects.filterType') : t('objects.filterStatus');
            const newOption: FilterOption = { value, label };
            setFilters((prev) => {
                const existing = prev.find((f) => f.name === name);
                if (!existing) {
                    return [
                        ...prev,
                        {
                            name,
                            placeholder,
                            type: 'select',
                            multiple: true,
                            value: [newOption],
                        },
                    ];
                }
                const currentValues = Array.isArray(existing.value) ? existing.value : [];
                const alreadyHas = currentValues.some(
                    (v) => (typeof v === 'string' ? v : v.value) === value,
                );
                if (alreadyHas) return prev;
                return prev.map((f) =>
                    f === existing
                        ? { ...f, value: [...(f.value as FilterOption[]), newOption] }
                        : f,
                );
            });
        },
        [t],
    );

    const filterGroups: FilterGroup[] = useMemo(
        () => [
            {
                name: 'type',
                placeholder: t('objects.filterType'),
                type: 'select',
                multiple: true,
                options: [...types]
                    .map((typ) => ({ value: typ.id, label: typ.name }))
                    .sort((a, b) => a.label.localeCompare(b.label)),
            },
            {
                name: 'status',
                placeholder: t('objects.filterStatus'),
                type: 'select',
                multiple: true,
                options: STATUS_VALUES.map((s) => ({
                    value: s,
                    label: t(`objects.status.${s}`),
                })).sort((a, b) => a.label.localeCompare(b.label)),
            },
        ],
        [types, t],
    );

    const showLoadMoreSpinner = isLoadingMore;
    const showEmpty = !isLoading && items.length === 0;

    return (
        <div className="flex flex-col h-full">
            <GenericPageNavHeader title={t('objects.title')} />
            <div className="flex flex-col gap-4 p-4 flex-1 min-h-0">
                <FilterProvider
                    filters={filters}
                    setFilters={setFilters}
                    filterGroups={filterGroups}
                >
                    <div className="flex items-center gap-2">
                        <Input
                            value={query}
                            onChange={setQuery}
                            placeholder={t('objects.searchPlaceholder')}
                            className="flex-1 max-w-md"
                        />
                        <FilterBtn />
                        <FilterClear />
                    </div>
                    <FilterBar />
                </FilterProvider>

                <div className="flex-1 min-h-0 overflow-auto">
                    <Table className="w-full">
                        <THead>
                            <tr>
                                <SortableHead
                                    field="name"
                                    label={t('objects.col.name')}
                                    activeField={sortField}
                                    direction={sortDir}
                                    onSort={handleSort}
                                />
                                <SortableHead
                                    field="type"
                                    label={t('objects.col.type')}
                                    activeField={sortField}
                                    direction={sortDir}
                                    onSort={handleSort}
                                />
                                <SortableHead
                                    field="status"
                                    label={t('objects.col.status')}
                                    activeField={sortField}
                                    direction={sortDir}
                                    onSort={handleSort}
                                />
                                <SortableHead
                                    field="updated"
                                    label={t('objects.col.updated')}
                                    activeField={sortField}
                                    direction={sortDir}
                                    onSort={handleSort}
                                />
                            </tr>
                        </THead>
                        <TBody isLoading={isLoading} columns={4} rows={6}>
                            {items.map((item) => (
                                <ContentObjectRow
                                    key={item.id}
                                    item={item}
                                    t={t}
                                    onAddFilter={addFilterValue}
                                />
                            ))}
                        </TBody>
                    </Table>
                    {showLoadMoreSpinner && (
                        <div className="flex justify-center py-4">
                            <Spinner />
                        </div>
                    )}
                    <div ref={loadMoreRef} className="h-4 w-full" />
                    {showEmpty && (
                        <div className="text-center text-sm text-muted-foreground py-8">
                            {t('objects.empty')}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

interface SortableHeadProps {
    field: SortField;
    label: string;
    activeField: SortField;
    direction: SortDir;
    onSort: (field: SortField) => void;
}

function SortableHead({ field, label, activeField, direction, onSort }: SortableHeadProps) {
    const isActive = activeField === field;
    const Icon = isActive ? (direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
        <th
            scope="col"
            aria-sort={
                isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'
            }
            className="text-left cursor-pointer select-none"
            onClick={() => onSort(field)}
        >
            <div className="flex items-center gap-1">
                <span>{label}</span>
                <Icon
                    className={`size-3 ${isActive ? '' : 'opacity-40'}`}
                    aria-hidden="true"
                />
            </div>
        </th>
    );
}

interface InlineFilterButtonProps {
    tooltip: string;
    hoverClass: string;
    onClick: () => void;
}

function InlineFilterButton({ tooltip, hoverClass, onClick }: InlineFilterButtonProps) {
    return (
        <VTooltip description={tooltip} asChild>
            <Button
                variant="ghost"
                size="sm"
                aria-label={tooltip}
                className={`h-6 w-6 p-0 opacity-0 transition-opacity focus-visible:opacity-100 ${hoverClass}`}
                onClick={(event) => {
                    event.stopPropagation();
                    onClick();
                }}
            >
                <FilterIcon className="size-4" />
            </Button>
        </VTooltip>
    );
}

interface ContentObjectRowProps {
    item: ContentObjectItem;
    t: (key: string, opts?: Record<string, unknown>) => string;
    onAddFilter: (name: 'type' | 'status', value: string, label: string) => void;
}

function ContentObjectRow({ item, t, onAddFilter }: ContentObjectRowProps) {
    const updated = item.updated_at ? new Date(item.updated_at).toLocaleString() : '—';
    const typeName = item.type?.name;
    const typeId = item.type && 'id' in item.type ? item.type.id : undefined;
    const statusLabel = item.status ? t(`objects.status.${item.status}`) : '—';

    return (
        <tr>
            <td>
                <div className="flex flex-col">
                    <span className="font-medium">{item.name || item.id}</span>
                    {item.description && (
                        <span className="text-xs text-muted-foreground line-clamp-1">
                            {item.description}
                        </span>
                    )}
                </div>
            </td>
            <td className="group/type">
                <div className="flex items-center justify-between gap-2">
                    <span>{typeName ?? '—'}</span>
                    {typeId && typeName && (
                        <InlineFilterButton
                            tooltip={t('objects.filterByValue', { value: typeName })}
                            hoverClass="group-hover/type:opacity-100"
                            onClick={() => onAddFilter('type', typeId, typeName)}
                        />
                    )}
                </div>
            </td>
            <td className="group/status">
                <div className="flex items-center justify-between gap-2">
                    <Badge variant={statusVariant(item.status)}>{statusLabel}</Badge>
                    {item.status && (
                        <InlineFilterButton
                            tooltip={t('objects.filterByValue', { value: statusLabel })}
                            hoverClass="group-hover/status:opacity-100"
                            onClick={() => onAddFilter('status', item.status, statusLabel)}
                        />
                    )}
                </div>
            </td>
            <td className="text-sm text-muted-foreground">{updated}</td>
        </tr>
    );
}
