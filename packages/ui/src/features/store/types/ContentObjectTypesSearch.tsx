import {
    type Filter as BaseFilter,
    Button,
    ConfirmModal,
    EmptyCollection,
    ErrorBox,
    FilterBar,
    FilterBtn,
    FilterClear,
    type FilterGroup,
    FilterProvider,
    useIntersectionObserver,
    useToast,
    VTooltip,
} from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { RefreshCw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { filterValueToQueryValue } from '../../facets/utils/SearchInterface';
import { ContentObjectTypesTable } from './ContentObjectTypesTable';
import { CreateOrUpdateTypeModal, type CreateOrUpdateTypePayload } from './CreateOrUpdateTypeModal';
import { useWatchSearchResult } from './search/ObjectTypeSearchContext';
import { useTypeRegistry } from './TypeRegistryProvider.js';

interface ContentObjectTypesSearchProps {
    isDirty?: boolean;
}
export function ContentObjectTypesSearch({ isDirty = false }: ContentObjectTypesSearchProps) {
    const { store } = useUserSession();
    const { reload: reloadTypes } = useTypeRegistry();
    const { t } = useUITranslation();

    const toast = useToast();

    const [isReady, setIsReady] = useState(false);
    const { search, isLoading, error, objects } = useWatchSearchResult();

    const loadMoreRef = useRef<HTMLDivElement>(null);
    useIntersectionObserver(
        loadMoreRef,
        () => {
            if (isReady) search.loadMore();
        },
        { deps: [isReady, search] },
    );

    useEffect(() => {
        search.search().then(() => setIsReady(true));
    }, [search]);

    useEffect(() => {
        if (isDirty && isReady) {
            search.search().then(() => setIsReady(true));
        }
    }, [isDirty, isReady, search]);

    // Facet-nav filter state. `handleFilterChange` is the single source of truth: it updates the
    // chip list and translates it into the type search query (name text + chunkable yes/no).
    const filterGroups: FilterGroup[] = [
        { name: 'name', placeholder: t('store.name'), type: 'text' as const, multiple: false },
        {
            name: 'chunkable',
            placeholder: t('store.isChunkable'),
            type: 'select' as const,
            multiple: false,
            options: [
                { label: 'Yes', value: 'true' },
                { label: 'No', value: 'false' },
            ],
        },
    ];

    const [filters, setFilters] = useState<BaseFilter[]>([]);
    const handleFilterChange: React.Dispatch<React.SetStateAction<BaseFilter[]>> = (value) => {
        const next = typeof value === 'function' ? value(filters) : value;
        setFilters(next);

        search.query.name = undefined;
        search.query.chunkable = undefined;
        for (const filter of next) {
            if (!filter.value || filter.value.length === 0) continue;
            const queryValue = filterValueToQueryValue(filter);
            if (filter.name === 'name' && typeof queryValue === 'string') {
                search.query.name = queryValue;
            } else if (filter.name === 'chunkable') {
                search.query.chunkable = queryValue === 'true' ? true : queryValue === 'false' ? false : undefined;
            }
        }

        setIsReady(false);
        search.search().then(() => setIsReady(true));
    };

    // Per-row quick filter: add (or replace) a chip for the given filter group, using its option
    // label for select groups so the chip reads "Yes"/"No" rather than "true"/"false".
    const addQuickFilter = (field: string, value: string) => {
        const group = filterGroups.find((g) => g.name === field);
        if (!group) return;
        const label = group.type === 'select' ? (group.options?.find((o) => o.value === value)?.label ?? value) : value;
        handleFilterChange((prev) => [
            ...prev.filter((f) => f.name !== field),
            {
                name: field,
                type: group.type,
                placeholder: group.placeholder,
                multiple: group.multiple,
                value: [{ value, label }],
            },
        ]);
    };

    const [showCreateModal, setShowCreateModal] = useState(false);
    const onOpenCreateModal = () => {
        setShowCreateModal(true);
    };

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showDelete, setShowDelete] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const selectedCount = selectedIds.length;

    const handleRefresh = () => {
        setIsReady(false);
        search.search().then(() => setIsReady(true));
    };

    const handleBulkDelete = async () => {
        if (isDeleting) return;
        setIsDeleting(true);
        try {
            const results = await Promise.allSettled(selectedIds.map((id) => store.types.delete(id)));
            const failed = results.filter((r) => r.status === 'rejected').length;
            const succeeded = results.length - failed;
            setShowDelete(false);
            setSelectedIds([]);
            reloadTypes();
            search.search().then(() => setIsReady(true));
            if (failed === 0) {
                toast({ status: 'success', title: `${succeeded} type(s) deleted`, duration: 3000 });
            } else {
                toast({ status: 'error', title: `${succeeded} deleted, ${failed} failed`, duration: 5000 });
            }
        } catch (err: unknown) {
            toast({
                status: 'error',
                title: 'Failed to delete types',
                description: err instanceof Error ? err.message : undefined,
                duration: 5000,
            });
        } finally {
            setIsDeleting(false);
        }
    };

    if (error) {
        return <ErrorBox title={t('store.failedToFetchTypes')}>{error.message}</ErrorBox>;
    }

    const onCloseCreateModal = async (payload?: CreateOrUpdateTypePayload) => {
        if (!payload) {
            setShowCreateModal(false);
            return Promise.resolve();
        }
        return store.types
            .create(payload)
            .then(async () => {
                toast({
                    status: 'success',
                    title: t('store.typeCreated'),
                    duration: 2000,
                });
                reloadTypes();
                search.search().then(() => setIsReady(true));
            })
            .catch((err) => {
                toast({
                    status: 'error',
                    title: t('store.errorCreatingType'),
                    description: err.message,
                    duration: 5000,
                });
            });
    };

    return (
        <div className="flex flex-col flex-1 min-h-0">
            <div className="flex flex-shrink-0 justify-between items-center gap-2">
                <FilterProvider filterGroups={filterGroups} filters={filters} setFilters={handleFilterChange}>
                    <div className="flex gap-2 items-center">
                        <FilterBtn />
                        <FilterBar />
                        <FilterClear />
                    </div>
                </FilterProvider>
                <div className="flex items-center gap-2">
                    {selectedCount > 0 ? (
                        <>
                            <span className="text-sm font-medium">
                                {selectedCount} type{selectedCount === 1 ? '' : 's'} selected
                            </span>
                            <VTooltip description="Clear selection" asChild>
                                <Button variant="ghost" aria-label="Clear selection" onClick={() => setSelectedIds([])}>
                                    <X className="size-4" />
                                </Button>
                            </VTooltip>
                            <Button variant="destructive" isDisabled={isDeleting} onClick={() => setShowDelete(true)}>
                                {isDeleting ? 'Deleting...' : 'Delete selected'}
                            </Button>
                        </>
                    ) : (
                        <span className="text-sm text-muted">
                            {objects?.length ?? 0} type{objects?.length === 1 ? '' : 's'}
                        </span>
                    )}
                    <VTooltip description={t('store.refresh')} asChild>
                        <Button variant="outline" aria-label={t('store.refresh')} onClick={handleRefresh}>
                            <RefreshCw className="size-4" />
                        </Button>
                    </VTooltip>
                </div>
            </div>
            <div className="flex flex-col w-full flex-1 min-h-0 border rounded-md my-2">
                <div className="flex-1 min-h-0 overflow-y-auto">
                    {!isLoading && objects?.length === 0 ? (
                        <EmptyCollection
                            title={t('store.noType')}
                            buttonLabel={t('store.createType')}
                            onClick={onOpenCreateModal}
                        >
                            {t('store.getStartedTypes')}
                        </EmptyCollection>
                    ) : (
                        <>
                            <ContentObjectTypesTable
                                objects={objects}
                                isLoading={isLoading}
                                onFilter={addQuickFilter}
                                hasCheckbox
                                selectedIds={selectedIds}
                                onToggle={(id, checked) =>
                                    setSelectedIds((cur) =>
                                        checked ? (cur.includes(id) ? cur : [...cur, id]) : cur.filter((x) => x !== id),
                                    )
                                }
                                onToggleAll={(checked) =>
                                    setSelectedIds(checked ? (objects?.map((o) => o.id) ?? []) : [])
                                }
                            />
                            <div ref={loadMoreRef} className="h-4 w-full" />
                        </>
                    )}
                    <CreateOrUpdateTypeModal
                        okLabel="Create"
                        title={t('store.createType')}
                        isOpen={showCreateModal}
                        onClose={onCloseCreateModal}
                    />
                </div>
            </div>
            {showDelete && (
                <ConfirmModal
                    isOpen
                    title={selectedCount === 1 ? 'Delete Type' : 'Delete Types'}
                    content={`Delete ${selectedCount} selected type${selectedCount === 1 ? '' : 's'}? This action cannot be undone.`}
                    onConfirm={handleBulkDelete}
                    onCancel={() => setShowDelete(false)}
                    requireAcknowledge
                />
            )}
        </div>
    );
}
