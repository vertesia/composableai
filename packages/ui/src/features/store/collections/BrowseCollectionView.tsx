import { Collection, getContentTypeRefId } from "@vertesia/common";
import { useToast } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";
import { TypeRegistry } from "../types/TypeRegistry.js";
import { useTypeRegistry } from "../types/TypeRegistryProvider.js";
import { DocumentSearchResults, DocumentSearchResultsWithDropZone } from "../objects/DocumentSearchResults";


interface BrowseCollectionViewProps {
    collection: Collection;
}
export function BrowseCollectionView({ collection }: BrowseCollectionViewProps) {
    const toast = useToast();
    const { client } = useUserSession();
    const { registry: typeRegistry } = useTypeRegistry();

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
        return undefined;
    }
}