import {
    Button,
    ConfirmModal,
    EmptyCollection,
    ErrorBox,
    Input,
    SelectBox,
    useDebounce,
    useIntersectionObserver,
    useToast,
    VTooltip,
} from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { RefreshCw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ContentObjectTypesTable } from './ContentObjectTypesTable';
import { CreateOrUpdateTypeModal, type CreateOrUpdateTypePayload } from './CreateOrUpdateTypeModal';
import { useWatchSearchResult } from './search/ObjectTypeSearchContext';
import { useTypeRegistry } from './TypeRegistryProvider.js';

enum ChunkableOptions {
    true = 'Yes',
    false = 'No',
}

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

    const [searchTerm, setSearchTerm] = useState<string>('');
    const debounceValue = useDebounce(searchTerm, 500);

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
        search.query.name = debounceValue;
        search.search().then(() => setIsReady(true));
    }, [debounceValue, search]);

    const [chunkable, setChunkable] = useState<string | undefined>(undefined);
    const onChunkableChange = (data: string | undefined) => {
        setChunkable(data);
    };

    useEffect(() => {
        search.query.chunkable = chunkable ? chunkable === 'Yes' : undefined;
        search.search().then(() => setIsReady(true));
    }, [chunkable, search]);

    useEffect(() => {
        if (isDirty && isReady) {
            search.search().then(() => setIsReady(true));
        }
    }, [isDirty, isReady, search]);

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
            <div className="flex flex-shrink-0 gap-4">
                <Input placeholder={t('store.filterByName')} value={searchTerm} onChange={setSearchTerm} />
                <SelectBox
                    className="w-60"
                    isClearable
                    options={Object.values(ChunkableOptions)}
                    value={chunkable}
                    onChange={onChunkableChange}
                    placeholder={t('store.isChunkable')}
                />
            </div>
            <div className="flex flex-shrink-0 justify-end items-center gap-2 mt-2">
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
                                onFilter={(field, value) => {
                                    if (field === 'name') setSearchTerm(value);
                                }}
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
                />
            )}
        </div>
    );
}
