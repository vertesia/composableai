import { Collection, ContentObjectType } from "@vertesia/common";
import { Button, Panel, useToast } from "@vertesia/ui/core";
import { TagsInput } from "@vertesia/ui/core/components/TagsInput";
import { useUserSession } from "@vertesia/ui/session";
import { useEffect, useState } from "react";

interface SharedPropsEditorProps {
    collection: Collection;
}
export function SharedPropsEditor({ collection }: SharedPropsEditorProps) {

    const { client } = useUserSession();
    const [colType, setColType] = useState<ContentObjectType | undefined>(undefined);
    const [sharedProps, setSharedProps] = useState<string[]>(collection.shared_properties || []);
    const toast = useToast();

    useEffect(() => {
        if (collection.type?.id) {
            client.store.types.retrieve(collection.type.id).then(setColType);
        }
    }, [collection.type?.id]);

    const options: string[] = colType ? Object.keys(colType.object_schema?.properties || {}) : [];

    const onSelect = (selected: string[]) => {
        setSharedProps(selected);
    }

    const onSave = () => {
        client.store.collections.update(collection.id, {
            shared_properties: sharedProps
        }).then(() => {
            // Handle success
            toast({
                title: "Updated shared properties",
                status: "success"
            })
        }).catch((error) => {
            toast({
                title: "Failed to update shared properties",
                description: error.message,
                status: "error"
            })
            // Handle error
        });
    }

    return (
        <Panel title="Shared Properties" action={
            <Button size="lg" isLoading={false} onClick={onSave}>
                Save
            </Button>}
        >
            <div className=''>
                <TagsInput value={sharedProps} onChange={onSelect} options={options} placeholder="Select properties to share" />
            </div>
        </Panel>
    )

}
