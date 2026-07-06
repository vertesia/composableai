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
import { X } from 'lucide-react';
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

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showBulkDelete, setShowBulkDelete] = useState(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    const selectedCount = selectedIds.length;
    const allVisibleSelected = !!objects && objects.length > 0 && objects.every((o) => selectedIds.includes(o.id));
    const selectedTypes = objects?.filter((o) => selectedIds.includes(o.id)) ?? [];

    const toggleOne = (id: string, checked: boolean) => {
        setSelectedIds((cur) => (checked ? (cur.includes(id) ? cur : [...cur, id]) : cur.filter((v) => v !== id)));
    };

    const toggleAll = (checked: boolean) => {
        setSelectedIds(checked && objects ? objects.map((o) => o.id) : []);
    };

    const handleBulkDelete = async () => {
        if (isBulkDeleting) return;
        setIsBulkDeleting(true);
        try {
            const results = await Promise.allSettled(selectedIds.map((id) => store.types.delete(id)));
            const failed = results.filter((r) => r.status === 'rejected').length;
            const succeeded = results.length - failed;
            setShowBulkDelete(false);
            setSelectedIds([]);
            reloadTypes();
            await search.search();
            if (failed === 0) {
                toast({
                    status: 'success',
                    title: t('store.actions.typeDeleted', { count: succeeded }),
                    duration: 3000,
                });
            } else {
                toast({
                    status: 'error',
                    title: t('store.actions.typeDeletePartial', { succeeded, failed }),
                    duration: 5000,
                });
            }
        } catch (err: unknown) {
            toast({
                status: 'error',
                title: t('store.actions.failedToDeleteTypes'),
                description: err instanceof Error ? err.message : undefined,
                duration: 5000,
            });
        } finally {
            setIsBulkDeleting(false);
        }
    };

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
            <div className="flex flex-shrink-0 gap-4 items-center">
                <Input placeholder={t('store.filterByName')} value={searchTerm} onChange={setSearchTerm} />
                <SelectBox
                    className="w-60"
                    isClearable
                    options={Object.values(ChunkableOptions)}
                    value={chunkable}
                    onChange={onChunkableChange}
                    placeholder={t('store.isChunkable')}
                />
                {selectedCount > 0 && (
                    <div className="flex items-center gap-2 ms-auto">
                        <span className="text-sm font-medium whitespace-nowrap">
                            {t('store.actions.selectedCount', { n: selectedCount })}
                        </span>
                        <VTooltip description={t('store.actions.clearSelection')} asChild>
                            <Button
                                variant="ghost"
                                aria-label={t('store.actions.clearSelection')}
                                onClick={() => setSelectedIds([])}
                            >
                                <X className="size-4" />
                            </Button>
                        </VTooltip>
                        <Button
                            variant="destructive"
                            isDisabled={isBulkDeleting}
                            onClick={() => setShowBulkDelete(true)}
                        >
                            {isBulkDeleting ? t('store.actions.deleting') : t('store.actions.deleteSelected')}
                        </Button>
                    </div>
                )}
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
                                selectedIds={selectedIds}
                                onToggleOne={toggleOne}
                                allSelected={allVisibleSelected}
                                onToggleAll={toggleAll}
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
                    <ConfirmModal
                        isOpen={showBulkDelete}
                        title={t('store.actions.deleteType', { count: selectedCount })}
                        content={
                            <div>
                                <p>{t('store.actions.deleteTypeConfirm', { count: selectedCount })}</p>
                                {selectedTypes.length > 0 && (
                                    <>
                                        <div className="mt-2">{t('store.actions.affectedItems')}</div>
                                        <ul className="mt-1 max-h-40 overflow-y-auto rounded-md border p-2 text-sm">
                                            {selectedTypes.map((o) => (
                                                <li key={o.id} className="truncate py-0.5">
                                                    {o.name || o.id}
                                                </li>
                                            ))}
                                        </ul>
                                    </>
                                )}
                            </div>
                        }
                        onConfirm={handleBulkDelete}
                        onCancel={() => setShowBulkDelete(false)}
                        confirmationValue="delete"
                        confirmationLabel={t('store.actions.typeToConfirmDelete')}
                        confirmationPlaceholder="delete"
                    />
                </div>
            </div>
        </div>
    );
}
