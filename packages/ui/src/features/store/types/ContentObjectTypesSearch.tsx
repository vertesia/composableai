import { useEffect, useRef, useState } from "react";

import { ContentObjectTypesTable } from "./ContentObjectTypesTable";
import { useWatchSearchResult } from "./search/ObjectTypeSearchContext";

import { EmptyCollection, ErrorBox, Input, SelectBox, useDebounce, useIntersectionObserver, useToast } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";
import { useTypeRegistry } from "./TypeRegistryProvider.js";
import { useUITranslation } from '../../../i18n/index.js';

import { CreateOrUpdateTypeModal, CreateOrUpdateTypePayload } from "./CreateOrUpdateTypeModal";

enum ChunkableOptions { true = "Yes", false = "No" };

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

    const [searchTerm, setSearchTerm] = useState<string>("");
    const debounceValue = useDebounce(searchTerm, 500);

    const loadMoreRef = useRef<HTMLDivElement>(null);
    useIntersectionObserver(loadMoreRef, () => {
        isReady && search.loadMore();
    }, { deps: [isReady] });

    useEffect(() => {
        search.search()
            .then(() => setIsReady(true));
    }, []);

    useEffect(() => {
        search.query.name = searchTerm;
        search.search()
            .then(() => setIsReady(true));
    }, [debounceValue]);

    const [chunkable, setChunkable] = useState(undefined);
    const onChunkableChange = (data: any) => {
        setChunkable(data);
    };

    useEffect(() => {
        search.query.chunkable = chunkable ? chunkable == "Yes" : undefined
        search.search()
            .then(() => setIsReady(true));
    }, [chunkable]);

    useEffect(() => {
        if (isDirty && isReady) {
            search.search().then(() => setIsReady(true));
        }
    }, [isDirty]);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const onOpenCreateModal = () => {
        setShowCreateModal(true);
    };

    if (error) {
        return (
            <ErrorBox title={t('store.failedToFetchTypes')}>{error.message}</ErrorBox>
        );
    };

    const onCloseCreateModal = async (payload?: CreateOrUpdateTypePayload) => {
        if (!payload) {
            setShowCreateModal(false);
            return Promise.resolve();
        }
        return store.types.create(payload).then(async () => {
            toast({
                status: "success",
                title: t('store.typeCreated'),
                duration: 2000
            });
            reloadTypes();
            search.search().then(() => setIsReady(true));
        }).catch(err => {
            toast({
                status: "error",
                title: t('store.errorCreatingType'),
                description: err.message,
                duration: 5000
            });
        });
    };

    return (
        <div className="flex flex-col gap-4 h-full">
            <div className="flex flex-shrink-0 gap-4">
                <Input placeholder={t('store.filterByName')} value={searchTerm} onChange={setSearchTerm} />
                <SelectBox className="w-60" isClearable options={Object.values(ChunkableOptions)} value={chunkable} onChange={onChunkableChange} placeholder={t('store.isChunkable')} />
            </div>
            <div className="flex flex-col w-full flex-1 min-h-0 border rounded-md my-2">
                <div className="flex-1 min-h-0 overflow-y-auto">
                    {
                        (!isLoading && objects?.length === 0) ? (
                            <EmptyCollection title={t('store.noType')} buttonLabel={t('store.createType')} onClick={onOpenCreateModal}>
                                {t('store.getStartedTypes')}
                            </EmptyCollection >
                        ) : (
                            <ContentObjectTypesTable objects={objects} isLoading={isLoading} />
                        )
                    }
                    <div ref={loadMoreRef} className="h-4 w-full" />
                    <CreateOrUpdateTypeModal okLabel="Create" title={t('store.createType')} isOpen={showCreateModal} onClose={onCloseCreateModal} />
                </div>
            </div>
        </div>
    )
}
