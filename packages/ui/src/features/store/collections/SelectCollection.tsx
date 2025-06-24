import { ErrorBox, useFetch, VSelectBox } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session/UserSession";

interface SelectCollectionProps {
    value: any;
    onChange: (collection: any) => void;
}

/**
 * A component to select a collection from a list of collections.
 * It fetches the collections from the store and displays them in a dropdown.
 * @param props - The properties for the component.
 * @returns A dropdown to select a collection.
 */
export function SelectCollection({ onChange, value }: SelectCollectionProps) {
    const { client } = useUserSession();
    const { data: collections, error } = useFetch(() => client.store.collections.list({ dynamic: false }), []);

    if (error) {
        return <ErrorBox title='Collection fetch failed'>{error.message}</ErrorBox>
    }
    return (
        <VSelectBox
            filterBy={"name"}
            value={value}
            onChange={onChange}
            placeholder="Select a collection"
            options={collections || []}
            optionLabel={(col: any) => col.name}
            by="id"
            className="mb-4"
        />
    );
}
