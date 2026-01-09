import { useUserSession, useTypeRegistry, TypeRegistry } from "@vertesia/ui/session";
import { Collection } from "@vertesia/common";
import { DocumentSearchResultsWithDropZone, DocumentSearchResults } from "../objects/DocumentSearchResults";
import { useToast } from "@vertesia/ui/core";
import { useDocumentSearch } from "../objects/search/DocumentSearchContext";


interface BrowseCollectionViewProps {
    collection: Collection;
}
export function BrowseCollectionView({ collection }: BrowseCollectionViewProps) {
    const toast = useToast();
    const { client } = useUserSession();
    const typeRegistry = useTypeRegistry();
    const search = useDocumentSearch();
    search.query.all_revisions = true;

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
        table_layout = typeRegistry?.getTypeLayout(collection.type.id);
    }
    if (table_layout && table_layout.length > 0) {
        return table_layout;
    } else {
        return undefined;
    }
}