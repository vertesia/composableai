import { ErrorBox, useFetch, VSelectBox } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";

interface SelectCollectionProps {
    value?: string; // Collection ID
    onChange: (collectionId: string | undefined, collection?: any) => void;
    disabled?: boolean;
    className?: string;
}

/**
 * A component to select a collection from a list of collections.
 * It fetches the collections from the store and displays them in a dropdown.
 * @param props - The properties for the component.
 * @returns A dropdown to select a collection.
 */
export function SelectCollection({ onChange, value, disabled = false, className }: SelectCollectionProps) {
    const { client } = useUserSession();
    const { data: collections, error } = useFetch(() => client.store.collections.search({ dynamic: false }), []);

    if (error) {
        return <ErrorBox title='Collection fetch failed'>{error.message}</ErrorBox>
    }

    // Find the selected collection object from the ID
    const selectedCollection = value ? collections?.find(col => col.id === value) : undefined;

    const handleChange = (collection: any) => {
        // Call onChange with both the ID and the full collection object
        onChange(collection?.id, collection);
    };

    return (
        <VSelectBox
            filterBy={"name"}
            value={selectedCollection}
            onChange={handleChange}
            placeholder="Select a collection"
            options={collections || []}
            optionLabel={(col: any) => col.name}
            by="id"
            className={className}
            disabled={disabled}
        />
    );
}
