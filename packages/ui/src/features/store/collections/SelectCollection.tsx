import { useCallback } from "react";

import { CollectionItem } from "@vertesia/common";
import { ErrorBox, useFetch, VSelectBox } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";

/**
 * A component to select a collection from a list of collections.
 * It fetches the collections from the store and displays them in a dropdown.
 * @param props - The properties for the component.
 * @returns A dropdown to select a collection.
**/
interface SelectCollectionProps {
    value?: string | string[];
    onChange: (collectionId: string | string[] | undefined, collection?: CollectionItem | CollectionItem[]) => void;
    disabled?: boolean;
    placeholder?: string;
    filterOut?: string[]; // collection ID to filter out from the list
    allowDynamic?: boolean;
    multiple?: boolean;
}

function getLabel(option: CollectionItem) {
    return option.name;
}

export function SelectCollection({ onChange, value, disabled = false, placeholder = "Select a collection", filterOut, allowDynamic = true, multiple = false }: SelectCollectionProps) {
    const { client } = useUserSession();

    // Handle collection selection
    const handleSelect = useCallback((collection: CollectionItem | CollectionItem[] | null) => {
        if (multiple) {
            // Multiple selection mode
            const selectedCollections = collection as CollectionItem[] | null;
            if (selectedCollections && selectedCollections.length > 0) {
                const ids = selectedCollections.map(c => c.id);
                onChange(ids, selectedCollections);
            } else {
                onChange(undefined);
            }
        } else {
            // Single selection mode
            const selectedCollection = collection as CollectionItem | null;
            if (selectedCollection) {
                onChange(selectedCollection.id, selectedCollection);
            } else {
                onChange(undefined);
            }
        }
    }, [onChange, multiple]);

    // Fetch collections
    const { data: collections, error } = useFetch<CollectionItem[]>(async () => {
        const allCollections = await client.store.collections.search({
            dynamic: allowDynamic ? undefined : false
        });
        // Filter out collections if filterOut is provided
        if (filterOut && filterOut.length > 0) {
            return allCollections.filter(col => !filterOut.includes(col.id));
        }
        return allCollections;
    }, [client, allowDynamic, filterOut]);

    if (error) {
        return <ErrorBox title="Error">{error.message || String(error)}</ErrorBox>;
    }

    // Find the selected collection(s) from the value (collection ID(s))
    const selectedCollection = multiple
        ? collections?.filter(col => Array.isArray(value) && value.includes(col.id)) || []
        : collections?.find(col => col.id === value) || null;

    return (
        multiple ? (
            <VSelectBox<CollectionItem>
                className="w-full"
                by="id"
                value={selectedCollection as CollectionItem[]}
                filterBy="name"
                options={collections || []}
                disabled={disabled}
                optionLabel={(option: CollectionItem) => getLabel(option)}
                placeholder={placeholder}
                onChange={handleSelect as (collection: CollectionItem[] | null) => void}
                isClearable
                multiple={multiple}
            />
        ) : (
            <VSelectBox<CollectionItem>
                className="w-full"
                by="id"
                value={selectedCollection as CollectionItem}
                filterBy="name"
                options={collections || []}
                disabled={disabled}
                optionLabel={(option: CollectionItem) => getLabel(option)}
                placeholder={placeholder}
                onChange={handleSelect as (collection: CollectionItem | null) => void}
                isClearable
                multiple={multiple}
            />
        )
    );
}