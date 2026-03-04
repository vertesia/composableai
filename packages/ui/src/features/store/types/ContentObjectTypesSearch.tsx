import { useEffect, useRef, useState } from "react";

import { ContentObjectTypesTable } from "./ContentObjectTypesTable";
import { useWatchSearchResult } from "./search/ObjectTypeSearchContext";

import { EmptyCollection, ErrorBox, Input, SelectBox, useDebounce, useIntersectionObserver, useToast } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";
import { useTypeRegistry } from "./TypeRegistryProvider.js";

import { CreateOrUpdateTypeModal, CreateOrUpdateTypePayload } from "./CreateOrUpdateTypeModal";

enum ChunkableOptions { true = "Yes", false = "No" };

interface ContentObjectTypesSearchProps {
    isDirty?: boolean;
}
export function ContentObjectTypesSearch({ isDirty = false }: ContentObjectTypesSearchProps) {
    const { store } = useUserSession();
    const { reload: reloadTypes } = useTypeRegistry();

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
            <ErrorBox title="Failed to fetch ObjectTypes">{error.message}</ErrorBox>
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
                title: "Type created",
                duration: 2000
            });
            reloadTypes();
            search.search().then(() => setIsReady(true));
        }).catch(err => {
            toast({
                status: "error",
                title: "Error creating type",
                description: err.message,
                duration: 5000
            });
        });
    };

    return (
        <div className="flex flex-col gap-4 h-full">
            <div className="flex flex-shrink-0 gap-4">
                <Input placeholder="Filter by Name" value={searchTerm} onChange={setSearchTerm} />
                <SelectBox className="w-60" isClearable options={Object.values(ChunkableOptions)} value={chunkable} onChange={onChunkableChange} placeholder={"Is Chunkable"} />
            </div>
            <div className="flex-1 overflow-y-auto">
                {
                    (!isLoading && objects?.length === 0) ? (
                        <EmptyCollection title="No Type" buttonLabel="Create Type" onClick={onOpenCreateModal}>
                            Get started by creating a new Type.
                        </EmptyCollection >
                    ) : (
                        <ContentObjectTypesTable objects={objects} isLoading={isLoading} />
                    )
                }
                <CreateOrUpdateTypeModal okLabel="Create" title="Create Type" isOpen={showCreateModal} onClose={onCloseCreateModal} />
            </div>
        </div>
    )
}
