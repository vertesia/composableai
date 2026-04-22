import { Collection, getContentTypeRefId, ColumnLayout } from "@vertesia/common";
import { useToast } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";
import { useEffect, useRef } from "react";
import { TypeRegistry } from "../types/TypeRegistry.js";
import { useTypeRegistry } from "../types/TypeRegistryProvider.js";
import { DocumentSearchResults, DocumentSearchResultsWithDropZone } from "../objects/DocumentSearchResults";
import { useDocumentSearch } from "../objects/search/DocumentSearchContext";

const collectionDefaultLayout: ColumnLayout[] = [
    { name: "ID", field: "id", type: "objectId?slice=-7" },
    { name: "Name", field: ".", type: "objectName" },
    { name: "Revision", field: ".", type: "revision" },
    { name: "Type", field: "type.name", type: "string" },
    { name: "Status", field: "status", type: "string" },
    { name: "Updated At", field: "updated_at", type: "date" },
];


interface BrowseCollectionViewProps {
    collection: Collection;
}
export function BrowseCollectionView({ collection }: BrowseCollectionViewProps) {
    const toast = useToast();
    const { client } = useUserSession();
    const { registry: typeRegistry } = useTypeRegistry();
    const search = useDocumentSearch();

    // Update dynamic collection results when the query changes.
    const querySignature = collection?.dynamic ? JSON.stringify(collection.query ?? {}) : null;
    const prevCollectionRef = useRef<Collection | undefined>(undefined);
    useEffect(() => {
        const prev = prevCollectionRef.current;
        if (prev !== collection) {
            // eslint-disable-next-line no-console
            console.log('[COLLECTION_PROP] BrowseCollectionView received new collection prop', {
                old_value: prev ? { id: prev.id, query: prev.query, dynamic: prev.dynamic } : null,
                new_value: collection ? { id: collection.id, query: collection.query, dynamic: collection.dynamic } : null,
            });
            prevCollectionRef.current = collection;
        }
    });

    const isFirstRun = useRef(true);
    const prevSignatureRef = useRef<string | null>(null);
    useEffect(() => {
        if (querySignature === null) return;
        const prev = prevSignatureRef.current;
        if (isFirstRun.current) {
            isFirstRun.current = false;
            prevSignatureRef.current = querySignature;
            // eslint-disable-next-line no-console
            console.log('[SEARCH_QUERY_INIT] BrowseCollectionView first mount; deferring to DocumentSearchResults initial fetch', {
                old_value: null,
                new_value: JSON.parse(querySignature),
            });
            return;
        }
        // eslint-disable-next-line no-console
        console.log('[SEARCH_QUERY_CHANGE] Dynamic collection query changed; calling search.reset() + search.search()', {
            old_value: prev ? JSON.parse(prev) : null,
            new_value: JSON.parse(querySignature),
        });
        prevSignatureRef.current = querySignature;
        search.reset();
        void search.search();
    }, [querySignature, search]);

    const onUploadDone = async (objectIds: string[]) => {
        if (objectIds.length > 0) {
            await client.store.collections.addMembers(collection.id, objectIds).catch(err => {
                toast({
                    title: 'Failed to add objects to collection',
                    description: err.message,
                    status: 'error'
                })
            });
        }
    }
    const tableLayout = getTableLayout(collection, typeRegistry);
    return collection.dynamic ? (
        <DocumentSearchResults layout={tableLayout} />
    ) : (
        <DocumentSearchResultsWithDropZone onUploadDone={onUploadDone} layout={tableLayout} />
    )
}

function getTableLayout(collection: Collection, typeRegistry?: TypeRegistry | undefined) {
    let table_layout = collection.table_layout;
    if (table_layout && table_layout.length > 0) {
        return table_layout;
    }
    if (collection.type && typeRegistry) {
        table_layout = typeRegistry?.getTypeLayout(getContentTypeRefId(collection.type));
    }
    if (table_layout && table_layout.length > 0) {
        return table_layout;
    } else {
        return collectionDefaultLayout;
    }
}