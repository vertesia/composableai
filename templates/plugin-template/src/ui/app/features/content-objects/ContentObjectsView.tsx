import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
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
    useIntersectionObserver,
} from '@vertesia/ui/core';
import { GenericPageNavHeader } from '@vertesia/ui/features';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import type { ContentObjectTypeItem } from '@vertesia/common';
import { SortableHead, type SortDir } from '../../components/SortableHead';
import { ContentObjectRow } from './components/ContentObjectRow';
import { useContentObjectsSearch } from './hooks/useContentObjectsSearch';
import { STATUS_VALUES, type FilterableField, type SortField } from './types';

export function ContentObjectsView() {
    const { t } = useUITranslation();
    const { client } = useUserSession();

    const [query, setQuery] = useState('');
    const [filters, setFilters] = useState<Filter[]>([]);
    const [sortField, setSortField] = useState<SortField>('updated');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [types, setTypes] = useState<ContentObjectTypeItem[]>([]);

    const debouncedQuery = useDebounce(query, 300);

    const loadMoreRef = useRef<HTMLDivElement>(null);

    const { items, isLoading, isLoadingMore, loadMore, refetch } =
        useContentObjectsSearch({ debouncedQuery, filters, sortField, sortDir });

    useEffect(() => {
        client.store.types
            .list({ limit: 200 })
            .then(setTypes)
            .catch((err) => console.error('Failed to load content types:', err));
    }, [client]);

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
        (name: FilterableField, value: string, label: string) => {
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
                        <div className="flex-1 max-w-md">
                            <Input
                                value={query}
                                onChange={setQuery}
                                placeholder={t('objects.searchPlaceholder')}
                            />
                        </div>
                        <FilterBtn />
                        <FilterClear />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refetch()}
                            isDisabled={isLoading}
                            alt={t('objects.refresh')}
                            className="ml-auto"
                        >
                            <RefreshCw />
                        </Button>
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
                    {isLoadingMore && (
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
