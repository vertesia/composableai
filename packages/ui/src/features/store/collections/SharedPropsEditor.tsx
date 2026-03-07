import { Collection, ContentObjectType } from "@vertesia/common";
import { Button, Panel, TagsInput, useToast } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";
import { useEffect, useState } from "react";
import { useUITranslation } from '../../../i18n/index.js';

interface SharedPropsEditorProps {
    collection: Collection;
}
export function SharedPropsEditor({ collection }: SharedPropsEditorProps) {

    const { client } = useUserSession();
    const { t } = useUITranslation();
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
                title: t('store.updatedSharedProperties'),
                status: "success"
            })
        }).catch((error) => {
            toast({
                title: t('store.failedToUpdateSharedProperties'),
                description: error.message,
                status: "error"
            })
            // Handle error
        });
    }

    return (
        <Panel title={t('store.sharedProperties')} description={t('store.sharedPropertiesDescription')}
            action={
                <Button size="lg" isLoading={false} onClick={onSave}>
                    {t('modal.save')}
                </Button>}
        >
            <div className=''>
                <TagsInput value={sharedProps} onChange={onSelect} options={options} placeholder={t('store.selectPropertiesToShare')} />
            </div>
        </Panel>
    )

}
