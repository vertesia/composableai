import { Collection } from "@vertesia/common";
import { Panel, Switch, useToast } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";
import { useState } from "react";
import { useUITranslation } from '../../../i18n/index.js';

interface SyncMemberHeadsToggleProps {
    collection: Collection;
}
export function SyncMemberHeadsToggle({ collection }: SyncMemberHeadsToggleProps) {

    const { client } = useUserSession();
    const { t } = useUITranslation();
    const [skipHeadSync, setSkipHeadSync] = useState<boolean>(collection.skip_head_sync ?? false);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const toast = useToast();

    const onSaveSkipHeadSync = (enableSyncHeads: boolean) => {
        const skip_head_sync = !enableSyncHeads;
        setIsSaving(true);
        client.store.collections.update(collection.id, {
            skip_head_sync: skip_head_sync
        }).then(() => {
            // Handle success
            toast({
                title: t('store.updatedSkipHeadSync'),
                status: "success"
            })
            setSkipHeadSync(skip_head_sync);
        }).catch((error) => {
            toast({
                title: t('store.failedToUpdateSkipHeadSync'),
                description: error.message,
                status: "error"
            })
            // Handle error
        }).finally(() => {
            setIsSaving(false);
        });
    }

    return (
        <Panel title={t('store.syncMemberHeads')} description={t('store.syncMemberHeadsDescription')}>
            <Switch disabled={isSaving} value={!skipHeadSync} onChange={onSaveSkipHeadSync}>
                {t('store.enableSyncMemberHeads')}
            </Switch>
        </Panel>
    )

}
